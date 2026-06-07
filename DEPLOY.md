# Deploying CloudBudgetMaster

Production runs on a **Hostinger VPS** (nginx + gunicorn/systemd). This is the real,
verified deploy procedure.

## Server facts
- **Host:** Ubuntu 24.04 VPS — `ssh root@82.25.110.57` (hostname `srv1610377.hstgr.cloud`).
  hPanel → VPS → **Terminal** opens a root browser shell (no password needed).
- **Web server:** host **nginx** (`nginx/1.24.0`).
  - `cloudbudgetmaster.com` / `www` → static files from **`/var/www/cloudbudgetmaster/frontend/dist`**
  - `api.cloudbudgetmaster.com` → reverse-proxy to **`127.0.0.1:8001`** (backend)
- **Backend:** **gunicorn (3 workers) on `:8001`**, managed by the systemd service
  **`cbm-api.service`** (`systemctl status cbm-api`). It runs from a **virtualenv** at
  `/var/www/cloudbudgetmaster/backend/venv`. NOTE: pm2 on this box runs a *different*
  app (`clskills` / claude-skills-hub) — `pm2 restart` does NOT touch this backend.
- **Code on server:** the repo is checked out at **`/var/www/cloudbudgetmaster`**
  (remote: `github.com/Samarth0211/CLoudBudgetMaster`). Node 22 / npm / git are installed,
  so the frontend is **built on the server**.
- **Env files (server-only, git-ignored — do not overwrite):**
  `frontend/.env.production` (sets `VITE_API_BASE_URL=https://api.cloudbudgetmaster.com/v1`)
  and `backend/.env`.

## Deploy the frontend (the common case)
1. Commit + push your changes to `main` (`github.com/Samarth0211/CLoudBudgetMaster`).
2. On the server:
   ```bash
   cd /var/www/cloudbudgetmaster && git pull origin main && cd frontend && npm install && npm run build
   ```
   Vite writes to `frontend/dist`, which nginx already serves — **no nginx reload needed**.
3. Verify, then hard-refresh the site (Ctrl+Shift+R):
   ```bash
   curl -s https://cloudbudgetmaster.com/ | grep -o "index-[A-Za-z0-9]*\.css"
   ```

## Deploy the backend (only if backend changed)
Ubuntu 24.04 blocks system-wide `pip` (PEP 668 "externally-managed"), so you MUST
use the venv's pip, and restart via systemd (NOT pm2):
```bash
cd /var/www/cloudbudgetmaster && git pull origin main
# install deps into the backend's venv (only needed when requirements changed)
backend/venv/bin/pip install -r backend/requirements.txt
# restart the systemd service + verify
systemctl restart cbm-api
systemctl is-active cbm-api && curl -s https://api.cloudbudgetmaster.com/health
```
If you add a new dependency, `import`-check it in the venv before restarting to
avoid a boot crash: `backend/venv/bin/python -c "import <pkg>"`.

## Notes / gotchas
- **`frontend/.env.production` is required on the server** (git-ignored). It must
  contain `VITE_API_BASE_URL=https://api.cloudbudgetmaster.com/v1`. If missing, the
  Vite build silently falls back to `http://localhost:8000` and the whole app
  breaks in the browser. After a frontend build, verify the live bundle contains
  the real API host (see the verify command in the frontend deploy section).
- **Brand fonts** (Inter + JetBrains Mono) load via `<link>` in `frontend/index.html`,
  **not** a CSS `@import` — PostCSS drops a font `@import` placed after the Tailwind
  import, so the fonts silently fail. Keep them in `index.html`.
- Pushing needs write access to `Samarth0211/CLoudBudgetMaster` (the `Samarth0211`
  GitHub account, not `samarth-ship-it`).
