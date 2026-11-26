# Kế hoạch sửa phía khách hàng — chia theo phần

Mỗi phần làm riêng, commit riêng. Phần nào bạn chốt thì mình mới làm. Cột "Cần bạn chốt" là những chỗ mình chưa tự quyết.

---

## Phần A — Bảo mật đăng nhập / OTP (đề xuất làm trước)

| # | Việc | File chính | Cần bạn chốt |
|---|---|---|---|
| A1 | `resend-otp`: gửi OTP tới email của tài khoản (`useracc.email`) và bỏ qua `email` trong body | `server/routes/user/auth.ts` | Không |
| A2 | Gắn luồng OTP với một "challenge" có ký và hết hạn sau khoảng 10 phút, chỉ cấp sau khi nhập đúng mật khẩu hoặc đăng ký. `resend-otp`/`validate-otp` phải có challenge này chứ không chỉ `temp_account_id`. Client (`LoginDialog`, `OTPDialog`, `lib/api/http.ts`) gửi kèm challenge. | `auth.ts`, `server/lib/order-token.ts` (tái dùng HMAC), `next-client/src/components/OTPDialog.tsx`, `LoginDialog.tsx` | A1 đã chặn được lỗ hổng chính, A2 là lớp bảo vệ thêm. Có làm A2 luôn không? |
| A3 | Sinh OTP bằng `crypto.getRandomValues` | `server/lib/otp-utils.ts` | Không |
| A4 | Đăng nhập / quên mật khẩu trả về cùng một thông báo chung ("Email hoặc mật khẩu không đúng") | `auth.ts`, `password.ts` | Quên mật khẩu báo "Nếu email tồn tại, chúng tôi đã gửi link" thì UX kém rõ hơn một chút. Đồng ý không? |
| A5 | Lọc `<>` trong tên ở API cập nhật hồ sơ (dùng lại validator của đăng ký) | `server/routes/user/users.ts` | Không |

Kiểm tra sau khi sửa: chạy test hiện có, rồi gọi thử API ở local (đổi email trong body thì OTP vẫn chỉ tới email của tài khoản).

## Phần B — Bảo mật cấu hình

| # | Việc | File | Cần bạn chốt |
|---|---|---|---|
| B1 | CORS: chỉ whitelist chính xác các domain (cinesphere.com.vn, admin, preview, localhost) và bỏ wildcard `*.pages.dev`/`*.workers.dev` | `worker/src/index.ts` | Danh sách domain preview/admin thật đang dùng là gì? |
| B2 | Không trả `err.message` ra client khi lỗi 500 | `worker/src/routes/userRouter.ts` | Không |
| B3 | Webhook SePay: từ chối `transferAmount` không phải số, không chuyển `failed` thành `paid`, chống trùng theo id giao dịch | `server/routes/webhook/sepay.ts` | Đơn đã `failed` (hết hạn) mà khách vẫn chuyển tiền thì xử lý sao: tự khôi phục, hay để admin xử lý tay? |

## Phần C — Lỗi chức năng Home

| # | Việc | Cần bạn chốt |
|---|---|---|
| C1 | Sửa hydration error trên Home (server và client render khác nhau ở section có `Suspense`/dynamic) | Không |
| C2 | Popup phim → "Đặt vé ngay" mở thẳng booking, chọn sẵn gói 1 người, và ghi phim đã chọn vào đơn | Vé gói phim có gắn với một phim / suất cụ thể không? (xem C3) |
| C3 | **Luồng suất chiếu**: hiện booking không chọn suất, nhưng Home có đồng hồ 24 suất bấm được | **Quyết định nghiệp vụ:** (a) vé dùng cho mọi suất trong ngày, thì đồng hồ chỉ để xem lịch và bỏ chữ "Chạm để đặt vé"; hay (b) bắt buộc chọn suất khi đặt, việc này lớn hơn và đụng cả DB lẫn admin |
| C4 | Thể loại phim: card và popup lấy cùng một trường dữ liệu | Không |
| C5 | Sửa chính tả "8K+8K" | Không |

## Phần D — Dữ liệu (để sau; sửa trong Admin → Gói vé & bảng giá)

Đã tra DB (bản sao từ live, 25/11/2026). Chưa sửa gì.

**1. Số người chơi gói VR sai hoặc để trống** (card VR đang hiện sai cho khách)

| Chi nhánh | Gói | Đang lưu | Nên là |
|---|---|---|---|
| HN AEON Hà Đông | #35 VR GHẾ XOAY 360 (2 NGƯỜI) | 1 | 2 |
| HN AEON Hà Đông | #37 VR CHIẾN TRƯỜNG BÓNG TỐI (2 NGƯỜI) | trống | 2 |
| HN AEON Hà Đông | #38–#41 VR ĐẶC NHIỆM (1/2/3/4 NGƯỜI) | trống | 1/2/3/4 |
| HCM Vạn Hạnh | #10 VR 360 FLYER (COMBO 2 NGƯỜI) | trống | 2 |
| HCM Vạn Hạnh | #11–#14 VR DRAGON RIDER (1/2/3/4 NGƯỜI) | trống | 1/2/3/4 |

**2. Ảnh gói VR:** cả 8 gói VR của HN AEON Hà Đông (#34–#41) chưa có ảnh.

**3. Mô tả gói VR:** 17/18 gói VR không có mô tả (chỉ VR ATTACK có).

**Phía code (làm cùng E3 khi đến lượt):** card VR tự xử lý dữ liệu thiếu. Số người trống thì lấy từ tên gói, không đoán được thì ẩn. Không có mô tả thì vẫn giữ chiều cao card đều. Không có ảnh thì dùng ảnh mặc định đẹp hơn.

## Phần E — Layout desktop

| # | Việc | Cần bạn chốt |
|---|---|---|
| E1 | Thống nhất căn lề tiêu đề section. Đề xuất: tiêu đề căn trái, nút phụ bên phải, cùng container 1280 | Căn trái hay căn giữa? |
| E2 | Tiêu đề "Khám phá không gian Cinesphere" đưa vào container | Không |
| E3 | Card gói và card VR cao bằng nhau (dòng phụ / mô tả giữ chỗ cố định); hàng cuối VR thẳng lưới | Không |
| E4 | Card VR: cả card bấm được để mở chi tiết, chỉ giữ 2 nút (Đặt ngay, Thêm giỏ) | Đồng ý bỏ nút "Chi tiết"? |
| E5 | Hiệu ứng fade khi cuộn: rút ngắn thời gian, hiện sớm hơn, bỏ hẳn ở section đầu | Không |
| E6 | Hero: giảm còn 1 CTA chính và 1 phụ | Giữ "Đặt vé ngay" và "Trải nghiệm VR"; bỏ "Lịch chiếu hôm nay"/"Xem video 8K"? |
| E7 | Footer: tiêu đề cột dùng một màu nhấn; bỏ filter xám của bản đồ | Không |
| E8 | Dropdown chi nhánh: tăng tương phản, hiện đủ tên | Không |
| E9 | Thư viện phim: tên phim đặt dưới poster; "Mở chi tiết" đổi thành button thật | Không |
| E10 | Turnstile dùng theme dark | Không |
| E11 | Bài viết: overlay tối hơn trên ảnh cover; ngày hiển thị cùng một định dạng; sửa khối "Đã xem gần đây" | Không |

## Phần F — Mobile (375px) — đã làm F2, F3, F4 (25/11/2026)

Đo lại sau Phần E (25/11/2026): trang chủ dài **8.337px** (≈ 10 lần chiều cao màn hình 812px). Chiều cao từng phần:

| Phần | Cao | Ghi chú |
|---|---|---|
| Hero (đầu trang) | 794px | Chữ "CINESPHERE" 48px chiếm gần nửa màn hình đầu, nút "Đặt vé ngay" bị đẩy xuống dưới |
| Thư viện phim | 771px | Đã là carousel vuốt ngang |
| Chọn gói vé | 792px | 4 card xếp lưới 2 cột |
| VR | **1.838px** | 7–8 card xếp lưới 2 cột, phần dài nhất |
| Lịch chiếu | 1.003px | Đồng hồ + lưới 24 giờ |
| Công nghệ (video) | **1.780px** | Đoạn giới thiệu dài + video + 4 ý + dải video |
| Footer | 1.358px | 4 cột xếp chồng |

Đã có sẵn: thanh "Đặt vé ngay" cố định ở đáy màn hình (`MobileBookBar`, hiện khi đã cuộn qua hero và chưa tới phần gói vé). Đã làm cùng Phần E: căn lề 16px cho mọi section; tên chi nhánh ngắn trên header ("Vạn Hạnh Mall"); nút trên card VR cao 44px, có nhãn đọc màn hình.

| # | Việc | Đề xuất | Ước tính giảm | Cần chốt |
|---|---|---|---|---|
| F1 | Gói vé + VR dạng carousel vuốt ngang trên mobile (desktop giữ lưới) | Mỗi card rộng ~70% màn hình, thấy mép card kế tiếp để khách biết là vuốt được; có chấm chỉ vị trí | ≈ 2.000px | Có |
| F2 | Hero mobile gọn hơn | Thu chữ "CINESPHERE" (48px → ~36px), rút đoạn mô tả, ẩn 3 ô tính năng trên mobile, để nút "Đặt vé ngay" nằm trong màn hình đầu | ≈ 300px | Có |
| F3 | Phần Công nghệ trên mobile | Đoạn giới thiệu cắt còn 3 dòng + "Xem thêm"; 4 ý chuyển thành lưới 2×2 icon | ≈ 500px | Có |
| F4 | Footer mobile | Cột "Thông tin công ty" và bản đồ thu gọn thành mục bấm mở (accordion) | ≈ 500px | Có |

**Kết quả (25/11/2026):** F1 không làm (gói vé và gói VR giữ lưới dọc theo quyết định). Đã làm F2–F4: trang chủ mobile 8.337px → **7.148px**; hero 794 → 402px (nút "Đặt vé ngay" nằm trong màn hình đầu, đáy nút ở 322px); Công nghệ 1.780 → 1.550px; footer 1.358 → 790px. Desktop giữ nguyên.

Mục tiêu: trang chủ mobile còn khoảng **5.000px** (từ 8.337px), nút đặt vé luôn trong tầm tay.

## Phần G — Review các trang sau đăng nhập (25/11/2026)

Cách test: tài khoản test `g-test@example.com` tạo trong DB local, đăng nhập bằng session token gắn vào trình duyệt (bỏ qua CAPTCHA/OTP); 2 đơn test tạo qua giao diện (1 gói vé nhóm 2 người chuyển `paid` bằng SQL, 1 gói VR để chờ rồi hủy).

### Hoạt động đúng
- Trang Tài khoản chặn khi chưa đăng nhập (mở popup đăng nhập); API `/api/user/*` không có token → 401.
- Lịch sử vé: đơn chờ có đếm ngược, nội dung chuyển khoản, nút "Thanh toán ngay" / "Hủy đơn"; đơn đã thanh toán có mã vé, số ngày còn hiệu lực, "Xem vé".
- Hủy đơn: có hộp xác nhận (nhắc "nếu vừa chuyển khoản hãy giữ đơn"), đơn chuyển `cancelled`, đơn đã thanh toán không bị ảnh hưởng.
- Popup vé: mã vé to, nút sao chép, gói, danh sách phim, ngày thanh toán / hết hạn, tổng tiền.
- Hồ sơ: tên chứa `<` `>` bị server từ chối (Phần A5); tên hợp lệ lưu được; email khóa không sửa.
- Đổi mật khẩu: 3 ô, gợi ý điều kiện, nút ẩn/hiện, `autocomplete` đúng.
- API lịch sử bỏ qua `email` / `user_id` truyền lên, chỉ trả đơn của chính tài khoản.
- Đặt vé khi đã đăng nhập tự điền tên, SĐT, email.
- Mobile 375px: không cuộn ngang, không có nút < 40px, không có chữ < 12px.

### Vấn đề

| Mức | Vấn đề | Đề xuất |
|---|---|---|
| **CAO (bảo mật)** | Đăng ký **không xác minh email** (tài khoản kích hoạt ngay), trong khi lịch sử vé **gom mọi đơn có cùng email**, kể cả đơn mua khi chưa đăng nhập. Ai biết email của một khách mua vãng lai (chưa có tài khoản) có thể đăng ký bằng email đó và xem **mã vé** của khách để dùng tại quầy. Nếu bật 2FA khi đăng nhập thì kẻ xấu bị chặn ở bước OTP, nhưng 2FA là cài đặt có thể tắt. (`server/routes/user/auth.ts` registerImpl, `server/routes/user/users.ts` ~159) | Bắt xác minh email bằng OTP khi đăng ký trước khi tài khoản dùng được; hoặc chỉ gom đơn theo email sau khi email đã xác minh |
| Trung bình | Câu chú thích "Đơn mua khi chưa đăng nhập không hiện ở đây" **sai**: code đang hiện các đơn đó (khớp theo email) | Sửa câu cho đúng sau khi chốt cách xử lý lỗ hổng trên |
| Trung bình | Popup vé **không ghi chi nhánh / địa chỉ rạp**, trong khi vé chỉ dùng ở đúng chi nhánh đã mua | Thêm tên chi nhánh + địa chỉ vào popup vé (và lịch sử) |
| Thấp | "Chỉ hiển thị N giao dịch gần nhất" đọc như bị giới hạn, thực ra N là tổng số đơn | Đổi thành "N giao dịch" hoặc bỏ |
| Thấp | Nút "Thanh toán ngay" màu đỏ (màu đỏ thường là hành động nguy hiểm) | Dùng màu chính (xanh) như các nút đặt vé |
| Thấp | Đơn đã hủy biến khỏi lịch sử sau khi tải lại | Chấp nhận được; nếu muốn, hiện thêm tab "Đã hủy" |
| Thấp | Lỗi lưu hồ sơ chỉ hiện ở toast, không có lỗi ngay dưới ô nhập | Hiện lỗi dưới ô "Họ và tên" |
| Thấp | Ô ngày sinh hiện "mm/dd/yyyy" (theo trình duyệt) | Ô chọn ngày theo kiểu dd/mm/yyyy |
| Thấp | Mật khẩu tối thiểu 6 ký tự | Nâng lên 8 |
| Thấp | Mobile: khoảng trống lớn phía trên breadcrumb; tên chi nhánh "AEON MALL Hà Đông" vẫn bị cắt ở 375px | Giảm khoảng đệm trên; rút tên chi nhánh ngắn hơn hoặc chỉ hiện icon trên màn rất hẹp |

### Đã sửa sau review (25/11/2026)
- **Lỗ hổng email (CAO) — đã sửa theo Cách 1:** đăng ký giờ gồm 2 bước. `/api/register` chỉ kiểm tra form, giữ tạm trong KV 15 phút (mật khẩu và mã đều ở dạng băm) và gửi mã OTP; **chưa tạo tài khoản**. `/api/register/verify` (mã đúng) mới tạo tài khoản và đăng nhập luôn; `/api/register/resend` gửi lại mã (chờ 30 giây). Sai mã quá số lần cho phép thì khóa 15 phút. Email lấy từ challenge có chữ ký, không lấy từ request. Popup đăng ký chuyển sang bước "Xác Minh Email" (dùng lại popup OTP). File: `server/routes/user/register-otp.ts`, `server/lib/otp-challenge.ts`, `worker/src/routes/userRouter.ts`, `next-client/src/components/RegisterDialog.tsx`, `OTPDialog.tsx`.
- `/api/register` không còn trả stack trace ra trình duyệt, và log lỗi không còn ghi mật khẩu.
- **Icon tài khoản trên header:** đã đăng nhập = vòng tròn tô màu với chữ cái đầu của tên + chấm xanh lá; chưa đăng nhập = nút viền "Đăng nhập" (màn hẹp chỉ hiện icon). Áp dụng cả desktop lẫn mobile (`components/user/header/AccountAvatar.tsx`).
- Chưa thử gửi mã thật trên local (Brevo local là key thật, sẽ gửi email ra ngoài).

- **Các mục còn lại của Phần G (đã làm):** popup vé và thẻ đơn hiện chi nhánh + địa chỉ rạp; câu ghi chú lịch sử vé sửa cho đúng ("gồm cả vé đã mua bằng email này khi chưa đăng nhập"); nút "Thanh toán ngay" màu xanh; lỗi tên hiện ngay dưới ô; ngày sinh là 3 ô chọn Ngày / Tháng / Năm; mật khẩu mới tối thiểu 8 ký tự (có chữ và số), **server cũng kiểm tra** khi đăng ký, đổi và đặt lại mật khẩu (trước đây chỉ form kiểm tra); khoảng trống phía trên trang Tài khoản trên mobile giảm từ 112px xuống 80px.

Dữ liệu test còn trong DB local: tài khoản `g-test@example.com` (kèm session), đơn #233 (paid), #234 (cancelled).

---

**Thứ tự đề xuất:** A, rồi B, rồi C1/C4/C5, rồi E và F (sau khi chốt), cuối cùng là C2/C3 (sau khi chốt nghiệp vụ).

---

## Phần H — Mục "Thông báo" cho nhân viên (admin)

**Mục tiêu:** những việc nhân viên phải xử lý tay hiện chỉ nằm trong audit log, không ai nhắc. Gom chúng vào một mục Thông báo có chuông trên header admin, mỗi thông báo có nút xử lý ngay tại chỗ.

### Loại thông báo (giai đoạn 1)
| Loại | Khi nào | Nút xử lý |
|---|---|---|
| Tiền về sau hạn (`sepay_late_payment`) | Đơn đã hết hạn/hủy nhưng ngân hàng báo có tiền | **Xác nhận vé** (chuyển đơn sang `paid` và gửi mail vé) · **Đã hoàn tiền** · Bỏ qua |
| Chuyển thiếu tiền (`sepay_insufficient`) | Khách chuyển ít hơn giá đơn | Xác nhận vé (nếu chấp nhận) · Đã hoàn tiền · Bỏ qua |
| Chuyển trùng (`sepay_duplicate`) | Đơn đã `paid` mà tiền về thêm lần nữa | Đã hoàn tiền · Bỏ qua |
| Gửi mail thất bại | Mail vé hoặc OTP gửi lỗi (bảng `email_logs`) | Gửi lại · Bỏ qua |

### Cách làm
- **DB:** bảng mới `staff_notifications` gồm: `id`, `type`, `branch_id`, `booking_id`, `title`, `message`, `data` (JSON: số tiền, mã giao dịch…), `status` (`open`/`resolved`/`dismissed`), `resolved_by`, `resolved_at`, `resolution` (đã xác nhận / đã hoàn tiền / bỏ qua), `created_at`. Kèm 1 migration.
  - Lý do không đọc thẳng từ audit log: audit log chỉ để ghi lại lịch sử, không có trạng thái "đã xử lý / chưa xử lý".
- **Server:** webhook SePay (và mail-queue khi gửi lỗi) tạo thông báo ngay lúc ghi audit. API admin: liệt kê (lọc theo trạng thái, loại, chi nhánh), đếm số chưa xử lý, đánh dấu đã xử lý, xác nhận vé, đánh dấu đã hoàn tiền. Mọi thao tác đều ghi audit.
- **Trạng thái mới cho đơn:** `payment_status = 'refunded'`. Phía khách hiện nhãn "Đã hoàn tiền" thay cho nhãn vàng.
- **Admin UI:** chuông trên header kèm số chưa xử lý (cập nhật mỗi khoảng 60 giây), và trang mới "Thông báo" (`client/pages/admin/Notifications.tsx`) có tab Chưa xử lý / Đã xử lý; mỗi dòng có link mở đơn.
- **Quyền:** thêm quyền RBAC `notifications.view` và `notifications.resolve`. Nhân viên chi nhánh chỉ thấy thông báo của chi nhánh mình.

### Cần bạn chốt
1. Giai đoạn 1 có đúng 4 loại trên không? Có cần thêm loại nào khác (đơn VR sắp tới giờ, voucher sắp hết…)?
2. "Xác nhận vé" cho đơn tiền về muộn: cấp vé luôn, hay cho nhân viên chọn suất/ngày mới?
3. Có cần báo ra ngoài (mail cho quản lý, Telegram/Zalo) khi có thông báo mới, hay chỉ cần chuông trong admin?
4. Ai được xử lý: mọi nhân viên của chi nhánh, hay chỉ quản lý?
