# Connexy — System Architecture

## 1. Overview

Connexy is a manufacturing data discovery, mapping, and semantic-modeling platform built on the **Cloudflare developer platform**. It ingests read-only metadata from ERP/MES/historian/SCADA/machine systems, uses tiered Mistral AI to recommend mappings and generate semantic models, and produces validation-ready documentation — all human-in-the-loop.

## 2. Topologies

| Topology | Compute | AI | Data | Use Case |
|---|---|---|---|---|
| **Managed Cloud** (primary) | Cloudflare Workers + Workflows | AI Gateway → Mistral (EU) | D1, Vectorize, R2, DO, KV | Default; fastest to deploy |
| **Customer VPC** | Containerized data plane | In-boundary self-hosted Mistral (vLLM/SGLang) | Postgres + pgvector + S3-compatible | Data residency; EU VPC |
| **On-Prem (air-gapped)** | On-prem agent (container) | In-boundary self-hosted Mistral (Ollama) | Local Postgres + vector DB | Air-gapped sites |

All three share the same business logic. Cloudflare-specific access is behind thin adapters (`@connexy/data` interfaces) so the data plane is portable.

## 3. C4 — Component View

```
┌─────────────────────────────────────────────────────────────────┐
│                     Cloudflare (Managed Cloud)                    │
│                                                                   │
│  ┌──────────┐     ┌──────────────────────────────────────────┐   │
│  │  Pages   │────▶│  Workers (API Gateway — Hono)             │   │
│  │ (React)  │     │  ┌─────────────────────────────────────┐  │   │
│  └──────────┘     │  │  Workflows (Discovery Pipeline)     │  │   │
│                   │  │  plan→ingest→classify→map→model→   │  │   │
│                   │  │  score→review→export                 │  │   │
│                   │  └─────────────────────────────────────┘  │   │
│                   │  ┌──────────┐ ┌──────────┐ ┌───────────┐  │   │
│                   │  │ Queues   │ │ Durable  │ │ AI Gateway│  │   │
│                   │  │ (stages) │ │ Objects  │ │ →Mistral  │  │   │
│                   │  └────┬─────┘ │ (audit,  │ └─────┬─────┘  │   │
│                   └───────┼───────│ coord)   │───────┼────────┘   │
│                           │       └──────────┘       │            │
│                   ┌───────▼───┐ ┌──────────┐ ┌───────▼────┐       │
│                   │  D1 (DB) │ │ Vectorize│ │  R2 (exports)│      │
│                   └──────────┘ └──────────┘ └─────────────┘       │
│                                                                   │
│                   ┌─────────────────────────────────────┐        │
│                   │  Connector Adapters (Workers)        │        │
│                   │  [SAP] [Opcenter] [PI] [File] ...     │        │
│                   │  READ-ONLY (no write methods)        │        │
│                   └─────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

## 4. Service Boundaries

| Service | Cloudflare Primitive | Responsibility |
|---|---|---|
| API Gateway | Workers (Hono) | HTTP routing, auth, tenant isolation, RBAC |
| Discovery Pipeline | Workflows | Durable multi-step orchestration (plan→export) |
| Stage Hand-off | Queues | Async, at-least-once between stages |
| Relational Store | D1 | Projects, connectors, mappings, models, gaps |
| Vector Index | Vectorize | Metadata embeddings for semantic search |
| Object Storage | R2 | Export packages, large metadata blobs |
| Audit Log | Durable Object | Append-only, hash-chained audit entries |
| Project Coordination | Durable Object | Per-project workflow state, events |
| Config/Sessions | KV | Hot-read config, session tokens |
| Model Router | AI Gateway → Mistral | Tiered model access with cost telemetry |

## 5. Event Catalogue

| Event | Stage | Emitted By | Consumed By |
|---|---|---|---|
| `workflow.started` | plan | Workflow | Coordinator DO |
| `ingest.completed` | ingest | Connector adapter | Workflow step |
| `classify.completed` | classify | AI engine | Workflow step |
| `map.proposed` | map | AI engine | D1 + Coordinator DO |
| `model.generated` | model | AI engine | D1 + Coordinator DO |
| `gap.detected` | score | AI engine | D1 + Coordinator DO |
| `review.requested` | review | Workflow | Frontend (SSE/poll) |
| `export.ready` | export | Queue consumer | R2 + D1 |
| `audit.appended` | any | Audit middleware | Audit DO |

## 6. Data Residency Enforcement

- **Managed Cloud:** AI Gateway pinned to Mistral EU endpoint. D1/Vectorize/R2 in EU region.
- **VPC/On-Prem:** Model router routes to in-boundary self-hosted Mistral. No metadata crosses boundary.
- **Enforcement point:** `assertDataResidency()` in the model router boundary. Tested in CI.

## 7. Prime Directive Gates

| Directive | Gate | Enforcement |
|---|---|---|
| Read-only at source | No write methods on connector interface | Structural + test suite |
| Human-in-the-loop | No auto-apply; all proposals require accept/reject | API + UI |
| Evidence + confidence | Schema requires min 1 evidence + confidence 0-1 | JSON Schema validation |
| Auditable | Hash-chained DO audit log | Chain verification test |
| Data residency | Model router residency assertion | Integration test |
| Cost-disciplined | Per-call cost telemetry + per-project spend cap | CI metric check |