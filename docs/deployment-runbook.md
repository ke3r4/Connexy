# Connexy — Deployment Runbook

## Topology 1: Cloudflare Managed Cloud (Primary)

### Prerequisites
- Cloudflare account with Workers Paid plan
- Mistral AI API key (EU endpoint)
- Domain (optional, for custom domain)

### Steps

1. **Provision Cloudflare resources via Terraform**
```bash
cd infra/terraform/cloudflare
terraform init
terraform plan -out=tfplan \
  -var="cloudflare_account_id=$CF_ACCOUNT_ID" \
  -var="mistral_api_key=$MISTRAL_KEY" \
  -var="jwt_secret=$(openssl rand -hex 32)" \
  -var="environment=production"
terraform apply tfplan
```

2. **Initialize D1 schema**
```bash
wrangler d1 execute connexy-production --remote \
  --file=../../infra/cloudflare/schema.sql
```

3. **Deploy API Worker**
```bash
npm run deploy:api
```

4. **Deploy Frontend (Pages)**
```bash
npm run deploy:web
```

5. **Verify**
```bash
curl https://connexy-api-production.$CF_ACCOUNT.workers.dev/health
# Expected: {"status":"ok","service":"connexy-api","version":"0.1.0"}
```

---

## Topology 2: Customer VPC (Containerized)

### Prerequisites
- Docker host with 16GB RAM, 4 vCPU
- GPU (optional, for self-hosted Mistral via vLLM)
- Mistral API key OR self-hosted model weights

### Steps

1. **Start infrastructure**
```bash
export POSTGRES_PASSWORD=$(openssl rand -hex 16)
docker compose up -d postgres qdrant minio
```

2. **Start self-hosted Mistral (optional, for air-gapped)**
```bash
docker compose up -d vllm
# Wait for model to load (check logs)
docker logs -f connexy-vllm
```

3. **Start Connexy API**
```bash
docker compose up -d api
```

4. **Initialize database**
```bash
docker exec connexy-postgres psql -U postgres -d connexy \
  -f /app/infra/cloudflare/schema.sql
```

5. **Verify**
```bash
curl http://localhost:8787/health
```

---

## Topology 3: On-Prem (Air-Gapped)

### Prerequisites
- Physical server with GPU (RTX 4090 or A100)
- Pre-downloaded model weights (Mistral-7B-Instruct)
- Docker or Podman installed
- No internet access required after setup

### Steps

1. **Pre-stage model weights on a connected machine**
```bash
# On a connected machine:
huggingface-cli download mistralai/Mistral-7B-Instruct-v0.3
# Transfer to air-gapped server:
scp -r ~/.cache/huggingface user@airgap:/opt/models/
```

2. **Transfer Docker images**
```bash
# On connected machine:
docker pull postgres:16-alpine
docker pull qdrant/qdrant:latest
docker pull minio/minio:latest
docker pull vllm/vllm-openai:latest
docker save postgres:16-alpine qdrant/qdrant:latest minio/minio:latest vllm/vllm-openai:latest | gzip > images.tar.gz
# Transfer to air-gapped server:
scp images.tar.gz user@airgap:~/
# On air-gapped server:
docker load < images.tar.gz
```

3. **Start services**
```bash
export POSTGRES_PASSWORD=$(openssl rand -hex 16)
docker compose up -d
```

4. **Verify (from within the air-gapped network)**
```bash
curl http://connexy-api:8787/health
```

---

## Rollback

### Cloudflare
```bash
wrangler deployments rollback --name connexy-api-production
```

### Container
```bash
docker compose down
# Revert to previous image tag
docker compose pull connexy/api:v0.0.X
docker compose up -d
```

---

## Observability

### Cloudflare
- Workers Logs: `wrangler tail connexy-api-production`
- AI Gateway analytics: Cloudflare Dashboard → AI Gateway → connexy-ai-production
- D1 metrics: Cloudflare Dashboard → D1 → connexy-production

### Container
- Prometheus metrics at `http://localhost:8787/metrics`
- Grafana dashboard: import `infra/grafana/connexy-dashboard.json`
- Logs: `docker logs -f connexy-api`