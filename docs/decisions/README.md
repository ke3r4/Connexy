# Decisions

## 2026-06-24 — D001: Hono as HTTP framework on Workers
**Context:** Need a lightweight HTTP router on Cloudflare Workers.
**Decision:** Use Hono — Workers-native, minimal overhead, middleware support.
**Status:** Accepted.

## 2026-06-24 — D002: Hash-chained audit log in Durable Objects
**Context:** Prime Directive 4 requires immutable, append-only audit log with tamper-evidence.
**Decision:** Store audit entries in a per-tenant Durable Object with SHA-256 hash chaining (each entry references prevHash). Verification endpoint reconstructs the chain.
**Status:** Accepted.

## 2026-06-24 — D003: Connector fixtures for Phase 1
**Context:** Live connector APIs (SAP, Opcenter, PI) unavailable during initial build.
**Decision:** Build connectors against interface + realistic fixtures per Prime Directive 8. Flag in open-questions. Live API integration deferred to Phase 4.
**Status:** Accepted.

## 2026-06-24 — D004: In-memory confidence calibration (Phase 1)
**Context:** Confidence calibration requires tracking predicted-vs-actual acceptance over time.
**Decision:** Start with in-memory calibrator; persist calibration data to D1 in Phase 2 when real AI calls begin.
**Status:** Accepted.

## 2026-06-24 — D005: Thin adapter for Cloudflare-specific access
**Context:** Data plane must be portable to containers (VPC/on-prem).
**Decision:** All Cloudflare-specific bindings (D1, Vectorize, R2, DO, KV) accessed through thin adapter interfaces in `@connexy/data`. Business logic depends on interfaces, not bindings.
**Status:** Accepted. To be implemented in `@connexy/data` package.