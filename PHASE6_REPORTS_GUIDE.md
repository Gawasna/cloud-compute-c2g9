# CloudStock — Phase 6: Dashboard và báo cáo

Bản này phát triển tiếp từ source **CloudStock Phase 5** có sẵn trong gói `CloudStock_Phase5_QuanLyTaiKhoan_README_TongHop.zip`, không phải kết quả merge tự động với `dev/gawasna` mới nhất.

## Đã bổ sung

- `GET /api/reports/trend?period=day|week|month`: tổng số đơn vị hàng **IN/OUT** theo 14 ngày, 12 tuần hoặc 12 tháng, theo múi giờ `Asia/Ho_Chi_Minh`. Tuần bắt đầu Thứ Hai. Những kỳ không có giao dịch trả về 0.
- `GET /api/reports/overview`: tổng SKU đang quản lý, tổng đơn vị tồn, **giá trị tồn kho = tổng (số lượng tồn × giá vốn hiện tại)**, số SKU sắp hết và hết hàng. Không dùng tên gọi Cash Flow.
- `GET /api/reports/low-stock`: danh sách toàn bộ sản phẩm có tồn bằng 0 **hoặc** thấp hơn ngưỡng tối thiểu, gồm mức thiếu và trạng thái.
- `GET /api/reports/export?kind=inventory|low-stock|movements`: tải CSV UTF-8 BOM, có quote/escape và giảm nguy cơ spreadsheet formula injection, do Backend truy vấn toàn bộ dữ liệu.
- Dashboard thêm bộ lọc Ngày/Tuần/Tháng và dùng thống kê tổng hợp từ PostgreSQL thay vì tính KPI theo 100 sản phẩm đầu tiên.
- Trang Báo cáo thêm KPI giá trị tồn, biểu đồ theo kỳ, danh sách cảnh báo và 3 nút xuất CSV.
- Phân quyền giữ như Phase 5: `admin`, `viewer` xem báo cáo và xuất CSV; `staff` chỉ xem biểu đồ ở Dashboard, không được truy cập báo cáo tổng hợp/export.

## Các file sửa

- `backend/src/module.ts`
- `src/lib/api/cloudstock.ts`
- `src/components/Dashboard.tsx`
- `src/components/MovementChart.tsx` (mới)
- `src/components/Phase6Reports.tsx` (mới)
- `src/app/globals.css`

Không yêu cầu thêm dependency hoặc migration DB. Không động đến transaction `SELECT ... FOR UPDATE`, Supabase Auth hay quản lý tài khoản Phase 5.

## Cách áp dụng vào repo Git nhóm (Windows PowerShell)

1. **Sao lưu/commit các thay đổi cá nhân trước khi chép code.** Bản ZIP là source đầy đủ của Phase 5 + Phase 6, không nên giải nén ghi đè toàn bộ repo mới nhất của nhóm.
2. `git switch feature/cloudstock-inventory` và `git status` để xác nhận đang ở đúng nhánh.
3. Chép **6 file liệt kê ở trên** từ ZIP vào đường dẫn tương ứng trong repo đang làm. So sánh diff trước khi commit, đặc biệt nếu đồng đội vừa sửa cùng file.
4. Trong root Next.js: `npm ci`, `npm run type-check`, `npm run build`.
5. Trong `backend/`: `npm ci`, `npm run type-check`, `npm run build`.
6. Đảm bảo `.env.local`, `backend/.env`, cert PostgreSQL của bạn vẫn giữ nguyên trên máy. Không chép secrets vào Git.
7. Chạy frontend/backend theo hướng dẫn Phase 5; đăng nhập 3 vai trò để kiểm thử.

## Test thủ công Phase 6

1. Admin mở Dashboard → đổi Ngày/Tuần/Tháng → đủ 14/12/12 cột, cả kỳ không giao dịch hiển thị 0.
2. Tạo phiếu IN 5 đơn vị rồi OUT 2 đơn vị trong ngày: Dashboard ngày cập nhật IN/OUT theo số lượng **hàng hóa**; tồn cuối cùng tăng 3 đơn vị.
3. Xem Báo cáo: giá trị tồn bằng tổng `stock_quantity * cost_price` trong `public.products` đang hoạt động. Không gọi giá trị này là doanh thu/cash flow.
4. Sửa ngưỡng hoặc giảm số lượng tồn để tạo một SKU sắp hết, và tạo SKU hết hàng. Cả hai xuất hiện trong cảnh báo.
5. CSV `inventory`, `low-stock`, `movements`: mở bằng Excel, kiểm tra dấu tiếng Việt, dữ liệu có dấu phẩy, tên có dấu nháy kép, hàng >100 không mất.
6. Tài khoản `viewer` vào Báo cáo/xuất CSV được; `staff` không có trang Báo cáo và gọi API export trực tiếp phải bị 403. Tài khoản bị vô hiệu hóa phải bị chặn qua AuthGuard.
7. Kiểm tra dữ liệu ở các ranh giới ngày/tuần/tháng theo giờ Việt Nam, nhất là khi timestamp lưu UTC.

## Cần lưu ý trước khi merge

- Source này lấy từ bản ZIP Phase 5 đã có trong hội thoại, **không chắc trùng hoàn toàn với HEAD mới nhất trên GitHub**. Hãy so sánh và cherry-pick 6 file thay vì chép cả dự án.
- Môi trường tạo gói không có đầy đủ npm cache để chạy `npm ci`, do đó **chưa xác minh được build/type-check tại đây**. Bạn cần chạy các lệnh trong môi trường local của mình.
- Hiện `Dashboard.tsx` có bảng sản phẩm chỉ tải 100 sản phẩm đầu tiên từ Phase 5; KPI/tổng quan và CSV Phase 6 đã dùng truy vấn toàn bộ, nhưng việc phân trang danh sách sản phẩm toàn diện sẽ xử lý riêng.
- Giá trị tồn kho đang định giá theo **giá vốn hiện tại** trên từng SKU, chưa phải mô hình FIFO/LIFO hoặc bình quân theo lô.
- CSV lịch sử giao dịch xuất **toàn bộ** giao dịch, có thể tạo file lớn khi dữ liệu tăng đáng kể; cần phân trang/streaming cho quy mô lớn hơn.
