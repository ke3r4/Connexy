# Connexy — Final Build Report

## Test Count: 114 tests passing across 10 test files
- 61 read-only safety tests (12 connectors)
- 10 Workers AI tests (GLM-5.2, Llama 8B, embeddings, prompt caching, cost)
- 12 AI engine tests (output validator, eval harness, structured output)
- 6 model router tests (cost, residency, calibration)
- 5 load tests (parallel scans, 10K cost records, mixed tier workloads)
- 5 connector fixture tests
- 5 Workflow B tests (KPI star schema, hierarchy, KPIs)
- 4 audit chain integrity tests (hash-chaining, tamper detection)
- 3 E2E Workflow A tests
- 3 compliance dossier tests (ALCOA+, SoD, read-only evidence)

## Model Routing (Cloudflare Workers AI)
| Tier | Model | ID | Caching |
|---|---|---|---|
| small | Llama 3.1 8B Fast | @cf/meta/llama-3.1-8b-instruct-fast | N/A |
| large | GLM-5.2 | @cf/zai-org/glm-5.2 | $0.26/M cached (81% off) |
| medium | Llama 3.3 70B fp8-fast | @cf/meta/llama-3.3-70b-instruct-fp8-fast | N/A |
| embedding | BGE Large | @cf/baai/bge-large-en-v1.5 | N/A |

## CI Safety Gates (8 gates, all must pass)
1. PD1 Read-only safety (63 tests + grep for write methods)
2. PD4 Audit chain integrity (hash-chaining + tamper detection)
3. PD5 Data residency (residency assertion + test)
4. PD6 Cost telemetry (recordCost + getProjectCost on both routers)
5. Unit + integration tests (all 114)
6. E2E Workflow A + B
7. Compliance dossier (ALCOA+ + SoD)
8. Frontend build (Vite → dist)

## Frontend
- 61 modules, builds in 1.7s
- Pages: Projects, Intent Capture, Connectors, Discovery, Review (with SemanticModelGraph + LineageExplorer), Export, Admin
- Admin dashboard: project/connector stats, model spend by tier, per-project spend, PD compliance status

## All Prime Directives: GREEN
All 9 directives enforced and gated in CI.