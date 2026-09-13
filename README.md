# Cloud Computing Project: Next.js & Supabase Cloud Architecture

A modern web application architecture built with **Next.js App Router (Serverless on Vercel)** and **Supabase Managed PostgreSQL**. Designed with strict architectural boundaries, server/client isolation, zero-ORM neutrality, and multi-tier quality gates.

---

## 1. Architecture Overview

The system employs a unified single-repository design structured across five distinct domains:
- **Application Runtime:** Next.js App Router deployed as Serverless functions on Vercel (Server Components, Route Handlers, Edge Middleware).
- **Database Lifecycle:** Supabase Managed PostgreSQL with pooled runtime execution and direct migration channels.
- **Operational Tooling:** Standalone TypeScript scripts under `scripts/` for environment verification and batch maintenance.
- **Quality Gates:** Multi-layered test suites under `tests/` covering unit boundaries, integration contracts, migrations, RLS policies, and E2E scenarios.
- **CI/CD Pipeline:** Automated GitHub Actions workflows under `.github/workflows/` ensuring zero-regression delivery.

*Architecture Note: The project avoids traditional 3-tier monolithic folders (`frontend/`, `backend/`), Docker containers, and standalone microservices.*

---

## 2. Tech Stack & Technologies

- **Framework:** Next.js 16.3.5 (App Router, React Server Components)
- **Runtime & Language:** Node.js (>= 22.x LTS), TypeScript 5.7.3
- **UI Library:** React 19.3.0
- **Database:** Supabase Managed PostgreSQL (Row Level Security & Supavisor Connection Pooler)
- **Observability:** `@sentry/nextjs` 10.74.0 (configured at project root)
- **Code Quality:** ESLint 9.20.0 (Flat Config)
- **Test Runner:** Node.js Native Test Runner (`node:test`, `node:assert/strict`)

---

## 3. Directory Layout & Structure

```text
cloud-compute-c2g9/
├── .github/workflows/ci.yml       # GitHub Actions CI/CD pipeline
├── public/                        # Static assets
├── scripts/
│   ├── health/check-local-env.ts  # Local environment diagnostic CLI
│   ├── backfill/                  # Chunked batch backfill scripts
│   └── maintenance/               # Periodic maintenance tasks
├── src/
│   ├── app/                       # Next.js App Router (pages, layouts, API routes)
│   │   ├── (authenticated)/       # Authenticated route group
│   │   ├── (public)/              # Public route group
│   │   └── api/health/route.ts    # Production health check Route Handler
│   ├── components/
│   │   ├── layout/                # Shell and layout components
│   │   └── ui/                    # Pure presentational UI components
│   ├── features/                  # Isolated business feature modules
│   ├── lib/                       # Shared utilities, DB client contract, config
│   │   └── db/index.ts            # Zero-ORM DatabaseClient interface
│   ├── server/                    # Server-only domain services & repositories
│   │   ├── repositories/          # BaseRepository interface & implementations
│   │   └── services/              # Domain logic services
│   ├── instrumentation.ts         # Sentry initialization hook
│   └── middleware.ts              # Edge middleware
├── supabase/
│   ├── migrations/                # Versioned SQL migrations (<timestamp>_<desc>.sql)
│   └── seed/seed.sql              # Idempotent seed data
├── tests/
│   ├── unit/                      # ESLint boundary & server-only tests
│   ├── integration/               # Repository contract & client integrity tests
│   ├── migration/                 # Migration ordering & SQL syntax tests
│   ├── rls/                       # Row Level Security policy tests
│   └── e2e/                       # 4-Tier Opaque-Box architectural E2E tests
├── .env.example                   # Environment variable template
├── eslint.config.mjs              # Architectural boundary lint rules
├── next.config.ts                 # Next.js & Sentry build configuration
├── sentry.*.config.ts             # Root Sentry client/server/edge configs
└── tsconfig.json                  # TypeScript compiler settings & path aliases
```

---

## 4. Server-Only & Architectural Boundaries

1. **Server-Only Boundary (`server-only`):**
   - Every file in `src/server/` and `src/lib/db/` must include `import "server-only";` on line 1.
   - Accidental imports by Client Components (`'use client'`) fail at compile time, preventing secret leakage.

2. **UI Purity Rule:**
   - Components in `src/components/ui/` are pure presentational units.
   - Enforced by ESLint `no-restricted-imports`: UI components cannot import from `@/server` or `@/features`.

3. **Feature Isolation Rule:**
   - Feature modules in `src/features/<feature-a>/` cannot import from sibling modules `src/features/<feature-b>/`.
   - Cross-cutting logic must reside in `src/lib/` or shared components.

4. **Zero-ORM Neutrality:**
   - No heavyweight ORM (Prisma/Drizzle) is installed.
   - Data access adheres to the neutral `DatabaseClient` and `BaseRepository` contracts with SQL migrations as the single source of truth.

---

## 5. Database Connection Model & Supavisor Pooling

The architecture strictly separates transactional runtime queries from schema migration operations:

| Connection String | Port | Mode | Target Service | Usage |
|---|:---:|:---:|---|---|
| **`DATABASE_URL`** | `6543` | Transaction | Supavisor Connection Pooler | Used by 100% of runtime queries from Server Components and Route Handlers. Eliminates connection exhaustion during serverless scaling. |
| **`DIRECT_URL`** | `5432` | Session | PostgreSQL Direct Instance | Reserved for migration tooling (`supabase db push`, CI runner) requiring DDL transaction locks, advisory locks, and extension management. |

---

## 6. Schema Migrations & Seeding

- **Naming Convention:** All migrations under `supabase/migrations/` follow the timestamp pattern:
  ```text
  <YYYYMMDDHHMMSS>_<snake_case_description>.sql
  ```
- **Schema Evolution:** Changes follow the **Expand -> Migrate/Backfill -> Contract** pattern to ensure zero-downtime deployments.
- **Idempotent Seeding:** `supabase/seed/seed.sql` uses `ON CONFLICT DO UPDATE` to safely run multiple times without data corruption.

---

## 7. Observability & Sentry Integration

- **Root Configurations:** Sentry configs (`sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`) remain at the project root for automatic detection by the Next.js compiler.
- **Source Maps:** Uploaded during CI via `SENTRY_AUTH_TOKEN` and stripped from production artifacts to prevent code exposure.
- **PII Scrubbing:** Configured with `beforeSend` filters to sanitize sensitive parameters prior to transmission.

---

## 8. Health Checks & Diagnostics

- **Production Health Endpoint:** `GET /api/health` (`src/app/api/health/route.ts`) configured with `dynamic = "force-dynamic"` returns HTTP 200 `{"status":"healthy","timestamp":"..."}` in under 50ms for external uptime monitors.
- **Local Diagnostic Tool:** `scripts/health/check-local-env.ts` provides pre-flight validation of environment variables and connection strings independently of the Next.js server.

---

## 9. Environment Configuration (.env)

Variables in `.env.example` are partitioned by exposure level:

| Variable | Classification | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser-Safe | Supabase API endpoint for client SDK |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-Safe | Supabase anonymous key governed by RLS |
| `NEXT_PUBLIC_SENTRY_DSN` | Browser-Safe | Sentry error ingestion endpoint |
| `DATABASE_URL` | Server Secret | Pooled Supavisor connection string (port 6543) for runtime |
| `DIRECT_URL` | Server/CI Secret | Direct PostgreSQL connection string (port 5432) for migrations |
| `SUPABASE_SERVICE_ROLE_KEY` | Server Secret | Administrative Supabase key bypassing RLS (never client-exposed) |
| `SENTRY_AUTH_TOKEN` | CI Secret | Authentication token for Sentry release and source map uploads |

---

## 10. Testing Strategy & Quality Gates

The system relies on Node.js native test runner (`node:test`, `node:assert/strict`) for rapid, dependency-free test execution:

```bash
# Run unit, integration, migration, and RLS test suites
npm test

# Run 4-tier opaque-box architectural E2E tests
npm run test:e2e
```

Test hierarchy:
- `tests/unit/`: ESLint boundary rules and `server-only` directive enforcement.
- `tests/integration/`: `DatabaseClient` and `BaseRepository` contract conformance.
- `tests/migration/`: Migration naming, chronological order, and SQL syntax validity.
- `tests/rls/`: Row Level Security enablement and access policy enforcement.
- `tests/e2e/`: 4-tier black-box architectural tests (Coverage, Boundaries, Interactions, Scenarios).

---

## 11. CI/CD Pipeline & Workflow

Automated via GitHub Actions (`.github/workflows/ci.yml`) on `push` and `pull_request` to `main`, `master`, and `dev/**`:

```text
[ Push / PR ] ──► 1. lint (ESLint Flat Config)
              ──► 2. typecheck (tsc --noEmit)
              ──► 3. test (npm test & test:e2e)
              ──► 4. migration-check (DIRECT_URL validation)
              ──► 5. sentry-release (Source maps & release tracking)
              ──► 6. build (Production Turbopack compilation)
```

---

## 12. Getting Started & Development

### Quick Start
```bash
# 1. Clone repository
git clone https://github.com/Gawasna/cloud-compute-c2g9.git
cd cloud-compute-c2g9

# 2. Install dependencies
npm install

# 3. Setup environment variables
cp .env.example .env.local

# 4. Run pre-flight diagnostic check
npx tsx scripts/health/check-local-env.ts

# 5. Start development server
npm run dev
```

### Key CLI Commands
| Command | Description |
|---|---|
| `npm run dev` | Start local Next.js development server |
| `npm run lint` | Execute ESLint across all files and boundary rules |
| `npm run type-check` | Validate TypeScript types via `tsc --noEmit` |
| `npm test` | Run all unit, integration, migration, and RLS test suites |
| `npm run test:e2e` | Run 4-tier architectural E2E test suite |
| `npm run build` | Compile Next.js production build bundle |
