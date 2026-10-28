# Local end-to-end testing (manual + Playwright)

Use this after `npm run dev` is running (API on **3000**, web on **5173**).

## 1. Demo accounts (synthetic only)

```bash
SEED_USER_PASSWORD='at-least-12-chars' npm run db:seed -w backend
export E2E_PATIENT_PASSWORD="$SEED_USER_PASSWORD"
```

Creates `patient.demo@sukoon.test`, `doctor.demo@sukoon.test`, `admin.demo@sukoon.test` (`@sukoon.test` never delivers mail).

## 2. Bookable demo doctor

Pick **one** profile (re-running overwrites the same `doctor.demo`):

| Command | Use case |
| ------- | -------- |
| `npm run db:seed:demo-doctor -w backend` | Free **clinic**, doctor must **accept** |
| `npm run db:seed:demo-doctor:instant -w backend` | Free clinic, **instant** confirm |
| `npm run db:seed:demo-doctor:paid -w backend` | ₹500 + **`PAYMENT_PROVIDER=sandbox`** |
| `npm run db:seed:demo-doctor:video -w backend` | Free **video** + accept; needs **LiveKit** |

Or from the repo root (password required in the same command; includes next-date cache refresh):

```bash
SEED_USER_PASSWORD='at-least-12-chars' npm run setup:demo
SEED_USER_PASSWORD='at-least-12-chars' npm run setup:demo:video
```

Writes `e2e/.doctor-slug` and `e2e/.demo-seed-meta.json` (gitignored).

To refresh cached next dates alone (e.g. after editing timetables in Atlas):

```bash
npm run db:refresh-next-available -w backend
```

## 3. Environment for your flows

| Goal | `backend/.env` |
| ---- | ---------------- |
| Paid sandbox checkout | `PAYMENT_PROVIDER=sandbox` |
| Real Razorpay test keys | `PAYMENT_PROVIDER=razorpay` + keys + optional `RAZORPAY_WEBHOOK_SECRET` + `npm run webhook:tunnel` |
| Video calls | `VIDEO_PROVIDER=livekit` + `LIVEKIT_*` |
| Join without 5‑minute wait (dev only) | `VIDEO_JOIN_ANYTIME=true` |

Restart the API after `.env` changes (`rs` in the backend terminal).

Check:

```bash
curl -s http://localhost:3000/api/v1/health/ready | jq .integrations
```

## 4. Playwright

```bash
npm run playwright:install    # once
npm run test:browser          # all specs (skips what is not configured)
npm run test:browser:smoke    # public pages only, no password
```

| Spec | Needs |
| ---- | ----- |
| `smoke.spec.ts` | Dev servers (directory URL filters + home **Available now** link) |
| `integrations.spec.ts` | Dev API on :3000 (`health/ready` integration flags) |
| `patient-auth`, `doctor-auth` | `E2E_PATIENT_PASSWORD` + seed |
| `booking-flow.spec.ts` | Default `db:seed:demo-doctor` |
| `booking-sandbox-pay.spec.ts` | `db:seed:demo-doctor:paid` + sandbox payments |
| `video-flow.spec.ts` | `db:seed:demo-doctor:video` + LiveKit + `VIDEO_JOIN_ANYTIME` recommended |

## 5. Directory filters (manual)

On **Find a doctor** or from the home page 24×7 chips, try query params such as:

- `takingBookings=1` — availability turned on  
- `hasOpenSlots=1` — free slot in the next 30 days (IST)  
- `availWhen=today|tonight|weekend|public_holiday` — time window filters (IST; holidays from
  `public_holidays` when seeded, else built-in national dates)  
- `npm run db:seed-public-holidays -w backend` — optional; loads India national holidays into MongoDB  
- `npm run db:seed-service-areas -w backend` — optional; pilot Delhi + Gurugram PINs for **Doctor at home** lookup  
- `holidayState=KA` (etc.) with `availWhen=public_holiday` — state + national holidays  
- `mode=online|clinic` — consultation type  
- `feeBand=free|under_500|under_1000|under_2000` — consultation fee (INR)  
- `sort=next_available` — soonest cached `nextAvailableDate` first (doctors with no date last)  

Example: `/doctors?takingBookings=1&availWhen=weekend&mode=online`

## 6. Manual checklist (real accounts)

1. Patient: find your doctor → book **video** → pay if fee &gt; 0.  
2. Doctor: **Patient appointments** → **Accept booking**.  
3. Both: **Join** / **Video room** (with `VIDEO_JOIN_ANYTIME=true` locally).  
4. Doctor profile: **Approve each booking** toggle if you want instant confirm without accept.

## 7. API tests (no Atlas)

```bash
npm run test:e2e    # in-memory MongoDB; does not touch your dev database
```

See also [DEPLOYMENT.md](./DEPLOYMENT.md) for Atlas, Razorpay, and production rules.
