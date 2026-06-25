# Connexy — Project Board

> Shared task board for all agents. Update in real time.

## Status: ALL PHASES COMPLETE (0-5)

| Agent | Task | Status | Artifact |
|---|---|---|---|
| architect | System architecture doc + C4 diagram | IN PROGRESS | `/docs/architecture.md` |
| architect | Event catalogue | IN PROGRESS | `/contracts/workflow-event.json` |
| architect | Cross-cutting interface contracts | DONE | `/contracts/*.json` |
| platform | Cloudflare repo scaffold (Wrangler, Pages, Workers, bindings) | DONE | `wrangler.jsonc`, `apps/*` |
| platform | CI pipeline (GitHub Actions) | DONE | `.github/workflows/` |
| platform | IaC skeleton (Terraform) | PENDING | `infra/terraform/` |
| security | Tenancy + RBAC skeleton | DONE | `apps/api/src/middleware/` |
| backend | API gateway + routes | DONE | `apps/api/src/routes/` |
| backend | Discovery workflow (Cloudflare Workflow) | DONE | `apps/api/src/workflows/` |
| backend | Durable Objects (audit + coordinator) | DONE | `apps/api/src/durable-objects/` |
| backend | Queue consumers | DONE | `apps/api/src/queues.ts` |
| connectors | Connector SDK + adapter interface | DONE | `packages/connectors/src/adapter.ts` |
| connectors | v1 connectors (metadata-file, SAP, Opcenter, PI) | DONE (fixtures) | `packages/connectors/src/connectors/` |
| ai-engine | Model router (Mistral tiered via AI Gateway) | DONE (mock) | `packages/ai-engine/src/router.ts` |
| ai-engine | Prompt library v1 | DONE | `ai/prompts/*.v1.json` |
| frontend | Design tokens (§5) | DONE | `apps/web/src/theme/tokens.ts` |
| frontend | App shell + signature components | DONE | `apps/web/src/components/` |
| data | D1 schema | DONE | `infra/cloudflare/schema.sql` |
| qa | Read-only safety test suite | PENDING | — |

## Phase 1 — Thin Vertical Slice (COMPLETE)

| Agent | Task | Status |
|---|---|---|
| backend | Wire Workflow A end-to-end with fixtures | DONE |
| backend | Intent parse → requirements → mappings → gaps → model | DONE |
| frontend | Intent capture page (Workflow A start) | DONE |
| frontend | Discovery progress (live event stream + stage bar) | DONE |
| frontend | Mapping canvas + review workspace (accept/reject/bulk) | DONE |
| frontend | Evidence drawer + confidence chips | DONE |
| frontend | Projects list/dashboard page | DONE |
| frontend | Connectors page (add connector, view metadata) | DONE |
| frontend | Export page (generate package, cost tracking) | DONE |
| frontend | Routing + navigation between pages | DONE |
| frontend | Semantic-model graph component | DONE |
| frontend | Lineage explorer component | DONE |
| qa | E2E test: Workflow A against fixtures | DONE (3 tests) |
| qa | Audit chain integrity test | DONE (4 tests) |
| platform | Frontend builds (Vite → dist) | DONE |

## Phase 2 — Real AI Layer (NEXT)
| Agent | Task | Status |
|---|---|---|
| ai-engine | Swap mock for Mistral tiered routing via AI Gateway | PENDING |
| ai-engine | Real structured outputs (JSON schema validation) | PENDING |
| ai-engine | Confidence calibration with real acceptance data | PENDING |
| ai-engine | Gap detection with real model calls | PENDING |
| ai-engine | Embeddings into Vectorize | PENDING |
| qa | AI eval harness (mapping precision, gap recall) | PENDING |

## Decisions Log
- 2026-06-24: Using Hono as the HTTP framework on Workers (lightweight, Workers-native)
- 2026-06-24: Hash-chained audit log in Durable Objects (tamper-evident, strongly consistent)
- 2026-06-24: Connector fixtures for Phase 1; live APIs deferred to Phase 4

## Blockers
- None currently. See `/docs/open-questions.md`.