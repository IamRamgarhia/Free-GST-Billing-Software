# Running Free GST Billing Software Online

> **Important.** This app is designed to run on **your own computer** as an offline-first PWA — every invoice, GSTIN, and bank detail stays in a local `data/` folder that never touches a network. The "run online" paths below trade that privacy for remote access from multiple devices. If you don't have a hard need for online access, **the local install is still the recommended default** — see the main [README](../README.md#-install-in-60-seconds-windows-one-click).
>
> This guide is for the users who *do* need online access — a freelancer working from cafes, a small team sharing invoices across a shop and an accountant's laptop, or someone billing on a phone away from their PC.

---

## Quick decision guide — pick a path in 30 seconds

| You want… | Pick this path | Setup effort | Monthly cost |
|---|---|---|---|
| Fastest lift-and-shift, closest to how it runs locally | **Option A — Railway / Render / Fly.io** | 15 min, no code change | $0–$5 free tier, ~$5–$10 after |
| Modern serverless with a real database | **Option B — Vercel + Supabase** | 1–2 days, needs code adaptation | $0 free tier, ~$25 at scale |
| Full control, own machine on the internet | **Option C — VPS (Hetzner / DigitalOcean)** | 30 min, one-time SSH | ~$4–$6 |
| Just a private URL from your home PC | **Option D — Cloudflare Tunnel** | 10 min | $0 |

Every path below assumes you've already got the app running locally per the main README. If not, do that first.

---

## Option A — Lift-and-shift on Railway / Render / Fly.io *(recommended for most)*

**Why this is easiest.** These platforms run a Node process 24/7 with a **persistent disk** attached — exactly what the app expects. No code changes. Your `data/*.json` files sit on a real disk that survives restarts.

### On Railway (recommended — best free tier for this shape of app)

1. Create an account at [railway.app](https://railway.app) → New Project → **Deploy from GitHub repo**
2. Pick your fork of `Free-GST-Billing-Software`
3. Railway auto-detects Node — set the **Start Command** to `npm start`
4. Under Settings → **Networking**, click **Generate Domain** to get a public URL
5. Under **Volumes**, mount a **1 GB volume at `/app/data`** so invoices survive redeploys
6. Set env vars if needed (none required by default)
7. Push a commit → auto-deploys

You now have `https://your-app.up.railway.app` running the exact same app. Install it as a PWA in Chrome on any device.

### On Render

Same idea — pick "Web Service", connect the repo, `npm install && npm run build` as build, `npm start` as start, add a **Disk** at `/opt/render/project/src/data` (1 GB). Render's free tier sleeps after 15 min idle; the app cold-starts in ~5 sec.

### On Fly.io

`fly launch` in the repo folder → answer the prompts → attach a `fly volumes create data --size 1` → mount it in `fly.toml` at `/app/data`. Cheapest of the three at scale but the CLI has a learning curve.

### Making this online-safe *(do this before sharing the URL)*

The app was built assuming `localhost`-only access. Before you point real customer data at the internet, you MUST add:

1. **HTTP Basic Auth** in front of every route (5 lines of Express middleware — see [Appendix A](#appendix-a--adding-basic-auth) below).
2. **HTTPS** — Railway / Render / Fly all give you HTTPS for free with the auto-generated domain. Don't disable it.
3. **CORS lockdown** — `server.js` already restricts to `localhost`. When you deploy, update the allowlist regex to match your deployed domain instead. (See the `v1.10.0 — CORS lockdown` comment near the top of `server.js`.)
4. **Backups** — Railway/Render volumes are backed up by the platform, but export a JSON backup weekly (Settings → Backup & Restore → Download All) as a second copy.

**Ballpark cost**: Railway free trial runs a small app for weeks; after that ~$5/month. Render free tier works if you're OK with cold starts; ~$7/month for always-on. Fly.io ~$3–5/month.

---

## Option B — Vercel + Supabase *(for scale-to-zero + a real DB)*

**Reality check first.** This path is **not a 5-minute click-through**. The app currently talks to an Express server that reads/writes `data/*.json` files. Vercel is serverless (functions time out at 10s on Hobby, 60s on Pro, and they have no persistent disk). To make this work you need to:

1. **Split the frontend from the backend.** Vercel hosts the `dist/` build as a static PWA. The Express routes become either:
   - **Vercel Functions** (each route → one function under `api/*.js`), or
   - **A separate Supabase Edge Function / hosted backend** the frontend calls.
2. **Move `data/*.json` into Postgres tables in Supabase.** Bills, clients, products, expenses, purchases, recurring, receipts, terms templates, settings — each becomes a table. This is ~1 day of adapter code.
3. **Rewrite the store client.** `src/store.js` today calls `/api/bills`; you'd rewrite it to call the Supabase JS client (`supabase.from('bills').select()`) directly, skipping the Express layer entirely.

If you're comfortable with that scope, the shape is:

### Frontend on Vercel

```bash
# Vercel picks up automatically:
# - Build command: npm run build
# - Output directory: dist
# - Framework: Vite
```

Push your fork → Vercel Import → Deploy. Add env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under Project Settings.

### Database on Supabase

1. Create a project at [supabase.com](https://supabase.com) (free tier includes 500 MB Postgres, 1 GB file storage, 50 MAU auth).
2. In the SQL editor, create tables matching the JSON shapes. Minimum schema:

   ```sql
   -- One row per user (Supabase Auth handles this).
   create table profile (
     user_id uuid primary key references auth.users(id),
     data jsonb not null default '{}'::jsonb,
     updated_at timestamptz default now()
   );

   create table bills (
     id text primary key,
     user_id uuid not null references auth.users(id),
     invoice_number text not null,
     invoice_date date not null,
     status text not null default 'unpaid',
     total_amount numeric,
     paid_amount numeric default 0,
     data jsonb not null,          -- full bill body
     created_at timestamptz default now(),
     unique (user_id, invoice_number)
   );

   create table clients (
     id text primary key,
     user_id uuid not null references auth.users(id),
     name text not null,
     gstin text,
     data jsonb not null
   );

   create table products (
     id text primary key,
     user_id uuid not null references auth.users(id),
     name text not null,
     hsn text,
     data jsonb not null
   );

   -- Same pattern for expenses, purchases, recurring, receipts, templates.

   -- Row Level Security so users only see their own rows.
   alter table profile   enable row level security;
   alter table bills     enable row level security;
   alter table clients   enable row level security;
   alter table products  enable row level security;

   create policy "own profile"  on profile  for all using (auth.uid() = user_id);
   create policy "own bills"    on bills    for all using (auth.uid() = user_id);
   create policy "own clients"  on clients  for all using (auth.uid() = user_id);
   create policy "own products" on products for all using (auth.uid() = user_id);
   ```

3. Enable **Supabase Auth** with Email + Google providers so users log in.
4. Rewrite `src/store.js` to call the Supabase client (rough sketch):

   ```js
   import { createClient } from '@supabase/supabase-js';
   const supabase = createClient(
     import.meta.env.VITE_SUPABASE_URL,
     import.meta.env.VITE_SUPABASE_ANON_KEY
   );

   export const getAllBills = async () => {
     const { data, error } = await supabase.from('bills').select('*');
     if (error) throw error;
     return data.map(row => ({ ...row.data, id: row.id, status: row.status }));
   };

   export const saveBill = async (bill, opts = {}) => {
     const row = {
       id: bill.id,
       user_id: (await supabase.auth.getUser()).data.user.id,
       invoice_number: bill.invoiceNumber,
       invoice_date: bill.invoiceDate,
       status: bill.status || 'unpaid',
       total_amount: bill.totalAmount,
       paid_amount: bill.paidAmount || 0,
       data: bill,
     };
     const q = opts.overwrite
       ? supabase.from('bills').upsert(row)
       : supabase.from('bills').insert(row);
     const { error } = await q;
     if (error) throw error;
   };

   // …repeat for clients, products, expenses, etc.
   ```

5. Delete `server.js` from the deploy — you don't need Express anymore. Frontend talks to Supabase directly, RLS keeps user data separated.
6. Push → Vercel rebuilds → your PWA now runs on the edge with Supabase Postgres behind it.

**Trade-offs vs Option A:**

| | Option A (Railway) | Option B (Vercel + Supabase) |
|---|---|---|
| Setup effort | 15 min | 1–2 days |
| Code changes | None | Rewrite `store.js`, add auth, delete `server.js` |
| Multi-user support | One account per deploy | Native multi-user with Supabase Auth |
| Idle cost | Runs 24/7 (~$5/mo) | Scale-to-zero (free tier likely enough for one user) |
| Backups | Volume snapshot | Postgres PITR (Pro plan) |
| Bill archive (PDFs) | Local disk | Supabase Storage bucket |

**Recommendation:** if you're one user who just wants online access, Option A is drastically less work. Option B is only worth it if you want to onboard other businesses or run this as a mini SaaS.

---

## Option C — Own VPS (DigitalOcean / Hetzner / Contabo)

For the price of one coffee a month you get full root on a Linux VM, no serverless limits, and no vendor lock-in.

1. Spin up a **Hetzner CX11** (€3.79/mo — best price/perf) or DigitalOcean's $4 droplet
2. SSH in, install Node 18+ and PM2:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs git
   sudo npm i -g pm2
   ```
3. Clone the repo, `npm install && npm run build`
4. `pm2 start server.js --name freegstbill && pm2 save && pm2 startup`
5. Put **Caddy** in front for automatic HTTPS:
   ```
   billing.yourdomain.com {
     reverse_proxy localhost:47371
     basicauth {
       admin JDJhJDE0JGl1... # bcrypt hash of your password
     }
   }
   ```
6. `sudo systemctl reload caddy` — done. Point your DNS at the VM's IP.

Backups: `crontab -e` → `0 3 * * * rsync -a /root/Free-GST-Billing-Software/data/ /root/backups/$(date +\%F)/` runs a daily snapshot. Or set up **restic** to push to Backblaze B2 for off-site backups (~$0.005/GB/month).

**Best cost/control ratio** of any option. Downside: you're the sysadmin — OS updates, backup verification, uptime monitoring are all your problem.

---

## Option D — Cloudflare Tunnel *(zero-cost, home PC only)*

Best kept secret. Your app runs on your home PC as usual (`localhost:47371`); Cloudflare exposes it publicly at a URL you control, with HTTPS and (optional) Cloudflare Access authentication in front. No public IP, no port forwarding, no cloud bill.

1. Install `cloudflared` from [cloudflare.com/products/tunnel](https://www.cloudflare.com/products/tunnel/)
2. `cloudflared tunnel login` → picks your Cloudflare account
3. `cloudflared tunnel create freegstbill`
4. In the Cloudflare Zero Trust dashboard, create a **Public Hostname** for the tunnel → `billing.yourdomain.com` → HTTP → `localhost:47371`
5. Add an **Access policy** requiring your email to log in — now only YOU can reach it
6. Run `cloudflared tunnel run freegstbill` (or install as a service)

Your home PC must be on for the URL to work. Great for solo use — bad for a team.

---

## Data migration — going from local to online

**Option A / C (Node backend):** copy your `data/` folder to the deployed server via `scp`, put it at the same path the app expects. Done — the app comes up with all your existing bills.

**Option B (Supabase):** write a one-off migration script that reads every local `data/bills/*.json` and inserts into the `bills` table. Rough sketch:

```js
// migrate-to-supabase.mjs — run once locally with your Supabase service key
import { createClient } from '@supabase/supabase-js';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const userId = process.env.MIGRATION_USER_ID; // uuid of your Supabase user

const dir = './data/bills';
const files = await readdir(dir);
for (const f of files) {
  const bill = JSON.parse(await readFile(join(dir, f), 'utf8'));
  await supabase.from('bills').upsert({
    id: bill.id, user_id: userId,
    invoice_number: bill.invoiceNumber,
    invoice_date: bill.invoiceDate,
    status: bill.status || 'unpaid',
    total_amount: bill.totalAmount, paid_amount: bill.paidAmount || 0,
    data: bill,
  });
  console.log('migrated', bill.id);
}
```

Repeat the loop for `clients/`, `products/`, `expenses/`, etc.

---

## What you lose when you go online

Being honest about the trade-offs:

- **Privacy.** Local mode: your data never leaves your machine. Any online path puts your business data on someone else's server. Even with encryption and RLS, that server operator (Railway, Vercel, Supabase, Hetzner) can technically access it. Weigh this against the convenience.
- **Cost.** Local mode is free forever. Online paths range from free (D) to ~$5–$25/month (A/B/C).
- **Uptime.** Local mode is up whenever your PC is on. Online adds a dependency on the hosting provider's uptime.
- **Compliance.** Some CAs and auditors specifically want your GST records on-premise. Check before moving to Vercel/Supabase — Indian data-localization rules (Digital Personal Data Protection Act 2023) may require data-in-India hosting for certain business sizes.
- **Auto-update.** Local install has `Update FreeGSTBill.bat` — one click to pull the latest release. Online deploys need CI/CD or manual redeploys per push.

---

## Appendix A — Adding Basic Auth (Options A + C)

Drop this into `server.js` right after `const app = express();`:

```js
// Basic Auth — protects every route with a single username/password.
// Set via env: BASIC_AUTH_USER=admin BASIC_AUTH_PASS=your-strong-pass
const basicAuth = (req, res, next) => {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASS;
  if (!user || !pass) return next();               // no auth configured → open
  const hdr = req.headers.authorization || '';
  const [scheme, encoded] = hdr.split(' ');
  if (scheme !== 'Basic' || !encoded) {
    res.set('WWW-Authenticate', 'Basic realm="freegstbill"');
    return res.status(401).send('Auth required');
  }
  const [u, p] = Buffer.from(encoded, 'base64').toString().split(':');
  if (u === user && p === pass) return next();
  res.set('WWW-Authenticate', 'Basic realm="freegstbill"');
  return res.status(401).send('Bad credentials');
};
app.use(basicAuth);
```

Set `BASIC_AUTH_USER` and `BASIC_AUTH_PASS` as environment variables on your host, restart, and only clients with the password can reach the app.

This is a **minimum** — for a production deployment consider Auth0 / Clerk / Supabase Auth instead. Basic Auth is fine for solo use.

---

## Appendix B — Adjusting CORS for a deployed domain

Open `server.js` and find the block near the top labelled `v1.10.0 — CORS lockdown`. It currently allows only `localhost`. Add your deployed origin:

```js
// Was: /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin) || …
// Now, allow your production domain too:
/^https:\/\/billing\.yourdomain\.com$/i.test(origin) ||
/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(origin) ||
```

Keep the localhost line so `npm run dev` still works when you're developing.

---

## Cost summary at a glance

| Option | One-time setup | Monthly | Best for |
|---|---|---|---|
| **A** Railway / Render / Fly | 15 min, zero code | $0–$10 | Most people who want online access |
| **B** Vercel + Supabase | 1–2 days, code rewrite | $0–$25 | Multi-user, SaaS-ish deployments |
| **C** Own VPS (Hetzner) | 30 min, sysadmin skills | $4–$6 | Full control, tightest cost |
| **D** Cloudflare Tunnel | 10 min | $0 | Solo user with an always-on home PC |
| **Local install (default)** | 2 min | $0 | Everyone else — start here |

---

## Getting help

- Something on the deploy paths doesn't work? Open a [GitHub issue](https://github.com/IamRamgarhia/Free-GST-Billing-Software/issues) with the platform + the error you're seeing.
- Want a specific stack documented that's not here (Netlify, Cloudflare Pages + D1, Coolify, Dokploy, etc.)? Open a feature request — happy to add.

**Reminder — for 95% of users, the [local install](../README.md#-install-in-60-seconds-windows-one-click) is still the right answer.** Only go online if you have a specific reason to.
