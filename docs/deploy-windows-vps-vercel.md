# Deploy: Windows 11 VPS + Vercel (no Docker, no domain)

You do **not** need a domain. A **public IP address** is enough.

## Architecture

```text
User  -->  https://your-app.vercel.app  (Vercel, free HTTPS)
              |
              +-- /api/v1/* proxied to  -->  http://YOUR_VPS_IP:8000  (Windows VPS)
                                                    |
                                                    +-- LM Studio on same VPS (port 1234)
```

The browser only talks to Vercel (HTTPS). Vercel's server calls your VPS API over HTTP by IP. That is normal for this setup.

## Part 1 — Windows 11 VPS (backend + model)

### 1. Open firewall ports

In Windows Firewall (or your cloud provider security group), allow inbound:

| Port | Purpose |
|------|---------|
| **8000** | FastAPI API (required for Vercel proxy) |
| **1234** | LM Studio local server (only if accessed from same machine — usually no public rule needed) |

You do **not** need to expose port 3000 if the frontend lives on Vercel.

### 2. Install on the VPS

- Python 3.12+
- Node.js (optional — only if you build frontend on VPS; not needed for Vercel-only UI)
- Git
- LM Studio + load Qwen model, start **Local Server** on port `1234`

```powershell
cd D:\git_repo\AI_verify
npm run setup
npm run pilot-setup
```

### 3. Configure `.env` on the VPS

Copy `.env.vps.example` to `.env` and set (replace placeholders):

```env
DATABASE_URL=sqlite+aiosqlite:///./data/trustai.db

TRUSTAI_INFERENCE_BACKEND=lmstudio
TRUSTAI_LMSTUDIO_URL=http://127.0.0.1:1234/v1

TRUSTAI_JWT_SECRET=<long-random-secret>
TRUSTAI_ADMIN_PASSWORD=<strong-password>

# Your Vercel app URL (browser origin) — REQUIRED for login/API from Vercel
TRUSTAI_CORS_ORIGINS=https://your-app.vercel.app

TRUSTAI_BACKEND_PORT=8000
```

Notes:

- **Do not** put your VPS IP in `TRUSTAI_CORS_ORIGINS` for the Vercel setup — put your **Vercel URL** there.
- `TRUSTAI_PUBLIC_HOST` is only used if you also host the UI on the VPS; ignore it for Vercel-only frontend.

### 4. Run backend (production — not `npm run dev`)

```powershell
npm run prod:backend
```

Or manually:

```powershell
$env:PYTHONPATH = "D:\git_repo\AI_verify\backend"
cd D:\git_repo\AI_verify\backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Use `--host 0.0.0.0` so Vercel (and health checks) can reach the API from the internet.

Keep this running (RDP session, or install as a Windows Service / Task Scheduler at startup).

### 5. Test API by IP

From your PC:

```powershell
curl http://YOUR_VPS_IP:8000/api/v1/health
```

Expect `"status":"ok"` and `"auth_enabled":true`.

---

## Part 2 — Vercel (frontend only)

### 1. Import project

- Connect GitHub repo to Vercel
- **Root Directory:** `frontend`
- Framework: Next.js

### 2. Environment variables (Vercel dashboard)

| Name | Value | Example |
|------|--------|---------|
| `TRUSTAI_BACKEND_URL` | `http://YOUR_VPS_IP:8000` | `http://203.0.113.10:8000` |
| `NEXT_PUBLIC_API_URL` | `/api/v1` | `/api/v1` |

Redeploy after changing env vars.

### 3. Test through Vercel

```powershell
curl https://your-app.vercel.app/api/v1/health
```

Then open `https://your-app.vercel.app/login` in a browser.

---

## Domain vs IP — quick answers

| Question | Answer |
|----------|--------|
| Do I need a domain? | **No.** IP works. |
| What URL do users open? | `https://your-app.vercel.app` (Vercel gives you this free) |
| What does Vercel call for API? | `http://YOUR_VPS_IP:8000` |
| Can I use `http://IP:3000` for the UI? | Yes, if you host frontend on VPS — but then use Vercel OR VPS, not both unless you know CORS. |
| HTTPS on IP only? | Hard (no free cert for bare IP). Use Vercel for HTTPS UI; API can stay HTTP on IP behind Vercel proxy. |
| Later add a domain? | Optional — point `api.yourdomain.com` to VPS IP and update `TRUSTAI_BACKEND_URL` on Vercel. |

---

## Common mistakes

1. **`npm run dev` on VPS** — dev only; use `npm run prod:backend` for API.
2. **CORS set to VPS IP** — must include **Vercel URL** (`https://....vercel.app`).
3. **Backend bound to `127.0.0.1`** — Vercel cannot reach it; use `0.0.0.0`.
4. **Port 8000 blocked** — open in Windows Firewall + cloud security group.
5. **LM Studio not running** — Playground generation fails; API health may still be OK.

---

## Optional: all on Windows VPS (no Vercel)

Use your **public IP** in the browser:

```env
TRUSTAI_PUBLIC_HOST=http://YOUR_VPS_IP:3000
TRUSTAI_CORS_ORIGINS=http://YOUR_VPS_IP:3000
```

Run `npm run prod` (backend + frontend production build). Users visit `http://YOUR_VPS_IP:3000` (HTTP only unless you add a reverse proxy + domain later).
