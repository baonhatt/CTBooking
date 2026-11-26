# Hướng dẫn: migration DB prod, rồi xóa và chép prod sang preview

> **Đã chạy xong ngày 26/11/2026:**
> - **Prod:** đã đánh dấu `0001_init.sql`, rồi chạy 0002, 0003, 0004.
>   - 24 bảng cũ giữ nguyên số dòng. Chỉ bảng sổ ghi `d1_migrations` tăng từ 16 lên 20.
>   - Đã có 2 bảng mới (`unmatched_transfers`, `register_pending`) và 3 index mới.
>   - Mốc Time Travel trước migration: `00009fa2-00000000-0000512f-7d74e6d75df3f7e255f26aad22c87a95`.
> - **Preview:** đã xóa trắng và chép từ prod. 26/26 bảng cùng số dòng, 39/39 bảng/index cùng cấu trúc, không còn migration chờ.
> - **Sự cố khi nhập:** lần đầu lỗi "FOREIGN KEY constraint failed" vì dòng của bảng con đứng trước bảng cha. D1 tự trả preview về trạng thái trống, prod không bị ảnh hưởng.
>   - `scripts/db-prepare-dump.cjs` nay xếp dòng theo thứ tự bảng cha trước, bảng con sau. Nhập lại đã thành công.
> - **File sao lưu trên máy đã xóa** (có dữ liệu khách hàng). Muốn quay lại thì dùng mốc Time Travel ở trên.

Tình trạng kiểm tra ngày 26/11/2026, chỉ đọc, không sửa gì trên live.

> **Quy tắc:**
> - **Prod:** chỉ được chạy migration **thêm** bảng / cột / index. Không sửa, không xóa, không chép đè dữ liệu đang có.
> - **Preview:** được xóa trắng và chép dữ liệu từ prod.
>
> Đã kiểm tra:
> - 3 migration mới (0002, 0003, 0004) chỉ có `CREATE TABLE IF NOT EXISTS` và `CREATE INDEX IF NOT EXISTS`, không có ALTER / UPDATE / DELETE / DROP.
> - Code mới chỉ cần thêm 2 bảng (`register_pending`, `unmatched_transfers`), không đổi cột của bảng cũ nào.
>
> Trên prod chỉ có 1 lệnh ghi ngoài 3 migration này: bước 2 thêm **1 dòng vào bảng sổ ghi migration `d1_migrations`**, bảng Cloudflare dùng để biết file nào đã chạy, không phải dữ liệu nghiệp vụ. Không có dòng này, lệnh `migrations apply` sẽ chạy lại `0001_init.sql` và gán lại quyền vai trò trên prod.

## Hai database hiện tại

| | prod (`cinema-db`) | preview (`cinema-db-preview`) |
|---|---|---|
| Cấu trúc bảng / index | 34 đối tượng | **giống hệt prod** |
| Dữ liệu | nhiều hơn | **cũ hơn, khác prod** (xem bảng dưới) |
| Migration Cloudflare đang báo "chưa chạy" | 0001, 0002, 0003, 0004 | 0001, 0002, 0003, 0004 |

Số dòng khác nhau:

| Bảng | prod | preview |
|---|---|---|
| bookings | 206 | 179 |
| ticket_packages | 40 | 9 |
| users / accounts | 59 / 58 | 48 / 47 |
| movies | 19 | 14 |
| branches | 4 | 2 |
| permissions / role_permissions | 76 / 102 | 60 / 90 |
| audit_logs | 356 | 182 |

Giống nhau: roles, showtimes, site_media, staff_branches, toys, d1_migrations.

**Vì sao `0001_init.sql` bị báo "chưa chạy"?** Cả hai DB đã chạy các migration cũ, từ `0001_initial_schema.sql` đến `0015_add_payment_expires_at.sql`. Sau đó repo gộp chúng thành một file `0001_init.sql` (commit `a0b2ecf`). Cloudflare nhận diện migration theo **tên file**, nên coi `0001_init.sql` là mới. Nội dung của nó thật ra đã có sẵn trên DB.

**Không được chạy lại `0001_init.sql` trên prod.** Phần tạo bảng có "IF NOT EXISTS" nên vô hại. Nhưng file này còn gán lại quyền mặc định cho vai trò manager/staff: quyền nào đã bị bỏ trên live sẽ bị **thêm lại**. Vì vậy chỉ **đánh dấu** nó là đã chạy (bước 2).

---

## Phần 1: migration prod

Chạy các lệnh trong PowerShell, tại thư mục `D:\Web_Film\CTBooking`. Trước đó nên commit code đang có.

**Bước 1. Sao lưu prod.**

```powershell
npm run db:export-prod
```

Lệnh này tạo file `cinema_db_prod.sql` (git đã bỏ qua file này vì có dữ liệu khách hàng). Ghi thêm mốc khôi phục Time Travel của D1, để quay lại được nếu cần:

```powershell
npx wrangler d1 time-travel info cinema-db --config worker/wrangler.toml
```

Lưu dòng `bookmark` mà lệnh này in ra.

**Bước 2. Đánh dấu `0001_init.sql` là đã chạy, không chạy nội dung.**

```powershell
npx wrangler d1 execute cinema-db --remote --config worker/wrangler.toml --command "INSERT INTO d1_migrations (name, applied_at) VALUES ('0001_init.sql', CURRENT_TIMESTAMP)"
```

**Bước 3. Kiểm tra danh sách còn lại.** Kết quả phải chỉ còn 0002, 0003, 0004:

```powershell
npx wrangler d1 migrations list cinema-db --remote --config worker/wrangler.toml
```

**Bước 4. Chạy 3 migration mới.** Cả ba chỉ **thêm** (bảng `unmatched_transfers`, `register_pending`, index của `bookings`), không sửa dữ liệu cũ. Code cũ trên live không dùng tới chúng, nên chạy trước khi deploy là an toàn.

```powershell
npx wrangler d1 migrations apply cinema-db --remote --config worker/wrangler.toml
```

**Bước 5. Kiểm tra.**

```powershell
npx wrangler d1 execute cinema-db --remote --config worker/wrangler.toml --command "SELECT name FROM sqlite_master WHERE name IN ('unmatched_transfers','register_pending','idx_bookings_status_expires')"
```

Kết quả phải có đủ 3 dòng. Số dòng của các bảng cũ phải giữ nguyên (bookings 206, permissions 76, role_permissions 102...).

---

## Phần 2: xóa preview và chép prod sang preview

**Lưu ý trước khi làm:** sau bước này, preview sẽ chứa **dữ liệu khách thật** (email, số điện thoại). Thao tác trên môi trường preview mà gửi mail (đặt vé, gửi lại vé, quên mật khẩu...) sẽ gửi tới **khách thật**. Khi thử trên preview, chỉ dùng email của mình.

**Bước 6. Xuất prod lần nữa, sau migration.** Bản xuất này đã có bảng mới và lịch sử migration mới.

```powershell
npm run db:export-prod
```

```powershell
node scripts/db-prepare-dump.cjs
```

Lệnh thứ hai tạo `cinema_db_prod.local.sql`: các lệnh tạo bảng đứng trước, dữ liệu đứng sau, để không vướng khóa ngoại. Vài dòng audit log quá lớn (trên 95 KB) sẽ được rút gọn phần chữ dài để không bị D1 từ chối. Bước 1 đã giữ bản gốc đầy đủ.

**Bước 7 (nên làm). Sao lưu preview cũ.**

```powershell
npx wrangler d1 export cinema-db-preview --remote --env preview --output=cinema_db_preview_backup.sql --config worker/wrangler.toml
```

**Bước 8. Xóa toàn bộ bảng của preview.** Phải có `--env preview`, **không bao giờ chạy file này cho prod**.

```powershell
npx wrangler d1 execute cinema-db-preview --remote --env preview --config worker/wrangler.toml --file=scripts/db-wipe-preview.sql
```

**Bước 9. Nhập dữ liệu prod vào preview.**

```powershell
npx wrangler d1 execute cinema-db-preview --remote --env preview --config worker/wrangler.toml --file=cinema_db_prod.local.sql
```

**Bước 10. Kiểm tra preview giống prod.**

```powershell
npx wrangler d1 migrations list cinema-db-preview --remote --env preview --config worker/wrangler.toml
```

Kết quả phải báo không còn migration nào cần chạy. So số dòng vài bảng chính trên cả hai DB:

```powershell
npx wrangler d1 execute cinema-db --remote --config worker/wrangler.toml --command "SELECT (SELECT count(*) FROM bookings) bookings, (SELECT count(*) FROM users) users, (SELECT count(*) FROM ticket_packages) packages, (SELECT count(*) FROM d1_migrations) migrations"
```

```powershell
npx wrangler d1 execute cinema-db-preview --remote --env preview --config worker/wrangler.toml --command "SELECT (SELECT count(*) FROM bookings) bookings, (SELECT count(*) FROM users) users, (SELECT count(*) FROM ticket_packages) packages, (SELECT count(*) FROM d1_migrations) migrations"
```

**Bước 11. Xóa các file dump khỏi máy** (có dữ liệu khách hàng), khi không còn cần:

```powershell
Remove-Item cinema_db_prod.sql, cinema_db_prod.local.sql, cinema_db_preview_backup.sql
```

---

## Ghi chú

- Script `db:migrate:prod` / `db:migrate:preview` trong `package.json` ghi tên `cinema_db` (tên binding), còn tên database là `cinema-db` / `cinema-db-preview`. Các lệnh ở trên dùng tên database cho chắc.
- Phần 1 chỉ đụng tới DB. Code mới (worker, admin, next-client) vẫn deploy sau như mục C của `docs/viec-con-lai-2026-11-26.md`.
