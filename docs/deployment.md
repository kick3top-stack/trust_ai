# Deployment Guide

## Prerequisites

- Docker and Docker Compose
- Qwen2.5-0.5B-Instruct HuggingFace model files

## Steps

1. Copy `.env.example` to `.env`
2. Place model in `models/Qwen2.5-0.5B-Instruct/`
3. Run `docker compose up --build`
4. Signing key auto-generates at `secrets/signing_key.pem` on first boot

## Services

| Service | Port |
|---------|------|
| frontend | 3000 |
| backend | 8000 |
| postgres | 5432 |

## Health Check

```bash
curl http://localhost:8000/api/v1/health
```

Expect `database: true`. `model_loaded` becomes true after first generation once model files are present.

## Production Notes

- Use HSM/KMS for signing key
- Set `TRUSTAI_BATCH_SIZE=256` for production throughput
- Enable TLS termination at reverse proxy
- Back up PostgreSQL volume
