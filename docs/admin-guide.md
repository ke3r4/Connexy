# Connexy — Admin Guide

## User Roles & Permissions

| Role | Create Project | Add Connector | Run Discovery | Accept/Reject | Export | Manage Users | View Audit |
|---|---|---|---|---|---|---|---|
| admin | Y | Y | Y | Y | Y | Y | Y |
| architect | Y | Y | Y | Y | Y | N | N |
| engineer | Y | Y | Y | N | N | N | N |
| reviewer | N | N | N | Y | Y | N | N |
| viewer | N | N | N | N | N | N | N |

## Data Residency Configuration

### Enforce EU residency
```json
{
  "dataResidencyRegion": "eu",
  "modelEndpoints": {
    "small": "https://api.mistral.ai/v1 (EU)",
    "large": "https://api.mistral.ai/v1 (EU)"
  }
}
```

### Custom (air-gapped) residency
```json
{
  "dataResidencyRegion": "custom",
  "modelEndpoints": {
    "small": "http://localhost:8080/v1",
    "large": "http://localhost:8080/v1"
  }
}
```

The model router asserts residency at the boundary. If a tenant's region doesn't match the model endpoint region (and it's not `custom`), the call is blocked.

## Model Cost Management

### Per-project spend tracking
Every model call records: model tier, tokens, cost, latency, success. View via:
```
GET /api/workflows/:projectId/cost
```

### Spend cap
The KPI "per-project model spend < 3% of project price" is tracked. Configure the project price in the project settings to enable the spend percentage calculation.

## Audit Trail

### Hash-chained audit log
Every API mutation (POST/PATCH/DELETE) is recorded in the per-tenant Durable Object audit log:
- Each entry has a SHA-256 hash that includes the previous entry's hash
- The chain can be verified via `GET /api/admin/audit/:entityId`
- Tampering breaks the chain and is detected by the verification endpoint

### Compliance dossier
Generate a validation-ready compliance package:
```
POST /api/exports
{
  "projectId": "...",
  "type": "validation-dossier"
}
```

The dossier includes:
- Read-only assertion evidence (test suite results + connector inventory)
- Audit trail summary (chain validation + sample entries)
- Human-in-the-loop metrics (proposals accepted/rejected/modified, auto-applied=0)
- Data residency evidence (endpoints, metadata transfers)
- ALCOA+ assessment (9 principles)
- Segregation of duties matrix
- "What Connexy did / did not do" record

## Connector Management

### Adding a connector
1. Navigate to project → Connectors → Add Connector
2. Select connector type
3. Configure credentials (stored in Workers Secrets / Secrets Store — never in code)
4. Run test scan (non-destructive)
5. Verify metadata objects ingested

### Disabling a connector
Only admins can disable connectors. Disabled connectors' metadata remains in D1 but is not re-scanned.

## SSO Configuration

### OIDC (Okta, Azure AD)
```env
SSO_PROVIDER=oidc
SSO_ISSUER=https://your-idp.okta.com/oauth2/default
SSO_CLIENT_ID=your-client-id
SSO_CLIENT_SECRET=your-client-secret
SSO_REDIRECT_URI=https://connexy.example.com/auth/callback
SSO_SCOPES=openid,email,profile,groups
```

### SAML
```env
SSO_PROVIDER=saml
SSO_ISSUER=https://your-idp.com/saml
```

Role mapping is based on group claims:
- `connexy-admin` → admin
- `connexy-architect` → architect
- `connexy-engineer` → engineer
- `connexy-reviewer` → reviewer
- (default) → viewer