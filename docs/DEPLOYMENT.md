# Running Locally and Deploying Later

This guide covers running everything on your own computer. Nothing here deploys anything; hosting
is a later, manual, owner-approved step (decision D14). Commands are given for **Windows
PowerShell** and **macOS/Linux**. Run every command from the project folder unless a step says
otherwise.

## 1. Prerequisites

| Tool                    | Version                           | Check            |
| ----------------------- | --------------------------------- | ---------------- |
| Node.js (LTS)           | 22.12 or newer (24 recommended)   | `node --version` |
| npm                     | comes with Node                   | `npm --version`  |
| A MongoDB Atlas account | free tier is fine for development | —                |
| Git (optional)          | any recent                        | `git --version`  |

**Windows:** install Node.js LTS from [nodejs.org](https://nodejs.org). The installer adds `node`
and `npm` to PowerShell; close and reopen PowerShell afterwards.

If PowerShell blocks `npm` with "running scripts is disabled on this system", run this once:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

## 2. Create a MongoDB Atlas database (about 10 minutes)

1. Sign in at [cloud.mongodb.com](https://cloud.mongodb.com) and create a project (for example
   `sukoon-dev`).
2. **Create a cluster:** choose the free tier, provider of your choice, region **Mumbai
   (ap-south-1 / asia-south1)** so data stays in India.
3. **Database Access → Add New Database User:** choose password authentication, a username such as
   `sukoon_dev_app`, and a generated password. Under privileges choose **Read and write to any
   database** (for production, restrict this to the single database). Save the password somewhere
   safe; you need it in step 4.
4. **Network Access → Add IP Address → Add Current IP Address.** Avoid `0.0.0.0/0` (allow from
   anywhere) except for a short test.
5. **Clusters → Connect → Drivers:** copy the `mongodb+srv://…` connection string.

Use separate clusters or at least separate database users for development and production. Never
put real patient data in a development database.

## 3. Configure the API

Copy the example environment file. This creates `backend/.env`, which git ignores.

```powershell
# PowerShell
Copy-Item backend/.env.example backend/.env
```

```bash
# macOS/Linux
cp backend/.env.example backend/.env
```

Open `backend/.env` in your editor and set:

- `MONGODB_URI` — the connection string from Atlas, with `<db_username>` and `<db_password>`
  replaced. If the password contains special characters such as `@`, `:` or `/`, URL-encode them
  (for example `@` becomes `%40`).
- `SESSION_SECRET` — generate a random value and paste it in (the command is the same in
  PowerShell and macOS):

  ```powershell
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```

Leave the other values at their defaults for local development. The API refuses to start, with a
clear message, if a required value is missing or invalid.

## 4. Install, prepare the database and run

```powershell
npm install
npm run db:indexes -w backend     # creates indexes; never drops anything
npm run db:seed -w backend        # optional: synthetic demo accounts, development only
```

The seed creates `patient.demo`, `doctor.demo`, `support.demo` and `admin.demo` (all
`@sukoon.test`). If `SEED_USER_PASSWORD` is not set in `.env`, it prints a random password once;
copy it then. Running the seed again does not overwrite existing accounts.

Start the API and the website. Either use **one terminal** from the project root:

```bash
npm run dev
```

(macOS/Linux: runs backend and frontend together; stop with Ctrl+C.)

Or use **two terminals**:

```powershell
# Terminal 1
npm run dev:backend
```

```powershell
# Terminal 2
npm run dev:frontend
```

Then open:

| What                                          | URL                                       |
| --------------------------------------------- | ----------------------------------------- |
| Website                                       | http://localhost:5173                     |
| API documentation (Swagger, development only) | http://localhost:3000/api/docs            |
| API health                                    | http://localhost:3000/api/v1/health/ready |

The website calls the API through the Vite development proxy (`/api` → port 3000), so cookies
behave as they will in production.

The backend runs under **nodemon** (`backend/nodemon.json`). It recompiles and restarts whenever a
file in `backend/src` changes. After editing `backend/.env`, type `rs` and press Enter in the
backend terminal to restart. The website reloads itself on save.

**Emails in development.** With `MAIL_TRANSPORT=console` (the default) the API prints each email
in the backend terminal instead of sending it. To try password reset, click
**Forgot your password?** on the sign-in page, then copy the `http://localhost:5173/reset-password#token=…`
link from the backend terminal into your browser. Registration prints a
`/verify-email#token=…` link the same way. Use synthetic `.test` addresses only.

**Sending real emails over SMTP.** Any SMTP provider works (Gmail, Zoho Mail, Brevo, SendGrid,
Amazon SES and others). In `backend/.env`:

```dotenv
MAIL_TRANSPORT=smtp
MAIL_FROM="Sukoon Health <you@your-domain.in>"
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=you@gmail.com
SMTP_PASSWORD=your-16-character-app-password
```

- **Gmail:** turn on 2-Step Verification for the Google account, then create an
  [App password](https://myaccount.google.com/apppasswords) and use it as `SMTP_PASSWORD`. Your
  normal Gmail password does not work. `MAIL_FROM` must be that Gmail address.
- **Port 587** uses `SMTP_SECURE=false`; the connection is upgraded with STARTTLS. **Port 465**
  uses `SMTP_SECURE=true`.
- `SMTP_REQUIRE_TLS` defaults to `true`, so mail is never sent unencrypted. Only a local test
  inbox such as Mailpit needs `false`, and production refuses that setting.

Type `rs` in the backend terminal to restart. The log then shows
`SMTP connection verified; emails will be sent`. If it shows `SMTP connection check failed`, the
message says why (wrong password, blocked port, and so on). The API keeps running, but emails fail
until it is fixed. Message bodies, and therefore reset links, are never written to the log.

**Doctors joining.** Everyone signs in on the same page. A doctor creates a normal account, opens
**For doctors** in the header (`/doctors/join`) and submits their council, registration number,
year, qualifications and speciality. A reviewer with the `providers:verify` permission (platform
admin) opens **Doctor applications** from the account page and checks the registration in the
[NMC Indian Medical Register](https://www.nmc.org.in/information-desk/indian-medical-register/)
or the state council register. Approving adds the doctor role. Reviewers cannot approve their own
application. Approval creates the doctor's profile as a draft. The doctor opens **Your doctor
profile** from the account page, fills it in and ticks **Show my profile to patients**. It then
appears under **Find a doctor** (`/doctors`).

**Timetables and booking.** A doctor opens **Set your timetable** (`/doctor/schedule`) from their
profile page and adds weekly hours in India time. Patients then see free in-clinic slots on the
doctor's public page, choose one and book. **Your appointments** (`/appointments`) lists their
bookings; they can cancel any time before the start. Doctors see confirmed bookings under
**Patient appointments** (`/doctor/appointments`), can cancel with a reason and record whether
the visit happened. Video (online) slots are bookable only once video calls are set up (below).

**Online payments with Razorpay.** Free (₹0) consultations work without any setup. For paid
consultations:

1. Create or sign in to a [Razorpay](https://dashboard.razorpay.com/) account and switch the
   dashboard to **Test mode**.
2. Go to **Account & Settings → API Keys → Generate Test Key**. Copy the Key ID (`rzp_test_…`)
   and the Key Secret (shown once).
3. In `backend/.env`:

   ```dotenv
   PAYMENT_PROVIDER=razorpay
   RAZORPAY_KEY_ID=rzp_test_your_key_id
   RAZORPAY_KEY_SECRET=your_key_secret
   ```

4. Type `rs` in the backend terminal. Book a paid slot; the Razorpay window opens. In test mode,
   use the test cards or UPI IDs listed in Razorpay's documentation. No real money moves.

Without these settings, paid bookings are refused with "Online payments are not available right
now"; nothing is ever marked as paid without a verified payment. The browser's payment result is
always checked on the server (signature, then the payment's order, amount and currency fetched
from Razorpay) before a booking is confirmed.

**Payment webhook (optional locally, required in production).** If the browser closes right after
paying, the webhook confirms the booking instead. Razorpay cannot reach `localhost`, so locally it
needs a tunnel; without one, the browser confirmation is used. To set it up, in **Dashboard →
Webhooks** add `https://<api-host>/api/v1/webhooks/razorpay`, pick a secret, select the events
`payment.captured`, `payment.authorized`, `order.paid`, `refund.processed` and `refund.failed`,
and put the same secret in `RAZORPAY_WEBHOOK_SECRET`.

**Local webhook tunnel (optional).** From the project folder, with the API already on port 3000:

```bash
npm run webhook:tunnel
```

This starts **cloudflared** or **ngrok** if installed. Copy the printed `https://…` host, then in Razorpay set the webhook URL to
`https://<that-host>/api/v1/webhooks/razorpay` (include the path). After a test payment, the backend log should show the webhook
being applied; `curl http://localhost:3000/api/v1/health/ready` reports `integrations.paymentWebhooks: true` when
`RAZORPAY_WEBHOOK_SECRET` is set.

**Refunds.** Cancelling a paid appointment (by the patient before the start, or by the doctor)
refunds it in full through Razorpay. A payment that arrives after its slot went to someone else is
refunded automatically. If Razorpay rejects a refund, the appointment shows "Refund delayed" and
the backend log says `needs manual follow-up`: refund it from the Razorpay dashboard.

**Video consultations with LiveKit Cloud.** Without this, video slots are hidden and refused, and
in-clinic booking works as before.

1. Create a free project at [LiveKit Cloud](https://cloud.livekit.io/).
2. Open **Settings → API keys** and create a key. Copy the WebSocket URL
   (`wss://<project>.livekit.cloud`), the API key and the API secret (shown once).
3. In `backend/.env`:

   ```dotenv
   VIDEO_PROVIDER=livekit
   LIVEKIT_URL=wss://your-project.livekit.cloud
   LIVEKIT_API_KEY=your_api_key
   LIVEKIT_API_SECRET=your_api_secret
   ```

4. Type `rs` in the backend terminal. Doctors can now add **Video consultation** hours to their
   timetable, and patients can book them. From 5 minutes before the start until the end time, a
   **Join video call** button appears on the patient's appointment page and on the doctor's
   appointments list. Both people need a browser with camera and microphone permission. Browsers
   allow the camera only on `https://` sites or `localhost`.

**Testing video join without waiting.** For local development only, add `VIDEO_JOIN_ANYTIME=true` to
`backend/.env` and restart the API. Join is then allowed any time after the doctor accepts (until
the slot ends). Production **refuses to start** with this flag enabled; use the normal
`VIDEO_JOIN_EARLY_MINUTES` window (default 5) when you go live.

Things to know before going live:

- **Not end-to-end encrypted.** Media is encrypted in transit, but LiveKit's servers relay it and
  could technically access it. Do not describe calls as end-to-end encrypted.
- **No recording.** Join passes cannot start recordings, and nothing is recorded unless recording
  ("egress") is deliberately added later.
- **Where data goes.** LiveKit Cloud has media servers in India (Mumbai, Hyderabad) and normally
  routes Indian users there. Guaranteeing that calls never leave a region needs LiveKit's
  region-pinning feature on a paid plan. LiveKit stores project data such as usage and room
  metadata in the US or EU. Include LiveKit in the data-processing agreements and privacy notice
  (see `COMPLIANCE_CHECKLIST.md`).
- **Content-Security-Policy.** No policy is set for the web app today. If the hosting adds one,
  `connect-src` must allow `wss://<project>.livekit.cloud` and `https://<project>.livekit.cloud`.
  Any `Permissions-Policy` header must allow `camera` and `microphone` for the site itself.
- **Not yet tried against real LiveKit.** Automated tests use a stand-in provider. The token
  format is checked with LiveKit's own verifier, but a real two-person call should be tried
  before patients use it.

**Admin accounts.** Put `ADMIN_EMAIL` (and `ADMIN_PASSWORD` for a new account) in
`backend/.env`, then run `npm run admin:create -w backend`. An existing account with that email
is made a platform admin and keeps its password. Delete `ADMIN_PASSWORD` from `.env` afterwards.

**Demo accounts.** `npm run db:seed -w backend` creates synthetic `@sukoon.test` accounts and
prints their password. `npm run db:seed:remove -w backend` deletes exactly those accounts and their
data. Both refuse to run outside development.

**Two-step verification in development.** On the account page, choose **Turn on two-step
verification** and scan the QR code with any authenticator app. In development the encryption key
is derived from `SESSION_SECRET`, so changing that secret makes existing enrolments unusable. Turn
it off first, or register a fresh test account.

## 5. Trying the API directly

Swagger UI at `/api/docs` lists every endpoint and its request and response shapes. Health checks
need no sign-in:

```powershell
# PowerShell (curl.exe, not the curl alias)
curl.exe http://localhost:3000/api/v1/health/ready
```

```bash
# macOS/Linux
curl http://localhost:3000/api/v1/health/ready
```

State-changing requests need an `Origin` header that is on the allow-list. After sign-in they also
need the `X-CSRF-Token` returned by the login response. This is CSRF protection, not a bug. The
browser app handles it automatically.

## 6. Checks and tests

```powershell
npm run lint          # oxlint, both apps
npm run typecheck     # TypeScript, both apps
npm test              # API unit tests + web component tests
npm run test:e2e      # API integration tests against an in-memory MongoDB
npm run playwright:install   # once: download Chromium for browser tests
npm run test:browser  # optional: UI smoke tests (needs `npm run dev` running)
npm run check         # lint + typecheck + unit tests + formatting check
npm run build         # production builds of both apps
npm run audit:deps    # known vulnerabilities in runtime dependencies
```

The first `npm run test:e2e` downloads a MongoDB server binary (about 80 MB) into
`node_modules/.cache`. Later runs reuse it. The integration tests never touch your Atlas database.

**Browser tests (Playwright).** See [LOCAL_E2E.md](./LOCAL_E2E.md) for the full matrix. With the API and
website already running (`npm run dev`), install Chromium once (`npm run playwright:install`), then:

```bash
export E2E_PATIENT_PASSWORD='same-as-seed'   # see e2e/env.example
npm run test:browser
```

Smoke tests (home, doctor directory, login form) run without a password. Signed-in tests are skipped
until `E2E_PATIENT_PASSWORD` is set — use the same value as `SEED_USER_PASSWORD` when you ran
`npm run db:seed -w backend`.

To exercise **booking in the browser** (free demo clinic slot, no Razorpay), also run:

```bash
npm run db:seed:demo-doctor -w backend
```

That prepares `doctor.demo@sukoon.test` (verified, published, timetable) and writes `e2e/.doctor-slug`
and `e2e/.demo-seed-meta.json`. Variants:

- `npm run db:seed:demo-doctor -w backend` — free, **doctor must accept** (default browser test)
- `npm run db:seed:demo-doctor:instant -w backend` — free, confirmed immediately
- `npm run db:seed:demo-doctor:paid -w backend` — ₹500, instant after **sandbox** payment (`PAYMENT_PROVIDER=sandbox`)
- `npm run db:seed:demo-doctor:video -w backend` — free **video** slots (`VIDEO_PROVIDER=livekit`, `VIDEO_JOIN_ANYTIME=true` for easier join tests)

## 7. Troubleshooting

| Symptom                                            | Cause and fix                                                                                                                                                  |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API exits with "Invalid environment configuration" | A value in `backend/.env` is missing or wrong. The message names the variable (never its value)                                                                |
| `MongoServerSelectionError` / timeout              | Your IP is not in Atlas Network Access, or the URI/password is wrong                                                                                           |
| `bad auth : authentication failed`                 | Database user name or password is wrong, or the password needs URL-encoding                                                                                    |
| "Security check failed" when submitting a form     | The page's origin is not in `CORS_ORIGINS`. Use `http://localhost:5173`, or add your origin to `.env` and restart the API                                      |
| `Port 5173 is already in use` / `EADDRINUSE :3000` | **Two backends** (e.g. `npm run dev` in `backend/` in two terminals). Keep **one** API only: stop the extra terminal with Ctrl+C, or `npm run dev:stop -w backend`, then restart a single `npm run dev` in `backend/` (or use root `npm run dev` once). Check: `lsof -nP -iTCP:3000 -sTCP:LISTEN` (macOS) |
| No reset or verification email arrives             | With `console`, emails are printed in the backend terminal: search it for `reset-password#token=`. With `smtp`, check the startup log line and the spam folder |
| `SMTP connection check failed: Invalid login`      | Wrong `SMTP_USER`/`SMTP_PASSWORD`. Gmail needs an App password, not your normal password                                                                       |
| `SMTP connection check failed: … timeout`          | The network blocks the SMTP port. Try 587 instead of 465 (or the reverse), or another network                                                                  |
| "Online payments are not available right now"      | `PAYMENT_PROVIDER` is `disabled` or the Razorpay keys are missing. Add test keys (section 4) and type `rs`                                                     |
| "The payment provider did not respond as expected" | Wrong Razorpay key ID/secret pair, or Razorpay is unreachable. The backend log shows Razorpay's error code                                                     |
| Doctor's page shows no times                       | The doctor has no timetable, the profile is unpublished, or all times are within 30 minutes / more than 30 days away                                           |
| **Soonest appointment** sort looks wrong or empty  | Run `npm run db:refresh-next-available -w backend` after seeding or bulk timetable changes (updates cached `nextAvailableDate` on profiles)                  |
| Video paid but no join button                      | Doctor has not **accepted** the booking yet (`pending_doctor`), or it is more than 5 minutes before start (set `VIDEO_JOIN_ANYTIME=true` locally to test sooner) |
| Payment stuck on "pending" after Razorpay          | Browser confirmation failed; set `RAZORPAY_WEBHOOK_SECRET` and use `npm run webhook:tunnel`, or reopen the appointment and use **Complete payment** if still due |
| "Too many requests" while testing                  | Rate limiting works as designed. Wait a minute, or raise the limits in `.env` for local testing only                                                           |

## 8. Before any production deployment (later, manual)

Hosting is not set up yet (D14). When the owner chooses hosts, follow this order. Nothing is
automated.

**Hosting shape.** Serve the API and the website on the same registrable domain (for example
`app.example.in` and `api.example.in`), both over HTTPS, so that the `SameSite=Lax` session
cookie works. In production the cookie is `__Host-sid` and `Secure`.

**Production environment.** Set `NODE_ENV=production`. Before deploy, from the repo root you can
dry-run the same validation with `npm run check:production-env` (reads `backend/.env` if present,
then applies production rules). Then:

- `CORS_ORIGINS` must list only the HTTPS web origin(s).
- `SESSION_SECRET` must be newly generated and stored in the host's secret manager, never in a
  file.
- `MONGODB_DB_NAME` must not be a development or test name.
- `TRUST_PROXY_HOPS` must equal the number of proxies or load balancers in front of the API.
- `APP_BASE_URL` must be the HTTPS web address used in emailed links.
- `MFA_ENCRYPTION_KEY` must be set: 32 random bytes, base64url encoded. Generate it once, keep it
  in the secret manager, and never change it casually. Without it, nobody with two-step
  verification can sign in.
- `MAIL_TRANSPORT` must not be `console`, which would write reset links to logs. Use `smtp` with
  the chosen provider (D5), whose `MAIL_FROM` domain has SPF and DKIM set up. With `disabled`,
  password reset and email verification answer "email temporarily unavailable". SMTP in
  production must use TLS (`SMTP_REQUIRE_TLS` cannot be `false`).
- With `PAYMENT_PROVIDER=razorpay`, the key must be a live key (`rzp_live_…`) and
  `RAZORPAY_WEBHOOK_SECRET` must be set. Live keys require completing Razorpay's business
  verification (KYC).
- `VIDEO_JOIN_ANYTIME` must be **false** (or unset). Never enable it on a live site.

The API refuses to start if these production rules are broken.

**Database.**

- Use a dedicated Atlas cluster in Mumbai, and a database user restricted to the one database.
- Restrict network access to the API host's egress IPs.
- Run `npm run db:indexes -w backend` deliberately before the first release (production has
  `autoIndex` off).
- Never run the seed against production (the script refuses).
- **Backups:** free and shared tiers have limited or no automated backups, so use a dedicated tier
  with Cloud Backup and point-in-time restore for anything holding real data. Test a restore before
  launch.

**Static site security headers.** Configure these on the web host: a Content-Security-Policy
(start from `default-src 'self'; connect-src 'self' https://api.example.in; img-src 'self' data:;
frame-ancestors 'none'; base-uri 'self'; form-action 'self'`), plus HSTS, `X-Content-Type-Options:
nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`. Razorpay Checkout additionally
needs `script-src https://checkout.razorpay.com`, `frame-src https://api.razorpay.com
https://checkout.razorpay.com` and `connect-src https://api.razorpay.com
https://lumberjack.razorpay.com`; confirm the current list in Razorpay's documentation before
launch. **LiveKit video** (when `VIDEO_PROVIDER=livekit`) additionally needs `connect-src` to
include `wss://<your-project>.livekit.cloud` and `https://<your-project>.livekit.cloud`, and
`Permissions-Policy` (or feature policy) must allow `camera` and `microphone` for your app origin.
The online consultation page reads `/api/v1/health/ready` to show whether `videoCalls` is true.

**Release checklist.**

- [ ] All items in [SECURITY.md §8](./SECURITY.md) (production blockers) resolved.
- [ ] `npm run check`, `npm run test:e2e` and `npm run build` pass on the release commit.
- [ ] `npm run audit:deps` reviewed.
- [ ] Legal review complete; real Privacy Notice and Terms published (D12).
- [ ] Clinical governance owner has signed off emergency and medical copy (D11).
- [ ] Any database change has a reviewed, reversible plan; nothing destructive runs automatically.
- [ ] Monitoring and an on-call contact are in place.
- [ ] After the first production deploy (or a major scheduling release), run
      `npm run db:refresh-next-available -w backend` once against the live database so directory
      **Soonest appointment** sort uses warm caches.
