# TrustAI

Cryptographic execution receipts for AI generations. Prove model identity, parameters, credit charges, and tamper-evident batch inclusion — verifiable offline.

## Quick Start

**First time only** — install backend deps:

```powershell
cd D:\git_repo\AI_verify
npm run setup
```

Then run:

```powershell
npm run dev
```

Starts **backend** (port 8000) and **frontend** (port 3000).

| URL | |
|-----|--|
| Frontend | http://localhost:3000 |
| **Sign in** | http://localhost:3000/login |
| **Playground** | http://localhost:3000/playground |
| **Dashboard** | http://localhost:3000/dashboard |
| API | http://localhost:8000/api/v1 |
| Health | http://localhost:8000/api/v1/health |

**Default admin** (created on first startup): `admin@trustai.local` / `admin123`

Change `TRUSTAI_JWT_SECRET` and admin password before any public deployment.

**Other scripts:**

```powershell
npm run dev:backend    # backend only
npm run dev:frontend   # frontend only
npm run free-port      # free port 8000 if blocked
npm run pilot-setup    # generate JWT secret + pilot checklist
npm run smoke-test     # verify auth/billing/disputes (backend must be running)
```

See [docs/support-playbook.md](docs/support-playbook.md) for handling billing disputes.

### LM Studio

1. Load `Qwen2.5-Coder-0.5B-Instruct-Q8_0` in **LM Studio**
2. **Local Server** → Start (port `1234`)
3. `.env`: `TRUSTAI_INFERENCE_BACKEND=lmstudio`

### Place model file

`models/Qwen2.5-Coder-0.5B-Instruct-Q8_0.gguf`

## Usage

1. **Register** or sign in at `/login`
2. **Playground** — generate with inference parameters; credits are deducted per run
3. **Receipt** — cryptographic proof of model, params, and billing
4. **Verify** — upload receipt ZIP/JSON or paste JSON
5. **Merkle Explorer** — browse sealed batch roots
6. **Billing** — view credit balance and statement
7. **Report billing issue** — on any receipt detail page
8. **Admin → Support** — lookup users, disputes, refunds

### Verify offline (CLI)

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

| Variable | Default | Description |
|----------|---------|-------------|
| `TRUSTAI_JWT_SECRET` | change-me | JWT signing secret |
| `TRUSTAI_DEFAULT_CREDITS` | 1000 | Starting credits per user |
| `TRUSTAI_BATCH_SIZE` | 1 | Receipts per sealed batch |
| `TRUSTAI_INFERENCE_BACKEND` | lmstudio | `lmstudio` or `gguf` |

## License

MIT
