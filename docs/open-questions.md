# Open Questions

> Questions that need a human decision or external verification. Do not silently work around these.

## P0 — Blockers (none currently)

## P1 — Needs Human Decision

1. **Mistral API access.** Do we have a Mistral API key and AI Gateway ID for dev/staging? The model router is built but cannot make real calls without credentials. Currently in mock/fixture mode.
2. **Cloudflare account + resource IDs.** The `wrangler.jsonc` uses placeholder IDs (`local-dev-db`, etc.). Need real D1 database IDs, Vectorize index name, R2 bucket name, and AI Gateway ID for staging/prod.
3. **SSO provider.** Which IdP will tenants use? OIDC (Okta/AzureAD) vs SAML? The auth middleware supports JWT; need the specific provider config.
4. **Project pricing.** The "per-project model spend < 3% of project price" KPI requires knowing the project price. What is the per-project price point for the cost cap?

## P2 — Verification Needed (Cloudflare docs may be stale)

5. **D1 10GB cap.** Verify current D1 database size limit. If exceeded, sharding strategy needed. Record in `/docs/decisions/`.
6. **Vectorize metadata filtering.** Verify Vectorize supports the metadata filtering we rely on for connector/tenant scoping.
7. **Workflow step limits.** Verify max steps and duration for Cloudflare Workflows. Our pipeline has 7 steps — should be fine, but confirm.
8. **AI Gateway caching.** Verify whether AI Gateway supports response caching (could reduce Mistral costs further).
9. **Durable Object storage limits.** Verify per-DO storage limit for the audit log. If exceeded, need offload to R2.

## P3 — Deferred to Later Phases

10. **Live connector APIs.** SAP OData, Siemens Opcenter REST, AVEVA PI Web API specs need verification before Phase 4. Currently building against fixtures.
11. **Batch/async Mistral API.** Verify Mistral batch API (50% off) for non-interactive runs. Build in Phase 2.
12. **Self-hosted Mistral swap path.** vLLM/SGLang/Ollama config for VPC/on-prem. Build in Phase 5.