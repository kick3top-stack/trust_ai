# TrustAI

A working demo of **receipts for AI generations**.

When you run a model, credits go down. Usually that is the whole story: you trust the platform, or you post on Discord and hope someone replies. TrustAI tries a different approach. Every generation gets a **receipt** that records what you asked for, which model ran, what you were charged, and a signed proof you can check later.

It is to show what AI platforms *could* offer: clearer billing, easier disputes, and records users can actually verify.

**Live demo:** https://trust-ai-seven.vercel.app/

## The problem

People keep running into the same issues across AI tools:

- Credits disappear with no clear breakdown
- "I asked for 10 seconds but was billed for 24" with no paper trail
- Support threads full of screenshots instead of one request ID
- No way to prove what model or settings were used for a run

TrustAI is a small MVP that tackles those gaps on a single stack you can run yourself.

## What it does

1. **Playground** — run inference (via LM Studio on the VPS) with temperature, tokens, seed, etc.
2. **Receipt** — after each run, the platform issues a signed record tied to that request.
3. **Billing** — credits are deducted per generation and logged in a statement.
4. **Verify** — paste or upload a receipt package and check that nothing was altered.
5. **Dispute** — flag a charge from the receipt page; admin resolves it in Support.

Under the hood, receipts are hashed, batched into Merkle trees, and signed with Ed25519. That part matters for integrity, but the user-facing idea is simple: **a receipt for every run**.

## Stack

| Part | Tech |
|------|------|
| Frontend | Next.js (Vercel) |
| Backend | FastAPI + SQLite |
| Inference | LM Studio (local on VPS) |

Production setup: Windows VPS for API + model, Vercel for the UI. See [docs/deploy-windows-vps-vercel.md](docs/deploy-windows-vps-vercel.md).

## Run locally

First time:

```powershell
npm run setup
npm run pilot-setup
```

Start backend and frontend:

```powershell
npm run dev
```

| What | URL |
|------|-----|
| App | http://localhost:3000 |
| Playground | http://localhost:3000/playground |
| API | http://localhost:8000/api/v1 |
| Health | http://localhost:8000/api/v1/health |

Default admin (created on first boot): `admin@trustai.local` / `admin123`

Change `TRUSTAI_JWT_SECRET` and the admin password before exposing this publicly.

### LM Studio

1. Load `Qwen2.5-Coder-0.5B-Instruct-Q8_0` in LM Studio
2. Start Local Server on port `1234`
3. In `.env`: `TRUSTAI_INFERENCE_BACKEND=lmstudio`

Model file path: `models/Qwen2.5-Coder-0.5B-Instruct-Q8_0.gguf`

### Other scripts

```powershell
npm run dev:backend     # API only
npm run dev:frontend    # UI only
npm run prod:backend    # production API on 0.0.0.0:8000 (VPS)
npm run free-port       # free port 8000 if something is stuck
npm run smoke-test      # auth / billing / disputes (API must be up)
```

## Verify a receipt offline

```bash
python scripts/verify_receipt.py \
  --receipt receipt.json \
  --proof merkle_proof.json \
  --signature root_signature.json
```

## Development

```bash
pip install -r backend/requirements.txt
pytest
```

## Configuration

| Variable | Default | Notes |
|----------|---------|-------|
| `TRUSTAI_JWT_SECRET` | change-me | Use 32+ random bytes in production |
| `TRUSTAI_DEFAULT_CREDITS` | 1000 | Starting balance per new user |
| `TRUSTAI_BATCH_SIZE` | 1 | Receipts per Merkle batch before sealing |
| `TRUSTAI_INFERENCE_BACKEND` | lmstudio | `lmstudio` or `gguf` |
| `TRUSTAI_CORS_ORIGINS` | — | Your Vercel URL when frontend is on Vercel |

## Docs

- [Deploy: VPS + Vercel](docs/deploy-windows-vps-vercel.md)
- [Receipt format](docs/receipt-format.md)
- [Support / disputes playbook](docs/support-playbook.md)
- [Architecture](docs/architecture.md)

## License

MIT
