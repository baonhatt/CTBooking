# Đề xuất xử lý các lỗi còn lại (26/11/2026)

## Kết quả (đã code ngày 26/11, theo câu trả lời review)

| # | Mục | Trạng thái |
|---|---|---|
| 1 | OTP nhân viên dùng như token | ✅ Middleware, gia hạn, đăng xuất chỉ nhận token `session`; OTP lưu `otp:<id>:<mã>` và xóa sau khi dùng |
| 2 | Nhân viên chi nhánh rỗng | ✅ Form tạo tick sẵn **chi nhánh mặc định** (`is_default`; người tạo không quản lý nó thì chi nhánh đầu của họ); server từ chối danh sách rỗng; nhân viên rỗng bị chặn mọi trang admin trừ tài khoản của mình |
| 3 | Gói nhiều chi nhánh | ✅ Giữ nhiều chi nhánh; đơn ghi chi nhánh khách chọn, kiểm tra từng gói có bán ở đó |
| 4 | Soát vé chuỗi con | ✅ Khớp chính xác, trong chi nhánh của nhân viên; webhook nhận mã `CS`+12 số đầy đủ ở bất kỳ đâu trong nội dung CK |
| 5 | Danh sách chi nhánh lộ mã vé | ✅ Chỉ trả mã vé của chi nhánh mình |
| 6 | VR tra `users.email` | ✅ Tra qua `accounts.email` |
| 7 | Combo từ client | ✅ Phim chọn phải thuộc gói |
| 8 | Upload ghi đè rồi xóa mất file mới | ✅ So `public_id`, cùng id thì không xóa |
| 9 | 2FA nhân viên bằng staffId trần | ✅ Challenge ký HMAC (`staff:`) |
| 10.1 | Đăng xuất không thu hồi Bearer | ✅ |
| 10.2 | Nhân viên đã xóa không lọc chi nhánh | ✅ |
| 10.3 | check-email lộ email nhân viên | ✅ Cùng câu "Email đã tồn tại" |
| 10.4 | Dashboard | ✅ Số khách hàng: nhân viên chi nhánh chỉ đếm khách có đơn ở chi nhánh mình; khách mới/cũ tính theo năm giờ VN. Số đồ chơi để chung (không có chi nhánh) |
| 10.5 | Bài viết không giới hạn chi nhánh | ✅ |
| 10.6 | API công khai `includeInactive` / `pageSize` | ✅ Khách chỉ thấy mục đang hoạt động (nhân viên đăng nhập vẫn thấy hết vì màn admin dùng chung API); `pageSize` tối đa 100 |
| 10.7 | Chi nhánh mặc định ẩn vẫn chọn | Không phải lỗi. Đã sửa lỗi liên quan: không có chi nhánh mặc định thì chọn chi nhánh mở đầu tiên; `branch_id` trên URL phải là chi nhánh đang mở |
| 10.8 | Nền hero | Không phải lỗi |
| 10.9 | Năm theo UTC | ✅ Dashboard, footer, `getVNYear` |
| 10.10 | Biên 15 giây trang QR | Đúng thiết kế, giữ nguyên; bỏ hằng số thừa |
| 10.11 | Gói chỉ thành viên | ✅ Server kiểm tra phiên đăng nhập thật. **Số người tối thiểu/tối đa: chưa làm, cần chốt nghĩa** |
| 10.12 | Đơn 0đ | ✅ Voucher 100% (Super Admin + Sales là Super Admin) → thanh toán ngay; voucher khác không được giảm về 0đ; gói giá 0đ không tạo được đơn |

---

# Bản đề xuất gốc (giữ để đối chiếu)

Đã làm xong trong phiên này: **ràng buộc cứng 10 phút** và **đăng ký mới** (xem `docs/luong-dat-ve-thanh-toan.md` mục 5 và 9).
Các mục dưới đây chỉ là cách sẽ xử lý. Mỗi mục có **❓ Cần chốt** khi có lựa chọn.

Mức: 🔴 nghiêm trọng (bảo mật / tiền) · 🟠 sai dữ liệu / sai quyền · 🟡 nhỏ.

---

## 1. 🔴 Mã OTP 6 số của nhân viên dùng được như token đăng nhập

**Hiện tại:** `worker/src/middleware.ts` (requireStaffAuth) tìm token trong `staff_tokens` theo token + chưa thu hồi + chưa hết hạn, **không kiểm tra `type`**. Mã OTP 2FA của nhân viên cũng nằm trong `staff_tokens` (type `otp`). Ai có mã OTP 6 số còn hạn (hoặc dò 6 số) có thể gửi nó làm Bearer token và vào admin.

**Sẽ làm:**
- Middleware thêm điều kiện `eq(staffTokens.type, 'session')`.
- Kiểm tra mọi chỗ tạo token phiên nhân viên đều ghi `type = 'session'` (nếu có dòng cũ type rỗng thì migration cập nhật).
- Test: token OTP gửi lên làm Bearer → 401.

## 2. 🟠 Nhân viên gán chi nhánh rỗng `[]` = xem được TẤT CẢ chi nhánh

**Hiện tại:** `getRestrictBranchIds` (`worker/src/routes/admin/admin-helpers.ts`) trả `[]` cho nhân viên không có chi nhánh. Các chỗ lọc viết `restrictToBranchIds && restrictToBranchIds.length > 0 ? lọc : không lọc` (`server/routes/admin/tickets.ts` dòng 112/219/381/585/642, `server/routes/user/booking/query.ts` dòng 240/248…), nên `[]` thành **không giới hạn**. `staff-management.ts` cho phép lưu `branchIds: []`.

**Sẽ làm (2 lớp):**
1. **Chặn từ gốc:** form tạo nhân viên **tick sẵn 1 chi nhánh** (chi nhánh của người đang tạo, hoặc chi nhánh đầu tiên); server từ chối tạo/sửa nhân viên không phải super admin mà `branchIds` rỗng ("Chọn ít nhất 1 chi nhánh"). Quản lý không được gán chi nhánh nằm ngoài chi nhánh của chính mình.
2. **An toàn khi dữ liệu cũ vẫn rỗng:** đổi nghĩa `[]` thành **không có quyền chi nhánh nào** (danh sách trống, thao tác bị từ chối). Chỉ `null` (super admin) mới là không giới hạn. Sửa mọi chỗ `length > 0 ? ... : không lọc` thành lọc luôn với `inArray` (mảng rỗng → không ra dòng nào).
3. Trước khi deploy: query liệt kê nhân viên đang có `[]` để gán lại.

❓ **Cần chốt:** chi nhánh tick sẵn là (a) chi nhánh của người tạo, hay (b) chi nhánh đầu tiên trong danh sách? Đề xuất (a).

## 3. 🟠 Gói vé gán nhiều chi nhánh: đơn ghi sai chi nhánh

**Hiện tại:** `validate.ts` (dòng ~158) lấy chi nhánh của đơn = `ticketPackage.branch_id || branch_id`. `ticketPackage.branch_id` là chi nhánh đầu tiên (cột cũ), nên khách đặt gói ở chi nhánh B nhưng đơn ghi chi nhánh A → báo cáo doanh thu, soát vé, quyền nhân viên đều lệch.

**Hai cách:**
- **(A) Giữ gói nhiều chi nhánh (đề xuất):** đơn ghi **chi nhánh khách đang chọn** (`branch_id` gửi lên), server kiểm tra gói có thuộc chi nhánh đó không (`matchesBranch` theo bảng gói–chi nhánh); không thuộc → 400. Không đổi admin, không đổi dữ liệu gói.
- **(B) Mỗi gói chỉ 1 chi nhánh:** đơn giản hơn về dữ liệu nhưng admin phải nhân bản gói cho mỗi chi nhánh (giá, ảnh, combo…), sửa giá phải sửa N lần; gói đang gán nhiều chi nhánh phải tách bằng migration.

❓ **Cần chốt:** A hay B? Đề xuất A. Đơn cũ đã ghi sai chi nhánh: có cần sửa lại theo dữ liệu nào không (không có dữ liệu gốc khách chọn chi nhánh nào, nên đề xuất **để nguyên**).

## 4. 🟠 Soát vé tìm theo chuỗi con

**Hiện tại:** `server/routes/user/booking/query.ts` dòng 43/58: `LIKE '%mã%'` trên `booking_code` và `pay_txt_code`, rồi `findFirst`. Gõ thiếu vài ký tự vẫn ra **một** vé bất kỳ khớp → soát nhầm vé người khác. Hàm tra cứu (dòng 7–80) không giới hạn chi nhánh.

**Sẽ làm:**
- So **khớp chính xác** (không phân biệt hoa thường, bỏ khoảng trắng) trên `booking_code` hoặc `pay_txt_code`.
- Hỗ trợ tiện: nếu nhân viên chỉ gõ phần số → thử ghép tiền tố `CS` rồi vẫn so chính xác.
- Nếu ra **nhiều hơn 1 đơn** → báo "Mã không rõ ràng, nhập đủ mã" thay vì lấy bừa.
- Tra cứu và soát vé đều lọc theo chi nhánh của nhân viên (đi chung mục 2).

❓ **Cần chốt:** quầy có hay gõ mã thiếu (ví dụ chỉ 6 số cuối) không? Nếu có, có thể cho tìm theo **đuôi mã** nhưng chỉ chấp nhận khi khớp đúng 1 đơn **và** trong chi nhánh mình; còn lại bắt nhập đủ.

## 5. 🟠 Danh sách chi nhánh trả mã vé chưa dùng của mọi chi nhánh

**Hiện tại:** `worker/src/routes/admin/branches.router.ts` (~dòng 55) trả `paid_unused_codes` cho tất cả chi nhánh, kể cả chi nhánh nhân viên không được gán.
**Sẽ làm:** chỉ trả trường này cho chi nhánh nằm trong quyền của nhân viên (super admin: tất cả); hoặc bỏ hẳn khỏi API danh sách nếu UI không dùng (sẽ grep UI trước).

## 6. 🟠 Đặt VR: truy vấn cột `users.email` không tồn tại

**Hiện tại:** `server/routes/user/vr-bookings.ts` dòng ~215 lọc theo `users.email`, bảng `users` không có cột này (email ở `accounts`) → lỗi / không đếm đúng lượt voucher của khách VR.
**Sẽ làm:** join `accounts` để lấy email (hoặc đếm theo `account_id` khi đã đăng nhập, theo email người đặt khi là khách vãng lai), giống cách `vouchers.ts` đếm lượt mỗi khách. Thêm test.

## 7. 🟠 Combo lấy từ dữ liệu client gửi

**Hiện tại:** `validate.ts` (~dòng 134) dùng combo (giá/tên) client gửi lên.
**Sẽ làm:** client chỉ gửi `combo_id` + số lượng; server đọc giá, tên, trạng thái, chi nhánh của combo từ DB, tự tính tổng. Combo không thuộc gói / không hoạt động → 400.

## 8. 🟠 Upload ảnh site-media: ghi đè rồi xóa mất file mới

**Hiện tại:** khi thay ảnh cùng tên file, code ghi file mới rồi xóa "file cũ" có cùng key → xóa luôn file vừa ghi.
**Sẽ làm:** chỉ xóa file cũ khi key cũ **khác** key mới; hoặc luôn sinh key mới (thêm hậu tố thời gian) rồi xóa key cũ.

## 9. 🟠 Xác thực 2FA nhân viên chỉ dựa vào `staffId`

**Hiện tại:** bước nhập OTP 2FA nhận `staffId` trần (giống lỗi cũ của OTP khách đã sửa). Ai biết id có thể yêu cầu gửi lại / thử mã.
**Sẽ làm:** dùng challenge ký HMAC như đăng nhập khách (`makeOtpChallenge` với tiền tố riêng `staff:`), đếm lượt sai trong DB bằng UPDATE có điều kiện.

## 10. 🟡 Các mục nhỏ

Mục 1–9 đã đối chiếu trực tiếp trong code. Các mục 10.x lấy từ đợt review trước; trước khi sửa từng mục sẽ đọc lại code để xác nhận.

| # | Lỗi | Sẽ làm |
|---|---|---|
| 10.1 | Đăng xuất khách chỉ xóa cookie, không thu hồi token Bearer | Đăng xuất xóa dòng token phiên trong DB |
| 10.2 | Danh sách nhân viên đã xóa không lọc theo chi nhánh | Áp cùng bộ lọc chi nhánh như danh sách thường |
| 10.3 | `/api/check-email` cho biết email là của nhân viên | Chỉ trả "đã được sử dụng", không nói loại tài khoản |
| 10.4 | Bộ lọc combo / dashboard không lọc chi nhánh | Thêm lọc chi nhánh như các thống kê khác |
| 10.5 | Bài viết (post) không giới hạn chi nhánh khi sửa | Kiểm tra chi nhánh của bài trước khi sửa/xóa |
| 10.6 | API công khai nhận `includeInactive` và `pageSize` không giới hạn | Bỏ `includeInactive` ở API công khai; `pageSize` tối đa 50 |
| 10.7 | Chi nhánh mặc định bị ẩn vẫn được chọn sẵn | Chọn chi nhánh đang hoạt động đầu tiên |
| 10.8 | Ảnh nền hero lỗi khi không có ảnh | Dùng nền mặc định |
| 10.9 | Năm ở footer / báo cáo tính theo UTC (sai đêm 31/12) | Tính theo giờ Việt Nam |
| 10.10 | Trang QR dừng nhận tiền trước 15 giây (SAFETY_MARGIN) nhưng server vẫn nhận đến hết 10 phút | Giữ 15 giây ở client (an toàn) nhưng ghi rõ; hoặc giảm còn 5 giây |
| 10.11 | Gói chỉ cho thành viên / số người tối thiểu chỉ kiểm tra ở client | Kiểm tra lại ở server khi tạo đơn |
| 10.12 | Đơn giá 0đ (voucher 100%) vẫn sinh QR chờ chuyển khoản | Đơn 0đ chuyển `paid` ngay, không qua SePay |

❓ **Cần chốt cho 10.12:** có cho voucher giảm 100% không? Nếu không, chặn ở bước tạo voucher thay vì xử lý đơn 0đ.

---

## Thứ tự đề xuất

1. Mục 1 (OTP thành token) – nhỏ, nghiêm trọng nhất, làm trước.
2. Mục 2 + 4 + 5 (quyền chi nhánh + soát vé) – làm chung vì dùng cùng bộ lọc.
3. Mục 3 + 7 (chi nhánh đơn + combo) – cùng file `validate.ts`.
4. Mục 6, 8, 9.
5. Các mục nhỏ (10.x).

Mỗi nhóm có test riêng, chạy toàn bộ test + typecheck, và ghi lại vào `docs/luong-dat-ve-thanh-toan.md` khi xong.

---

# Rà soát API (26/11, lượt 2)

## Tách API khách / admin
- Bỏ các route công khai khách không dùng: `/api/movies`, `/api/tickets`, `/api/tickets/:id`, `/api/toys*`, `/api/branches/options` (công khai), `/sitemap.xml` của worker (sitemap thật do next-client phục vụ).
- Admin có route riêng: `GET /api/admin/movies` (lọc chi nhánh, không trả phim đã xóa, chế độ `picker`), `GET /api/admin/vouchers/package-options`, `GET /api/admin/branches/:id/unused-codes`, `GET /api/admin/audit-logs/:id`.

## Dữ liệu nhạy cảm không còn trả ra
- `/api/validate-booking`: không còn trả tên, SĐT, id của khách theo email gõ vào; không còn thông tin nhân viên Sales của voucher.
- Voucher (VR validate, lịch sử vé của khách): không còn id/email nhân viên Sales, số lượt; mô tả chỉ là ghi chú, không lộ JSON thô.
- `/api/cancel-booking`, `/api/create-booking`, VR create: chỉ trả các trường trang dùng (không còn mã giao dịch ngân hàng, id nhân viên xác nhận...).
- Phim chi tiết công khai: chỉ phim đang hoạt động, chưa xóa.
- Site media công khai: chỉ mục đang hoạt động, chưa xóa.
- `/api/admin/sepay/check` không trả bản ghi ngân hàng thô; `confirm-booking` không trả cả dòng đơn.
- Mật khẩu nhân viên mới được xóa khỏi phản hồi trước khi soạn mail (không thể lọt cho người không phải Super Admin).

## Phạm vi chi nhánh (admin)
- Danh sách chi nhánh, chi tiết, đã xóa, sửa/xóa/bật tắt: chỉ chi nhánh của mình. Mã vé chưa dùng tải riêng khi mở hộp thoại đóng cửa.
- Site media: nhân viên chi nhánh chỉ thao tác media thuộc chi nhánh mình; media chung chỉ Super Admin. **Hiện mọi media là chung → chỉ Super Admin quản lý** (cần chốt, xem dưới).
- Ký upload Cloudinary chỉ cho các thư mục admin thực sự dùng.
- Doanh thu voucher chỉ tính chi nhánh của mình; lọc chi nhánh ở danh sách voucher đã hoạt động.
- Việc cần xử lý: mail lỗi không gắn đơn (OTP, tài khoản nhân viên) chỉ Super Admin thấy.

## Gói tin nhẹ hơn
- Danh sách bài viết (khách + admin) không còn nội dung bài, SEO, author_id; trang `/bai-viet` không nhúng 50 bài đầy đủ vào HTML.
- Gói vé, gói VR, phim, chi nhánh, hồ sơ khách, lịch sử vé: chỉ các trường màn hình đọc.
- Giao dịch, soát vé, nhân viên, vai trò, nhật ký: bỏ trường thừa; nhật ký thay đổi chỉ tải old/new khi mở chi tiết.
- Mọi danh sách admin có giới hạn số dòng/trang (100; picker phim 500).
- Đếm "Việc cần xử lý" (gọi mỗi 60 giây) nhẹ hơn và không vượt giới hạn 100 tham số của D1.

## Lỗi hiển thị đã sửa kèm
- Hồ sơ admin: tên chi nhánh luôn rỗng. Chi tiết nhân viên/chi nhánh/đồ chơi: "người tạo/sửa" luôn "Hệ thống". Vai trò: ngày tạo/sửa trống. Vé đã xóa: cột chi nhánh luôn "-". Nhân viên đã xóa: sai tên trường. Phim: mã gói thiếu.
- Trang tài khoản khách: hủy 1 đơn làm cả danh sách hiện "đã hủy".
- Giao dịch admin: mã giao dịch ngân hàng đọc sai chỗ.

## Chưa làm (cần chốt)
1. Media trang chủ: thêm ô chọn chi nhánh để nhân viên chi nhánh tự quản, hay để Super Admin quản như hiện tại.
2. Token đăng nhập (admin và khách) đang nằm trong localStorage / cookie JS đọc được: nên chuyển sang cookie HttpOnly (đổi kiến trúc đăng nhập).
3. Dashboard đang kéo nhiều đơn về worker để cộng: nên chuyển sang SUM/GROUP BY trong SQL.
4. Gửi mail thử ở "Xem trước email" chỉ cần quyền xem nhật ký mail.
5. Chi tiết voucher toàn hệ thống: lịch sử dùng vẫn hiện mã vé mọi chi nhánh cho nhân viên chi nhánh.
