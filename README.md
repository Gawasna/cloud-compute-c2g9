# CloudStock — Hệ thống quản lý kho trên Cloud

CloudStock là ứng dụng quản lý kho bằng **Next.js (frontend)**, **NestJS (REST API)** và **Supabase (PostgreSQL + Authentication)**. Giao diện sử dụng tiếng Việt, hỗ trợ 3 vai trò: **Quản trị viên**, **Nhân viên kho**, **Người xem báo cáo**.

## Bắt đầu nhanh

1. Chạy lần lượt các migration trong `supabase/migrations/` theo tên tăng dần. Nếu đã chạy migration Giai đoạn 4, chỉ chạy migration mới `20261025000001_user_management.sql`.
2. Giữ file `backend/.env` tại máy cá nhân, cấu hình `DATABASE_URL`, `DATABASE_SSL_CA_PATH` (nếu cần), `SUPABASE_URL`, `SUPABASE_ANON_KEY`, **`SUPABASE_SERVICE_ROLE_KEY`** (server-only) và `FRONTEND_ORIGIN=http://localhost:3000`.
3. Giữ `.env.local` tại thư mục gốc với `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL=http://localhost:4000/api`.
4. Terminal 1: `cd backend && npm install && npm run dev`.
5. Terminal 2 tại thư mục gốc: `npm install && npm run dev`. Truy cập `http://localhost:3000/login`.

> **Bảo mật:** Tuyệt đối không đưa mật khẩu database, Supabase service role key, `.env`, `.env.local` hay chứng chỉ cá nhân lên Git. Chỉ dùng service role key trong `backend/.env`, không đặt tên biến bắt đầu bằng `NEXT_PUBLIC_`.

## Giai đoạn 5 — Quản lý tài khoản nhân viên

Trong mục **Người dùng** (chỉ Admin), có thể:
- Xem danh sách tên, email, vai trò, trạng thái và ngày tạo.
- Tạo tài khoản nhân viên mới, đặt mật khẩu ban đầu (ít nhất 10 ký tự).
- Đổi vai trò `admin`, `staff`, `viewer`.
- Khóa/mở khóa tài khoản. Khi khóa, NestJS từ chối cả phiên hiện có và Supabase Auth chặn đăng nhập mới.
- Không tự đổi vai trò hoặc tự khóa/mở khóa tài khoản của chính mình.

API NestJS: `GET /api/users`, `POST /api/users`, `PATCH /api/users/:id/role`, `PATCH /api/users/:id/status`. Tất cả đều cần `Authorization: Bearer <token>` của Admin. Dịch vụ tạo người dùng sử dụng Supabase Admin API phía server; không đưa `service_role` cho browser.

### Triển khai migration Giai đoạn 5

Chạy `supabase/migrations/20261025000001_user_management.sql` trong SQL Editor một lần. Lệnh thêm cột `profiles.is_active BOOLEAN NOT NULL DEFAULT true`, không xóa 3 tài khoản và 30 sản phẩm hiện có. Đảm bảo máy Backend đã nạp `SUPABASE_SERVICE_ROLE_KEY` hợp lệ, sau đó khởi động lại Backend.

### Kiểm thử Giai đoạn 5

1. Admin xem danh sách 3 tài khoản cũ; email và vai trò hiển thị đúng.
2. Admin tạo tài khoản Staff mới, đăng nhập thành công.
3. Admin đổi vai trò Staff sang Viewer; sau tải lại, Viewer không thể nhập/xuất.
4. Admin khóa một tài khoản phụ; đăng nhập mới không được và token cũ bị NestJS từ chối.
5. Admin mở khóa tài khoản; đăng nhập được trở lại.
6. Staff/Viewer gọi `GET /api/users` hoặc `POST /api/users` phải nhận HTTP 403.
7. Admin không thể đổi vai trò hoặc khóa tài khoản chính mình.
8. Chứng minh `profiles.is_active` được cập nhật và nhật ký kho cũ vẫn còn `performed_by` UUID để truy vết.

**Lưu ý:** Đây là chức năng quản lý nội bộ cho đồ án; chưa tích hợp email mời / bắt buộc thay mật khẩu lần đầu hay nhật ký audit của thao tác quản trị. Khi deploy production cần đánh giá thêm các kiểm soát này.

---

## Tài liệu dự án ban đầu

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


---

## Nội dung đã hợp nhất từ `AUTH_SETUP.md`

# CloudStock — Đăng nhập Supabase (3 vai trò)

## Đã triển khai

- `/login`: đăng nhập email/mật khẩu với Supabase Auth; không cho đăng ký công khai.
- `/`: kiểm tra session, gọi NestJS `GET /api/auth/me` để lấy vai trò từ `public.profiles`; chuyển về `/login` khi chưa đăng nhập.
- Dashboard khóa vai trò theo API; không còn dropdown đổi quyền giả lập; có nút Đăng xuất.
- Access token được gửi tới NestJS để kiểm chứng bằng Supabase Auth và vai trò trong `profiles`.
- Token được lưu tại `sessionStorage` trên trình duyệt (không tồn tại sau khi đóng tab); tự refresh khi hết hạn. Với triển khai production, nên chuyển sang kiến trúc cookie HttpOnly/BFF, CSP chặt chẽ, và áp dụng bảo vệ route từ phía server.

## Cấu hình

Tạo file `.env.local` tại root (không commit):

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_LEGACY_ANON_KEY
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

Backend giữ nguyên `.env` riêng và chứng chỉ CA đã hoạt động trên máy. Khởi động `cd backend && npm run dev` và tại root `npm run dev`.

## Tài khoản

Tạo 3 user trong Supabase Authentication → Users. Gán 3 `auth.users.id` tương ứng vào `public.profiles`, với role `admin`, `staff`, `viewer`. Bảng profiles phải có hồ sơ tương ứng; API sẽ trả 403 nếu thiếu.

## Thử nghiệm

1. Truy cập `http://localhost:3000/` (chưa đăng nhập) → `/login`.
2. Đăng nhập Admin → hiển thị Dashboard có menu quản trị.
3. Đăng xuất và đăng nhập Staff → chỉ có menu dashboard/sản phẩm/nhập xuất/lịch sử.
4. Đăng xuất và đăng nhập Viewer → chỉ có menu dashboard/báo cáo.
5. Tự nhập đường dẫn `/` khi chưa đăng nhập → bị chuyển về `/login`.
6. Đăng nhập với tài khoản thiếu `profiles` → lỗi phân quyền.

**Dữ liệu kho đã tích hợp:** `Dashboard.tsx` đọc `/api/products?limit=100`, `/api/categories`, `/api/units`, `/api/dashboard` và `/api/movements` (chỉ Admin/Staff). Các thao tác tạo/sửa/xóa sản phẩm và nhập/xuất thực hiện bằng NestJS API, không ghi vào localStorage. Nếu có hơn 100 sản phẩm, UI sẽ cảnh báo cần phân trang. Giá vốn và tồn kho mới được cập nhật thông qua database; tồn đầu kỳ của sản phẩm mới phải là 0, nhập bằng phiếu để có lịch sử.

Không đưa `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `.env` hoặc chứng chỉ riêng vào GitHub.


---

## Nội dung đã hợp nhất từ `CHANGELOG_UI.md`

# CloudStock — cập nhật giao diện và lịch sử giao dịch

- Lịch sử giao dịch hiển thị **vai trò** từ `public.profiles` qua LEFT JOIN, không lộ UUID trên UI. `performed_by` vẫn lưu UUID phục vụ truy vết và tính toàn vẹn dữ liệu.
- Nhãn hiển thị: Quản trị viên, Nhân viên kho, Người xem báo cáo; hồ sơ không tìm thấy sẽ hiện Chưa xác định.
- Chuẩn hóa thông báo thành công và loại bỏ tên công nghệ/thuật ngữ lập trình trong giao diện người dùng.
- Tắt biểu tượng N của Next.js khi chạy development bằng `devIndicators: false`.
- Không thay đổi schema, dữ liệu, vai trò thực tế hoặc thiết lập bí mật.

## Kiểm tra
1. Chạy lại NestJS và Next.js.
2. Đăng nhập Staff, tạo phiếu nhập thử, mở Lịch sử giao dịch: cột Người thực hiện hiển thị Nhân viên kho.
3. Đăng nhập Admin, thực hiện giao dịch: cột Người thực hiện hiển thị Quản trị viên.
4. Kiểm tra thêm/sửa/xóa sản phẩm, toast chỉ hiển thị câu thân thiện.
5. Mở `http://localhost:3000`, biểu tượng N không còn hiển thị.


---

## Nội dung đã hợp nhất từ `CLOUDSTOCK_GUIDE.md`

# CloudStock — Hướng dẫn nhóm 3 thành viên

## Đánh giá repository ban đầu

Repository gốc dùng **Next.js 16 + React 19, serverless, Supabase PostgreSQL**, không có NestJS. Đã có khung thư mục, health endpoint, Sentry, 2 migration nền, CI và các test về kiến trúc. Không có CRUD nghiệp vụ kho hoặc màn hình dashboard trong ZIP. Bản mới giữ nguyên các file cũ và thêm UI dashboard + thư mục `backend/` NestJS riêng.

## Trải nghiệm giao diện nhanh

```bash
npm install
npm run dev
```

Mở http://localhost:3000. Mặc định ở giao diện Admin; **đổi vai trò** góc trên bên phải để xem giao diện Nhân viên kho hoặc Người xem báo cáo. UI hiện là **prototype tương tác**, dữ liệu mẫu lưu trong `localStorage` của trình duyệt, **chưa gọi NestJS hoặc Supabase**. Thêm/sửa/xóa SKU, nhập/xuất tồn, xem lịch sử, CSV báo cáo đã thao tác được ở chế độ demo. Xóa dữ liệu bằng DevTools > Application > Local Storage nếu muốn reset.

## Vai trò

| Chức năng | Admin | Nhân viên kho | Người xem báo cáo |
|---|---|---|---|
| Dashboard | Xem | Xem | Xem |
| Sản phẩm | CRUD | Xem | Không truy cập |
| Danh mục / đơn vị | CRUD | Không | Không |
| Nhập / xuất | Có | Có | Không |
| Lịch sử giao dịch | Có | Có | Không |
| Báo cáo | Xem | Không | Xem |
| Quản lý người dùng | Có | Không | Không |

## Trách nhiệm 3 người

1. **Thành viên 1 — Backend & bảo mật:** `backend/src/`, Supabase Auth, xử lý roles, kiểm thử xuất vượt tồn, race condition.
2. **Thành viên 2 — PostgreSQL & Cloud:** migrations, Supabase, seed, CI/CD, environment, logging, health check, deploy NestJS.
3. **Thành viên 3 — Frontend & báo cáo:** `src/components/Dashboard.tsx`, `src/app/globals.css`, tách thành component theo module, kết nối API, dashboard và báo cáo.

Cả nhóm cần cùng review pull request, viết hướng dẫn, test role và chuẩn bị demo luồng từ login đến nhập xuất.

## Kết nối giao diện với backend (việc còn lại)

1. Thiết lập Supabase Auth browser client, màn hình login, nhận JWT/session.
2. Tách UI khỏi mảng demo/localStorage thành React query/fetch tới `http://localhost:4000/api` với `Authorization: Bearer <token>`.
3. Đổi role switch demo thành role đọc từ API (không cho người dùng tự chọn role).
4. Tách danh mục, đơn vị tính, quản trị tài khoản thành CRUD hoàn chỉnh, thêm ngày lọc báo cáo và xử lý pagination.
5. Viết kiểm thử e2e có PostgreSQL test DB, deploy và kiểm tra quyền API.

**Không dùng UI switch role làm phân quyền thật.** Đây là prototype để nghiệm thu UX trước khi nối backend. API NestJS đã có logic kho và JWT/role nhưng chưa chạy thử với project Supabase thật.

## Lệnh chạy

Frontend: `npm install && npm run dev` (Node >=22). API: `cd backend && npm install && npm run dev`. Migration chạy bằng Supabase SQL Editor. Cần đặt secrets trong backend `.env`, tuyệt đối không commit file `.env`.


---

## Nội dung đã hợp nhất từ `CLOUDSTOCK_LIVE_DATA.md`

# CloudStock – kết nối dữ liệu kho thật

## Những gì đã thay đổi
- Dashboard đọc danh sách sản phẩm từ `GET /api/products?limit=100` bằng Supabase access token của người đăng nhập.
- Sản phẩm Supabase dùng `category_name`, `unit_symbol`, `cost_price`, `stock_quantity`, `minimum_stock`; map sang kiểu hiển thị tiếng Việt.
- Admin thêm/sửa/xóa sản phẩm qua `POST/PATCH/DELETE /api/products`.
- Admin/Staff nhập xuất qua `POST /api/movements`, backend transaction khóa row để chống xuất quá tồn.
- Admin/Staff đọc `GET /api/movements?limit=100`; Viewer chỉ xem thống kê và báo cáo; biểu đồ lấy từ `GET /api/dashboard`.
- Không lấy dữ liệu từ seed/localStorage nữa; lỗi API có thông báo và nút Tải lại, không hiện dữ liệu giả khi backend lỗi.

## Chạy
1. Giữ file `backend/.env` và chứng chỉ SSL trong `backend/certs/` của máy đang hoạt động. Không copy vào GitHub.
2. Cấu hình `cloudstock/.env.local` với NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_API_URL=http://localhost:4000/api.
3. Terminal 1: `cd backend && npm install && npm run dev`
4. Terminal 2 tại thư mục gốc: `npm install && npm run dev`
5. Mở http://localhost:3000/login và đăng nhập tài khoản trong bảng profiles.

## Lưu ý
- Màn hình sản phẩm chỉ tải tối đa 100 bản ghi; cần phát triển phân trang server-side nếu dữ liệu lớn hơn.
- Sản phẩm mới được tạo với tồn kho 0; phải lập phiếu nhập để tăng tồn và ghi lịch sử.
- Biểu đồ đang hiển thị tổng hợp nhập xuất theo ngày; phần báo cáo thể hiện số **ngày** có nhập/xuất, không phải số phiếu.
- Menu Admin và Staff giữ UI như cũ; tạo danh mục/đơn vị mới vẫn dùng API riêng hoặc Supabase SQL Editor, chưa có form cho tính năng này.
- Không truy cập trực tiếp database từ browser, không sử dụng service role key trong client.
- Chưa xác minh tích hợp với Supabase thật trong môi trường này; cần kiểm tra login, 30 sản phẩm, CRUD và lịch sử trên máy bạn.


---

## Nội dung đã hợp nhất từ `backend/README.md`

# CloudStock API · NestJS

Backend REST API dùng Supabase Auth (JWT qua `auth.getUser`) và PostgreSQL `pg`. Không sử dụng Supabase `service_role` trong trình duyệt.

## Chạy

```bash
cd backend
npm install
cp .env.example .env  # Windows: copy .env.example .env
npm run dev
```

Điền `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` trong `.env` rồi chạy migration `supabase/migrations/20261025000000_cloudstock.sql` bằng Supabase SQL editor (cần chạy 2 migration cũ trước). Tạo account trong Supabase Auth; tạo profile bằng SQL với UUID tài khoản. Cấp role `admin` thủ công khi bootstrap.

## API (prefix `/api`)

- `GET /health` health check DB
- `GET/POST/PATCH/DELETE /products` (POST/PATCH/DELETE admin)
- `GET/POST/DELETE /categories` (ghi admin)
- `GET/POST /units` (ghi admin)
- `GET/POST /movements` (admin, staff; ghi giao dịch atomically)
- `GET /dashboard` (đã đăng nhập)
- `GET /reports/low-stock`, `GET /reports/movements` (admin, viewer)
- `GET /users`, `PATCH /users/:id/role` (admin)

Mọi endpoint trừ `/health` yêu cầu `Authorization: Bearer <supabase_access_token>`. Người dùng lấy access token từ Supabase Auth login; backend xác thực thực sự trên máy chủ và truy vấn role từ bảng profiles. `POST /movements` dùng transaction và `SELECT ... FOR UPDATE` để không xảy ra xuất âm tồn khi gọi đồng thời.

## Chú ý bảo mật

Backend sử dụng kết nối PostgreSQL đáng tin cậy, thực thi kiểm soát role ở controllers. Không cấp thông tin đăng nhập PostgreSQL cho client. Cấu hình `DATABASE_URL` được dùng chỉ ở backend. Thay cho triển khai production: thêm audit log cho sửa danh mục, hardening validation và rate limiting, cache role theo yêu cầu, pagination báo cáo và phân quyền đủ chặt cho nguồn truy cập khác.
