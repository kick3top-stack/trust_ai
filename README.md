# TrustAI

Cryptographic execution receipts for AI generations. Prove model identity, parameters, credit charges, and tamper-evident batch inclusion — verifiable offline.

## Quick Start

**First time only** — install backend deps (includes GGUF inference library):

```powershell
cd D:\git_repo\AI_verify
npm run setup
```

Then run:

```powershell
npm run dev
```

Starts **backend** (port 8000) and **frontend** (port 3000). `.env` is already configured — no manual env commands.

| URL | |
|-----|--|
| Frontend | http://localhost:3000 |
| **Generate** | http://localhost:3000/generate |
| **Dashboard** | http://localhost:3000/dashboard |
| API | http://localhost:8000/api/v1 |
| Health | http://localhost:8000/api/v1/health |

**Other scripts:**

```powershell
npm run dev:backend    # backend only
npm run dev:frontend   # frontend only
```

### Place your model (for generation)

**Option A — LM Studio (recommended on VPS)**

1. Open **LM Studio** → load `Qwen2.5-Coder-0.5B-Instruct-Q8_0`
2. Go to **Local Server** tab → click **Start Server** (port `1234`)
3. `.env` is set to `TRUSTAI_INFERENCE_BACKEND=lmstudio`

**Option B — Direct GGUF** (requires CPU with AVX support)

Copy GGUF file to `models/Qwen2.5-Coder-0.5B-Instruct-Q8_0.gguf` and set `TRUSTAI_INFERENCE_BACKEND=gguf`

### VPS (no Docker)

```powershell
.\scripts\start-vps.ps1 -PublicHost "http://YOUR_VPS_IP:3000"
```

### Docker Compose (requires virtualization)

```bash
python scripts/generate_signing_key.py --output secrets/signing_key.pem
```

### 3. Start with Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

- Frontend: http://localhost:3000
- API docs: http://localhost:8000/api/v1/docs
- Health: http://localhost:8000/api/v1/health

### 4. Generate a demo receipt

```bash
curl -X POST http://localhost:8000/api/v1/generate-demo \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Explain Merkle trees in one sentence."}'
```

Save the returned `receipt`, `merkle_proof`, and `root_signature` JSON objects.

### 5. Verify offline

```bash
python scripts/verify_receipt.py \
  --receipt receipt.json \
  --proof merkle_proof.json \
  --signature root_signature.json
```

Or upload `receipt.json` at http://localhost:3000/verify

## Development

### Run tests

```bash
pip install -r backend/requirements.txt
pytest
```

### Project structure

```
backend/     FastAPI + crypto + Merkle + PostgreSQL
frontend/    Next.js verification dashboard
scripts/     Key generation + offline verifier
docs/        Architecture and security documentation
models/      Local Qwen model (not in git)
secrets/     Ed25519 signing key (not in git)
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `TRUSTAI_BATCH_SIZE` | 1 | Receipts per sealed batch |
| `TRUSTAI_BATCH_SEAL_SECONDS` | 300 | Max seconds before sealing open batch |
| `TRUSTAI_MODEL_PATH` | models/Qwen2.5-Coder-0.5B-Instruct-Q8_0.gguf | Path to GGUF model file |
| `TRUSTAI_SIGNING_KEY_PATH` | secrets/signing_key.pem | Ed25519 private key |

## License

MIT
