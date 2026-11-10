# Ghi chú dự án

Một chỗ duy nhất cho: quy tắc nghiệp vụ đã chốt, cách vài phần chạy, tính năng đang tạm ẩn, việc còn mở. Cách chạy và triển khai ở [README.md](../README.md).

## 1. Quy tắc nghiệp vụ đã chốt

- **Đăng nhập admin:** mật khẩu mạnh, khóa sau nhiều lần sai (theo email + IP và theo IP). Chỉ 1 Super Admin, được miễn 2FA. Bật 2FA nhân viên chỉ khi mọi nhân viên có email thật. Reset mật khẩu nhân viên: chỉ Super Admin.
- **Phân quyền chi nhánh:** nhân viên chỉ sửa bản ghi thuộc đúng một chi nhánh của mình. Bản ghi toàn hệ thống (`branch_ids` rỗng) hoặc nhiều chi nhánh: chỉ Super Admin sửa. Nhân viên chưa gán chi nhánh không thấy gì. Áp cho phim, gói vé, voucher, bài viết, ảnh (site-media). Giao diện phải báo rõ lý do khi không được sửa.
- **Vai trò:** chỉ Super Admin tạo/sửa vai trò. Mỗi nhân viên một vai trò (form hiện cho chọn nhiều, server chấp nhận mảng `roleIds`).
- **Đặt vé và thanh toán:**
  - Đơn có `pay_txt_code` do server sinh. Cửa sổ thanh toán 10 phút; cron 5 phút đổi đơn quá hạn sang hết hạn.
  - Khách vãng lai xem đơn bằng mã bí mật của đơn (header `X-Order-Token`, HMAC của `<bookingId>:<pay_txt_code>` với `ORDER_TOKEN_SECRET`); khách đăng nhập xem ở Hồ sơ. Không có link xem đơn công khai.
  - Chuyển sang `paid` bằng một câu `UPDATE` có điều kiện (nguyên tử). Webhook SePay chỉ nhận khi tiền nhận ≥ tiền cần trả, bỏ qua giao dịch ra, ghi `audit_logs` (`sepay_*`). Tiền về trễ quá 10 phút: nhân viên kiểm ngân hàng và xác nhận tay.
  - Đơn luôn có chi nhánh (chi nhánh đã chọn hoặc mặc định); đơn cũ không có chi nhánh thuộc HCM và chỉ Super Admin xác nhận được. Bán vé không gắn ghế hay suất chiếu.
- **Voucher:** giờ hiệu lực theo giờ Việt Nam. Bỏ "loại trừ gói" và "người dùng cụ thể". Voucher nhiều chi nhánh chỉ Super Admin sửa.
- **Doanh thu:** chỉ đơn `paid`, theo ngày thanh toán (`COALESCE(paid_at, created_at)`) giờ Việt Nam, khoảng nửa mở. Chỉ người có quyền xem doanh thu mới thấy số tiền. Bảng giao dịch: "đã thanh toán" lọc theo ngày thanh toán, trạng thái khác theo ngày tạo. Chưa có hoàn/huỷ sau khi đã trả (xử lý ngoài hệ thống).
- **Xuất giao dịch:** cần quyền `transactions.export` (không chỉ `view`), tối đa 5000 dòng.
- **Soát vé:** mỗi lượt cho vào cổng ghi `audit_logs` (`check_in`, hoặc `force_checkin` khi duyệt vé quá hạn); màn hình lấy tên nhân viên soát từ đó. Vé quá hạn vẫn cho nhân viên duyệt tay.
- **Bài viết:** "Lưu trữ" là xóa mềm. Nội dung HTML được lọc khi lưu và khi trả ra. Ngày đăng sửa lùi được, ngày ở tương lai bị bỏ qua. Slug trùng tự thêm `-2`, `-3`.

## 2. Bài viết theo chi nhánh và SEO

- Mỗi bài có `branch_ids` (rỗng = mọi chi nhánh). Website khách ẩn các bài chỉ dành cho chi nhánh khác **trong trình duyệt** (`BranchScoped`, `lib/post-branch.ts`), kể cả ô tìm kiếm và "bài viết liên quan".
- Cố ý không lọc ở server theo chi nhánh đã chọn: HTML sẽ khác nhau theo người xem (rủi ro cloaking, cache theo cookie, Googlebot không thấy bài riêng chi nhánh). Server luôn gửi đủ bài, đủ liên kết.
- URL bài viết luôn là `/bai-viet/<slug>-<id>`, mở được từ mọi chi nhánh, có trong sitemap, có JSON-LD `Article` và canonical, không `noindex`. Trang bài viết không bao giờ thêm `?branch_id=` vào URL.
- Địa chỉ khác dạng chuẩn (slug cũ, chỉ có id) được chuyển về URL chuẩn bằng `permanentRedirect`. Vì `bai-viet/[slug]/loading.tsx` làm Next gửi khung trang trước (HTTP 200), kết quả là meta refresh chứ không phải HTTP 308. Canonical vẫn trỏ đúng nên Google gộp tín hiệu. Muốn 308 thật: bỏ `loading.tsx` ở trang bài viết hoặc dùng middleware.
- Sitemap: `next-client/src/app/sitemap.ts` chỉ lấy 200 bài đầu; `/sitemap.xml` của Worker lấy 1000. Cần nâng nếu số bài vượt.

## 3. Đang tạm ẩn hoặc cố ý bỏ qua (tìm bằng từ khóa)

| Từ khóa trong code | Là gì | Mở lại thế nào |
|---|---|---|
| `TẠM ẨN ĐỒ CHƠI` | Module đồ chơi/quà tặng (khách chưa dùng): menu admin, route `/toys`, thẻ Dashboard, mục sản phẩm trang chủ khách. API, DB, `Toys*.tsx`, `ProductSection.tsx` giữ nguyên | Bỏ ghi chú ở 4 chỗ đó |
| `TẠM BỎ QUA NHIỀU ẢNH` | Ảnh chi tiết phim (`detail_images`): mỗi phim chỉ dùng 1 poster. Website khách không hiển thị, form sửa không có chỗ thêm | Thêm upload nhiều ảnh vào `MovieEditModal`, hiển thị ở website |
| `Modal sửa tài khoản khách bị tắt` | `UserEditModal` (Users.tsx): nút Lưu không gọi API, server chưa có API sửa khách | Làm API thật rồi bật lại |

Bỏ qua có chủ ý: bộ lọc loại đăng nhập của khách (mọi tài khoản đều là `email`); gom request lịch chiếu theo chi nhánh (chỉ vài chi nhánh); xóa gói vé có đơn (server chặn, hộp xác nhận báo trước số đơn).

## 4. Việc còn mở và rủi ro

- **Bí mật nằm trong git (rủi ro cao nhất).** Repo trên GitHub từng chứa `.env` (Cloudinary secret, SePay token) và `.env.preview` (chuỗi kết nối Postgres cũ), `db_backup/` (dữ liệu khách, token) và `TURNSTILE_SECRET`, `CLOUDINARY_API_KEY` trong `worker/wrangler.toml`. Đã bỏ khỏi cây hiện tại nhưng **vẫn còn trong lịch sử git**. Nên xoay (đổi) khóa Cloudinary, SePay, Turnstile và mật khẩu DB cũ. Chuyển `TURNSTILE_SECRET` và `CLOUDINARY_API_KEY` sang `wrangler secret`. Xóa lịch sử cần `git filter-repo` và force-push.
- **`next-client` dùng chung `node_modules` gốc.** Nhiều gói (`framer-motion`, `@radix-ui/*`...) chỉ có trong `package.json` gốc, không có trong `next-client/package.json`. Chạy được khi build từ máy này; build trên máy sạch hoặc CI chỉ trong `next-client/` sẽ thiếu gói.
- **Schema Drizzle và database thật có thể lệch** (`shared/schema.ts` không khai báo các chỉ mục `idx_*`). File `0001_init.sql` lấy từ database thật. Khi đổi bảng, sửa cả hai.
- **Thu hẹp CORS** chờ hostname preview của website khách (Next.js).
- **Gán chi nhánh HCM cho đơn cũ** chưa có `branch_id`: một lần `UPDATE` cho `bookings` và `booking_vr_items`, sao lưu trước.
- Màn lịch chiếu gọi một request mỗi chi nhánh; nhật ký hoạt động lọc theo từng điều kiện đều đã đúng (AND).

## 5. Lịch sử nhánh

Các đợt sửa lớn nằm trên các nhánh nối tiếp, chưa gộp vào `main`: `fix/dot1-login-hardening` → `dot2-staff-confirm-logout` → `dot3-booking-payment-flow` → `dot4-sepay-webhook` → `dot5-email` → `dot6-voucher` → `dot7-revenue` → `dot8-posts-showtimes-settings` → `dot9-admin-review-fixes` → nhánh dọn dẹp hiện tại. Thư viện `xss` (lọc HTML bài viết) đã thêm ở đợt 8.
