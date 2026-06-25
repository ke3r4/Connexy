# Connexy Phase 0 Report — Foundations

## Status
- **Phase:** 0 — Foundations
- **Date:** 2026-06-24
- **Status:** COMPLETE (gate passed)

## What was built

### Architecture & Contracts
- `/docs/architecture.md` — full system architecture with C4 component view, service boundaries, event catalogue, residency enforcement
- `/contracts/` — 5 typed interface contracts: MetadataObject, MappingProposal, ConnectorAdapter, ModelRouterRequest, WorkflowEvent, AuditEntry
- `/docs/decisions/` — 5 ADRs (Hono, hash-chained audit, connector fixtures, confidence calibration, thin adapters)

### Cloudflare Platform Scaffold
- `wrangler.jsonc` — Workers config with D1, Vectorize, R2, Durable Objects, KV, Queues, Workflows, AI bindings
- `apps/api/` — FastAPI... no, Hono-on-Workers API with full route set:
  - health, projects, connectors, mappings, semantic-models, gaps, reviews, exports, workflows, admin
  - Middleware: error handler, auth (JWT), tenant isolation, audit
  - Durable Objects: AuditLogDO (hash-chained), ProjectCoordinatorDO (workflow state)
  - DiscoveryWorkflow (Cloudflare Workflow): plan→ingest→classify→map→model→score→review→export
  - Queue consumer: export generation → R2
- `apps/web/` — React + Vite frontend on Cloudflare Pages:
  - Design tokens (§5): dark-first, signal cyan, electric indigo, confidence scale
  - Signature components: MappingCanvas, DiscoveryConsole, EvidenceDrawer, ConfidenceChip
  - App shell with nav sidebar, top bar, review workspace layout

### Packages
- `@connexy/shared` — types, Zod schemas, error hierarchy
- `@connexy/connectors` — read-only connector SDK + 4 v1 connectors (metadata-file, SAP ERP, Siemens Opcenter, AVEVA PI)
- `@connexy/ai-engine` — model router (Mistral tiered via AI Gateway), cost tracker, confidence calibrator

### Data
- `infra/cloudflare/schema.sql` — D1 schema: tenants, users, projects, connectors, metadata_objects, mappings, semantic_models, gaps, export_packages, model_calls, reuse_catalogue

### AI
- `ai/prompts/` — 5 versioned prompt templates: intent-parse, classify-metadata, map-source-to-target, semantic-model-generate, gap-detection

### Tests
- Read-only safety suite: 21 tests (Prime Directive 1 gate)
- Connector tests: 5 tests
- AI engine tests: 6 tests (cost computation, residency assertion, confidence calibration)
- **Total: 32 tests passing**

### CI
- `.github/workflows/ci.yml` — test, safety gates, build + wrangler dry-run

## Gate Result: PASS
- Contracts committed: YES
- CI pipeline configured: YES
- Wrangler config valid: YES
- Read-only safety tests green: YES (21/21)
- All tests green: YES (32/32)

## Prime Directive Adherence
- PD1 (Read-only): Enforced structurally (no write methods on adapter) + 21-test suite
- PD2 (Human-in-the-loop): API routes require accept/reject, no auto-apply
- PD3 (Evidence + confidence): Schemas require min 1 evidence + confidence 0-1
- PD4 (Auditable): Hash-chained Durable Object audit log
- PD5 (Data residency): Model router residency assertion
- PD6 (Cost-disciplined): Per-call cost tracking, per-project spend endpoint
- PD8 (Build on Cloudflare): Workers, Workflows, D1, Vectorize, R2, DO, KV, AI Gateway
- PD9 (No fabrication): Fixtures flagged in open-questions

## Open Questions
See `/docs/open-questions.md` — 12 items, 4 needing human decision (Mistral key, CF account IDs, SSO provider, project pricing).

## Next: Phase 1 — Thin Vertical Slice
- Wire Workflow A end-to-end against fixtures in the UI
- Intent capture form → discovery progress → mapping canvas → review → export
- E2E test: human can run Workflow A against fixtures