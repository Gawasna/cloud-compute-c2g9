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
