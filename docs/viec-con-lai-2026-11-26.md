# Việc còn lại sau đợt sửa 23–26/11/2026

Tài liệu liên quan:
- Luồng đặt vé, thanh toán, voucher, đăng ký: [luong-dat-ve-thanh-toan.md](luong-dat-ve-thanh-toan.md)
- Đề xuất và kết quả từng lỗi, rà soát API: [de-xuat-xu-ly-2026-11-26.md](de-xuat-xu-ly-2026-11-26.md)

## A. Cần trao đổi, quyết định

| # | Việc | Hiện trạng | Đề xuất |
|---|---|---|---|
| A1 | Token đăng nhập của admin và khách | Server trả token trong JSON. Admin lưu ở `localStorage`, trang khách lưu ở cookie JS đọc được và `localStorage`. Nếu trang bị chèn script (XSS), token có thể bị lấy, dù server đã đặt cookie HttpOnly. | Chỉ dùng cookie HttpOnly, không trả token trong body. Cần đổi cách gọi API (cookie `credentials: 'include'`, cấu hình CORS và SameSite giữa domain admin, khách và API). Làm riêng một đợt. |
| A2 | Media trang chủ (banner hero, ảnh công nghệ) | Media dùng chung mọi chi nhánh, nên chỉ **Super Admin** được thêm, sửa, xóa. Nhân viên chi nhánh có quyền "uploads" chỉ xem. | Đã chốt giữ nguyên. Nếu sau này muốn cho nhân viên chi nhánh sửa, mở lại theo quyền "uploads". |

## B. Chưa thử trên trình duyệt (cần anh/chị đăng nhập admin)

Đã có test tự động (1000+ test) và đã gọi thử API local. Các màn admin dưới đây chưa được bấm thử bằng tay:

1. Đăng nhập nhân viên có OTP 2FA: bước nhập OTP giờ gửi mã ký `otpChallenge`, không gửi id nhân viên.
2. Nhân viên:
   - tạo mới: có tick sẵn chi nhánh mặc định không, bỏ trống chi nhánh có bị chặn không;
   - sửa;
   - chi tiết: có hiện "người tạo / người sửa" không;
   - danh sách nhân viên đã xóa.
3. Phim: danh sách admin dùng route mới `/api/admin/movies`, lọc trạng thái, tìm kiếm.
4. Chọn phim ở Suất chiếu và ở Gói vé (combo); danh sách gói trong form Voucher.
5. Chi nhánh:
   - danh sách chỉ hiện chi nhánh của mình;
   - mã vé chưa dùng hiện khi mở hộp thoại "Đóng cửa";
   - chi tiết hiện "người tạo / người sửa".
6. Upload media bằng tài khoản Super Admin (thư mục Cloudinary đã giới hạn).
7. Giao dịch: danh sách, chi tiết, xuất Excel. Soát vé. Trang "Đơn cần xử lý" (3 tab, số đếm đỏ ở sidebar).
8. Nhật ký thay đổi: dữ liệu cũ/mới chỉ tải khi mở chi tiết. Vai trò: số quyền, ngày tạo/sửa ở trang chi tiết. Vai trò đã xóa.
9. Hồ sơ admin: tên chi nhánh. Dashboard: các số liệu (đã so khớp 52/52 với code cũ trên dữ liệu local).
10. Xem trước email: chỉ Super Admin thấy nút "Gửi thử"; tối đa 10 thư / 10 phút. **Gửi thư thật qua Brevo.**
11. Voucher: tạo voucher 100%, chỉ Super Admin, Sales phải là Super Admin. Chi tiết voucher: nhân viên chi nhánh chỉ thấy lượt dùng ở chi nhánh mình.

Trang khách (đã mở thử trang chủ, đặt vé, danh sách bài viết, chi tiết bài viết; không lỗi console). Các luồng có **gửi mail thật**, chưa chạy bằng tay:
- đăng ký tài khoản mới (mã OTP);
- đặt vé bằng voucher 100% (đơn 0đ, mail vé);
- gói "chỉ thành viên" khi chưa đăng nhập và khi đã đăng nhập.

## C. Khi đưa lên live

1. `npm run db:migrate:prod`: migration `0002_unmatched_transfers.sql` và `0003_register_pending.sql`.
2. Deploy **cùng lúc** worker (API), admin và next-client. API đã thay đổi:
   - bỏ các route công khai `/api/movies`, `/api/tickets`, `/api/tickets/:id`, `/api/toys*`, `/api/branches/options` (công khai) và `/sitemap.xml` của worker;
   - thêm route admin mới;
   - OTP 2FA của nhân viên và mã đăng ký đổi định dạng;
   - nhiều phản hồi đã được rút gọn.
3. Kiểm tra `ORDER_TOKEN_SECRET` trên worker và các domain CORS.
4. Trước khi deploy: gán chi nhánh cho nhân viên (không phải Super Admin) chưa có chi nhánh. Nếu không, họ bị chặn khỏi mọi trang admin, chỉ còn đăng xuất / đổi mật khẩu. Dữ liệu local hiện không có ai như vậy.
5. Sau deploy: thử một đơn chuyển khoản thật (số tiền nhỏ) để xác nhận webhook SePay khớp mã và giờ ngân hàng.

## D. Việc nhỏ, để sau (không gấp)

| # | Việc | Ghi chú |
|---|---|---|
| D1 | Danh sách chi nhánh (admin): số phim / số gói đếm theo cột cũ `branch_id`, chưa theo `branch_ids` | Phim/gói gán nhiều chi nhánh có thể bị đếm thiếu. Chỉ ảnh hưởng con số hiển thị. |
| D2 | Soát vé đọc `branch_id` từ danh sách chi nhánh (bí danh của `id`) | Đổi sang `id`, rồi bỏ bí danh. |
| D3 | Hàm không còn dùng | `server/routes/user/movies.ts` (`listMovies`, `getMovie`), `server/routes/user/toys.ts` (`listActiveToys`), kiểu `ActiveMoviesTodayResponse` trong `shared/api.ts`; trong `client/lib/api`: `createBookingApi`, `validateBookingApi`, các hàm hồ sơ/lịch sử khách. Xóa khi dọn code. |
| D4 | Suất chiếu (admin) gọi một request cho mỗi chi nhánh | Có thể gộp thành một request. |
| D5 | Chi tiết voucher (admin) vẫn trả mô tả thô | Chỉ admin thấy; danh sách đã rút gọn. |
| D6 | Hết giờ đếm ngược ở trang QR không hủy đơn nữa | Đơn vẫn "chờ thanh toán" tới khi server đóng (tối đa khoảng 5 phút sau hạn, do cron hoặc khi có ai xem trạng thái). Lượt voucher vì vậy được giữ thêm tối đa khoảng 5 phút. |
| D7 | Đồ chơi | Phần đồ chơi đang ẩn trên trang khách và các route công khai của nó đã bỏ. Mở lại đồ chơi thì phải thêm lại route công khai. |
| D8 | Chuyển dư tiền, hoàn tiền | Không có trạng thái "Đã hoàn tiền" riêng; nhân viên ghi bằng "Đã xử lý + ghi chú". |
| D9 | Dashboard: "Top gói vé" | Vẫn đọc các đơn trong khoảng thời gian chọn (tuần / tháng / năm) và cộng trong code, vì tên gói lưu dạng JSON. Các số liệu khác đã tính trong SQL. |
