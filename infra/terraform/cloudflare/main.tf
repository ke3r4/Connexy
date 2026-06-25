terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
  required_version = ">= 1.5.0"
}

variable "cloudflare_account_id" {
  type        = string
  description = "Cloudflare account ID"
}

variable "environment" {
  type    = string
  default = "staging"
}

variable "mistral_api_key" {
  type      = string
  sensitive = true
}

variable "jwt_secret" {
  type      = string
  sensitive = true
}

# D1 Database
resource "cloudflare_d1_database" "connexy" {
  account_id = var.cloudflare_account_id
  name       = "connexy-${var.environment}"
}

# Vectorize Index
resource "cloudflare_vectorize_index" "connexy" {
  account_id = var.cloudflare_account_id
  name       = "connexy-embeddings-${var.environment}"
  dimensions = 1024
  metric     = "cosine"
}

# R2 Bucket
resource "cloudflare_r2_bucket" "connexy_exports" {
  account_id = var.cloudflare_account_id
  name       = "connexy-exports-${var.environment}"
}

# KV Namespace - Config
resource "cloudflare_workers_kv_namespace" "config" {
  account_id = var.cloudflare_account_id
  title      = "connexy-config-${var.environment}"
}

# KV Namespace - Sessions
resource "cloudflare_workers_kv_namespace" "sessions" {
  account_id = var.cloudflare_account_id
  title      = "connexy-sessions-${var.environment}"
}

# Queue - Ingest
resource "cloudflare_queue" "ingest" {
  account_id = var.cloudflare_account_id
  name       = "connexy-ingest-${var.environment}"
}

# Queue - Export
resource "cloudflare_queue" "export" {
  account_id = var.cloudflare_account_id
  name       = "connexy-export-${var.environment}"
}

# AI Gateway
resource "cloudflare_ai_gateway" "connexy" {
  account_id = var.cloudflare_account_id
  name       = "connexy-ai-${var.environment}"
}

# Worker - API
resource "cloudflare_worker_script" "api" {
  account_id = var.cloudflare_account_id
  name       = "connexy-api-${var.environment}"

  d1_database_binding {
    name        = "DB"
    database_id = cloudflare_d1_database.connexy.database_id
  }

  vectorize_binding {
    name         = "VECTORIZE"
    index_name   = cloudflare_vectorize_index.connexy.name
  }

  r2_bucket_binding {
    name        = "R2_BUCKET"
    bucket_name = cloudflare_r2_bucket.connexy_exports.name
  }

  kv_namespace_binding {
    name         = "KV_CONFIG"
    namespace_id = cloudflare_workers_kv_namespace.config.id
  }

  kv_namespace_binding {
    name         = "KV_SESSIONS"
    namespace_id = cloudflare_workers_kv_namespace.sessions.id
  }

  queue_binding {
    name     = "INGEST_QUEUE"
    queue_id = cloudflare_queue.ingest.id
  }

  queue_binding {
    name     = "EXPORT_QUEUE"
    queue_id = cloudflare_queue.export.id
  }

  # Durable Object bindings
  durable_object_binding {
    name       = "AUDIT_LOG"
    class_name = "AuditLogDO"
  }

  durable_object_binding {
    name       = "PROJECT_COORDINATOR"
    class_name = "ProjectCoordinatorDO"
  }

  # Workers AI binding
  ai_binding {
    name = "AI"
  }

  # AI Gateway binding
  ai_gateway_binding {
    name = "AI_GATEWAY"
    id   = cloudflare_ai_gateway.connexy.id
  }

  # Workflow binding
  workflow_binding {
    name       = "DISCOVERY_WORKFLOW"
    class_name = "DiscoveryWorkflow"
  }

  # Durable Object migrations
  migration {
    tag = "v1"
    new_class = "AuditLogDO"
    new_class = "ProjectCoordinatorDO"
  }

  secret_text {
    name  = "JWT_SECRET"
    text  = var.jwt_secret
  }

  vars = {
    ENVIRONMENT = var.environment
  }
}

# Pages Project - Frontend
resource "cloudflare_pages_project" "web" {
  account_id        = var.cloudflare_account_id
  name              = "connexy-web-${var.environment}"
  production_branch = "main"

  build_config {
    build_command   = "npm run build:web"
    destination_dir = "apps/web/dist"
    root_dir        = "."
  }
}

output "d1_database_id" {
  value = cloudflare_d1_database.connexy.database_id
}

output "r2_bucket_name" {
  value = cloudflare_r2_bucket.connexy_exports.name
}

output "pages_url" {
  value = "https://connexy-web-${var.environment}.pages.dev"
}

output "worker_url" {
  value = "https://connexy-api-${var.environment}.${var.cloudflare_account_id}.workers.dev"
}