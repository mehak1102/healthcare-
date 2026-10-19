# Implementation Roadmap

Each phase ends with working, tested, documented software. A phase is only "done" when its exit
checks have actually been run. Owner decisions referenced as D1–D14 are in
[OPEN_DECISIONS.md](./OPEN_DECISIONS.md).

Status key: ✅ done · 🟡 in progress · ⬜ not started

## Phase 0 — Audit, architecture and documentation ✅

- ✅ Repository audit. The folder was empty, so no existing work needed preserving.
- ✅ Architecture, security, data model, API contract, compliance and open-decision documents.
- ✅ Project scaffold: separate `backend/` and `frontend/` folders (linked as npm workspaces),
  TypeScript strict, oxlint, Prettier.
- ✅ Centralised design tokens from the brand palette, with accessibility-checked derived shades.

## Phase 1 — Secure foundation 🟡

Built and verified:

- ✅ NestJS modular monolith: config validation (fails fast, rejects placeholder secrets in
  production), MongoDB connection, structured logging with request IDs and redaction, a stable
  error shape, security headers, body limits, CORS, `Cache-Control: no-store`.
- ✅ Accounts: registration (patients only), login, logout and `/auth/me`. Argon2id hashing,
  account lockout and generic errors.
- ✅ Sessions: opaque tokens stored only as hashes, HttpOnly cookies, idle and absolute expiry,
  rotation on login and password change, and a device list with revocation.
- ✅ CSRF: Origin allow-list plus a session-bound token.
- ✅ Rate limiting, with a stricter limit on credential endpoints.
- ✅ RBAC policy table for 11 roles, a permission guard and audited denials. In production, staff
  permissions only apply to sessions that passed two-step verification.
- ✅ Append-only audit log for auth events and privileged reads.
- ✅ Read-only admin user list (search, role filter, pagination), audited.
- ✅ Web: design system primitives, header and footer with a permanent emergency notice, home page,
  sign-in, registration, account and security page, admin users page, emergency page, and draft
  legal pages.
- ✅ Tests: unit (API), integration against a real in-memory MongoDB replica set (API), and
  component tests (web).
- ✅ Scripts: index sync (non-destructive) and a development-only seed with synthetic users.
- ✅ Email verification and password reset (single-use hashed tokens, links in the URL fragment, no
  account enumeration, every session revoked after a reset). Development prints emails to the API
  terminal; production fails closed until a provider is chosen.
- ✅ Two-step verification with an authenticator app (TOTP): set-up with QR code, sign-in
  challenge, single-use recovery codes, replay protection and lockout. Staff permissions in
  production require a verified session.
- ✅ Real email over SMTP (`MAIL_TRANSPORT=smtp`, any provider, TLS enforced in production,
  connection checked at start-up).
- ✅ Doctor onboarding: doctors apply with their council registration; a reviewer with
  `providers:verify` checks the official register and approves or rejects. Approval grants the
  doctor role in one transaction with the audit event. Self-review is blocked.

Remaining in Phase 1:

- ⬜ Owner picks the production email provider and sets up SPF/DKIM for the sending domain (D5).
- ⬜ Staff-assisted two-step verification reset (identity-checked, audited, super admin only).
- ⬜ Admin actions: change roles (super admin only, audited, with a reason), disable/enable an
  account, force sign-out.
- ⬜ `consent_records` collection, replacing the interim terms fields on `users`.
- ⬜ Breached-password check (k-anonymity range API), behind a port with an offline fallback.
- 🟡 Playwright browser tests: public smoke, patient/doctor sign-in, clinic booking with doctor
  accept, sandbox paid booking, video join (needs demo seed + LiveKit locally). Auth/MFA journeys
  still manual.
- ⬜ A migrations runner (versioned, reviewed, never automatic in production).

**Exit checks:** `npm run check`, `npm run test:e2e`, manual review of the security headers and
cookie flags, and an audit-log review of a full auth journey.

## Phase 2 — Catalogue and providers 🟡

Built and verified:

- ✅ Doctor profiles: an unpublished draft is created on approval with the reviewed details
  locked. Doctors add their about text, languages, video or in-clinic visits, fee and clinic
  location, then publish.
- ✅ Public "Find a doctor" directory and profile pages, with filters for speciality, city,
  consultation type, language, name, **fee band**, **taking new bookings** (`takingBookings`),
  open slots, and time windows (`availWhen`). Only published profiles of active accounts with the
  doctor role are listed, and each shows when its registration was checked.

Remaining:

- Profile photos (needs private storage, D6) and clinic contact details.
- Database-driven categories, specialties and services (replacing the static "Coming soon" cards
  on the home page), with admin CRUD, ordering and visibility flags.
- Doctor profiles: qualifications, council and registration number, languages, fees, consultation
  modes. Organisation (clinic/hospital) profiles and memberships.
- Extend the doctor application review (built in Phase 1) with document evidence (registration
  certificate, ID), decision history and re-verification dates (D7). Only verified profiles
  become public.
- Public search and filtering (specialty, city, mode, language, **fee band** on the directory), with
  honest empty states.
- Organisation-scoped authorization for clinic admins and receptionists.

**Exit checks:** an unverified profile can never appear publicly (tested). Clinic staff cannot read
another clinic's data (tested).

## Phase 3 — Scheduling, booking and home visits 🟡

Built and verified:

- ✅ Doctor timetables (weekly hours in IST, visit length, consultation type, days off) and slot
  generation in India time, with unit tests at day boundaries.
- ✅ Race-safe booking: 10-minute payment holds, a unique partial index, per-doctor serialised
  transactions and `Idempotency-Key` handling. Tested: six simultaneous bookings for one slot
  produce exactly one success.
- ✅ Razorpay payments (pulled forward from Phase 4): hosted Checkout, server-side signature and
  amount verification, capture of authorised payments, signed and de-duplicated webhooks,
  automatic full refunds on cancellation or late payment. Fails closed when not configured.
- ✅ Appointment lifecycle with an event history: patients cancel any time before the start (D9),
  doctors cancel with a reason or record completed / no-show. Emails to patient and doctor.
- ✅ Pages: booking on the doctor's profile, Your appointments, appointment details with Pay now
  and Cancel, the doctor's timetable and appointments.

Remaining:

- ✅ Patient rescheduling of confirmed appointments (new slot, same doctor and mode; no extra payment).
- ✅ Video consultations inside the website (LiveKit; online slots open when configured).
- ✅ Holidays (days off on the timetable, including quick **Today/Tomorrow IST** on the schedule page).
- ✅ One-off **extra hours on a date** on the doctor timetable (outside the weekly pattern).
- 🟡 The 24×7 doctors view: **Available now** (`availWhen=today`), **Online**, **Clinic visit**,
  **Tonight**, **Weekend**, and **Public holiday** (`availWhen=public_holiday`, India gazetted
  dates in code); directory and public profile show `nextAvailableDate`. Home-visit matching still
  to come; **`public_holidays`** collection + seed (`db:seed-public-holidays`) are in place for
  national dates — state-specific rows are later (see DATA_MODEL).
- Home visits: 🟡 `service_areas`, PIN coverage, `home_visit_requests` + `dispatch_offers`, quote/create (gated by `HOME_VISIT_BOOKING_OPEN`), ops queue + reassign + doctor accept. Remaining: automatic matching, ETAs, en-route lifecycle (D4).
- Notifications (email first, then SMS after DLT registration, D5).
- ✅ Operations dashboard (read models): `GET /ops/summary` + `/ops` UI. Dispatch and home-visit reassignment APIs still planned.

**Exit checks:** concurrency tests prove that two parallel bookings for one slot produce exactly one
success. Time-zone tests cover the IST day boundaries.

## Phase 4 — Payments, consultations, records and privacy centre ⬜

- Payments beyond booking (Razorpay checkout, webhooks and refunds are built in Phase 3): a
  finance view of payments and refunds, invoices (GST), settlements to doctors (D10).
- Video consultations (D3), with a waiting room and lifecycle.
- Prescriptions (doctor role only), document uploads with private storage (D6) and malware
  scanning, sharing grants and an access log.
- Privacy centre: consent management, data export and deletion requests (DPDP), and an access
  history the patient can view.
- Support tickets and grievance handling.
- KMS-backed field encryption for designated sensitive fields.

## Phase 5 — Hardening and launch readiness ⬜

- Observability: error tracking, uptime checks, log retention, alerting on security events.
- Load tests for search and booking; a backup restore drill.
- External penetration test, legal review (D12), and clinical governance sign-off (D11).
- Hosting set-up (D14) by the owner, following [DEPLOYMENT.md](./DEPLOYMENT.md). No automatic
  deployment.

## Phase 6 — Extended services (after approval and partner agreements) ⬜

Diagnostics, medical transport, home nursing, insurance and health packages. Each needs signed
partner agreements before any listing appears.
