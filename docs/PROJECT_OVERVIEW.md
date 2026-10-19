# Project Overview

> Working name: **Sukoon Health** ("sukoon" means calm or peace). The name is a placeholder until
> branding and trademark checks are done — see `OPEN_DECISIONS.md`.

## 1. What we are building

A healthcare platform that connects patients in India with verified doctors, clinics, diagnostic
centres, home-care providers and medical transport. It is a real, database-backed application, not a
static demo. The design draws on the breadth of large consumer health platforms, but the brand,
interface, copy and workflows are original.

## 2. Repository state at Phase 0 audit (13 Oct 2026)

| Item                                        | Finding                                                                                                                                                     |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Existing code                               | None. The workspace folder was empty and was not a git repository.                                                                                          |
| Existing dependencies, routes, integrations | None.                                                                                                                                                       |
| Build / test / lint status                  | Not applicable (nothing existed).                                                                                                                           |
| Existing security issues                    | None inherited.                                                                                                                                             |
| Machine                                     | macOS (Apple Silicon), Node 24, npm 11. The brief asked for Windows PowerShell commands, so `DEPLOYMENT.md` shows both macOS/Linux and PowerShell commands. |

Because nothing existed, no user work could be overwritten. Everything in this repository was
created from Phase 0 onwards.

## 3. Product scope

### MVP (Phases 1–4)

1. Accounts, sessions and role-based access control.
2. Doctor and clinic discovery with verified profiles and database-driven categories and specialties.
3. Availability engine and race-safe appointment booking (clinic visits and online consultations).
4. Doctor-at-home requests with service-area validation, matching, dispatch offers and reassignment.
5. Payments (gateway-hosted checkout), webhooks, refunds and invoices.
6. Online consultations via a video provider, prescriptions and protected medical documents.
7. Patient, doctor, clinic and administrator dashboards, and a live operations dashboard.
8. A patient privacy centre (consents, record sharing, active sessions).
9. A "Doctors available 24×7" section driven only by verified schedules.

### Later (Phase 6, after approval, partner agreements and stable MVP)

Insurance, diagnostics and home sample collection, ambulance and transport, home nursing,
packages, vouchers and memberships, partner settlements, mortuary-service partner coordination,
and advanced analytics.

### Explicit non-goals

- Emergency dispatch. The platform shows emergency guidance and routes users to official emergency
  services. It does not replace them.
- AI diagnosis or unvalidated symptom checking.
- Claims of regulatory certification, clinical validation or end-to-end encryption that we cannot
  demonstrate.

## 4. Users and roles

Patient, Doctor, Clinic/hospital staff, Diagnostic partner, Home-care provider, Transport partner,
Customer support, Operations staff, Finance staff, Platform administrator and a restricted
Super-administrator. See `SECURITY.md` for the permission model.

## 5. Visual identity

The palette comes from the two reference palettes supplied by the product owner. The tokens live in
`frontend/src/styles/tokens.css`.

| Role                       | Colour                                                                 |
| -------------------------- | ---------------------------------------------------------------------- |
| Main surfaces              | Warm off-white `#FAF7F4`, white, warm beige `#DDC9BD`                  |
| Subtle backgrounds         | Soft peach `#F9CDBE`, blush `#DDB7AA`                                  |
| Primary actions            | Coral `#F58F80` with dark text `#302B2B` (contrast ≈ 6:1)              |
| Text links and focus rings | Derived coral ink `#A84B3C` (≈ 5:1 on off-white)                       |
| Informational states       | Muted blue-grey `#9DBAC2`, sage grey `#9EAFB0`                         |
| Accents                    | Dusty rose `#C99898`, dusty mauve `#987985`, terracotta rose `#BC8F88` |
| Text                       | Primary `#302B2B`, secondary `#716967`                                 |
| Borders                    | `#E8DEDA`                                                              |

White text on coral fails WCAG contrast (about 2.4:1), so coral buttons always use dark text. Mauve
and blue-grey are used for large text, icons and decorative surfaces only, never for body text.

## 6. Document map

| Document                    | Purpose                                                                    |
| --------------------------- | -------------------------------------------------------------------------- |
| `ARCHITECTURE.md`           | System structure, modules, request lifecycle, integration adapters         |
| `SECURITY.md`               | Threat model, authentication, authorization, encryption, audit, known gaps |
| `DATA_MODEL.md`             | Collections, indexes, relationships, concurrency and retention design      |
| `API_CONTRACTS.md`          | API conventions and endpoint contracts                                     |
| `IMPLEMENTATION_ROADMAP.md` | Phased checklist and current progress                                      |
| `DEPLOYMENT.md`             | Local setup, MongoDB Atlas, environment variables, future deployment       |
| `OPEN_DECISIONS.md`         | Decisions that need the product owner, plus recorded assumptions           |
| `COMPLIANCE_CHECKLIST.md`   | India-focused privacy and healthcare compliance checklist                  |
