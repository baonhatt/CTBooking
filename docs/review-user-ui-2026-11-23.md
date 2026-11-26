# Review trang khách hàng (next-client) — 23/11/2026

Phạm vi: http://localhost:3000, DB local clone từ live. Desktop 1440×900 và mobile 375×812.
Đã xem: Home (2 chi nhánh: Vạn Hạnh `branch_id=2`, AEON Hà Đông `branch_id=1`), popup phim, popup VR, Booking, Tin tức, Chi tiết bài viết, Đặt lại mật khẩu, QR payment, Success payment, `/account` khi chưa đăng nhập.
Chưa test được: các trang sau khi đăng nhập (Tài khoản, lịch sử vé) và thanh toán thật, vì đăng nhập có Turnstile (CAPTCHA). Cần bạn đăng nhập giúp để review tiếp.

---

## 1. Bảo mật (ưu tiên cao nhất)

| Mức | Vấn đề | Vị trí | Đề xuất |
|---|---|---|---|
| **CRITICAL** (đã đọc code xác nhận) | `resend-otp` gửi OTP tới `email` lấy từ request body, không phải email của tài khoản. Kẻ tấn công gửi `{temp_account_id: N, email: "attacker@..."}`, nhận OTP rồi gọi `validate-otp` là đăng nhập được vào tài khoản N (phiên 30 ngày). ID tăng dần, nên mọi tài khoản đều bị lộ. | `server/routes/user/auth.ts:229-292` | Luôn gửi tới `useracc.email` và bỏ qua `email` trong body. Gắn luồng OTP với một challenge ngắn hạn có ký, chỉ cấp sau khi nhập đúng mật khẩu. |
| HIGH | OTP sinh bằng `Math.random()`, không an toàn về mật mã | `server/lib/otp-utils.ts:11` | Dùng `crypto.getRandomValues` |
| MEDIUM | CORS phản hồi lại mọi `Origin` kèm `Allow-Credentials: true`, và cho phép mọi `*.pages.dev` / `*.workers.dev` | `worker/src/index.ts` ~105 | Whitelist domain chính xác |
| MEDIUM | Dò được email đã đăng ký: login trả 404 "Email không tồn tại" và 400 khi sai mật khẩu; forget-password cũng vậy | `auth.ts:27/65`, `password.ts:28` | Trả cùng một thông báo chung |
| MEDIUM | Cập nhật hồ sơ không lọc `<>` trong tên (đăng ký và đặt vé thì có lọc), có nguy cơ XSS ở email hoặc trang admin | `server/routes/user/users.ts` ~44 | Dùng chung một validator |
| LOW | forget-password trả `err.message` ra ngoài khi lỗi 500. Webhook SePay: `NaN` lọt qua kiểm tra số tiền, cho chuyển booking `failed` thành `paid`, và không chống trùng theo id giao dịch. Secret fallback khi host là localhost. | `userRouter.ts` ~452, `webhook/sepay.ts:150-240` | |

Phần đã ổn: giá và tổng tiền tính ở server, voucher bị giới hạn không vượt tổng, không có IDOR ở booking và user, webhook có API key so sánh timing-safe, HTML bài viết được sanitize, không có SQL thô, cookie HttpOnly/Secure/Lax.
Test thủ công: voucher `' OR 1=1--` bị từ chối đúng, SĐT tự lọc ký tự không phải số, email sai định dạng bị chặn.

## 2. Lỗi chức năng / dữ liệu

1. **Hydration error trên Home** (4 lỗi console: server render `<section>` trong `<main>` khác với client). Client phải render lại từ đầu, gây chớp nội dung và chậm LCP.
2. **Popup phim → "Đặt vé ngay"** chỉ cuộn xuống khu "Chọn gói", không mang theo phim đã chọn. Người dùng chọn phim xong lại phải chọn gói từ đầu và mất ngữ cảnh. Đề xuất: mở thẳng booking, chọn sẵn phim và gói 1 người.
3. **Booking gói phim không có bước chọn suất chiếu hay phim** ("Áp dụng cho mọi suất chiếu"), trong khi Home có đồng hồ suất chiếu với 24 suất bấm được. Cần làm rõ: vé có gắn suất không? Nếu không thì đồng hồ trên Home đang gây hiểu nhầm.
4. **Thể loại không khớp**: card phim nào cũng ghi "SCI-FI", nhưng popup ghi "Phiêu lưu". Đề xuất lấy từ cùng một trường dữ liệu.
5. **Dữ liệu VR sai**: "VR GHẾ XOAY 360 (2 NGƯỜI)" hiển thị "1 người"; một số card thiếu hẳn số người.
6. **Chi nhánh AEON Hà Đông không có ảnh VR** nào, chỉ có placeholder "CINESPHERE VR". Chi nhánh Vạn Hạnh thì dùng một ảnh lặp lại cho cả hàng thứ 2.
7. `/qr-payment` và `/success-payment` khi không có đơn sẽ tự redirect sang `/booking` và `/checkout` mà không báo gì. Riêng success thì có thông báo "Không tìm thấy đơn", vậy là ổn.
8. Trang bài viết: khối "Đã xem gần đây" trống dù vừa mở bài; ngày hiển thị không thống nhất (list "5 Tháng 5, 2026", chi tiết "16/05/2026").
9. Lỗi chính tả "Siêu định dạng 8K+8K" ở section Experience.

## 3. Review layout tổng quát (desktop)

**Tổng thể**: tông tối và gradient xanh-tím đã đồng bộ, nhìn "điện ảnh". Các vấn đề chính:
- **Căn lề section không nhất quán**: "Thư viện phim" và "Khám phá không gian Cinesphere" căn trái, còn "Chọn gói", "VR" và "Lịch chiếu" căn giữa. Nên chọn một kiểu (đề xuất: tiêu đề căn trái, có nút "Xem tất cả" bên phải).
- **Tiêu đề "Khám phá không gian Cinesphere" sát mép trái** (x≈12px), lọt ra ngoài container 1280 mà các section khác dùng.
- **Quá nhiều CTA cạnh tranh nhau** ở hero (2 nút lớn và 2 link phụ), cộng thêm "Đặt vé ngay" trên header. Đề xuất giữ 1 CTA chính.
- **Nội dung "fade in khi cuộn" chậm**: cuộn nhanh thì thấy màn hình đen trống khoảng 1 giây. Nên giảm thời gian animation và bỏ fade cho section đầu.
- **Footer**: mỗi cột tiêu đề một màu (xanh, đỏ, tím, xanh lá), nhìn rời rạc. Nên dùng một màu nhấn. Bản đồ Google bị filter xám, khó đọc.
- **Dropdown chi nhánh**: chữ mờ, độ tương phản thấp, tên bị cắt "HCM | CN Vạn Hạnh ...".

### Theo từng section Home
| Section | Nhận xét | Đề xuất |
|---|---|---|
| Hero | Chữ "CINESPHERE" lặp lại logo; 3 card tính năng bên phải nhỏ, nặng chữ | Đưa slogan lên làm H1; card tính năng chuyển xuống dải icon ngang |
| Thư viện phim | Tên phim đè lên poster, mà poster đã có chữ nên rối; "Mở chi tiết" là `div`, không phải button (không dùng được bàn phím) | Đặt tên phim dưới poster; dùng `<button>`/`<a>` |
| Chọn gói | Chỉ card 1 người có dòng phụ "vé 1 người", nên các card lệch chiều cao; nút giỏ hàng chỉ có icon | Thống nhất nội dung card; làm nổi gói "phổ biến" |
| VR | Card thiếu mô tả (chỉ card đầu có), chiều cao lệch; hàng cuối 3 card căn giữa lệch lưới 4 cột; 3 nút/card (Đặt ngay, Chi tiết, Thêm giỏ) là nhiều | Cả card click mở chi tiết; giữ 2 nút |
| Lịch chiếu (đồng hồ) | Đẹp, nhưng đồng hồ chiếm nửa khung mà ít thông tin; "5 phút 30 giây" dạng thời lượng khó đọc | Thu nhỏ đồng hồ; hiển thị thời lượng "5:30" |
| Experience + video | Ổn; tiêu đề quá dài, bị xuống dòng ở mobile | Rút gọn |

### Các trang khác
- **Booking**: bố cục 2 cột (chi tiết và thanh toán) rõ ràng, có stepper. Một số poster trong "Phim trong gói" tải chậm, hiện ô đen. Nút "Xác Nhận & Thanh Toán" nhìn như đang bật dù còn thiếu thông tin; nên làm xám rõ ràng hơn. Đã có ghi chú "Còn thiếu: ...", tốt.
- **Tin tức**: chỉ 2 bài, cột phải trống nhiều; chưa có danh sách hay phân trang và chưa lọc theo danh mục. Ô tìm kiếm đã có.
- **Chi tiết bài viết**: tiêu đề H1 đè lên ảnh cover cũng có chữ "PHIM 8 KỲ QUAN", khó đọc; nên thêm overlay tối hơn hoặc đặt tiêu đề dưới ảnh. Header trong suốt đè lên tiêu đề khi cuộn.
- **Popup đăng nhập**: bố cục 2 cột đẹp, nhưng widget Turnstile màu sáng lạc tông. Nên dùng `theme: 'dark'`.
- **Reset password (token sai)**: hiển thị "Liên kết không còn hiệu lực" rõ ràng, tốt.

## 4. Mobile (375px)

- Không bị cuộn ngang ở cả Home, Tin tức, Bài viết và Booking. Tốt.
- **Home dài 8.333px**: riêng section VR cao 2.031px (8 card xếp 2 cột) và Experience 1.788px. Đề xuất: VR và gói phim dùng carousel vuốt ngang như Thư viện phim, sẽ giảm khoảng 2.500px.
- Header: pill chi nhánh bị cắt "HCM | CN..." nên không biết đang ở đâu. Nên hiện tên ngắn ("Vạn Hạnh") hoặc chuyển vào menu.
- Card VR 2 cột: các nút "Chi tiết" và "Thêm giỏ" chỉ còn icon, không có nhãn, và vùng chạm nhỏ.
- Hero: chữ "CINESPHERE" to chiếm gần nửa màn hình đầu; CTA "Đặt vé ngay" bị đẩy xuống dưới màn hình đầu.
- Booking mobile: có thanh tổng tiền cố định ở đáy ("Còn thiếu... / Tổng"), tốt.
- Bài viết: H1 30px là ổn; có 1 ảnh rộng hơn màn hình nhưng đã bị khung che đi, không gây cuộn ngang.

## 5. Thứ tự sửa đề xuất
1. Vá `resend-otp` (critical), rồi OTP CSPRNG, rồi CORS.
2. Sửa hydration error trên Home.
3. Làm rõ luồng phim → suất chiếu → gói (mục 2.2 và 2.3).
4. Dọn dữ liệu (thể loại, số người VR, ảnh VR chi nhánh Hà Đông).
5. Thống nhất căn lề section, đồng đều chiều cao card, rút gọn Home trên mobile bằng carousel.
