# Connexy — API Reference

## Base URL
- Local dev: `http://localhost:8787`
- Cloudflare: `https://connexy-api-{env}.{account}.workers.dev`

## Authentication
All `/api/*` endpoints require:
- `Authorization: Bearer <JWT>`
- `X-Tenant-ID: <tenant-uuid>`

## Endpoints

### Health
| Method | Path | Description |
|---|---|---|
| GET | `/health` | Service status |
| GET | `/health/ready` | Readiness check (DB) |
| GET | `/health/live` | Liveness check |

### Projects
| Method | Path | Description | Roles |
|---|---|---|---|
| GET | `/api/projects` | List projects | all |
| GET | `/api/projects/:id` | Get project | all |
| POST | `/api/projects` | Create project | admin, architect, engineer |
| PATCH | `/api/projects/:id` | Update project | admin, architect, engineer |
| DELETE | `/api/projects/:id` | Archive project | admin |
| POST | `/api/projects/:id/run` | Start discovery workflow | admin, architect, engineer |

### Connectors
| Method | Path | Description | Roles |
|---|---|---|---|
| GET | `/api/connectors` | List connectors | all |
| GET | `/api/connectors/:id` | Get connector | all |
| POST | `/api/connectors` | Create connector (read-only enforced) | admin, architect, engineer |
| POST | `/api/connectors/:id/test-scan` | Test scan (non-destructive) | admin, architect, engineer |
| GET | `/api/connectors/:id/metadata` | Get ingested metadata | all |
| DELETE | `/api/connectors/:id` | Disable connector | admin |

### Mappings
| Method | Path | Description | Roles |
|---|---|---|---|
| GET | `/api/mappings` | List mappings (by projectId) | all |
| GET | `/api/mappings/:id` | Get mapping | all |
| POST | `/api/mappings/:id/accept` | Accept proposed mapping | admin, architect, engineer, reviewer |
| POST | `/api/mappings/:id/reject` | Reject proposed mapping | admin, architect, engineer, reviewer |
| PATCH | `/api/mappings/:id` | Modify mapping | admin, architect, engineer, reviewer |

### Semantic Models
| Method | Path | Description | Roles |
|---|---|---|---|
| GET | `/api/semantic-models` | List models (by projectId) | all |
| GET | `/api/semantic-models/:id` | Get model | all |
| POST | `/api/semantic-models/:id/approve` | Approve model | admin, architect, reviewer |
| POST | `/api/semantic-models/:id/publish` | Publish model | admin, architect |

### Gaps
| Method | Path | Description | Roles |
|---|---|---|---|
| GET | `/api/gaps` | List gaps (by projectId) | all |
| GET | `/api/gaps/:id` | Get gap | all |
| POST | `/api/gaps/:id/acknowledge` | Acknowledge gap | admin, architect, engineer, reviewer |
| POST | `/api/gaps/:id/resolve` | Resolve gap | admin, architect, engineer |
| POST | `/api/gaps/:id/wont-fix` | Mark as won't fix | admin, architect |

### Reviews
| Method | Path | Description | Roles |
|---|---|---|---|
| GET | `/api/reviews/:projectId` | Get review queue | all |
| POST | `/api/reviews/:projectId/bulk-accept` | Bulk accept mappings | admin, architect, reviewer |
| POST | `/api/reviews/:projectId/complete` | Complete review → approved | admin, architect, reviewer |

### Exports
| Method | Path | Description | Roles |
|---|---|---|---|
| GET | `/api/exports` | List export packages | all |
| POST | `/api/exports` | Generate export package | admin, architect, engineer, reviewer |
| GET | `/api/exports/:id/download` | Download package | all |

### Workflow
| Method | Path | Description | Roles |
|---|---|---|---|
| GET | `/api/workflows/:projectId/state` | Get workflow state | all |
| POST | `/api/workflows/:projectId/cancel` | Cancel workflow | admin, architect, engineer |
| GET | `/api/workflows/:projectId/events` | Get workflow events | all |
| GET | `/api/workflows/:projectId/cost` | Get project cost | admin, architect |

### Admin
| Method | Path | Description | Roles |
|---|---|---|---|
| GET | `/api/admin/stats` | Tenant statistics | admin |
| GET | `/api/admin/audit/:entityId` | Audit trail for entity | admin |
| GET | `/api/admin/model-spend` | Per-project model spend | admin, architect |

## Error Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "statusCode": 400,
    "details": {}
  }
}
```