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
