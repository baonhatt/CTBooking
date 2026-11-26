# Luồng đặt vé – thanh toán – voucher – đăng ký (cập nhật 26/11/2026)

Tài liệu mô tả cách web **thực sự chạy**. Bản 26/11: **ràng buộc cứng 10 phút** (bỏ tự nhận tiền muộn trong 24 giờ và bỏ việc lấy lại lượt voucher) và **đăng ký mới** (mục 9).

## 1. Trạng thái đơn (`bookings.payment_status`)

| Trạng thái | Nghĩa | Ai đặt |
|---|---|---|
| `pending` | Đã đặt, đang chờ chuyển khoản (tối đa 10 phút) | Lúc tạo đơn |
| `paid` | Đã thanh toán, có mã vé, đã gửi mail vé | Webhook SePay / nhân viên xác nhận |
| `cancelled` | Khách bấm **Hủy** khi còn trong 10 phút | Khách (trang QR, trang Tài khoản) |
| `expired` | Hết 10 phút mà chưa trả | Cron 2 phút / lúc có người kiểm tra đơn / webhook (tiền về sau hạn) |
| `failed` | Lỗi khi tạo đơn, hoặc nhân viên hủy trong admin | Hệ thống / nhân viên |

Admin hiện cả `failed` và `cancelled` là "Đã hủy", còn `expired` là "Đã hết hạn". Phía khách: `failed`/`cancelled` hiện "Đã hủy thanh toán", `expired` hiện "Hết hạn thanh toán".

## 2. Các cột liên quan

| Cột | Ý nghĩa |
|---|---|
| `payment_expires_at` | Hạn thanh toán = lúc tạo + 10 phút |
| `transaction_id` | Mã giao dịch ngân hàng (SePay `referenceCode`) |
| `paid_at` | Thời điểm thanh toán |
| `booking_code` | Mã vé, chỉ có khi `paid` |
| `voucher_id`, `voucher_discount_amount` | Voucher đã dùng và số tiền giảm |
| `vouchers.used_count` | Số lượt đang bị giữ hoặc đã dùng (gồm cả đơn `pending`) |
| `voucher_redemption_logs` | Một dòng cho mỗi lần dùng **đã thanh toán** |

## 3. Luồng đặt vé

```
Khách chọn gói → trang Đặt vé
  │
  ├─ [Áp dụng voucher]  → CHỈ KIỂM TRA (còn hạn, đúng chi nhánh/gói, còn tổng lượt, còn lượt của khách)
  │                        Không trừ lượt. Bỏ đi lúc này thì không ảnh hưởng gì.
  │
  └─ [Xác nhận & thanh toán]
        → server kiểm tra lại voucher (như trên)
        → TRỪ 1 LƯỢT voucher (used_count + 1, câu UPDATE có điều kiện: hết lượt thì báo lỗi, không tạo đơn)
        → tạo đơn: pending, payment_expires_at = bây giờ + 10 phút, mã chuyển khoản CS…
        → sang trang QR (đếm ngược 10 phút)
```

**Lượt voucher mỗi khách** = số lần đã dùng ở đơn đã thanh toán **+ số đơn `pending` còn hạn** có cùng voucher (theo tài khoản, hoặc theo email nếu là khách vãng lai). Nhờ vậy khách không mở được nhiều đơn chờ cùng lúc để lách giới hạn.

## 4. Trong 10 phút chờ thanh toán

| Việc xảy ra | Kết quả |
|---|---|
| Khách chuyển khoản đủ tiền | SePay gọi webhook → `paid`, cấp mã vé, gửi mail vé, ghi `voucher_redemption_logs` |
| Khách chuyển **thiếu** | Đơn giữ nguyên, audit log ghi `sepay_insufficient`, nhân viên xử lý |
| Khách bấm **Hủy** | `cancelled`, trả lại 1 lượt voucher |
| Hết giờ đếm ngược trên trang QR (15 giây trước hạn thật) | Trang **không hủy đơn** (`cancelled` chỉ dành cho khách tự bấm Hủy). Trang hỏi trạng thái lần cuối: đã trả thì sang trang kết quả, chưa thì hiện popup hết hạn. Đơn được server đóng thành `expired` đúng hạn (mục dưới) |
| Khách đóng trang, không trả | Đơn hết hạn bằng một trong hai cách: **(1)** có ai kiểm tra trạng thái đơn (trang QR / checkout) thì chuyển `expired` **ngay**; **(2)** nếu không, cron mỗi 2 phút chuyển `expired`. Cả hai đều trả lượt voucher |

Mọi việc chuyển trạng thái đều dùng câu UPDATE có điều kiện (chỉ khi đơn còn `pending`), nên cron, webhook và thao tác của khách không ghi đè lên nhau, và lượt voucher không bị trả hai lần. Riêng webhook chuyển `paid` còn thêm điều kiện **`payment_expires_at` chưa qua** (`only_open_pending` trong `update.ts`): tiền về đúng lúc đơn vừa hết hạn hoặc vừa bị hủy thì thua, và đi sang nhân viên.

## 5. Tiền về: chỉ tự xác nhận khi NGÂN HÀNG ghi nhận chuyển khoản trong 10 phút

Quy tắc: "trong hạn" tính theo **giờ ngân hàng ghi nhận giao dịch** (`transactionDate` của SePay, giờ Việt Nam), không theo lúc SePay báo về. Thiếu hoặc sai giờ ngân hàng thì dùng giờ nhận webhook. Mọi trường hợp ngoài quy tắc, dù chuyển đủ tiền, đều để nhân viên kiểm tra và xác nhận tay.

```
SePay báo tiền về, có mã CS… (đủ 12 số, nằm đâu trong nội dung cũng được) khớp đơn
 ├─ Đơn đã paid → giữ nguyên, audit sepay_duplicate → nhân viên hoàn tiền nếu cần
 ├─ Tiền thiếu → giữ nguyên đơn, audit sepay_insufficient → nhân viên xử lý
 └─ Tiền đủ
     ├─ Đơn cancelled (khách bấm Hủy) / failed → KHÔNG paid; lưu transaction_id; audit sepay_late_payment
     ├─ Giờ ngân hàng SAU hạn (payment_expires_at)
     │    → đơn còn pending thì chuyển expired (trả lượt voucher 1 lần); lưu transaction_id; audit sepay_late_payment
     ├─ Đơn expired (hệ thống đóng lúc hết hạn) + giờ ngân hàng TRONG hạn
     │    ├─ không dùng voucher → paid (ngân hàng báo chậm, khách không sai)
     │    └─ có voucher → nhân viên xử lý (lượt voucher đã được trả khi đơn đóng)
     └─ Đơn pending + giờ ngân hàng trong hạn → paid
          (UPDATE có điều kiện: còn pending / expired-hệ-thống + payment_expires_at >= giờ ngân hàng)
          ├─ Thành công → cấp mã vé, gửi mail vé, ghi voucher_redemption_logs
          └─ Thua cuộc đua (khách vừa bấm Hủy đúng lúc) → nhân viên xử lý
```

- Mọi nhánh `sepay_late_payment` → khách thấy nhãn vàng "Đã nhận tiền – chờ xác nhận"; đơn hiện ở tab **Đơn chưa xác nhận** trang "Đơn cần xử lý".
- Nhân viên **Xác nhận vé** → `paid` như xác nhận tay (cấp mã vé, mail vé, cố lấy lại lượt voucher; hết lượt vẫn xác nhận và báo). Hoặc **Đã xử lý + ghi chú** (ví dụ đã hoàn tiền).
- Webhook không bao giờ tự lấy lại lượt voucher (đơn có voucher đã đóng luôn đi sang nhân viên), nên không còn chuyện voucher 5 lượt bị dùng quá.
- Webhook phải có header `Apikey` đúng; client không thể tự đánh dấu đơn đã thanh toán.

## 5b. Trang "Đơn cần xử lý" (admin)

Một trang, một cảnh báo đỏ trên sidebar ("N việc cần xử lý", tự cập nhật mỗi 60 giây). Ba tab:

| Tab | Gồm | Nút |
|---|---|---|
| Chuyển khoản chưa khớp | Tiền về không tìm thấy đơn (xem bên dưới) | Gán vào đơn · Bỏ qua |
| Đơn chưa xác nhận | Tiền về cho đơn nhưng không tự xác nhận: sau 10 phút / đơn đã hủy hoặc hết hạn (`sepay_late_payment`), chuyển thiếu (`sepay_insufficient`), chuyển trùng (`sepay_duplicate`) | Xác nhận vé (như xác nhận tay ở trang Hóa đơn) · Đã xử lý + ghi chú |
| Mail gửi lỗi | `email_logs` có `status = failed` (60 ngày gần nhất) | Gửi lại mail vé (chỉ mail vé) · Đã xử lý + ghi chú |

Không có bảng mới cho hai tab sau: đọc từ audit log và `email_logs` có sẵn. "Đã xử lý" là một dòng audit `action_item_resolved`. Tự tính là đã xử lý khi: đơn (trừ chuyển trùng) đã chuyển sang `paid` ở chỗ khác; mail cùng loại tới cùng người sau đó gửi thành công. Đường dẫn cũ `/unmatched-transfers` vẫn mở trang này (`/action-items`).

### Tiền về không khớp đơn nào

Khi SePay báo tiền **vào** mà:
- nội dung chuyển khoản trống, hoặc không có mã `CS…`, hoặc
- có mã `CS…` nhưng không có đơn nào mang mã đó,

thì webhook lưu một dòng vào bảng **`unmatched_transfers`**: mã giao dịch SePay (không lưu trùng khi SePay gửi lại), số tiền, nội dung gốc, mã giao dịch ngân hàng, thời điểm, trạng thái `open`.

Lưu ý: SePay báo **mọi** khoản tiền vào tài khoản, nên danh sách có thể có cả tiền không phải tiền vé.

**Nhân viên thấy ở đâu**
- **Cảnh báo đỏ ở đầu sidebar admin**: "N chuyển khoản chưa khớp". Số này tự cập nhật mỗi 60 giây, và ngay sau mỗi lần xử lý. Bấm vào để mở trang xử lý.
- **Menu "Chuyển khoản chưa khớp"** (nhóm Kinh doanh & vé), có số đỏ bên cạnh.
- Trang có 3 tab: Chưa xử lý / Đã gán vào đơn / Đã bỏ qua. Tìm được theo nội dung CK, SĐT, mã GD hoặc số tiền.

**Xử lý**
| Nút | Điều kiện | Kết quả |
|---|---|---|
| Gán vào đơn | Nhân viên nhập mã đơn `CS…`. Đơn chưa thanh toán, số tiền ≥ giá đơn, đơn thuộc chi nhánh của nhân viên | Đơn chuyển `paid` (giống xác nhận tay: cấp mã vé, gửi mail vé, lấy lại lượt voucher), dòng chuyển "Đã gán đơn #…". Hai người bấm cùng lúc thì chỉ một người được |
| Bỏ qua | Bắt buộc ghi lý do | Dòng chuyển "Đã bỏ qua", lưu lý do, người xử lý và thời điểm |

Quyền: ai có quyền xem hóa đơn (`transactions.view`) thì thấy cảnh báo và danh sách. Bấm Gán hay Bỏ qua cần quyền xác nhận thanh toán (`ticket_check.validate`). Mọi thao tác đều ghi audit log (`unmatched_transfer_matched` / `unmatched_transfer_ignored`).

Chuyển **dư** tiền: hệ thống không xử lý riêng; nhân viên tự đối chiếu và hoàn tiền.

## 6. Khách thấy gì

| Nơi | `pending` | `paid` | `cancelled` / `failed` | `expired` | Tiền về muộn chờ nhân viên |
|---|---|---|---|---|---|
| Trang QR | QR + đếm ngược | Chuyển sang trang kết quả | Popup "Đơn hàng không còn hiệu lực" | Popup "Hết thời gian thanh toán" | — |
| Trang kết quả (checkout) | "Đang xử lý" | Mã vé | "Thanh toán thất bại" | "Thanh toán thất bại" | Vàng: "Đã nhận tiền – chờ xác nhận" |
| Tài khoản → lịch sử vé | Chờ thanh toán (10 phút) | Còn hiệu lực / Đã dùng | Không hiện | Không hiện | Vàng: "Đã nhận tiền – chờ xác nhận" |

Popup hết hạn ghi rõ: đơn đã hết hạn, hệ thống **không tự xác nhận** nữa; nếu khách đã lỡ chuyển tiền thì nhân viên sẽ đối chiếu và xác nhận vé hoặc hoàn tiền; cần gấp thì gọi hotline.

## 7. Nhân viên (admin)

- Trang Giao dịch: lọc theo trạng thái; `failed`/`cancelled` hiện "Đã hủy", `expired` hiện "Đã hết hạn".
- Trường hợp cần xử lý tay: tra Audit log theo `sepay_late_payment`, `sepay_insufficient`, `sepay_duplicate`. Đơn có `transaction_id` mà không `paid` là đơn đã nhận tiền.
- Xác nhận tay (chuyển sang `paid`): gửi mail vé, cố lấy lại lượt voucher; hết lượt thì vẫn xác nhận và báo cho nhân viên.
- Chưa có trạng thái "Đã hoàn tiền" riêng: hoàn tiền ghi bằng "Đã xử lý + ghi chú".

## 8. File chính

| Việc | File |
|---|---|
| Tạo đơn, trừ lượt voucher | `server/routes/user/booking/create.ts`, `server/routes/user/vr-bookings.ts` |
| Kiểm tra voucher (gồm lượt mỗi khách) | `server/routes/user/vouchers.ts` |
| Đổi trạng thái thanh toán | `server/routes/user/booking/update.ts` |
| Cron hết hạn + hết hạn ngay khi kiểm tra | `server/routes/scheduled/booking-expiry.ts` (cron `*/2 * * * *` trong `worker/wrangler.toml`, index migration 0004) |
| API trạng thái / hủy đơn | `worker/src/routes/publicRouter.ts` (`/api/bookings/:id`, `/api/cancel-booking`) |
| Webhook SePay | `server/routes/webhook/sepay.ts` |
| Chuyển khoản chưa khớp | `server/routes/admin/unmatched-transfers.ts`, `client/components/admin/content/UnmatchedTransfersContent.tsx`, migration `worker/migrations/0002_unmatched_transfers.sql` |
| Nhận biết tiền về muộn | `server/routes/user/booking/access.ts` (`isPaymentReceivedLate`) |
| Trang QR / kết quả / tài khoản | `next-client/src/app/qr-payment`, `checkout`, `account` |
| Đăng ký (mục 9) | `server/routes/user/register-otp.ts`, `server/lib/otp-challenge.ts`, `worker/src/routes/userRouter.ts`, `next-client/src/components/RegisterDialog.tsx`, migration `worker/migrations/0003_register_pending.sql` |

## 9. Đăng ký tài khoản (bản 26/11)

Chưa nhập đúng mã gửi về email thì **chưa có tài khoản**. Form chờ xác minh nằm trong bảng D1 **`register_pending`** (không còn lưu trong KV).

```
[Bước 1] Khách điền form → POST /api/register (Turnstile, bỏ qua trên localhost)
  → email viết thường; email đã có tài khoản → 400
  → email này vừa gửi mã < 30 giây → 429 "Vui lòng đợi N giây rồi bấm Đăng ký lại" (form mới KHÔNG bị âm thầm bỏ)
  → xóa các dòng register_pending đã hết hạn
  → tạo registration_id MỚI (32 ký tự hex ngẫu nhiên)
  → lưu/ghi đè dòng của email: password_hash (bcrypt), code_hash = sha256(email:registration_id:mã),
     code_expires_at (mặc định 5 phút), sent_at, fails = 0, expires_at = +15 phút
  → gửi mã qua email
  → trả otp_challenge = chữ ký HMAC của {email, registration_id, hạn 15 phút}
     (tiền tố "register:", không đổi lẫn được với challenge đăng nhập)

[Bước 2] Khách nhập mã → POST /api/register/verify {otp_challenge, otp}
  → challenge sai / hết hạn → 401
  → dòng pending không còn, hoặc registration_id khác (đã có người đăng ký lại email này) → 410 "Phiên đăng ký đã hết hạn"
  → đếm lượt thử bằng 1 câu UPDATE ... SET fails = fails + 1 WHERE fails < giới hạn RETURNING
       không cập nhật được (đã quá giới hạn) → 429, kể cả khi mã đúng; đoán song song cũng không lách được
  → mã hết hạn → 400 ; mã sai → 400
  → mã đúng: "giành" dòng bằng DELETE ... RETURNING (chỉ 1 request thắng) → tạo account + user với password_hash
       email vừa bị lấy → 400 kèm thông báo ; lỗi khác → 500 "Không tạo được tài khoản, vui lòng thử lại" (không lộ lỗi DB)
  → tạo token phiên 30 ngày → khách đăng nhập luôn, gửi mail chào mừng

[Gửi lại mã] POST /api/register/resend {otp_challenge}
  → cần đúng registration_id hiện tại; cách lần gửi trước ≥ 30 giây (không thì 429 + seconds_remaining)
  → mã mới, fails về 0, gửi lại mail
```

Vì sao có `registration_id`: nếu người khác đăng ký cùng email (với mật khẩu của họ), dòng pending đổi sang id mới nên challenge cũ trong hộp thoại của chủ email vô hiệu. Người kia không thấy mã (mã gửi vào email), còn chủ email không thể vô tình xác minh một form do người khác điền.

Lần đăng nhập đầu sau khi đăng ký không cần OTP (đã xác minh email lúc đăng ký).

## 9b. Đơn 0đ (voucher 100% để test)

- Voucher giảm 100% (`percent` = 100) chỉ **Super Admin** được tạo/sửa, và mục **Sales** của voucher phải là một Super Admin.
- Lúc khách dùng: kiểm tra lại Sales vẫn là Super Admin (đã bị hạ quyền / khóa thì mã không hợp lệ).
- Chỉ voucher 100% như vậy mới đưa đơn về 0đ. Voucher khác (ví dụ giảm cố định 500k cho đơn 300k) mà giảm hết giá trị đơn thì bị từ chối: "Mã giảm giá này không dùng được vì giảm hết giá trị đơn hàng".
- Gói giá 0đ (cấu hình sai) không tạo được đơn: "Giá vé không hợp lệ".
- Bấm **Đặt vé** với đơn 0đ: server tạo đơn rồi xác nhận **ngay** (giống SePay trả tiền: cấp mã vé, gửi mail vé, ghi lượt voucher, audit `free_order_paid`). Trang đặt vé chuyển thẳng sang trang kết quả, không qua trang QR.
- File: `server/lib/free-voucher.ts`, `server/routes/user/booking/free-order.ts`, `worker/src/routes/publicRouter.ts` (`payIfFree`).

## 9c. Mã chuyển khoản trong nội dung ngân hàng

Ngân hàng hay chèn thêm chữ/số quanh nội dung. Webhook tìm **mọi** chuỗi `CS` + đúng 12 số ở bất kỳ đâu trong nội dung (không phân biệt hoa thường). Chỉ cần có **một mã đầy đủ** là khớp đơn; mã thiếu số không khớp đơn nào (vào "Chuyển khoản chưa khớp"). Nếu nội dung có hai mã của hai đơn khác nhau thì không đoán, để nhân viên xử lý.

## 9d. Soát vé

Nhân viên nhập/quét: mã vé (8 ký tự), mã thanh toán `CS…` (hoặc chỉ 12 số), hoặc `BK<số đơn>` của vé in cũ. So **khớp chính xác**, không còn tìm theo chuỗi con. Mã `CS…` nằm trong chuỗi quét dài vẫn được nhận. Chỉ tìm trong chi nhánh của nhân viên (Super Admin: mọi chi nhánh). Khớp nhiều đơn → báo "Mã khớp với nhiều đơn…".

## 10. Khi triển khai lên live

1. `npm run db:migrate:prod` để chạy migration `0002_unmatched_transfers.sql` và `0003_register_pending.sql`.
2. Deploy worker (server) và next-client **cùng lúc** (challenge đăng ký đổi định dạng: hộp thoại cũ đang mở sẽ phải đăng ký lại).
3. Kiểm tra `ORDER_TOKEN_SECRET` đã đặt trên worker, và domain CORS.
4. Deploy admin (client) cùng worker: bước nhập OTP 2FA của nhân viên đổi từ `staffId` sang `otpChallenge`.
5. Trước khi deploy: nhân viên (không phải Super Admin) nào chưa có chi nhánh sẽ bị chặn mọi trang admin, chỉ còn đăng xuất / đổi mật khẩu. Gán chi nhánh cho họ trước (local hiện không có ai như vậy).
