# Connexy Phase 1 Report — Thin Vertical Slice

## Status
- **Phase:** 1 — Thin Vertical Slice (Workflow A, mocked model)
- **Date:** 2026-06-24
- **Status:** COMPLETE (gate passed)

## What was built

### Frontend (Cloudflare Pages + React)
- **Intent Capture Page** — user describes outcome in plain language, selects workflow type (MES-to-Machine or KPI Dashboard), with example prompts
- **Connectors Page** — add read-only connectors (metadata-file, SAP, Opcenter, PI), view ingested metadata objects, start discovery
- **Discovery Page** — live event stream (Discovery Console), stage progress bar (plan→ingest→classify→map→model→score→review), polling for workflow state
- **Review Workspace** — tabbed review (mappings/gaps/models), accept/reject individual mappings, bulk accept, evidence drawer, confidence chips
- **Export Page** — generate validation-ready packages, view model cost breakdown by tier, download packages
- **Projects Page** — dashboard listing all projects with status badges, click to navigate to appropriate workflow stage
- **Semantic Model Graph** — SVG node-link graph, indigo for AI-proposed, cyan for approved, dashed alert for gaps
- **Lineage Explorer** — left-to-right source→transform→target flow
- **Design system** — all tokens from §5 implemented (dark-first, signal cyan, electric indigo, confidence scale, mono for machine truth, blueprint grid, hairline borders, 4-6px corners)

### Backend (Cloudflare Workers + Workflows)
- **Discovery Workflow** enhanced:
  - Plan stage: heuristic intent parser extracts requirements from plain language
  - Ingest stage: scans connectors (metadata-file fixtures with 4 PLC tags)
  - Classify stage: categorizes objects (production-count, machine-state, etc.)
  - Map stage: matches objects to requirements by category + name, computes confidence, builds evidence trail
  - Model stage: generates semantic model with entities
  - Score stage: detects gaps (low-confidence mappings), moves project to review
  - Review stage: marks ready for human approval
- **API routes** for all CRUD operations on projects, connectors, mappings, gaps, models, exports, workflow state, cost
- **Queue consumer** for export generation → R2

### Tests
- **E2E Workflow A test** (3 tests): full pipeline from ingest through export against fixtures
- **Audit chain integrity test** (4 tests): hash-chaining, retrieval, verification, tamper detection
- **Read-only safety suite** (21 tests): all connectors assert canWrite: false
- **Connector tests** (5 tests): fixture objects, normalizer, deduplication
- **AI engine tests** (6 tests): cost computation, residency assertion, confidence calibration
- **Total: 39 tests passing**
- **Frontend build: passing** (Vite → dist, 58 modules)

## Gate Result: PASS
- Human can run Workflow A end-to-end in the UI against fixtures: YES
  - Create project → add connector → run discovery → review mappings → export
- Recommendations carry confidence + evidence: YES
- Humans can accept/edit/reject: YES (individual + bulk)
- Validation-ready package exports: YES (generates JSON package to R2)
- All tests green: YES (39/39)
- Frontend builds: YES

## Prime Directive Adherence
- PD1 (Read-only): 21-test safety suite + structural enforcement
- PD2 (Human-in-the-loop): All mappings start as "proposed"; no auto-accept
- PD3 (Evidence + confidence): Every mapping has evidence array + calibrated confidence
- PD4 (Auditable): Hash-chained audit log with tamper detection test
- PD5 (Data residency): Model router residency assertion
- PD6 (Cost-disciplined): Per-call cost tracking, export page shows cost by tier
- PD8 (Cloudflare): Workers + Workflows + Pages + D1 + R2 + DO + KV + Queues
- PD9 (No fabrication): All connectors are fixture-based, flagged in open-questions

## Open Questions
No new blockers. Existing open questions remain (Mistral API key, CF account IDs, SSO provider, pricing).

## Next: Phase 2 — Real AI Layer
- Swap mock for Mistral tiered routing via AI Gateway
- Real structured outputs with JSON schema validation
- Confidence calibration with real acceptance data
- Gap detection with real model calls
- Embeddings into Vectorize for semantic search
- AI eval harness (mapping precision ≥ 90%, gap recall ≥ 85%)