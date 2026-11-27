# Kế hoạch tái cấu trúc dữ liệu chi nhánh — bản cuối

Ngày lập: 27/11/2026. Cập nhật: 27/11/2026 theo các quyết định đã chốt (mục 9).
Trạng thái: **code đã làm xong ở local, đã diễn tập trên bản sao live ở local; chưa commit, chưa chạy gì trên preview/live.**
Mọi số liệu lấy từ DB live bằng truy vấn **chỉ đọc** ngày 27/11/2026.

---

## 0. Mục tiêu và nguyên tắc

1. **Một logic duy nhất.** Toàn hệ thống (API, admin, web khách, cron, webhook) chỉ đọc/ghi theo mô hình mới.
2. **Dữ liệu cũ được sửa cho khớp mô hình mới** bằng SQL do script sinh ra (đọc lại được trước khi chạy).
3. **Không mất dữ liệu, không mất đơn, không lệch tiền.** Không `DELETE`/`DROP` trên bảng đang có. Chỉ tạo bảng mới, thêm cột mới,
   ghi vào bảng/cột mới và điền các ô `branch_id` đang trống của đơn cũ (đã duyệt). Số đơn và tổng tiền trước–sau phải khớp tuyệt đối.
4. **Diễn tập trên bản sao live ở local trước**, rồi preview, cuối cùng live.
5. **Nhiều chi nhánh không phải sửa code:** quan hệ bằng bảng nối có chỉ mục.
6. **Rỗng hay thiếu không bao giờ nghĩa là "mọi chi nhánh".** "Mọi chi nhánh" chỉ khi ghi rõ `all_branches = 1`.

---

## 1. Hiện trạng và vì sao rối

### 1.1 Cách lưu cũ

| Bảng | Cột chi nhánh | Ý nghĩa ngầm | Quan hệ khác lưu bằng JSON |
|---|---|---|---|
| `movies` | `branch_ids` (chuỗi JSON) + `branch_id` | NULL = mọi chi nhánh; `"[]"` = chưa cấu hình; `branch_id` = chi nhánh **đầu tiên** | — |
| `ticket_packages` (gói phim và VR) | như trên | như trên | `combo` = id phim; **combo rỗng = mọi phim của chi nhánh** |
| `vouchers` | `branch_ids` | NULL **hoặc `"[]"`** = mọi chi nhánh (khác các bảng kia) | `applicable_ticket_package_ids` (NULL/`[]` = mọi gói); `excluded_ticket_package_ids`, `applicable_user_ids` (không chỗ nào dùng) |
| `posts`, `site_media` | `branch_ids` | NULL = mọi chi nhánh | — |
| `bookings` | `branch_id` | 143 đơn cũ để trống | — |

### 1.2 Nguyên nhân gốc
Hai nguồn sự thật (`branch_ids` và `branch_id`); quan hệ lưu bằng chuỗi JSON (không khóa ngoại, không chỉ mục, ~45 file tự parse);
ý nghĩa ngầm khác nhau giữa các bảng; API trả dữ liệu thô để admin/web khách tự lọc.

### 1.3 Lỗi đã tìm thấy (đều hết khi chuyển)
| # | Lỗi | Vị trí cũ |
|---|---|---|
| L1 | Trang đặt vé loại phim dùng chung vì so chi nhánh đầu tiên | `next-client/src/app/booking/page.tsx:333` |
| L2 | Phim của gói lọc theo chi nhánh đầu tiên của gói; hết phim thì tự lấy mọi phim chi nhánh | `server/routes/user/tickets.ts:135`, `:141` |
| L3 | Xóa chi nhánh chỉ kiểm tra cột cũ | `server/routes/admin/branches.ts:493-504` |
| L4 | Lịch chiếu công khai hiện suất của phim đã ẩn / không còn ở chi nhánh | `server/routes/user/showtimes.ts:21` |
| L5 | Server cho tạo suất chiếu với phim không thuộc chi nhánh | `server/routes/admin/showtimes.ts:151` |

---

## 2. Dữ liệu live (kiểm tra chỉ đọc 27/11/2026)

### 2.1 Danh mục
| Kiểm tra | Kết quả |
|---|---|
| Phim / gói | 19 / 40 (12 gói phim "mọi phim của chi nhánh", 10 gói phim có danh sách phim, còn lại gói VR) |
| `branch_id` khác chi nhánh đầu tiên / id chi nhánh không tồn tại / combo có phim lỗi / suất chiếu sai chi nhánh | 0 / 0 / 0 / 0 |
| Gói "mọi chi nhánh" | 2 (gói #4, #5; combo viết kiểu cũ `[4, 5, 1, 2, 3]`, script đọc được) |
| Voucher | 2, đều đã xóa |
| Bài viết / media | 3 / 6, tất cả "mọi chi nhánh" |
| Bản ghi chưa gắn chi nhánh (`"[]"`) | **0** (đếm bằng lệnh `generate` trên bản sao live 27/11; script liệt kê tên/mã nếu có) |

### 2.2 Đơn hàng
| Nhóm | Số lượng | Cách xử lý |
|---|---|---|
| Đơn không có chi nhánh | **143**, tạo 23/12/2025–27/08/2026, trước khi có chi nhánh đầu tiên (27/08/2026 14:36); 114 đơn mua gói chỉ bán ở Vạn Hạnh, 29 đơn gói "mọi chi nhánh" | Gán Vạn Hạnh (id 2) — **đã duyệt** |
| Dòng VR không có chi nhánh | 1 | Lấy theo chi nhánh của đơn — **đã duyệt** |
| Đơn HN mua gói #3/#7 (nay chỉ HCM) | 10 | Giữ nguyên: đơn là bản chụp lúc mua |
| Vé đã dùng | 33 | Không đổi gì: vé vẫn dùng `is_used` + `checked_in_at` như cũ |

---

## 3. Mô hình mới

### 3.1 Quyết định thiết kế
- Mỗi quan hệ nhiều–nhiều là một **bảng nối** có khóa ngoại và chỉ mục. **Có dòng = đang chiếu/bán ở chi nhánh đó**; ngưng ở chi nhánh nào thì xóa dòng đó.
- **"Mọi chi nhánh" = `all_branches = 1`** (chi nhánh mở sau tự có). `all_branches = 0` và không có dòng nối = **chưa gắn chi nhánh**:
  không hiện ở đâu, chỉ Super Admin sửa được, admin tự vào gắn rồi lưu (không sửa bằng SQL).
- "Gói dùng mọi phim của chi nhánh" là **`movie_scope = 'all_at_branch'`**; `'selected'` = danh sách trong `package_movies`.
- **Một giá, một thứ tự chung** cho gói bán nhiều chi nhánh (lấy từ `ticket_packages`). Muốn giá khác ở chi nhánh B: tạo gói mới cho B rồi gỡ B
  khỏi gói cũ (Super Admin hoặc nhân viên quản lý mọi chi nhánh của gói làm).
- **Vé giữ đúng cơ chế cũ**: mỗi vé quét một lần (`is_used` + `checked_in_at`), gói hội viên cũng vậy. Lịch sử ai quét lấy từ `audit_logs`
  (`check_in` / `force_checkin`). Không có vé nhiều lượt.
- Hạn dùng vé theo `ticket_expiry_days` của chi nhánh như hiện nay.
- Đơn hàng là bản chụp, không bị đánh giá lại theo cấu hình hiện tại.

### 3.2 Bảng mới (migration `worker/migrations/0005_branch_links.sql`)
`movie_branches(movie_id, branch_id)`, `package_branches(package_id, branch_id)`, `package_movies(package_id, movie_id)`,
`voucher_branches(voucher_id, branch_id)`, `voucher_packages(voucher_id, package_id)`, `post_branches(post_id, branch_id)`,
`site_media_branches(media_id, branch_id)`. Khóa chính là cặp cột; xóa bản ghi thì xóa theo (CASCADE); chi nhánh `RESTRICT`.
Chỉ mục theo `branch_id` cho mọi bảng nối của phim/gói, theo `movie_id` cho `package_movies`.

### 3.3 Cột mới
`movies.all_branches`, `ticket_packages.all_branches`, `ticket_packages.movie_scope`, `vouchers.all_branches`, `vouchers.all_packages`,
`posts.all_branches`, `site_media.all_branches` (mặc định 0 / `'selected'`). Chỉ mục `bookings(branch_id, created_at)`, `showtimes(branch_id, start_time)`.

Voucher **không** có bảng khách hàng hay danh sách gói loại trừ: hai cột JSON cũ đó chưa từng được logic nào dùng; dữ liệu cũ giữ nguyên trong DB.

### 3.4 Cột cũ sau khi chuyển
`movies.branch_id / branch_ids`, `ticket_packages.branch_id / branch_ids / combo`, các cột JSON của `vouchers`, `posts.branch_ids`, `site_media.branch_ids`:
- **Không xóa khỏi DB, giữ nguyên giá trị** (để đối chiếu và để quay lại được).
- **Gỡ khỏi `shared/schema.ts`** nên code không đọc/ghi được nữa. `server/lib/branch-ids.ts`, `client/lib/branch-ids.ts` đã xóa.
- `bookings.checked_in_at`, `bookings.is_used`, `bookings.combo` (bản chụp phim của đơn) **giữ nguyên trong schema và code**.

### 3.5 Quy tắc (viết một lần trong `server/lib/catalog-scope.ts`)

| Câu hỏi | Quy tắc |
|---|---|
| Phim X chiếu ở chi nhánh B? | phim đang hoạt động, chưa xóa **và** (`all_branches = 1` **hoặc** có dòng `movie_branches(X,B)`) |
| Gói P bán ở B? | gói đang hoạt động, chưa xóa **và** (`all_branches = 1` **hoặc** có dòng `package_branches(P,B)`) |
| Phim của P khi xem ở B | `all_at_branch` → mọi phim chiếu ở B; `selected` → phim đã chọn ∩ phim chiếu ở B |
| Suất chiếu | chỉ tạo/sửa/sao chép với phim chiếu ở chi nhánh đó; bỏ chi nhánh khỏi phim khi còn suất chiếu ở đó thì bị chặn |
| Voucher V cho đơn ở B | chi nhánh: `all_branches` hoặc có dòng `voucher_branches`; gói: `all_packages` hoặc có trong `voucher_packages`; voucher giới hạn gói phải có ít nhất một gói (QĐ 16) |
| Form admin gửi lên | **tạo**: bắt buộc ghi rõ `all_branches: true` hoặc `all_branches: false` + `branch_ids` (rỗng được = chưa gắn); thiếu → **400**, kể cả Super Admin. Gói phim bắt buộc `movie_scope`, và "Chọn phim" phải có ít nhất một phim (form và server đều chặn, 400; gói VR không áp dụng); voucher bắt buộc `all_packages` (trừ voucher loại "all") và danh sách gói không được rỗng (QĐ 16). **sửa**: không gửi trường nào = giữ nguyên (ví dụ nút "Gỡ xuất bản" chỉ gửi trạng thái), gửi thiếu/sai → 400 |
| Nhân viên chi nhánh gán chi nhánh | chỉ chi nhánh của mình, ít nhất một; không được "mọi chi nhánh" hay "chưa gắn" (403) |
| Nhân viên chi nhánh sửa bản ghi | chỉ khi mọi chi nhánh của bản ghi thuộc mình; bản ghi mọi chi nhánh hoặc chưa gắn → chỉ Super Admin |
| Quét vé | nhân viên chỉ quét đơn có `branch_id` thuộc chi nhánh của mình; Super Admin quét mọi đơn; không quét chéo. Chống quét trùng: `UPDATE ... WHERE is_used = 0`, không đổi được dòng nào thì báo "vừa được quét" |
| Đơn mới | luôn có `branch_id` (chi nhánh khách chọn, không có thì chi nhánh mặc định) |
| Xóa chi nhánh | chặn nếu còn phim/gói/voucher/bài viết/media gắn riêng với chi nhánh đó, còn giao dịch hoặc nhân viên |
| Yêu cầu của khách không có chi nhánh | trả lời theo chi nhánh mặc định |
| Ảnh/video trang chủ (media) | nhân viên chi nhánh được tải lên cho chi nhánh của mình (QĐ 15); quyền được kiểm tra **trước** khi gửi file lên cloud (`POST /api/admin/site-media/check`); thay file của media cũ giữ nguyên chi nhánh của media đó; web khách lấy media theo chi nhánh đang chọn |
| Bài viết công khai | API danh sách và chi tiết loại luôn bài chưa gắn chi nhánh ở server (tổng số trang đúng) |

---

## 4. Code đã sửa

- **Module chung** `server/lib/catalog-scope.ts`: bộ lọc SQL (chạy được cả trong `db.query.x.findMany`), đọc/ghi bảng nối trong một batch,
  kiểm tra form, quyền nhân viên, danh mục cho khách (`moviesAtBranch`, `packagesAtBranch`, `packageAtBranch`), voucher, số liệu chi nhánh.
- **Server**: `admin/tickets.ts`, `movies.ts`, `vouchers.ts`, `posts.ts`, `site-media.ts`, `branches.ts`, `showtimes.ts`, `dashboard.ts`, `payments.ts`;
  `user/tickets.ts`, `movies.ts`, `showtimes.ts`, `vr-bookings.ts`, `vouchers.ts`, `users.ts`, `public-catalog.ts`, `public-posts.ts`,
  `booking/validate.ts`, `create.ts`, `query.ts` (chỉ đổi chỗ đọc gói của voucher), `confirmation-email.ts`; router `posts`, `site-media`, `publicRouter`.
- **API khách** trả dữ liệu **đã lọc theo chi nhánh** (gói kèm đúng phim của gói tại chi nhánh đó); web khách không tự lọc nữa.
- **Admin**: form phim/gói/voucher/bài viết/media dùng `all_branches` + `branch_ids` (rỗng = "Chưa chọn CN"), gói có lựa chọn
  "Mọi phim chiếu ở chi nhánh" / "Chọn phim", voucher có "Tất cả gói" / danh sách.
- **Web khách**: trang đặt vé dùng phim server gửi; bài viết chưa gắn chi nhánh không hiện ở đâu (danh sách, tìm kiếm, trang bài, sitemap).
- **Script** `scripts/migrate-branch-links.cjs` (mục 5).

## 5. Sửa dữ liệu cũ

`node scripts/migrate-branch-links.cjs generate <nơi> --out file.sql` đọc DB và sinh file SQL để đọc lại trước khi chạy:

| Bước | Nội dung | Đụng dữ liệu cũ? |
|---|---|---|
| A–F | Điền bảng nối và cờ mới từ cột cũ (phim, gói, phim của gói, voucher + gói của voucher, bài viết, media), theo đúng quy tắc cũ ở mục 1.1 | Không (chỉ bảng/cột mới) |
| G | `UPDATE bookings SET branch_id = 2 WHERE branch_id IS NULL AND created_at < <ngày tạo chi nhánh đầu tiên>` | Có — điền ô trống, **đã duyệt** |
| H | Dòng VR không có chi nhánh lấy chi nhánh của đơn | Có — điền ô trống, **đã duyệt** |

- Script **từ chối** sinh SQL khi bảng nối đã có dữ liệu (code mới có thể đã chạy, sinh lại sẽ xóa thay đổi trong admin). `--force` làm rỗng
  bảng nối rồi nạp lại — chỉ dùng trước khi deploy (diễn tập, hoặc giữa lúc chạy migration và deploy).
- Script **liệt kê bản ghi chưa gắn chi nhánh** (tên/mã) để bạn tự vào admin gắn; không sửa chúng bằng SQL.
- `verify`: bảng nối khớp 100% cột cũ, không còn đơn/dòng VR thiếu chi nhánh, liệt kê bản ghi chưa gắn (cảnh báo).
- `snapshot` + `compare`: số đơn theo trạng thái, tổng tiền (giá, giá gốc, giảm giá), số vé đã dùng, số có giờ quét, số có mã vé,
  dòng VR + tổng, voucher log, chuyển khoản lạ, số dòng các bảng chính — trước và sau phải bằng nhau từng con số.
- `check`: kiểm tra định kỳ sau khi chuyển: đơn và dòng VR thiếu chi nhánh phải = 0; bản ghi chưa gắn chỉ cảnh báo.
- `reverse`: **chỉ dùng khi quay lại code cũ** — sinh SQL ghi ngược bảng nối vào cột cũ cho mọi bản ghi (kể cả bản ghi tạo bằng code mới),
  gồm `branch_ids`, `branch_id` (chi nhánh đầu tiên), `combo`, danh sách gói voucher. Voucher/gói "không có chi nhánh/gói" ghi `[0]` vì code cũ
  hiểu `[]` của voucher là "mọi".

## 6. Quy trình

### 6.0 Sao lưu live — bắt buộc trước bất kỳ lệnh ghi nào
1. `npx wrangler d1 export cinema-db --remote --config worker/wrangler.toml --output db_backup/live-<yyyymmdd-hhmm>.sql`.
2. Nạp thử bản export vào một DB local trống; đếm số dòng các bảng chính và tổng tiền theo trạng thái — phải bằng số đọc trên live.
3. `npx wrangler d1 time-travel info cinema-db --config worker/wrangler.toml` → ghi bookmark và giờ.
4. Lưu trong `db_backup/` ở máy local (đã có trong .gitignore, không commit). Giữ ít nhất 30 ngày.
5. Sao lưu lần 2 sau khi chạy SQL dữ liệu, trước khi deploy.

Khôi phục (chỉ khi bạn đồng ý): lỗi code → deploy lại bản code trước + chạy SQL `reverse`; lỗi dữ liệu → `time-travel restore` về bookmark
rồi nhập lại đơn phát sinh sau mốc; dự phòng cuối → tạo DB mới từ file export.

### 6.1 Diễn tập trên bản sao live ở local (được phép làm ngay)
`npm run db:clone-prod-local` (export live chỉ đọc; DB local cũ được sao lưu trong `worker/.wrangler/state-backup-*`) → `snapshot` →
`npx wrangler d1 migrations apply cinema-db --local` → `generate` → đọc SQL → chạy → `verify` → `snapshot` → `compare` →
so sánh API khách từng chi nhánh với logic cũ → test tự động → thử trên trình duyệt. Biên bản ghi ở cuối tài liệu.

### 6.2 Preview
Clone live → preview (quy trình đã có), lặp lại 6.1 trên preview với code mới deploy lên preview.

### 6.3 Live (làm lúc nào cũng được vì web đang vắng khách; trong lúc chạy migration/SQL không sửa danh mục)
1. Sao lưu theo 6.0. 2. `snapshot`. 3. `migrations apply --remote` (chỉ thêm bảng/cột/chỉ mục). 4. `generate --remote` → đọc → chạy.
5. `verify` + `snapshot` + `compare`, sao lưu lần 2. 6. Deploy backend → admin → web khách. 7. `check`; theo dõi đơn mới, SePay, cron, soát vé.
8. Vào admin gắn chi nhánh cho các bản ghi chưa gắn mà script đã liệt kê.

### 6.4 Quay lại nếu có sự cố
Dữ liệu cũ (cột cũ, tiền, trạng thái) không bị đổi ngoài các ô `branch_id` trống được điền, nên quay lại = deploy bản code trước,
sau đó chạy SQL `reverse` (đọc trước) để thay đổi danh mục làm trên code mới không bị mất. Time Travel chỉ là phương án cuối.

## 7. Kiểm thử
- Unit test `catalog-scope.ts` và các route (SQLite trong bộ nhớ): mọi chi nhánh / một / nhiều / chưa gắn; gói `selected` / `all_at_branch`;
  voucher có/không giới hạn gói; form thiếu phạm vi → 400; quyền nhân viên; chi nhánh mới mở; xóa chi nhánh còn dữ liệu.
- Diễn tập 6.1 với các kiểm tra 5; so sánh API khách từng chi nhánh trước/sau.
- Thử trên trình duyệt: trang chủ, đặt vé, thanh toán, voucher, tài khoản, soát vé, form phim/gói/voucher/bài viết/media.

## 8. Việc sau phát hành (không đụng dữ liệu)
- Test quét mã nguồn bảo đảm không còn tên cột cũ (`ticket_packages.combo`, `branch_ids`, …), phân biệt với `bookings.combo` là bản chụp đơn.
- Chạy `check` hằng tuần.

## 9. Quyết định đã chốt (27/11/2026)
1. Bản ghi chưa gắn chi nhánh: để nguyên, không sửa bằng SQL, form không bắt buộc; script liệt kê; chỉ Super Admin sửa.
2. Duyệt bước G, H (143 đơn + 1 dòng VR → Vạn Hạnh).
3. Không thêm trigger chặn `branch_id` NULL; code bắt buộc chi nhánh khi tạo đơn; `check` đếm NULL = 0.
4. Quét vé chỉ trong chi nhánh của nhân viên, Super Admin quét mọi đơn.
5. Chuyển live lúc nào cũng được; không sửa danh mục trong lúc chạy migration/SQL.
6. Sao lưu live chỉ lưu trong `db_backup/` ở local.
7. Diễn tập 6.1 được làm ngay.
8. Gói hội viên = gói thường, quét 1 lần.
9. Bỏ vé nhiều lượt (không có `uses_*`, `ticket_checkins`).
10. Một giá chung; giá khác thì tạo gói mới.
11. Bỏ `redeem_scope`, `valid_days`.
12. Bảng nối không có cờ bật/tắt riêng: có dòng = đang bán/chiếu.
13. Form phải ghi rõ phạm vi chi nhánh (và gói của voucher); thiếu → 400, không bao giờ ngầm hiểu "mọi chi nhánh".
14. Gói phim "Chọn phim" không có phim nào → không cho lưu (form và server trả 400, khi tạo và khi sửa phim của gói). Gói VR không áp dụng.
15. Nhân viên chi nhánh được tạo ảnh/video (media) cho chi nhánh của mình; kiểm tra quyền trước khi tải file lên cloud; thay file giữ nguyên chi nhánh của media cũ.
16. Voucher giới hạn gói (`all_packages = false`) mà danh sách gói rỗng → chặn hẳn: form không cho lưu, server trả 400 khi tạo hoặc sửa.
17. Công tắc "Tất cả chi nhánh" trong form admin chỉ hiện cho Super Admin. Nhân viên chi nhánh (kể cả nhân viên chưa có chi nhánh) chỉ chọn trong chi nhánh của mình.

---

## 10. Biên bản diễn tập 6.1 (local, bản sao live export lúc 11:25 ngày 27/11/2026)

| Bước | Kết quả |
|---|---|
| Migration `0005` | áp dụng thành công trên bản sao |
| `generate` | phim 19 (24 liên kết), gói 40 (2 mọi chi nhánh, 41 liên kết), voucher 2, bài viết 3 và media 6 (mọi chi nhánh); 12 gói "mọi phim của chi nhánh", 60 liên kết phim đã chọn; 143 đơn → Vạn Hạnh |
| Bản ghi chưa gắn chi nhánh cần bạn gắn trong admin | **không có** (0) |
| `verify` | OK: bảng nối khớp 100% cột cũ; 0 đơn và 0 dòng VR thiếu chi nhánh |
| `snapshot` + `compare` | OK: số đơn từng trạng thái, mọi tổng tiền, số vé đã dùng, số có giờ quét, số có mã, dòng VR, voucher log, số dòng các bảng khớp từng con số |
| Chạy `generate` lần 2 | bị chặn đúng (bảng nối đã có 129 dòng) |
| `check` | 0 đơn / 0 dòng VR thiếu chi nhánh; 0 cảnh báo |
| `reverse` | sinh được SQL ghi ngược (110 dòng), không chạy |
| API khách so với logic cũ, 4 chi nhánh | **0 khác biệt** (gói, phim trong từng gói, phim đang chiếu, gói VR); media trả theo chi nhánh; bài viết công khai đếm đúng |
| Test tự động | server/worker 1008/1008 (gồm test quét tên cột cũ), admin 114/114; typecheck toàn repo và web khách 0 lỗi |
| Trình duyệt (lượt trước, cùng code trừ các sửa nhỏ của mục A) | gói không chi nhánh lưu được và khách không thấy; gắn Vạn Hạnh thì khách thấy đúng 6 phim, HN không thấy; đặt vé đúng chi nhánh/giá; soát vé lần 1 thành công, lần 2 bị chặn; form thiếu lựa chọn → 400 |
