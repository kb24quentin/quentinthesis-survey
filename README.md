# Loyalty Survey — Bachelor's Thesis (Quentin Leopold)

A digital, animated version of the research questionnaire
**"The Influence of Loyalty Programs as a Digital Business Model on Customer Purchase Behavior."**
Includes a password-protected admin area with per-response inspection and Excel export.

No build step, no database server, no native dependencies — just Node.js.

---

## Quick start

```bash
npm install
npm start
```

Then open:

| Page          | URL                            |
| ------------- | ------------------------------ |
| **Survey**    | http://localhost:3000          |
| **Admin**     | http://localhost:3000/admin    |

Default admin password: **`admin`** (change it before sharing — see below).

---

## Features

- **Animated loader** — “by Quentin Leopold” reveal, then a smooth curtain into the survey.
- **Multi-step wizard** — one section at a time, animated transitions, live progress bar.
- **All 42 questions** across sections A–H (online + in-store): single/multiple choice, 1–5 Likert scales, open text.
- **Skip logic** — answering “No” at Q10 automatically hides Q11–Q14 (membership questions).
- **Attention check** — Q38 is validated; failures are flagged in the admin area.
- **Fully responsive** — designed mobile-first, works on phone, tablet, and desktop.
- **Dark mode** — follows the visitor's system setting automatically.
- **Admin dashboard**
  - Live stats: total responses, % loyalty members, avg. completion time, attention fails.
  - Average agreement per rating item (raw means).
  - Full response table — view every single survey in detail, or delete it.
  - **Export to Excel** (`.xlsx`) with one row per response + a *Codebook* sheet.

---

## Changing the admin password

Set the `ADMIN_PASSWORD` environment variable when starting:

```bash
ADMIN_PASSWORD="my-secret-password" npm start
```

(On Windows PowerShell: `$env:ADMIN_PASSWORD="my-secret"; npm start`)

If you don't set it, the password stays `admin` and the server prints a warning.

---

## Where are the answers stored?

The app **auto-switches storage** based on the environment:

| Environment | Storage | When |
| ----------- | ------- | ---- |
| **Local** (`npm start`) | `data/responses.json` | no database URL set — zero setup |
| **Production** (Vercel etc.) | **Postgres** | any `DATABASE_URL` / `POSTGRES_URL` env var is present |

Locally, writes to `data/responses.json` are atomic, so the file is safe to copy
as a backup. To wipe local data, reset it to `{"responses": [], "nextId": 1}`.

---

## Deploying free on Vercel (with your own domain)

Vercel's free *Hobby* plan is perfect for a (non-commercial) thesis survey: fast,
auto-HTTPS, custom domain included. Because Vercel is serverless, responses are
stored in a free **Neon Postgres** database instead of a file — the app handles
this automatically once the database env var exists.

**1. Put the project on GitHub**
   Create a repo and push this folder (a free GitHub account is enough).

**2. Import into Vercel**
   - Sign up at [vercel.com](https://vercel.com) with GitHub.
   - *Add New… → Project →* select the repo → **Deploy**. (It works immediately;
     the database is added next.)

**3. Add the free database**
   - In the project: **Storage** tab → **Create Database** → **Neon (Postgres)** →
     follow the prompts (free tier).
   - Vercel injects the connection string (`DATABASE_URL` / `POSTGRES_URL`)
     automatically — no copy-pasting needed.

**4. Set the admin secrets**
   Project → **Settings → Environment Variables**, add:
   | Name | Value |
   | ---- | ----- |
   | `ADMIN_PASSWORD` | your chosen admin password |
   | `ADMIN_SECRET`   | any long random string (signs login tokens) |

**5. Redeploy**
   Project → **Deployments → ⋯ → Redeploy** so the new env vars take effect.
   Your survey is now live at `your-project.vercel.app`.

**6. Connect your own domain**
   - Buy a domain (e.g. Cloudflare Registrar, Namecheap, IONOS — ~1–12 €/yr).
   - Vercel → **Settings → Domains** → add your domain → Vercel shows the exact
     DNS records (an `A` record, or a `CNAME` for a subdomain) to enter at your
     registrar. HTTPS is issued automatically within minutes.

> The database survives redeploys, so responses are never lost — unlike the local
> JSON file, which would be wiped on a serverless host.

### Deploying elsewhere (Render, Railway, a VPS…)

It's a standard Express app (`npm start`, reads `PORT`). On any Node host, just set
a `DATABASE_URL` (Postgres) plus `ADMIN_PASSWORD` and `ADMIN_SECRET`, and push.

---

## Editing the questionnaire

All questions live in a single file: [`schema.js`](schema.js).
Change wording, options, or add questions there — both the survey form and the
Excel export update automatically. No other file needs to be touched.

---

## Project structure

```
schema.js          All 42 questions (single source of truth)
server.js          Express app: survey + admin API + Excel export
store.js           Storage adapter (file locally / Postgres in production)
db-postgres.js     Postgres backend (used when a DATABASE_URL is set)
api/[...path].js   Vercel serverless entry (re-exports the Express app)
vercel.json        Vercel routing config
data/              Saved responses, local only (git-ignored)
public/
  index.html       The survey
  admin.html       The admin dashboard
  css/             Styles (styles.css + admin.css)
  js/              survey.js · admin.js
```
