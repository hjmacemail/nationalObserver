# National Vitality Observatory — Platform

The observatory (Nation + Government tabs, organism views, stress tests, Improvement Advisor) served behind a login, with a **Settings** page where administrators save the Anthropic API key.

## What's included

- **Login page:** username and password, EN/AR. Passwords are hashed with scrypt. Sessions use a signed HttpOnly cookie (12 h, or 30 days with "Keep me signed in"). After 5 failed attempts the account is locked for 15 minutes.
- **Roles:**
  - **Administrator** can change settings and manage users.
  - **Viewer** can use the observatory and the AI advisor.
- **Settings** (`/settings`):
  - **AI — Anthropic API**:
    - Paste a key, test it, choose a model (automatic = latest Sonnet), or remove the key.
    - The key is encrypted at rest (AES‑256‑GCM) and is never sent to browsers. The Advisor calls `/api/ai/advise` and the server adds the key.
  - **Users**: add users, change a role, reset a password, delete a user.
  - **Your account**: change your password. This signs out your other devices.
- **Security basics:**
  - Same-origin check on every write.
  - Content-Security-Policy and other security headers.
  - Per-user AI rate limit (30 requests per hour by default).
- The standalone `app/nvo.html` still works on its own. In that mode, the key is entered in the browser as before.

## Using it on a phone

The whole platform is mobile-friendly: login, settings and the observatory itself. On screens narrower than 760 px:

- **Bottom navigation** jumps between Overview, Systems, Improve, Treat and Trends.
- **Status bar:** once you scroll past the header, a compact bar stays at the top with the vitality score, the condition, the date and Run/Pause.
- **Data source** collapses to a one-line status. Tap **Change** to open it.
- **Readability:** organism labels are larger, the trend chart is redrawn for a narrow width, and inputs are 16 px so iPhone doesn't zoom when you tap a field.
- **Settings:** the users table becomes cards.

**Install as an app:** open your Railway URL on the phone, sign in, then:

- **iPhone (Safari):** Share → *Add to Home Screen*.
- **Android (Chrome):** ⋮ → *Install app* (or *Add to Home screen*).

It opens full-screen with its own icon. It still needs an internet connection for sign-in, World Bank data and AI.

## Status reports (PDF / Word)

**Export report** (in the header controls, both tabs) creates a report on the country's or government's current status:

- **One-page summary:** headline scores, the organism, vital signs chart, diagnosis and key facts, early warnings, priority actions, trend chart.
- **Detailed report** (about 10 pages): everything above plus both organism views (ring and human body), resilience properties radar, every system with its 36-month chart and KPI table, the regeneration ledger chart, the trend and case log, stress-test results, active interventions, improvement levers, and the method.
  - Peer comparisons and AI plans are included if you loaded or generated them in the advisor first.
- **Formats:** PDF, or Word (.docx), which stays editable. The report can be in English or Arabic (right-to-left).

Everything is generated in the browser. Nothing is sent to the server, and it also works in the standalone HTML file. The PDF pages are high-resolution images, so the PDF text can't be selected. Use Word if you need to copy or edit text.

## Deploy on Railway

1. **Put this folder in a GitHub repo** (Railway deploys from GitHub):
   ```bash
   cd nvo-platform
   git init && git add . && git commit -m "Observatory platform"
   # create an empty repo on GitHub, then:
   git remote add origin https://github.com/<you>/nvo-platform.git
   git push -u origin main
   ```
   Or skip GitHub and use the CLI: `npm i -g @railway/cli && railway login && railway init && railway up`.
2. In Railway, choose **New Project → Deploy from GitHub repo** and pick the repo. The build uses the `Dockerfile` (configured in `railway.json`), and the health check is `/healthz`.
3. **Add a volume.** This is required, or users and settings are lost on every redeploy. Right-click the service → **Attach volume** → mount path `/data`. The server detects the volume automatically through `RAILWAY_VOLUME_MOUNT_PATH`.
4. **Variables** (service → Variables):

   | Variable | Required | Value |
   |---|---|---|
   | `SESSION_SECRET` | yes | A long random string. Generate one with `openssl rand -base64 48`. |
   | `ADMIN_USERNAME` | recommended | The first administrator, e.g. `hasan`. |
   | `ADMIN_PASSWORD` | recommended | At least 10 characters, with letters and numbers. You can change it later in Settings. |
   | `NODE_ENV` | optional | Already set to `production` in the image. |
   | `ANTHROPIC_API_KEY` | optional | A fallback key. A key saved in Settings takes priority. |

   If you leave out `ADMIN_USERNAME` and `ADMIN_PASSWORD`, open `/setup`. Enter the one-time code printed in **Deployments → Logs**, then create the administrator.
5. **Networking → Generate Domain**, then open the URL, sign in and go to **Settings → AI** to paste your Anthropic key (from console.anthropic.com → API keys). Press **Test key**, then **Save**.

### Forgot the admin password?
1. Set `ADMIN_USERNAME`, `ADMIN_PASSWORD` (the new password) and `ADMIN_PASSWORD_RESET=true`, then redeploy.
2. Sign in, then **remove `ADMIN_PASSWORD_RESET`**.

### Notes
- If you change `SESSION_SECRET`, everyone is signed out and the saved API key can no longer be decrypted. Re-enter the key in Settings. To rotate session secrets without losing the key, set a separate `ENCRYPTION_KEY`.
- World Bank data is still fetched by each browser from `api.worldbank.org`.
- Data is stored in `store.json` on the volume, which holds users and encrypted settings. Back it up from the volume if needed.

## Run locally

```bash
npm install
SESSION_SECRET=dev-secret-at-least-32-characters-long ADMIN_USERNAME=admin ADMIN_PASSWORD=ChangeMe12345 npm start
# open http://localhost:3000
```

Data goes to `./data` unless `DATA_DIR` is set.

## Updating the observatory app

The platform serves `app/nvo.html`. Replace that file with a newer build and redeploy; the login, settings and AI proxy don't change.

## Files

```
server.js          Express server: auth, users, settings, AI proxy, serves the app
lib/security.js    scrypt hashing, signed tokens, AES-GCM, login throttle
lib/store.js       JSON file store (atomic writes)
public/            login, setup, settings pages, manifest.webmanifest (+ assets/, app icons)
app/nvo.html       the observatory
Dockerfile, railway.json, .env.example
```
# nationalObserver
