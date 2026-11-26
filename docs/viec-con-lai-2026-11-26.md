# Việc còn lại sau đợt sửa 23–26/11/2026

Tài liệu liên quan:
- Luồng đặt vé, thanh toán, voucher, đăng ký: [luong-dat-ve-thanh-toan.md](luong-dat-ve-thanh-toan.md)
- Đề xuất và kết quả từng lỗi, rà soát API: [de-xuat-xu-ly-2026-11-26.md](de-xuat-xu-ly-2026-11-26.md)

## A. Cần trao đổi, quyết định

| # | Việc | Hiện trạng | Đề xuất |
|---|---|---|---|
| A1 | Token đăng nhập của admin và khách | Server trả token trong JSON. Admin lưu ở `localStorage`, trang khách lưu ở cookie JS đọc được và `localStorage`. Nếu trang bị chèn script (XSS), token có thể bị lấy, dù server đã đặt cookie HttpOnly. | Chỉ dùng cookie HttpOnly, không trả token trong body. Cần đổi cách gọi API (cookie `credentials: 'include'`, cấu hình CORS và SameSite giữa domain admin, khách và API). Làm riêng một đợt. |
| A2 | Media trang chủ (banner hero, ảnh công nghệ) | Media dùng chung mọi chi nhánh, nên chỉ **Super Admin** được thêm, sửa, xóa. Nhân viên chi nhánh có quyền "uploads" chỉ xem. | Đã chốt giữ nguyên. Nếu sau này muốn cho nhân viên chi nhánh sửa, mở lại theo quyền "uploads". |

## B. Đã thử trên trình duyệt (admin, tài khoản Super Admin), 26/11

Tất cả các màn sau mở được, không lỗi console, số liệu đúng:
- dashboard, hồ sơ;
- nhân viên:
  - tạo mới: tick sẵn chi nhánh mặc định; bỏ trống thì bị chặn, không gửi request;
  - chi tiết;
  - danh sách đã xóa;
- vai trò và chi tiết vai trò; nhật ký thay đổi (chi tiết tải dữ liệu cũ/mới khi mở);
- phim: danh sách qua route admin mới, chi tiết có gói áp dụng;
- lịch chiếu: chọn phim ở chế độ picker; gói vé: không còn ô nhóm, chọn phim combo;
- voucher:
  - danh sách, danh sách đã xóa, form có danh sách gói;
  - voucher 100%: Sales là quản lý thì bị chặn (403); Sales là Super Admin thì tạo được;
- chi nhánh:
  - danh sách, chi tiết có người tạo/sửa;
  - mã vé chưa dùng hiện khi mở hộp thoại đóng cửa (đã bấm Hủy, không đóng cửa);
- thư viện media; giao dịch (danh sách, chi tiết, API xuất file);
- soát vé:
  - mã đủ, chữ thường, mã CS, 12 số, mã nằm trong chuỗi dài: đều tìm thấy;
  - mã thiếu: không tìm thấy;
- đơn cần xử lý; mẫu email (Super Admin thấy nút "Gửi thử", chưa bấm vì gửi mail thật); khách hàng; nhật ký email; bài viết;
- gói "chỉ thành viên": bật thử cho 1 gói, khách chưa đăng nhập không thấy gói đó, rồi đã trả lại như cũ.

Lỗi tìm thấy khi thử và đã sửa:
- trang voucher đã xóa mặc định lọc "Chỉ VR" nên trống;
- tiêu đề các trang "đã xóa" hiện "Bảng điều khiển".

Chưa thử bằng tay vì cần tài khoản khác hoặc gửi mail thật:
- đăng nhập bằng tài khoản quản lý chi nhánh (phạm vi chi nhánh đã có test tự động);
- đăng ký khách mới;
- gửi thư thử;
- đặt vé 0đ bằng voucher 100% (đã chốt bỏ qua; luồng có test tự động). Voucher test đã xóa khỏi DB local.

## C. Khi đưa lên live

1. `npm run db:migrate:prod`: migration `0002_unmatched_transfers.sql`, `0003_register_pending.sql`, `0004_bookings_status_index.sql`. Cron hết hạn đơn đổi sang mỗi 2 phút (`worker/wrangler.toml`), có hiệu lực khi deploy worker.
2. Deploy **cùng lúc** worker (API), admin và next-client. API đã thay đổi:
   - bỏ các route công khai `/api/movies`, `/api/tickets`, `/api/tickets/:id`, `/api/toys*`, `/api/branches/options` (công khai) và `/sitemap.xml` của worker;
   - thêm route admin mới;
   - OTP 2FA của nhân viên và mã đăng ký đổi định dạng;
   - nhiều phản hồi đã được rút gọn.
3. Kiểm tra `ORDER_TOKEN_SECRET` trên worker và các domain CORS.
4. Trước khi deploy: gán chi nhánh cho nhân viên (không phải Super Admin) chưa có chi nhánh. Nếu không, họ bị chặn khỏi mọi trang admin, chỉ còn đăng xuất / đổi mật khẩu. Dữ liệu local hiện không có ai như vậy.
5. Sau deploy: thử một đơn chuyển khoản thật (số tiền nhỏ) để xác nhận webhook SePay khớp mã và giờ ngân hàng.

## D. Việc nhỏ: kết quả (26/11)

| # | Việc | Kết quả |
|---|---|---|
| D1 | Số phim / gói ở danh sách chi nhánh | Đã sửa: mỗi chi nhánh đếm phim/gói của nó cộng phim/gói áp dụng tất cả chi nhánh, giống trang khách. Đã đối chiếu số gói với trang khách ở cả 4 chi nhánh (11, 12, 7, 10). |
| D2 | Soát vé đọc bí danh `branch_id` | Đã đổi sang `id` và bỏ bí danh. |
| D3 | Hàm không còn dùng | Đã xóa: `listMovies`, `getMovie`, file `server/routes/user/toys.ts`, `ActiveMoviesTodayResponse`, 13 hàm client admin không ai gọi, route `/api/admin/revenue` không có màn nào gọi. |
| D4 | Lịch chiếu gọi 1 request mỗi chi nhánh | Đã gộp thành 1 request (`/api/admin/showtimes?branch_id=all`, vẫn theo chi nhánh của nhân viên). |
| D5 | Chi tiết voucher trả mô tả thô | Đã bỏ; chỉ gửi ghi chú và người Sales đã tách sẵn. |
| D6 | Giữ đơn sau hạn | Đã chốt: cron mỗi 2 phút + index `idx_bookings_status_expires` (migration 0004). Mỗi lần chạy chỉ đọc các đơn đang chờ (đã kiểm tra query plan). Đơn và lượt voucher được trả trong tối đa khoảng 2 phút sau hạn. |
| D7 | Đồ chơi | Không đổi. Phần đồ chơi đang ẩn; mở lại thì phải thêm lại route công khai. |
| D8 | Trạng thái "Đã hoàn tiền" | Đã chốt chưa cần; dùng "Đã xử lý + ghi chú". |
| D9 | "Top gói vé" trên dashboard cộng trong code | Đã chốt giữ nguyên: chỉ đọc đơn trong khoảng thời gian đang chọn. |
