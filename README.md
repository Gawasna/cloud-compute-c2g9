# Cloud Computing Project: Next.js & Supabase Cloud Architecture

Hệ thống kiến trúc ứng dụng web hiện đại xây dựng trên nền tảng **Next.js App Router (Serverless trên Vercel)** và **Supabase Managed PostgreSQL**. Dự án thiết lập ranh giới kiến trúc nghiêm ngặt ngay từ giai đoạn khởi tạo, ngăn chặn biến tướng thành kiến trúc nguyên khối (monolith), bảo vệ an toàn ranh giới Server/Client và tích hợp hệ thống kiểm định chất lượng phân tầng.

---

## 1. Tổng Quan Kiến Trúc (Architecture Overview)

Dự án áp dụng mô hình **Single Git Repository** với sự phân định ranh giới rõ ràng giữa 5 vùng trách nhiệm logic:
- **Tầng Ứng Dụng (Application Runtime):** Next.js App Router thực thi dạng Serverless trên Vercel (Server Components, Route Handlers, Edge Middleware).
- **Vòng Đời Dữ Liệu (Database Lifecycle):** Supabase Managed PostgreSQL với cơ chế phân tách kết nối Supavisor Connection Pooler và migration DDL trực tiếp.
- **Công Cụ Vận Hành (Operational Tooling):** Các tập lệnh chẩn đoán môi trường và bảo trì tại `scripts/`.
- **Cổng Kiểm Định Chất Lượng (Quality Gates):** Hệ thống kiểm thử đa tầng tại `tests/` bảo vệ RLS, migrations, lint boundaries và kịch bản E2E.
- **Đường Ống Tự Động Hóa (CI/CD Pipeline):** Tích hợp và phân phối liên tục qua GitHub Actions tại `.github/workflows/`.

*Lưu ý kiến trúc: Hệ thống không sử dụng mô hình 3-tier truyền thống (`frontend/`, `backend/`, `database/`), không dùng container Docker hay microservices độc lập.*

---

## 2. Công Nghệ Sử Dụng (Tech Stack & Technologies)

- **Application Framework:** Next.js 16.3.5 (App Router, React Server Components)
- **Runtime & Ngôn Ngữ:** Node.js (>= 22.x LTS), TypeScript 5.7.3
- **Giao Diện:** React 19.3.0
- **Cơ Sở Dữ Liệu:** Supabase Managed PostgreSQL (hỗ trợ Row Level Security & Supavisor Pooler)
- **Giám Sát & Quan Sát:** `@sentry/nextjs` 10.74.0 (phân bổ tại project root)
- **Kiểm Tra Mã Nguồn:** ESLint 9.20.0 (Flat Config)
- **Kiểm Thử Tự Động:** Node.js Native Test Runner (`node:test`, `node:assert/strict`)

---

## 3. Bố Cục Thư Mục (Directory Layout & Structure)

```text
cloud-compute-c2g9/
├── .github/
│   └── workflows/
│       └── ci.yml                 # Đường ống CI/CD GitHub Actions
├── public/                        # Static assets công khai
├── scripts/
│   ├── health/
│   │   └── check-local-env.ts     # Script chẩn đoán biến môi trường cục bộ
│   ├── backfill/                  # Script chuyển đổi dữ liệu theo lô (chunked)
│   └── maintenance/               # Script bảo trì định kỳ
├── src/
│   ├── app/                       # Next.js App Router (Pages, Routes, Layouts)
│   │   ├── (authenticated)/       # Route group cho người dùng đã đăng nhập
│   │   ├── (public)/              # Route group công khai
│   │   ├── api/
│   │   │   └── health/
│   │   │       └── route.ts       # Endpoint kiểm tra sức khỏe production (dynamic)
│   │   ├── layout.tsx             # Root layout
│   │   └── page.tsx               # Root page
│   ├── components/
│   │   ├── layout/                # Layout components
│   │   └── ui/                    # Presentational UI components (thuần khiết)
│   ├── features/                  # Module nghiệp vụ độc lập (feature-isolated)
│   ├── lib/                       # Tiện ích chung, cấu hình môi trường, DB client
│   │   └── db/index.ts            # Hợp đồng trung lập DatabaseClient (Zero-ORM)
│   ├── server/                    # Tầng logic nghiệp vụ chỉ chạy phía Server
│   │   ├── repositories/          # Interface BaseRepository trung lập
│   │   └── services/              # Domain services
│   ├── instrumentation.ts         # Hook khởi tạo Sentry
│   └── middleware.ts              # Edge request middleware
├── supabase/
│   ├── migrations/                # Versioned SQL migrations (<timestamp>_<desc>.sql)
│   └── seed/
│       └── seed.sql               # Dữ liệu mẫu khởi tạo (idempotent)
├── tests/
│   ├── unit/                      # Kiểm tra ranh giới ESLint và import server-only
│   ├── integration/               # Kiểm tra hợp đồng DatabaseClient và BaseRepository
│   ├── migration/                 # Kiểm tra cú pháp SQL và tính toàn vẹn migrations
│   ├── rls/                       # Kiểm tra chính sách Row Level Security (RLS)
│   └── e2e/                       # Bộ kiểm thử E2E 4-Tier Opaque-Box Architectural
├── .env.example                   # Template biến môi trường phân loại bảo mật
├── .gitignore                     # Cấu hình loại trừ Git hygiene
├── eslint.config.mjs              # ESLint Flat Config bảo vệ UI Purity và Feature Isolation
├── next.config.ts                 # Cấu hình build Next.js và Sentry plugin
├── package.json                   # Khai báo dependencies và scripts
├── sentry.client.config.ts        # Khởi tạo Sentry client browser
├── sentry.edge.config.ts          # Khởi tạo Sentry Vercel Edge runtime
├── sentry.server.config.ts        # Khởi tạo Sentry Node.js serverless runtime
└── tsconfig.json                  # Cấu hình TypeScript compiler và alias @/*
```

---

## 4. Ranh Giới Kiến Trúc (Server-Only & Architectural Boundaries)

1. **Ranh Giới Server-Only (`server-only`):**
   - Mọi tệp trong `src/server/` và `src/lib/db/` bắt buộc phải đặt chỉ thị `import "server-only";` ngay tại dòng đầu tiên.
   - Nếu Client Component (`'use client'`) vô tình import module server-only, trình biên dịch Next.js sẽ ngắt build ngay lập tức, chống rò rỉ mã nguồn và khóa bí mật ra ngoài trình duyệt.

2. **Quy Tắc UI Purity (ESLint):**
   - Các components trong `src/components/ui/` là presentation components thuần khiết.
   - Cấu hình ESLint `no-restricted-imports` cấm tuyệt đối `src/components/ui/` import từ `src/server/` hoặc `src/features/`.

3. **Quy Tắc Feature Isolation (ESLint):**
   - Các module trong `src/features/<feature-a>/` cấm import trực tiếp từ sibling feature `src/features/<feature-b>/`.
   - Logic dùng chung bắt buộc phải được đưa vào `src/lib/` hoặc generic components.

4. **Chiến Lược Trung Lập Zero-ORM (Zero-ORM Neutrality):**
   - Giai đoạn khởi tạo không cài đặt bất kỳ ORM nào (không Prisma, không Drizzle).
   - Truy cập dữ liệu tuân theo interface trung lập `DatabaseClient` và `BaseRepository`. Schema SQL trong `supabase/migrations/` là nguồn chân lý duy nhất.

---

## 5. Mô Hình Kết Nối Cơ Sở Dữ Liệu (Database Connection Model & Supavisor Pooling)

Hệ thống phân biệt nghiêm ngặt hai chuỗi kết nối độc lập:

| Chuỗi Kết Nối | Cổng | Chế Độ (Mode) | Dịch Vụ Tiếp Nhận | Mục Đích Sử Dụng |
|---|:---:|:---:|---|---|
| **`DATABASE_URL`** | `6543` | Transaction Mode | Supavisor Connection Pooler | Dành riêng cho 100% truy vấn runtime từ Server Components và Route Handlers. Tối ưu cho kiến trúc serverless, ngăn chặn cạn kiệt connection pool khi lambda functions tăng đột biến. |
| **`DIRECT_URL`** | `5432` | Session Mode | PostgreSQL Instance Trực Tiếp | Dành riêng cho công cụ migration tooling (`supabase db push`, CI runner). Hỗ trợ đầy đủ DDL transaction locks, advisory locks và extensions an toàn. |

---

## 6. Quản Lý Schema Migrations & Seeding (Database Migrations)

- **Quy tắc đặt tên:** Tất cả các tệp migration trong `supabase/migrations/` phải tuân theo mẫu regex:
  ```text
  <YYYYMMDDHHMMSS>_<ten_mo_ta_snake_case>.sql
  ```
- **Phương pháp tiến hóa:** Áp dụng mô hình 3 bước **Expand -> Migrate/Backfill -> Contract**:
  - *Expand:* Chỉ bổ sung thay đổi cộng dồn (thêm cột nullable, tạo bảng mới).
  - *Migrate/Backfill:* Chạy script bù dữ liệu theo lô qua `scripts/backfill/`.
  - *Contract:* Thu hẹp schema, xóa bỏ cột cũ sau khi toàn bộ mã nguồn đã chuyển đổi an toàn.
- **Dữ liệu mẫu (Seed):** Duy trì tại `supabase/seed/seed.sql` với cú pháp idempotent (`ON CONFLICT DO UPDATE`), an toan khi thực thi nhiều lần.

---

## 7. Giám Sát & Quan Sát Phân Tán (Sentry Observability)

- **Vị trí nghiêm ngặt tại Root:** Các tệp cấu hình Sentry (`sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`) đặt trực tiếp tại project root để trình biên dịch Webpack/Turbopack tự động nhận diện. Tuyệt đối không di chuyển vào `src/lib/observability/`.
- **Upload Source Maps:** Pipeline CI/CD tự động đóng gói và tải source maps lên Sentry server theo commit SHA thông qua biến `SENTRY_AUTH_TOKEN`, sau đó xóa bỏ file `.map` trong production bundle nhằm bảo vệ mã nguồn.
- **Bảo vệ PII:** Bộ lọc `beforeSend` loại bỏ triệt để dữ liệu nhạy cảm (mật khẩu, tokens, credit card) trước khi gửi sự kiện.

---

## 8. Kiểm Tra Sức Khỏe Hệ Thống (Health Checks)

- **Production Health Endpoint:**
  - Đường dẫn: `GET /api/health` (`src/app/api/health/route.ts`).
  - Cấu hình: `dynamic = "force-dynamic"` để vô hiệu hóa cache tĩnh, phản hồi dưới 50ms với HTTP 200 JSON: `{"status":"healthy","timestamp":"..."}`. Phục vụ các công cụ giám sát uptime bên ngoài (BetterStack, Pingdom).
- **Công Cụ Chẩn Đoán Cục Bộ:**
  - Tập lệnh `scripts/health/check-local-env.ts` chạy độc lập với server web qua Node.js, kiểm tra tính hợp lệ và định dạng của các biến kết nối database trước khi khởi động dự án.

---

## 9. Cấu Hình Biến Môi Trường (Environment Configuration & .env)

Dự án phân loại biến môi trường rõ ràng trong `.env.example`:

| Tên Biến | Phân Loại | Phạm Vi & Mục Đích Sử Dụng |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser-Safe | Địa chỉ API Supabase cho client SDK |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-Safe | Khóa ẩn danh Supabase, tuân thủ Row Level Security |
| `NEXT_PUBLIC_SENTRY_DSN` | Browser-Safe | Địa chỉ ingest dữ liệu lỗi của Sentry |
| `DATABASE_URL` | Server-Only Secret | Chuỗi kết nối Supavisor connection pooler (cổng 6543) cho runtime |
| `DIRECT_URL` | Server/CI Secret | Chuỗi kết nối trực tiếp PostgreSQL (cổng 5432) cho migration |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-Only Secret | Khóa quản trị Supabase bypass RLS (tuyệt đối không lộ ra client) |
| `SENTRY_AUTH_TOKEN` | CI-Only Secret | Token xác thực tạo Release và upload Source Maps |
| `SENTRY_ORG`, `SENTRY_PROJECT` | CI Variable | Slug định danh tổ chức và dự án trên Sentry dashboard |

---

## 10. Chiến Lược Kiểm Thử (Testing Strategy & Quality Gates)

Hệ thống sử dụng Node.js Built-in Runner (`node:test`, `node:assert/strict`) với độ tin cậy cao và không phụ thuộc thư viện ngoài:

```bash
# Chạy toàn bộ các bài kiểm thử bảo mật & kiến trúc nội bộ
npm test

# Chạy bộ kiểm thử E2E Opaque-Box Architectural (Tiers 1 - 4)
npm run test:e2e
```

Phân bổ các thư mục test:
- `tests/unit/`: Kiểm tra vi phạm ranh giới ESLint và vị trí đặt chỉ thị `server-only`.
- `tests/integration/`: Kiểm tra tính toàn vẹn hợp đồng `DatabaseClient` và `BaseRepository`.
- `tests/migration/`: Kiểm tra thứ tự thời gian, cú pháp SQL và quy ước đặt tên migration.
- `tests/rls/`: Kiểm tra kích hoạt Row Level Security và chính sách bảo vệ bảng công khai.
- `tests/e2e/`: Kiểm thử hộp đen 4 tầng (Feature Coverage, Boundaries, Interactions, Scenarios).

---

## 11. Đường Ống CI/CD & Tự Động Hóa (CI/CD Pipeline & Workflow)

Được định nghĩa tại `.github/workflows/ci.yml`, tự động kích hoạt khi có sự kiện `push` hoặc `pull_request` trên các nhánh `main`, `master`, và `dev/**`:

```text
[ Push / PR ] ──► 1. lint (ESLint Flat Config)
              ──► 2. type-check (tsc --noEmit)
              ──► 3. test (npm test & test:e2e)
              ──► 4. migration-check (Xác thực DDL với DIRECT_URL)
              ──► 5. sentry-release (Xác thực cấu hình Sentry Source Maps)
              ──► 6. build (Biên dịch Next.js Production Turbopack Build)
```

---

## 12. Hướng Dẫn Cài Đặt & Phát Triển (Getting Started & Workflow)

### Cài Đặt Cục Bộ
```bash
# 1. Clone kho mã nguồn
git clone https://github.com/Gawasna/cloud-compute-c2g9.git
cd cloud-compute-c2g9

# 2. Cài đặt thư viện phụ thuộc
npm install

# 3. Khởi tạo tệp môi trường
cp .env.example .env.local

# 4. Chẩn đoán cấu hình biến môi trường
npx tsx scripts/health/check-local-env.ts

# 5. Khởi động Next.js development server
npm run dev
```

### Các Lệnh Thao Tác Chính
| Lệnh | Mục Đích |
|---|---|
| `npm run dev` | Khởi động server phát triển cục bộ |
| `npm run lint` | Chạy linter kiểm tra toàn bộ mã nguồn và ranh giới kiến trúc |
| `npm run type-check` | Kiểm tra kiểu dữ liệu với TypeScript compiler |
| `npm test` | Chạy 19 bài kiểm thử đơn vị, tích hợp, migration và RLS |
| `npm run test:e2e` | Chạy toàn bộ 33 bài kiểm thử kiến trúc E2E 4-Tier |
| `npm run build` | Biên dịch bản phát hành production với Turbopack |
