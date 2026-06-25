-- Connexy D1 Schema — Phase 0/1
-- SQLite (Cloudflare D1) schema for relational state

-- Tenants
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  data_residency_region TEXT NOT NULL DEFAULT 'eu',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  sso_subject TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(tenant_id, email),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  workflow_type TEXT NOT NULL,
  intent TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  project_price_usd REAL,
  model_spend_cap_usd REAL,
  model_spend_cap_percentage REAL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

-- Requirements (parsed from intent)
CREATE TABLE IF NOT EXISTS requirements (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'required',
  source_hints TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
CREATE INDEX IF NOT EXISTS idx_requirements_project ON requirements(project_id);

-- Connectors
CREATE TABLE IF NOT EXISTS connectors (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  credentials_ref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'configured',
  last_sync_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
CREATE INDEX IF NOT EXISTS idx_connectors_tenant ON connectors(tenant_id);
CREATE INDEX IF NOT EXISTS idx_connectors_project ON connectors(project_id);

-- Metadata Objects (ingested read-only metadata)
CREATE TABLE IF NOT EXISTS metadata_objects (
  id TEXT PRIMARY KEY,
  connector_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'field',
  path TEXT,
  description TEXT,
  data_type TEXT,
  unit_of_measure TEXT,
  properties TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(connector_id, external_id),
  FOREIGN KEY (connector_id) REFERENCES connectors(id)
);
CREATE INDEX IF NOT EXISTS idx_metadata_connector ON metadata_objects(connector_id);

-- Mappings (source-to-target)
CREATE TABLE IF NOT EXISTS mappings (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  source_object_id TEXT NOT NULL,
  target_object_id TEXT NOT NULL,
  transformation TEXT,
  confidence REAL NOT NULL,
  evidence TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'proposed',
  proposed_by TEXT NOT NULL DEFAULT 'ai',
  reviewed_by TEXT,
  reviewed_at TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (source_object_id) REFERENCES metadata_objects(id)
);
CREATE INDEX IF NOT EXISTS idx_mappings_project ON mappings(project_id);
CREATE INDEX IF NOT EXISTS idx_mappings_status ON mappings(status);

-- Semantic Models
CREATE TABLE IF NOT EXISTS semantic_models (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  entities TEXT NOT NULL DEFAULT '[]',
  relationships TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
CREATE INDEX IF NOT EXISTS idx_models_project ON semantic_models(project_id);

-- Gaps
CREATE TABLE IF NOT EXISTS gaps (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  description TEXT NOT NULL,
  affected_objects TEXT NOT NULL DEFAULT '[]',
  recommendation TEXT,
  confidence REAL NOT NULL,
  evidence TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
CREATE INDEX IF NOT EXISTS idx_gaps_project ON gaps(project_id);
CREATE INDEX IF NOT EXISTS idx_gaps_severity ON gaps(severity);

-- Export Packages
CREATE TABLE IF NOT EXISTS export_packages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'json',
  r2_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'generating',
  generated_by TEXT NOT NULL,
  generated_at TEXT NOT NULL,
  expires_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
CREATE INDEX IF NOT EXISTS idx_exports_project ON export_packages(project_id);

-- Model Calls (cost telemetry)
CREATE TABLE IF NOT EXISTS model_calls (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  model_tier TEXT NOT NULL,
  model_name TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  success INTEGER NOT NULL DEFAULT 1,
  error TEXT,
  timestamp TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
CREATE INDEX IF NOT EXISTS idx_model_calls_project ON model_calls(project_id);

-- Reuse Catalogue
CREATE TABLE IF NOT EXISTS reuse_catalogue (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  artifact_type TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  name TEXT NOT NULL,
  promoted_by TEXT NOT NULL,
  promoted_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);
CREATE INDEX IF NOT EXISTS idx_reuse_tenant ON reuse_catalogue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_reuse_scope ON reuse_catalogue(scope);

-- Semantic Model Versions (versioned, with hierarchy + KPIs)
CREATE TABLE IF NOT EXISTS semantic_model_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  version INTEGER NOT NULL,
  entities TEXT NOT NULL DEFAULT '[]',
  relationships TEXT NOT NULL DEFAULT '[]',
  hierarchy TEXT NOT NULL DEFAULT '[]',
  kpi_definitions TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  parent_version_id TEXT,
  change_log TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
CREATE INDEX IF NOT EXISTS idx_smv_project ON semantic_model_versions(project_id, version);
-- Seed data for development
INSERT OR IGNORE INTO tenants (id, name, slug, data_residency_region, created_at, updated_at)
VALUES ('dev-tenant', 'Development Tenant', 'dev', 'eu', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');

INSERT OR IGNORE INTO users (id, tenant_id, email, name, role, created_at, updated_at)
VALUES
  ('dev-admin', 'dev-tenant', 'admin@connexy.dev', 'Dev Admin', 'admin', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('dev-architect', 'dev-tenant', 'architect@connexy.dev', 'Dev Architect', 'architect', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('dev-engineer', 'dev-tenant', 'engineer@connexy.dev', 'Dev Engineer', 'engineer', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z'),
  ('dev-reviewer', 'dev-tenant', 'reviewer@connexy.dev', 'Dev Reviewer', 'reviewer', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z');
