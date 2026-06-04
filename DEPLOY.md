# Deploying CloudBudgetMaster

Production runs on a **Hostinger VPS** (not Vercel/Render). This is the real,
verified deploy procedure.

## Server facts
- **Host:** Ubuntu 24.04 VPS — `ssh root@82.25.110.57` (hostname `srv1610377.hstgr.cloud`).
  hPanel → VPS → **Terminal** opens a root browser shell (no password needed).
- **Web server:** host **nginx** (`nginx/1.24.0`).
  - `cloudbudgetmaster.com` / `www` → static files from **`/var/www/cloudbudgetmaster/frontend/dist`**
  - `api.cloudbudgetmaster.com` → reverse-proxy to **`127.0.0.1:8001`** (backend)
- **Backend:** runs under **pm2 + gunicorn** on `:8001` (`pm2 list` to see the process).
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
```bash
cd /var/www/cloudbudgetmaster && git pull origin main \
  && cd backend && pip install -r requirements.txt \
  && pm2 restart all     # or: pm2 restart <name-from `pm2 list`>
```

## Notes / gotchas
- **Brand fonts** (Inter + JetBrains Mono) load via `<link>` in `frontend/index.html`,
  **not** a CSS `@import` — PostCSS drops a font `@import` placed after the Tailwind
  import, so the fonts silently fail. Keep them in `index.html`.
- This repo has stale **Vercel** artifacts (`vercel.json`, `.vercelignore`, `api/index.py`)
  from before the VPS move — they are unused.
- Pushing needs write access to `Samarth0211/CLoudBudgetMaster` (the `Samarth0211`
  GitHub account, not `samarth-ship-it`).
