terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
  required_version = ">= 1.5.0"
}

variable "environment" {
  type    = string
  default = "on-prem"
}

variable "mistral_endpoint" {
  type    = string
  default = "http://localhost:8080/v1"
}

variable "postgres_password" {
  type      = string
  sensitive = true
}

# Network
resource "docker_network" "connexy" {
  name = "connexy-${var.environment}"
}

# PostgreSQL (replaces D1 for VPC/on-prem)
resource "docker_container" "postgres" {
  name  = "connexy-postgres"
  image = "postgres:16-alpine"
  env = [
    "POSTGRES_DB=connexy",
    "POSTGRES_PASSWORD=${var.postgres_password}",
  ]
  networks_advanced {
    name = docker_network.connexy.name
  }
  ports {
    internal = 5432
    external = 5432
  }
  volumes {
    volume_name    = docker_volume.postgres_data.name
    container_path = "/var/lib/postgresql/data"
  }
}

resource "docker_volume" "postgres_data" {
  name = "connexy-postgres-data"
}

# Qdrant (replaces Vectorize for VPC/on-prem)
resource "docker_container" "qdrant" {
  name  = "connexy-qdrant"
  image = "qdrant/qdrant:latest"
  networks_advanced {
    name = docker_network.connexy.name
  }
  ports {
    internal = 6333
    external = 6333
  }
}

# MinIO (replaces R2 for VPC/on-prem)
resource "docker_container" "minio" {
  name  = "connexy-minio"
  image = "minio/minio:latest"
  command = ["server", "/data"]
  env = [
    "MINIO_ROOT_USER=connexy",
    "MINIO_ROOT_PASSWORD=${var.postgres_password}",
  ]
  networks_advanced {
    name = docker_network.connexy.name
  }
  ports {
    internal = 9000
    external = 9000
  }
}

# vLLM (self-hosted Mistral for air-gapped)
resource "docker_container" "vllm" {
  name  = "connexy-vllm"
  image = "vllm/vllm-openai:latest"
  env = [
    "MODEL=mistralai/Mistral-7B-Instruct-v0.3",
  ]
  command = [
    "--model", "mistralai/Mistral-7B-Instruct-v0.3",
    "--port", "8080",
  ]
  networks_advanced {
    name = docker_network.connexy.name
  }
  ports {
    internal = 8080
    external = 8080
  }
  volumes {
    host_path      = "/opt/models"
    container_path = "/root/.cache/huggingface"
  }
}

# Connexy API (containerized)
resource "docker_container" "api" {
  name  = "connexy-api"
  image = "connexy/api:latest"
  env = [
    "ENVIRONMENT=${var.environment}",
    "DB_HOST=connexy-postgres",
    "DB_PORT=5432",
    "DB_NAME=connexy",
    "DB_PASSWORD=${var.postgres_password}",
    "VECTORIZE_HOST=connexy-qdrant",
    "VECTORIZE_PORT=6333",
    "R2_ENDPOINT=http://connexy-minio:9000",
    "MISTRAL_ENDPOINT=${var.mistral_endpoint}",
  ]
  networks_advanced {
    name = docker_network.connexy.name
  }
  ports {
    internal = 8787
    external = 8787
  }
  depends_on = [docker_container.postgres, docker_container.qdrant, docker_container.minio]
}