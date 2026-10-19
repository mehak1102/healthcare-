# Security

This document describes what is **implemented**, what is **planned**, and what is **not yet
done**. Nothing here is a certification or a compliance claim.

## 1. Assets and threat model (summary)

| Asset                          | Main threats                                              | Primary mitigations                                                                                                   |
| ------------------------------ | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Accounts and sessions          | credential stuffing, brute force, session theft, CSRF     | Argon2id, rate limits, lockout, HttpOnly cookies, SameSite, CSRF token, session revocation                            |
| Medical records, prescriptions | IDOR/BOLA, over-broad staff access, leakage via logs/URLs | resource-level authorization, sharing grants, audit of every access, no PHI in logs, short-lived signed URLs          |
| Bookings and payments          | double booking, replayed webhooks, client-side tampering  | server-side state machines, atomic conditional updates, unique indexes, idempotency keys, signed webhook verification |
| Provider identity              | fake doctors, forged credentials                          | manual and partner verification workflow, unverified profiles not publicly listed                                     |
| Admin functions                | privilege escalation, insider misuse                      | least privilege, separation of duties, MFA for privileged roles, audit events                                         |
| Secrets                        | leakage via repo, bundle or logs                          | env-only secrets, `.gitignore`, startup validation, no secrets in `VITE_*` variables                                  |

## 2. Authentication (implemented in Phase 1)

- **Passwords:** Argon2id via the `argon2` library. The parameters (memory 19 MiB, time 2,
  parallelism 1) meet the OWASP minimum. Passwords must be 12–128 characters and must not contain
  the email local-part. No composition rules (NIST SP 800-63B). Checking against a breached-password
  list is planned.
- **Sessions:** server-side and opaque.
  - The browser holds a random 256-bit token in an `HttpOnly`, `SameSite=Lax` cookie. In production
    the cookie is `Secure` and uses the `__Host-` prefix.
  - The database stores only the SHA-256 hash of that token, so a database leak does not expose
    usable session tokens.
  - Sessions have an absolute lifetime (`SESSION_TTL_HOURS`) and an idle timeout
    (`SESSION_IDLE_MINUTES`). A MongoDB TTL index removes expired sessions.
  - Every login creates a new session (rotation). Changing a password rotates the current session
    and revokes every other one.
  - Users can list their active sessions and revoke them.
- **Session timestamps:** `lastSeenAt` is written at most once every 5 minutes per session, to limit
  write load.
- **CSRF:** two layers. First, every unsafe request (`POST`/`PUT`/`PATCH`/`DELETE`) must carry an
  `Origin` (or `Referer`) on the allow-list. Second, authenticated unsafe requests must also send
  `X-CSRF-Token`. That token is an HMAC-SHA256 of the session-token hash under `SESSION_SECRET`,
  compared in constant time. The token is returned in the body of `/auth/me` and `/auth/login`,
  never in a cookie.
- **Brute force:**
  - Per-IP rate limits: 10 requests a minute on login and registration, 100 a minute elsewhere.
  - Per-account lockout: 5 consecutive failures lock the account for 15 minutes.
  - Locked accounts get the same generic error as wrong passwords, so the response does not reveal
    whether an account exists.
  - Unknown emails still run an Argon2 verification against a dummy hash, so response timing does
    not reveal it either.
- **Account enumeration:** registering an email that already exists returns a generic
  `409 Conflict`.
  - This is a known, accepted trade-off for now.
  - Planned: once a real email provider exists, registration will always answer "check your inbox"
    and email the existing account holder instead.
- **Two-step verification (TOTP):**
  - Any user can turn it on with an authenticator app. Set-up re-checks the password, and the
    secret only becomes active once the user proves it with a valid code. Turning it on signs out
    every other device.
  - Secrets are encrypted at rest with AES-256-GCM under `MFA_ENCRYPTION_KEY`, with the user ID as
    associated data. Production refuses to start without a dedicated key. Development derives one
    from `SESSION_SECRET`.
  - Sign-in becomes two requests. The password step creates a **pending** session that grants
    nothing and expires in 5 minutes. A valid code replaces it with a new session (rotation).
  - Each code is accepted once (the last used time step is stored and claimed atomically), with
    ±30 seconds of drift. Code comparison is constant-time.
  - Ten recovery codes (50 bits each) are shown once and stored as HMAC-SHA-256 hashes under the
    MFA key, bound to the user. Each is consumed atomically.
  - Wrong codes count towards the account lockout. Re-entering the password does not reset the
    counter, so it cannot be used to get unlimited guesses.
  - Turning it off, or replacing recovery codes, needs a valid code (and the password, to turn it
    off).
- **Staff accounts:** in `production`, staff roles (support, operations, finance, admin,
  super-admin) only grant their permissions to sessions that passed two-step verification. Until
  then the account can sign in and turn it on, but staff endpoints return `403 MFA_REQUIRED`. Staff
  cannot turn it off in production.
- **Not yet covered:** passkeys/WebAuthn (planned after TOTP), and staff-assisted recovery for
  someone who loses both their phone and their recovery codes. That needs an identity-verification
  procedure owned by the operator.
- **Password reset and email verification:**
  - Links carry a random 256-bit token. Only its SHA-256 hash is stored (`account_tokens`). Each
    token is bound to one purpose and one user, expires (30 minutes for a reset, 24 hours for
    verification), and is consumed atomically, so it works exactly once. A newer link cancels
    older ones.
  - The token sits in the URL fragment, which browsers never send to servers. The web app removes
    it from the address bar as soon as it has been read.
  - A reset request answers `204` before the account lookup runs, so neither the response nor its
    timing reveals whether an address is registered. Unknown addresses are audited but get no
    email.
  - A completed reset revokes **every** session for the account and clears any lockout. The
    password policy is checked before the token is consumed, so a rejected password does not
    waste the link.
  - A verification link only succeeds if the account's email still matches the address it was
    sent to.
  - **Email fails closed.** The `console` transport (development only) prints emails, links
    included, to the API terminal; production refuses to start with it. With
    `MAIL_TRANSPORT=disabled`, request endpoints return `503 EMAIL_UNAVAILABLE` for every address.
  - **SMTP** (`MAIL_TRANSPORT=smtp`) requires TLS by default (implicit TLS on 465, or STARTTLS
    that must succeed), with TLS 1.2 or later. Production refuses `SMTP_REQUIRE_TLS=false`. The
    SMTP password lives only in the environment. Logs record the subject and message ID, never
    the recipient's message body or links.
- **Not yet implemented:** phone verification, account deactivation, and suspicious-login alerts.
  These are listed in the roadmap.

## 3. Authorization

- Roles are stored on the user document and are **never accepted from the client**. Registration
  always creates a `patient`.
- **Doctor role.** It is granted only by approving a doctor application. The reviewer needs
  `providers:verify`, must confirm they checked the registration in the official register, and
  cannot review their own application. The approval, role grant and audit event commit in one
  transaction. Each registration can back only one live application. Other roles are granted by
  administrators; that workflow is still to come.
- **Public doctor directory.** Only published profiles whose owner is active and still has the
  doctor role are returned, checked on every query. Doctors cannot edit the reviewed name,
  specialty, qualification or registration. Public responses expose no account IDs or emails, and
  name search input is regex-escaped.
- Permissions are derived on the server from a single policy table
  (`access-control/role-permissions.ts`). Routes declare `@RequirePermissions(...)`, and
  `PermissionsGuard` enforces them.
- Routes require authentication by default. Public routes must opt out explicitly with `@Public()`.
- **Resource-level checks** live in services. For example, a user can revoke only sessions whose
  `userId` matches their own. Future patient, record and booking access will follow the same rule:
  "load by id **and** owner/grant, otherwise 404".
- **Organization boundaries:** clinic and partner staff will have `organization_memberships`. Every
  query on organization-scoped data must filter by the caller's membership (Phase 2).
- **Separation of duties:** finance, support, operations and platform-admin permissions are
  disjoint. Only `super_admin` holds role-management permission, and that role is intended for
  break-glass use only.

## 4. Encryption

| Layer                              | What it means here                                  | Status                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Transport encryption               | HTTPS/TLS between browser, API and Atlas            | Atlas enforces TLS. HTTPS for the API and web is a deployment requirement (HSTS is set by Helmet)                                                                                                                                                                                                                                                                                                                              |
| Storage encryption                 | Disk/backup encryption at rest                      | Provided by MongoDB Atlas (encryption at rest is on by default). Document storage to be chosen                                                                                                                                                                                                                                                                                                                                 |
| Application-level field encryption | Specific fields encrypted by the API before storage | Planned for highly sensitive fields (for example clinical notes and ID numbers). Key management decision pending                                                                                                                                                                                                                                                                                                               |
| End-to-end encryption (E2EE)       | Only participants' devices can read content         | **Not implemented and not claimed.** Video calls (LiveKit Cloud) are encrypted in transit only: the provider's media servers relay and could access the media, and the call page says so. Calls are not recorded. Consultation messaging and attachments will be assessed separately. Clinicians and authorized processing need server access to records, so medical records will **not** be described as end-to-end encrypted |

Keys and secrets are never stored in the database or the repository. A managed KMS is required
before field-level encryption ships.

## 5. Logging, audit and privacy in logs

- Application logs are structured JSON (pino) with a request ID. They never contain request bodies,
  query strings, cookies, authorization headers, passwords, tokens or medical data.
- `audit_events` is append-only in code: the service exposes no update or delete. Phase 1 records
  registration, login success and failure (with the reason), logout, session revocation, password
  change, password-reset requests and completions, email-verification requests and completions,
  admin user-list access, and doctor applications (submission, reviewer list views, approvals,
  rejections and denied self-reviews). Audit events hold IDs, not names or medical details.
- **Planned:** a hash chain or export to write-once storage for tamper evidence; alerting on
  repeated failures, authorization denials and privileged changes.

## 6. Application security controls

| Control                                                                                                                                                                                                  | Status                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Input validation with explicit DTO schemas, unknown fields rejected                                                                                                                                      | Implemented                                                                      |
| NoSQL injection: DTOs accept only primitive types, so operator objects are rejected with 400; no raw query objects from clients; Mongoose `strictQuery`. User search input is regex-escaped and anchored | Implemented (covered by integration tests)                                       |
| API responses sent with `Cache-Control: no-store` and no ETags, so browsers and proxies never keep personal data                                                                                         | Implemented                                                                      |
| XSS: React escaping, no `dangerouslySetInnerHTML`, CSP via Helmet on API responses                                                                                                                       | Implemented. A CSP for the static web host is set at deployment                  |
| Security headers (Helmet), `x-powered-by` disabled                                                                                                                                                       | Implemented                                                                      |
| Request body size limit (100 KB JSON)                                                                                                                                                                    | Implemented                                                                      |
| CORS limited to configured origins, with credentials. The same allow-list is the Origin check for CSRF; in development it defaults to `http://localhost:5173` and `http://127.0.0.1:5173`                | Implemented                                                                      |
| Rate limiting                                                                                                                                                                                            | Implemented (in-memory; needs a shared store if more than one API instance runs) |
| Error responses without stack traces or internals                                                                                                                                                        | Implemented                                                                      |
| Uploads: size, MIME and magic-byte checks, private storage, malware scanning                                                                                                                             | Planned (Phase 4)                                                                |
| SSRF: no user-supplied URLs are fetched; future adapters use fixed hosts                                                                                                                                 | Policy                                                                           |
| Dependency scanning (`npm audit`)                                                                                                                                                                        | Script available. Automated scanning comes when CI is introduced                 |

### Payments and booking

- **Server-side amounts only.** The amount of every Razorpay order is computed on the server from
  the doctor's fee, in paise. Fee, status or payment fields sent by the browser are rejected.
- **Nothing counts as paid on the browser's word.** Confirming needs (1) the Checkout signature,
  HMAC-SHA256 of `order_id|payment_id` with the key secret, compared in constant time, and (2) the
  payment fetched from Razorpay with the same order, amount and currency, captured on our side if
  it was only authorised. Mismatches are audited as `denied`.
- **Webhooks** are accepted only with a valid `X-Razorpay-Signature` over the exact raw body. The
  endpoint is public, carries no cookie or Origin header, and so is not subject to CSRF checks;
  the signature is its only authentication. Event IDs are stored to ignore replays. Without a
  webhook secret the endpoint answers `503`.
- **Fails closed.** `PAYMENT_PROVIDER=disabled` (the default) refuses paid bookings with
  `503 PAYMENTS_UNAVAILABLE`; nothing is ever marked paid without a verified payment. Production
  refuses test keys and requires a webhook secret. The key secret never reaches the browser; only
  the public key ID does.
- **Refunds** are claimed atomically per payment ID, so retries cannot refund twice. A refund the
  gateway rejects is recorded as `refund_failed`, logged and audited for manual follow-up.
- **Access.** Patients see only their own appointments (`404` otherwise). Doctors see only their
  own confirmed appointments. Patients cannot book themselves as their own doctor.
- **Health information.** The patient's reason for visit is shown to the patient and their doctor
  only, and is kept out of logs, audit metadata and emails. Razorpay order notes contain only the
  appointment ID.
- **Abuse limits.** At most 2 unpaid holds per patient, each lasting 10 minutes.

## 7. Security assumptions

1. The API and web app will be served from the **same site** in production (for example
   `app.example.in` and `api.example.in`), so `SameSite=Lax` cookies work.
2. Only one API instance runs during the pilot. In-memory rate limits are acceptable until scaling
   out.
3. The Atlas cluster is in an India region (Mumbai), with network access restricted to known IPs
   and a least-privilege database user.

## 8. Production blockers (must be resolved before real patients)

- [ ] Generate and store `MFA_ENCRYPTION_KEY` in the host's secret manager. Losing it makes every
      enrolled authenticator unusable.
- [ ] A documented, identity-checked procedure for staff to reset someone's two-step verification.
- [ ] Choose the production email provider (D5), configure `MAIL_TRANSPORT=smtp` and set up SPF
      and DKIM for the sending domain. Phone verification is still to do.
- [ ] Legal review of privacy notice, terms and consent text, plus a DPDP Act assessment.
- [ ] Clinical governance owner and review of emergency and medical copy.
- [ ] KMS-backed field encryption for designated sensitive fields.
- [ ] Shared rate-limit store if horizontally scaled.
- [ ] Independent security review / penetration test.
- [ ] Backup restore test on the chosen Atlas tier.
- [ ] Razorpay live keys (after KYC) and webhook secret in the secret manager; Checkout domains
      added to the web host's Content-Security-Policy; a test payment and refund on live mode.
- [ ] Incident-response runbook with named owners.

## 9. Reporting a vulnerability

Until a security contact exists, report issues privately to the project owner. Do not open public
issues containing exploit details or personal data.
