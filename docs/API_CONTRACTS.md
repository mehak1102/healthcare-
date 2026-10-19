# API Contracts

The live OpenAPI document is served at `http://localhost:3000/api/docs` in development. It is
disabled in production. This file records conventions and the contracts implemented so far.

## 1. Conventions

| Topic       | Rule                                                                                                                              |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Base path   | `/api/v1`                                                                                                                         |
| Format      | JSON, UTF-8. Request body limit 100 KB                                                                                            |
| Auth        | `sid` cookie in development, `__Host-sid` in production (HttpOnly). No bearer tokens for browsers                                 |
| CSRF        | Unsafe methods need an allow-listed `Origin`. Authenticated unsafe methods also need `X-CSRF-Token`                               |
| Request ID  | Optional `X-Request-Id` in. Always echoed in the response header and in error bodies                                              |
| Caching     | Every API response is `Cache-Control: no-store`, with no ETags. Public catalogue endpoints may opt into caching later, explicitly |
| Idempotency | `Idempotency-Key` header required on booking, payment and refund creation (Phase 3+)                                              |
| Pagination  | `?page=1&limit=20` (limit at most 100). Response `{ items, page, limit, total }`. Cursor pagination for large feeds               |
| Times       | ISO-8601 UTC strings                                                                                                              |
| Money       | `{ amountMinor: number, currency: "INR" }`                                                                                        |

### Error shape

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed",
    "details": ["password must be longer than or equal to 12 characters"]
  },
  "requestId": "3b0f6c1e-…"
}
```

| HTTP | `code` examples                                                                                                                                                                           |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400  | `VALIDATION_FAILED`, `BAD_REQUEST`, `INVALID_OR_EXPIRED_LINK`, `INVALID_MFA_CODE`, `MFA_SETUP_EXPIRED`                                                                                    |
| 401  | `UNAUTHENTICATED`, `INVALID_CREDENTIALS`, `INVALID_MFA_CODE`, `MFA_CHALLENGE_EXPIRED`, `MFA_LOCKED`                                                                                       |
| 403  | `FORBIDDEN`, `CSRF_FAILED`, `MFA_REQUIRED`, `MFA_MANDATORY`, `SELF_REVIEW_FORBIDDEN`                                                                                                      |
| 404  | `NOT_FOUND` (also used when a resource exists but the caller may not see it)                                                                                                              |
| 409  | `CONFLICT`, `EMAIL_TAKEN`, `SLOT_UNAVAILABLE`, `MFA_ALREADY_ENABLED`, `MFA_NOT_ENABLED`, `APPLICATION_PENDING`, `REGISTRATION_IN_USE`, `ALREADY_A_DOCTOR`, `APPLICATION_ALREADY_REVIEWED` |
| 429  | `RATE_LIMITED`                                                                                                                                                                            |
| 500  | `INTERNAL_ERROR` (no internals exposed)                                                                                                                                                   |
| 503  | `EMAIL_UNAVAILABLE` (`MAIL_TRANSPORT=disabled`)                                                                                                                                           |

## 2. Implemented endpoints (Phase 1)

### Health

| Method & path              | Auth   | Response                                                                            |
| -------------------------- | ------ | ----------------------------------------------------------------------------------- |
| `GET /api/v1/health/live`  | public | `200 { status: "ok" }`                                                              |
| `GET /api/v1/health/ready` | public | `200 { status: "ok", checks: { database: "up" } }` or `503` with `database: "down"` |

### Authentication

| Method & path                                  | Auth    | Body                                               | Response                                                                                   |
| ---------------------------------------------- | ------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `POST /api/v1/auth/register`                   | public  | `{ fullName, email, password, acceptTerms: true }` | `201 { user, csrfToken }` + session cookie                                                 |
| `POST /api/v1/auth/login`                      | public  | `{ email, password }`                              | `200 { user, csrfToken }` + new session cookie, or `200 { mfaRequired: true }` (see below) |
| `POST /api/v1/auth/mfa/challenge`              | pending | `{ code }` (6 digits, or a recovery code)          | `200 { user, csrfToken }` + new session cookie                                             |
| `GET /api/v1/auth/mfa`                         | session | —                                                  | `200 { enabled, enrolledAt, recoveryCodesRemaining, canDisable }`                          |
| `POST /api/v1/auth/mfa/setup`                  | session | `{ password }`                                     | `200 { secret, otpauthUri }`. Not active until enabled                                     |
| `POST /api/v1/auth/mfa/enable`                 | session | `{ code }`                                         | `200 { recoveryCodes }` (shown once). Other sessions revoked                               |
| `POST /api/v1/auth/mfa/recovery-codes`         | session | `{ code }`                                         | `200 { recoveryCodes }`. Previous codes stop working                                       |
| `POST /api/v1/auth/mfa/disable`                | session | `{ password, code }`                               | `204`. `403 MFA_MANDATORY` for staff in production                                         |
| `POST /api/v1/auth/logout`                     | session | —                                                  | `204`, cookie cleared                                                                      |
| `GET /api/v1/auth/me`                          | session | —                                                  | `200 { user, csrfToken }`                                                                  |
| `GET /api/v1/auth/sessions`                    | session | —                                                  | `200 { items: SessionSummary[] }`                                                          |
| `DELETE /api/v1/auth/sessions/:id`             | session | —                                                  | `204`. `404` if the session is not the caller's                                            |
| `POST /api/v1/auth/sessions/revoke-others`     | session | —                                                  | `200 { revoked: number }`                                                                  |
| `POST /api/v1/auth/password`                   | session | `{ currentPassword, newPassword }`                 | `200 { user, csrfToken }`. Session rotated, others revoked                                 |
| `POST /api/v1/auth/password-reset/request`     | public  | `{ email }`                                        | `204` whether or not the account exists                                                    |
| `POST /api/v1/auth/password-reset/confirm`     | public  | `{ token, newPassword }`                           | `204`. Every session revoked, cookie cleared                                               |
| `POST /api/v1/auth/email-verification/request` | session | —                                                  | `204`. No email if already verified                                                        |
| `POST /api/v1/auth/email-verification/confirm` | public  | `{ token }`                                        | `204`                                                                                      |

Two-step verification notes:

- When the account has two-step verification on, `POST /auth/login` returns
  `200 { mfaRequired: true }` and a **pending** session cookie valid for 5 minutes. A pending
  session grants nothing: every other endpoint treats it as signed out. `POST /auth/mfa/challenge`
  replaces it with a full session.
- Codes follow RFC 6238 (SHA-1, 6 digits, 30 seconds, one step of clock drift either way). Each
  code is accepted once. Recovery codes look like `abcde-fgh23`, ignore case, spaces and dashes,
  and work once each.
- Wrong codes count towards the same lockout as wrong passwords (5 failures, 15 minutes). Once
  locked, the challenge returns `401 MFA_LOCKED` and clears the pending cookie.
- `user` now includes `mfaEnabled` and `staffMfaRequired`. In production, staff roles' permissions
  only apply to sessions that passed two-step verification; until then `staffMfaRequired` is true,
  `permissions` omits staff permissions, and staff endpoints return `403 MFA_REQUIRED`.

Account-recovery notes:

- Emailed links carry the token in the URL fragment (`/reset-password#token=…`,
  `/verify-email#token=…`). The web app reads it and posts it in the JSON body, so the token never
  appears in server logs, proxies or `Referer` headers.
- A reset request returns `204` before looking the address up. The lookup and the email happen in
  the background, so neither the response nor its timing reveals whether an account exists.
- Invalid, expired, already-used or superseded tokens return `400 INVALID_OR_EXPIRED_LINK`.
- When email delivery is not configured, both request endpoints return `503 EMAIL_UNAVAILABLE`
  for every address.
- These endpoints share the stricter auth rate limit.

```ts
type CurrentUser = {
  id: string;
  fullName: string;
  email: string;
  roles: Role[];
  permissions: Permission[]; // server-derived, for UI hints only
  emailVerified: boolean;
  createdAt: string;
};

type SessionSummary = {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  userAgent: string;
  ipAddress: string;
  current: boolean;
};
```

### Deleting your own account

| Method & path                 | Auth / permission              | Body                  | Response                      |
| ----------------------------- | ------------------------------ | --------------------- | ----------------------------- |
| `POST /api/v1/account/delete` | session, `account:self:manage` | `{ password, code? }` | `204`; session cookie cleared |

Errors:

- `400 INVALID_CURRENT_PASSWORD`: wrong password.
- `400 MFA_CODE_REQUIRED` or `INVALID_MFA_CODE`: two-step verification is on and the code is
  missing or wrong.
- `409 ACCOUNT_HAS_OPEN_APPOINTMENTS`: an appointment as patient or doctor has not ended yet, or an
  unpaid hold is still valid. `details` gives the count.
- `409 LAST_ADMIN`: no other active admin would be left.

Notes:

- The route uses the stricter rate limit for credential endpoints.
- One transaction removes the user, every session, emailed links, doctor applications, the public
  profile and the timetable. Unpaid holds that have run out are expired in the same step.
- Past appointments, with their name snapshots, are kept, and so are audit events. An
  `account.delete` audit event is written.
- Any booking for the doctor that was already in progress fails with `SLOT_UNAVAILABLE`.

### Administration

| Method & path             | Permission   | Query                                            | Response                                                                      |
| ------------------------- | ------------ | ------------------------------------------------ | ----------------------------------------------------------------------------- |
| `GET /api/v1/admin/users` | `users:read` | `page`, `limit`, `search` (email prefix), `role` | `200 { items: AdminUserSummary[], page, limit, total }`. Each call is audited |

### Doctor applications

| Method & path                                        | Auth / permission  | Body or query                                                                             | Response                                                                                       |
| ---------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `POST /api/v1/doctor-applications`                   | session            | `{ registrationNumber, registrationCouncil, registrationYear, qualification, specialty }` | `201 DoctorApplication`. `409 APPLICATION_PENDING`, `REGISTRATION_IN_USE`, `ALREADY_A_DOCTOR`  |
| `GET /api/v1/doctor-applications/me`                 | session            | —                                                                                         | `200 { application: DoctorApplication \| null }` (latest)                                      |
| `GET /api/v1/admin/doctor-applications`              | `providers:verify` | `status` (`pending` default), `page`, `limit`                                             | `200 { items: AdminDoctorApplication[], page, limit, total }`. Audited                         |
| `POST /api/v1/admin/doctor-applications/:id/approve` | `providers:verify` | `{ registerChecked: true, note? }`                                                        | `200`. Adds the `doctor` role. `403 SELF_REVIEW_FORBIDDEN`, `409 APPLICATION_ALREADY_REVIEWED` |
| `POST /api/v1/admin/doctor-applications/:id/reject`  | `providers:verify` | `{ reason }` (10–500 characters, shown to the applicant)                                  | `200`. The applicant may apply again                                                           |

- The browser never chooses a role or status; unknown fields are rejected with `400`.
- `registerChecked: true` records that the reviewer found the registration in the NMC or state
  council register. There is no automated register lookup.
- The status change, the role grant and the audit event commit in one database transaction.
- One pending application per account. A registration (council and number, ignoring case,
  spaces and punctuation) can back only one pending or approved application.
- The applicant is emailed the decision when email is configured. `note` is internal and never
  shown to the applicant.
- Approval also creates the doctor's profile as an unpublished draft (see below).

### Calendar (public)

| Method & path                              | Auth / permission | Query                                      | Response                                                                 |
| ------------------------------------------ | ----------------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| `GET /api/v1/calendar/public-holidays`     | public            | `region` (`IN`), `from` (IST date), `days` (1–366, default 90) | `200 { region, timezone: "Asia/Kolkata", source: "database"\|"static", items: [{ date, name }] }` |

- When `public_holidays` has rows for the region, `source` is `database` and listing uses MongoDB.
  Otherwise the built-in national date list is returned (`source: static`).
- Admin: `GET/POST /api/v1/admin/public-holidays`, `DELETE /api/v1/admin/public-holidays/:id` require
  `catalog:manage` (audited). Mutations refresh the in-memory holiday filter cache.
- Regions: `IN` (national) and pilot states `IN-KA`, `IN-MH`, `IN-TN`, `IN-DL`, `IN-TG`.

### Home visits (status only)

| Method & path                    | Auth / permission | Response                                                                 |
| -------------------------------- | ----------------- | ------------------------------------------------------------------------ |
| `GET /api/v1/home-visits/status` | public            | `200 { available: false, message, pilot: { states, pinCodeLookup, bookingOpen } }` |
| `GET /api/v1/home-visits/pin-coverage` | public        | `pin` (6-digit India PIN) | `200 { pin, valid, inPilotArea, stateCode, areaLabel, bookingOpen, message }` |
| `POST /api/v1/home-visits/quote`       | `appointments:self:book` | `{ pin, preferredWindow? }` | `200` indicative pilot fee when PIN is in area; `400 HOME_VISIT_OUT_OF_AREA` |
| `POST /api/v1/home-visits`             | `appointments:self:book` | `{ pin, addressLine1, locality?, chiefComplaint, preferredWindow }` | `200 HomeVisitRequest` when `HOME_VISIT_BOOKING_OPEN=true`; else `503 HOME_VISITS_NOT_OPEN` |
| `GET /api/v1/home-visits/mine`         | `appointments:self:book` | — | `200 { items: HomeVisitRequest[] }` |
| `POST /api/v1/provider/dispatch-offers/:id/accept` | `provider:appointments:handle` | — | `200` when the offer is still open |

### Operations (read models)

| Method & path                 | Auth / permission        | Response                                                                                                                                 |
| ----------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/ops/summary`     | `operations:dashboard`   | `200 OpsSummary`: pending doctor applications, appointment counts (IST today / next 24h), directory totals, home-visit pilot PIN count, integration flags. Audited as `ops.summary.read`. |
| `GET /api/v1/ops/home-visits` | `operations:dashboard`   | `?status&area&from&to&page&limit` → paginated queue with patient name |
| `POST /api/v1/ops/home-visits/:id/reassign` | `dispatch:operate` | `{ doctorUserId, note? }` withdraws open offers, creates a new dispatch offer (30 min TTL). Audited as `home_visit.reassign`. |

### Doctor profiles and the public directory

| Method & path                   | Auth / permission             | Body or query                                                                                      | Response                                                                       |
| ------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `GET /api/v1/doctor-profile/me` | `provider:profile:manage-own` | —                                                                                                  | `200 MyDoctorProfile` (includes `missing`: what is still needed to publish)    |
| `PUT /api/v1/doctor-profile/me` | `provider:profile:manage-own` | `{ bio, languages, consultationModes, consultationFeeInr, clinicName, city, locality, published }` | `200 MyDoctorProfile`. `400 PROFILE_INCOMPLETE` with `details` when publishing |
| `GET /api/v1/doctors`           | public                        | `specialty`, `city`, `mode` (`online`\|`clinic`), `language`, `q` (name), `takingBookings`, `hasOpenSlots`, `availWhen` (`today`\|`tonight`\|`weekend`\|`public_holiday`), `holidayState` (`KA`\|`MH`\|`TN`\|`DL`\|`TG` with `availWhen=public_holiday`), `feeBand` (`free`\|`under_500`\|`under_1000`\|`under_2000`), `sort` (`name`\|`next_available`), `page`, `limit` (≤ 48)   | `200 { items: DoctorCard[], page, limit, total }` — each card may include `nextAvailableDate` (IST) |
| `GET /api/v1/doctors/filters`   | public                        | —                                                                                                  | `200 { specialties: string[], cities: string[] }` from listed doctors only     |
| `GET /api/v1/doctors/:slug`     | public                        | —                                                                                                  | `200 DoctorPublicProfile`, or `404`                                            |

- Name, specialty, qualification and registration come from the approved application. They are
  not accepted in `PUT`; sending them returns `400 VALIDATION_FAILED`.
- Publishing needs an "about" text of at least 50 characters, a language, a consultation type and
  a fee (0 means free). In-clinic visits also need the clinic name and city.
- A profile is listed only while it is published **and** its owner is an active account that
  still has the doctor role.
- Public responses never include account IDs, email addresses or internal review notes.
- `nextAvailableDate` on directory cards and public profiles is cached on the doctor profile and
  refreshed when the timetable, availability or bookings change. Mode- and `availWhen`-specific
  directory queries still compute slots live.

### Timetables and free slots

| Method & path                     | Auth / permission              | Body or query                                                                              | Response                                                                                                           |
| --------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `GET /api/v1/doctor-schedule/me`  | `provider:schedule:manage-own` | —                                                                                          | `200 { rules, daysOff, timezone: "Asia/Kolkata", onlineBookingOpen }`                                              |
| `PUT /api/v1/doctor-schedule/me`  | `provider:schedule:manage-own` | `{ rules: [{ day 0–6, start "HH:mm", end, slotMinutes, mode }], daysOff: ["YYYY-MM-DD"] }` | `200` as above. `400 SCHEDULE_INVALID` with `details`                                                              |
| `GET /api/v1/doctors/:slug/slots` | public                         | `from` (India date, default today), `days` (1–14, default 7)                               | `200 { timezone, feeInr, bookableUntil, videoBookingOpen, days: [{ date, slots: [{ startsAt, endsAt, mode }] }] }` |

- Times are India time (UTC+05:30, no daylight saving). A block may not cross midnight or overlap
  another block on the same day; times are on 5-minute boundaries; `slotMinutes` is 10, 15, 20,
  30, 45 or 60.
- Slots start at least 30 minutes from now and at most 30 days ahead. Booked times and unexpired
  payment holds are left out.
- The slots response also has `unavailableReason` and `nextAvailableDate`.
  - `unavailableReason` is `no_timetable` when the doctor has no bookable timetable block. It is
    `payments_unavailable` when the fee is above zero and online payment is switched off.
    Otherwise it is `null`.
  - `nextAvailableDate` is the first India date in the 30-day window that has a free slot, or
    `null` when there is none.
- Online (video) slots are offered and bookable only while a video provider is configured
  (`VIDEO_PROVIDER=livekit`). `videoBookingOpen` and the timetable's `onlineBookingOpen` say
  whether that is the case; otherwise booking an online slot is `409 ONLINE_NOT_AVAILABLE_YET`.

### Appointments and payments

| Method & path                                   | Auth / permission              | Body                                                               | Response                                                                                                       |
| ----------------------------------------------- | ------------------------------ | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/appointments`                     | `appointments:self:book`       | `{ doctorSlug, startsAt, mode, patientNote? }` + `Idempotency-Key` | `200 PatientAppointment`. Paid: `pending_payment` with `checkout`; free: `confirmed`                           |
| `GET /api/v1/appointments?scope=upcoming\|past` | `appointments:self:book`       | —                                                                  | `200 { items: PatientAppointment[] }` (own only)                                                               |
| `GET /api/v1/appointments/:id`                  | `appointments:self:book`       | —                                                                  | `200 PatientAppointment`; someone else's → `404`                                                               |
| `POST /api/v1/appointments/:id/payment`         | `appointments:self:book`       | `{ razorpayOrderId, razorpayPaymentId, razorpaySignature }`        | `200` confirmed. `400 PAYMENT_SIGNATURE_INVALID`, `PAYMENT_MISMATCH`; `409 PAYMENT_TOO_LATE` (refund started)  |
| `POST /api/v1/appointments/:id/reschedule`      | `appointments:self:book`       | `{ startsAt }` (same doctor and consultation type)                 | `200` confirmed at the new time; no extra payment. `409 SLOT_UNAVAILABLE`, `409 CANNOT_RESCHEDULE` after start |
| `POST /api/v1/appointments/:id/cancel`          | `appointments:self:book`       | `{ reason? }`                                                      | `200`; full refund when paid. `409 CANNOT_CANCEL` once it has started                                          |
| `GET /api/v1/doctor/appointments?scope=…`       | `provider:appointments:handle` | —                                                                  | `200 { items: DoctorAppointment[] }` (own patients; only bookings that were confirmed)                         |
| `POST /api/v1/doctor/appointments/:id/cancel`   | `provider:appointments:handle` | `{ reason }` (5–500, shown to the patient)                         | `200`; the patient is refunded in full                                                                         |
| `POST /api/v1/doctor/appointments/:id/outcome`  | `provider:appointments:handle` | `{ outcome: "completed" \| "no_show" }`                            | `200`. `409 TOO_EARLY` before the start time                                                                   |
| `POST /api/v1/appointments/:id/video`           | `appointments:self:book`       | —                                                                  | `200 { url, token }`: a pass into this appointment's video call. See the rules below                           |
| `POST /api/v1/doctor/appointments/:id/video`    | `provider:appointments:handle` | —                                                                  | `200 { url, token }` for the doctor; same rules                                                                |
| `POST /api/v1/webhooks/razorpay`                | public, signature-verified     | Razorpay event (raw body signed with `X-Razorpay-Signature`)       | `200 { received: true }`. `400 WEBHOOK_SIGNATURE_INVALID`; `503` when no webhook secret is configured          |

- **Idempotency-Key** (16–100 of `A–Z a–z 0–9 - _`) is required on `POST /appointments`. Repeating
  a request with the same key returns the same appointment; the same key with a different body is
  `422 IDEMPOTENCY_KEY_REUSED`.
- The fee always comes from the doctor's profile on the server. Fields such as `feeInr` or
  `status` in the body are rejected (`400`).
- A paid booking holds its slot for 10 minutes. A patient may have at most 2 unpaid holds
  (`409 TOO_MANY_UNPAID_BOOKINGS`). A contested slot goes to exactly one patient; the others get
  `409 SLOT_UNAVAILABLE`.
- Payment is confirmed only after the Checkout signature verifies **and** the payment fetched from
  Razorpay matches the order, amount (paise) and currency. Authorised-only payments are captured.
- If a payment arrives after the hold was given to someone else, it is refunded in full
  automatically. If the hold lapsed but nobody took the slot, the booking is still confirmed.
- Other errors: `503 PAYMENTS_UNAVAILABLE` (no gateway configured, fee > 0),
  `503 PAYMENT_PROVIDER_ERROR`, `409 ONLINE_NOT_AVAILABLE_YET`, `403 SELF_BOOKING_FORBIDDEN`,
  `400 MODE_NOT_OFFERED`.

**Video calls.**

- Appointments carry `videoOpensAt`: 5 minutes before the start for confirmed video
  consultations that have not ended, otherwise `null`.
- A join pass is issued only to the appointment's own patient or doctor (anyone else gets `404`),
  only for confirmed video consultations, and only from `videoOpensAt` until the end time.
  Errors: `409 NOT_A_VIDEO_APPOINTMENT`, `409 APPOINTMENT_NOT_ACTIVE`, `409 TOO_EARLY`,
  `409 CALL_ENDED`, `503 VIDEO_UNAVAILABLE` (no video provider configured).
- The pass is a LiveKit token for one room (`appt_<appointment id>`), with at most 2 people. It
  cannot create, list, administer or record rooms, and it expires at the appointment's end time.
  The window applies to joining; a call already in progress is not cut off at the end time.
- Participants are named `patient` and `doctor`. The doctor's public name is shown on their tile;
  the patient's name is never sent to the video provider. Each pass is audited as
  `appointment.video.join`.

## 3. Planned endpoint groups

| Phase | Group         | Examples                                                                                                     |
| ----- | ------------- | ------------------------------------------------------------------------------------------------------------ |
| 1b    | Passkeys      | `POST /auth/passkeys/register`, `POST /auth/passkeys/authenticate` (WebAuthn, after TOTP)                    |
| 2     | Catalog       | `GET /categories`, `GET /categories/:slug`, `GET /specialties`                                               |
| 2     | Providers     | `GET /doctors?specialty&city&mode&language&availableNow&page`, `GET /doctors/:slug`                          |
| 2     | Verification  | Document evidence and re-verification dates on top of the doctor applications above                          |
| 3     | Booking       | Holidays and one-off extra hours (scheduling, booking, reschedule and cancellation are implemented above)    |
| 3     | Home visits   | `POST /home-visits/quote`, `POST /home-visits`, `POST /provider/dispatch-offers/:id/accept`                  |
| 3     | Operations    | `GET /ops/home-visits?status&area&from&to`, `POST /ops/home-visits/:id/reassign` (summary implemented below) |
| 4     | Payments      | Payment history, invoices and finance views (Razorpay checkout, webhooks and refunds are implemented above)  |
| 4     | Consultations | Waiting room and call lifecycle (joining video calls is implemented above)                                   |
| 4     | Records       | `GET /records`, `POST /records/documents`, `GET /records/documents/:id/download-url`, `POST /records/shares` |
| 4     | Privacy       | `GET /privacy/consents`, `POST /privacy/consents/:purpose/withdraw`, `POST /privacy/requests`                |
