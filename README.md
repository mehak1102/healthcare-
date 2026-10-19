# Sukoon Health (working name)

A secure, India-focused healthcare discovery and doctor-booking platform. This repository holds the
**foundation**: secure accounts, sessions, role-based access, audit logging and the design system.
Booking, payments and consultations come in later phases. See
[docs/IMPLEMENTATION_ROADMAP.md](docs/IMPLEMENTATION_ROADMAP.md).

> Development build. Not for real patient use. All accounts and data in development are synthetic.

## Stack

- **`backend/`** — the API: NestJS modular monolith, MongoDB Atlas via Mongoose, OpenAPI.
- **`frontend/`** — the website: React + Vite + TypeScript, React Router, Tailwind CSS, TanStack
  Query, React Hook Form + Zod.

The two folders are separate packages. The frontend talks to the backend only over HTTP.

## Quick start

Full instructions, including MongoDB Atlas set-up and Windows PowerShell commands, are in
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

```powershell
Copy-Item backend/.env.example backend/.env   # macOS: cp backend/.env.example backend/.env
# edit backend/.env: set MONGODB_URI and SESSION_SECRET
npm install
npm run db:indexes -w backend
npm run db:seed -w backend                      # optional synthetic demo users
npm run db:seed:demo-doctor -w backend          # optional: bookable doctor.demo (accept flow)
# or: SEED_USER_PASSWORD='…' npm run setup:demo  # seed + demo doctor + next-date cache
# npm run db:seed:demo-doctor:instant -w backend
# npm run db:seed:demo-doctor:paid -w backend   # needs PAYMENT_PROVIDER=sandbox
# npm run db:seed:demo-doctor:video -w backend  # needs VIDEO_PROVIDER=livekit
npm run dev:backend                             # terminal 1 → http://localhost:3000/api/docs
npm run dev:frontend                            # terminal 2 → http://localhost:5173
```

## Checks

```powershell
npm run check       # lint + typecheck + unit/component tests + formatting
npm run test:e2e    # API integration tests (in-memory MongoDB, no Atlas needed)
npm run playwright:install   # once: Chromium for browser tests
npm run test:browser         # needs npm run dev + demo seed password (see e2e/env.example)
npm run build
```

## Documentation

| Document                                                 | Purpose                                                    |
| -------------------------------------------------------- | ---------------------------------------------------------- |
| [LOCAL_E2E](docs/LOCAL_E2E.md)                           | Demo seed, Playwright, manual video/payment checklist      |
| [PROJECT_OVERVIEW](docs/PROJECT_OVERVIEW.md)             | Scope, roles, brand palette                                |
| [ARCHITECTURE](docs/ARCHITECTURE.md)                     | System design and module boundaries                        |
| [SECURITY](docs/SECURITY.md)                             | Threat model, controls, production blockers                |
| [DATA_MODEL](docs/DATA_MODEL.md)                         | Collections, indexes, booking concurrency design           |
| [API_CONTRACTS](docs/API_CONTRACTS.md)                   | Endpoint conventions and current endpoints                 |
| [IMPLEMENTATION_ROADMAP](docs/IMPLEMENTATION_ROADMAP.md) | Phases and status                                          |
| [DEPLOYMENT](docs/DEPLOYMENT.md)                         | Local set-up, troubleshooting, future production checklist |
| [COMPLIANCE_CHECKLIST](docs/COMPLIANCE_CHECKLIST.md)     | Indian regulatory considerations (not legal advice)        |
| [OPEN_DECISIONS](docs/OPEN_DECISIONS.md)                 | Decisions awaiting the owner, and documented assumptions   |
