# 🎮 GÓI VR + VOUCHER - PLAN TRIỂN KHAI CHI TIẾT

> Plan cho dự án CTBooking (CineSphere)
> Auth: Trae Agent
> Last updated: 2026-08-18
> File path: `VR_IMPLEMENTATION_PLAN.md` (root project)

---

## 📌 TỔNG QUAN KIẾN TRÚC (LỰA CHỌN ĐỒNG Ý)

### 1. Gói VR dùng chung bảng `ticket_packages` + cột phân biệt `type`
- **KHÔNG tách bảng** `ticket_packages` ra 2 bảng riêng. Lý do: 80% trường chung, dễ thống kê, CRUD admin không bị duplicate.
- Dùng cột **`type`** (đã có trong schema) làm discriminator:
  - `type = 'movie'` (hoặc NULL/empty) → gói vé xem phim (default, giữ nguyên data cũ)
  - `type = 'vr'` → gói trải nghiệm VR (mới)

### 2. Tách logic code hoàn toàn cho VR (KHÔNG đổ vào hàm cũ)
- Tất cả logic validate, create booking cho VR viết **vào file/module MỚI**
- KHÔNG SỬA `validateBookingInput()` / `createPaymentImpl()` hiện tại (trong `server/routes/user/payments.ts`) – chúng cứ phục vụ booking phim mãi mãi, tránh regression.

### 3. Dùng booking_vr_items cho đơn nhiều gói VR
- Bảng `booking_vr_items` (migration 0012 sẽ chỉnh sửa/lại chạy) lưu chi tiết nhiều VR package khác nhau trong cùng 1 booking (quantity, unit_price, snapshot name, voucher từng dòng…)
- Bảng `bookings` dùng chung với vé phim (thêm 2 cột voucher level tổng đơn) – thanh toán/confirm payment vẫn share code được.

### 4. Bảng Vouchers riêng, flexible cho tương lai
- Bảng `vouchers` (riêng) có cột **`scope: 'vr' | 'movie' | 'all'`**.
- Hiện tại scope mặc định `'vr'`. Sau này nếu vé phim cần voucher thì chỉ cần mở scope, KHÔNG viết lại hệ thống.

---

## 🏗️ PHASE 1 - DATABASE SCHEMA & MIGRATIONS (P0 - ưu tiên cao nhất)

> Migration 0012 chưa chạy, CHỈNH SỬA NỘI DUNG MIGRATION 0012 + TẠO MIGRATION MỚI 0013.
> Schema ở Cloudflare D1 (dùng SQLite cục bộ test), file khai báo: `worker/src/schema.ts`

---

### TASK 1.1 - Sửa migration `0012_add_booking_vr_items.sql` (CHƯA CHẠY → ĐƯỢC PHÉP SỬA)
**File:** `worker/migrations/0012_add_booking_vr_items.sql`
**Lưu ý cũ của user vẽ thiếu → bổ sung:**

| Cột cần thêm vào `booking_vr_items` | Kiểu | Mục đích |
|------------------------------------|------|----------|
| `voucher_id` | INTEGER (nullable) FK → vouchers.id | Voucher áp dụng trên từng dòng VR item (nếu hỗ trợ per-item) |
| `discounted_unit_price` | REAL | Giá sau khi giảm của 1 đơn vị (snapshot) |
| `line_total` | REAL | quantity × discounted_unit_price (snapshot để không tính toán lại khi báo cáo) |
| `voucher_discount_amount` | REAL | Số tiền được giảm trên dòng này (dành cho báo cáo) |
| `branch_id` | INTEGER FK → branches.id | Chi nhánh đặt (để thống kê theo branch) |

→ Migration 0012 cuối cùng sẽ có cấu trúc:
```sql
CREATE TABLE IF NOT EXISTS booking_vr_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  vr_ticket_package_id INTEGER NOT NULL REFERENCES ticket_packages(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL,
  package_name TEXT NOT NULL,
  voucher_id INTEGER REFERENCES vouchers(id) ON DELETE SET NULL,
  discounted_unit_price REAL,
  line_total REAL NOT NULL,
  voucher_discount_amount REAL DEFAULT 0,
  branch_id INTEGER REFERENCES branches(id) ON DELETE RESTRICT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_booking_vr_items_booking_id ON booking_vr_items(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_vr_items_vr_package_id ON booking_vr_items(vr_ticket_package_id);
CREATE INDEX IF NOT EXISTS idx_booking_vr_items_branch_id ON booking_vr_items(branch_id);
```

---

### TASK 1.2 - Tạo migration `0013_vr_vouchers_and_schema_updates.sql` (MỚI)
**File:** `worker/migrations/0013_vr_vouchers_and_schema_updates.sql`

Migration này làm 4 Việc:

#### A. Thêm cột VR vào bảng `ticket_packages` (cho type='vr')
```sql
ALTER TABLE ticket_packages ADD COLUMN cover_image TEXT;        -- Ảnh bìa trò chơi/trải nghiệm VR (khác cover_image của movies, đây là field của package)
ALTER TABLE ticket_packages ADD COLUMN duration_min INTEGER;   -- Thời gian trải nghiệm (phút) - nếu gói giới hạn thời gian
ALTER TABLE ticket_packages ADD COLUMN vr_genre TEXT;          -- Thể loại VR (ví dụ: "Horror", "Adventure", "Racing", "Educational") - optional
ALTER TABLE ticket_packages ADD COLUMN min_players INTEGER DEFAULT 1; -- Số người tối thiểu
ALTER TABLE ticket_packages ADD COLUMN max_players INTEGER DEFAULT 1; -- Số người tối đa / 1 lần chơi
```

#### B. Thêm cột voucher (level tổng đơn) vào bảng `bookings`
```sql
ALTER TABLE bookings ADD COLUMN voucher_id INTEGER REFERENCES vouchers(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN voucher_code_snapshot TEXT;     -- Snapshot mã voucher (để voucher bị xóa/sửa vẫn còn lịch sử)
ALTER TABLE bookings ADD COLUMN voucher_discount_amount REAL DEFAULT 0; -- Tổng giảm giá từ voucher trên toàn đơn
ALTER TABLE bookings ADD COLUMN booking_type TEXT DEFAULT 'movie'; -- 'movie' | 'vr' - PHÂN BIỆT LOẠI ĐƠN (quan trọng cho list/filter sau này)
ALTER TABLE bookings ADD COLUMN original_total_price REAL;      -- Tổng trước khi giảm giá (để đối chiếu)
```

#### C. Tạo bảng `vouchers` (chính)
```sql
CREATE TABLE IF NOT EXISTS vouchers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,   -- VD: "VR20OFF" - không phân biệt hoa thường
  name TEXT NOT NULL,                         -- Tên chương trình voucher (hiển thị admin)
  description TEXT,
  scope TEXT NOT NULL DEFAULT 'vr',           -- 'vr' | 'movie' | 'all' (hiện tại hardcode = 'vr')
  discount_type TEXT NOT NULL,                -- 'percent' | 'fixed'
  discount_value REAL NOT NULL,               -- 20 (cho percent) hoặc 50000 (cho fixed)
  min_order_value REAL DEFAULT 0,             -- Tổng đơn tối thiểu để áp dụng
  max_discount REAL,                          -- NULL = không giới hạn (cho percent). Ví dụ giảm 20% tối đa 50k
  usage_limit INTEGER,                        -- NULL = unlimited. VD 100 lượt toàn hệ thống
  per_user_limit INTEGER DEFAULT 1,           -- Số lượt tối đa / 1 user (NULL = unlimited)
  used_count INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,       -- boolean
  valid_from TEXT,                            -- ISO date
  valid_until TEXT,                           -- ISO date
  applicable_ticket_package_ids TEXT,         -- JSON array [id1,id2] - NULL = tất cả package trong scope
  applicable_user_ids TEXT,                   -- JSON array - NULL = không giới hạn user
  excluded_ticket_package_ids TEXT,           -- JSON array - loại trừ
  branch_ids TEXT,                            -- NULL = all branches | JSON array - chỉ áp tại chi nhánh nào
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  deleted_by_staff_id INTEGER REFERENCES staffs(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(code);
CREATE INDEX IF NOT EXISTS idx_vouchers_scope ON vouchers(scope);
CREATE INDEX IF NOT EXISTS idx_vouchers_is_active ON vouchers(is_active);
```

#### D. Tạo bảng `voucher_redemption_logs` (chống gian lận, lịch sử sử dụng voucher)
```sql
CREATE TABLE IF NOT EXISTS voucher_redemption_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_id INTEGER NOT NULL REFERENCES vouchers(id) ON DELETE RESTRICT,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  redeemed_at TEXT NOT NULL,
  discount_amount_applied REAL NOT NULL,
  order_total_before_discount REAL NOT NULL,
  order_total_after_discount REAL NOT NULL,
  staff_id INTEGER REFERENCES staffs(id) ON DELETE SET NULL -- nếu nhân viên áp mã cho khách offline
);
CREATE INDEX IF NOT EXISTS idx_voucher_redemption_voucher_id ON voucher_redemption_logs(voucher_id);
CREATE INDEX IF NOT EXISTS idx_voucher_redemption_booking_id ON voucher_redemption_logs(booking_id);
CREATE INDEX IF NOT EXISTS idx_voucher_redemption_user_id ON voucher_redemption_logs(user_id);
```

---

### TASK 1.3 - Cập nhật `worker/src/schema.ts` khai báo đầy đủ DRIZZLE ORM
**File:** `worker/src/schema.ts`
- **KHAI BÁO LẠI `ticket_packages`**: thêm các cột `cover_image`, `duration_min`, `vr_genre`, `min_players`, `max_players`
- **KHAI BÁO LẠI `bookings`**: thêm `voucher_id`, `voucher_code_snapshot`, `voucher_discount_amount`, `booking_type`, `original_total_price`
- **KHAI BÁO MỚI**:
  - `booking_vr_items` (đủ cột như migration 0012 đã chỉnh sửa) + relation (`bookingsRelations` thêm 1 `booking_vr_items: many()`)
  - `vouchers` + relation
  - `voucher_redemption_logs` + relation
- Thêm vào relations của `ticket_packages`: `vr_booking_items: many(booking_vr_items)`
- **Quan trọng**: tạo Drizzle snapshot mới nếu cần, ít nhất đảm bảo code typescript match SQL migrations.

---

## ⚙️ PHASE 2 - BACKEND API (WORKER + SERVER ROUTES) (P0)

> Tất cả logic mới viết vào FILE MỚI. KHÔNG chỉnh sửa logic cũ trong `server/routes/user/payments.ts` (trừ khi muốn hàm confirm payment share được – xem task 2.3).

---

### TASK 2.1 - Tạo module voucher: `server/routes/user/vouchers.ts` + `server/routes/admin/vouchers.ts`

#### 2.1.A User-side voucher logic (dùng trước khi tạo booking)
| Hàm | Đầu vào | Kết quả |
|-----|---------|---------|
| `validateVoucherForVRImpl()` | `{ code, vr_cart_items, user_id, branch_id, order_total_before }` | Trả về `{ valid: boolean, discount_amount, error_code?, voucher_details }` |
| Logic validate check: | 1. code tồn tại, 2. is_active=true, 3. chưa hết hạn (valid_from/until), 4. used_count < usage_limit, 5. user_id đã dùng chưa (check per_user_limit query redemption_logs), 6. min_order_value đạt, 7. scope có bao gồm vr, 8. applicable ticket_package_ids có chứa vr_package_id trong cart, 9. branch_ids match |

#### 2.1.B Admin voucher CRUD (tương Tickets)
Tạo các hàm trong `server/routes/admin/vouchers.ts`:
- `listVouchersImpl()`: phân trang, search theo code, filter scope/active/branch
- `getVoucherImpl()`: chi tiết 1 voucher + thống kê lượt dùng
- `createVoucherImpl()`: validate code unique, validate discount percent ≤100, max_discount logic
- `updateVoucherImpl()`:
- `deleteVoucherImpl()`: soft delete
- `restoreVoucherImpl()`:
- `toggleVoucherStatusImpl()`: bật/tắt nhanh

---

### TASK 2.2 - Tạo module VR Booking: `server/routes/user/vr-bookings.ts` (KHÔNG ĐỔNG VÀO payments.ts)

Các hàm MỚI, 100% riêng cho VR:

| Hàm | Mục đích | Đầu vào (body/args) | Lưu ý |
|-----|----------|---------------------|-------|
| `listActiveVRPackagesImpl()` | Lấy danh sách gói VR active (type='vr') cho user | `db, tables, branch_id?` | Filter `type='vr'` + is_active=true + deleted_at IS NULL + branch match. Return ảnh cover_image, duration, min/max players. |
| `validateVRBookingInput()` | Validate đặt VR (không ép combo phim) | `db, body, tables` | Body chứa: `vr_items[]` (mỗi item: `vr_package_id, quantity`), `voucher_code?`, `name, phone, email, branch_id`. <br> **KHÔNG check combo movies!**<br> Check tồn tại vr_package (type='vr', is_active=true). Tính `original_total_price`, rồi nếu có voucher thì gọi `validateVoucherForVRImpl()`. |
| `createVRBookingImpl()` | Tạo booking VR + insert booking_vr_items đồng thời (TRONG TRANSACTION nếu DB hỗ trợ, nếu không thì tuần tự nhưng có ROLLBACK thủ công nếu insert item fail) | `db, payload, tables` | 1. Insert vào `bookings` → lấy booking_id, nhớ set `booking_type='vr'`, các snapshot voucher. 2. Loop `vr_items` insert vào `booking_vr_items` (chứa snapshot unit_price, package_name, discounted, voucher_id per item). Trả về booking_id + booking_vr_items list. |
| `getVRBookingByIdImpl()` | Lấy chi tiết booking VR cho trang success | `id` | Join luôn `booking_vr_items` để show từng gói, số lượng, giá, voucher đã giảm. |

---

### TASK 2.3 - Tái sử dụng (share) payment confirmation
- **Hàm `updatePaymentImpl()` hiện tại** (trong payments.ts) **có thể dùng được luôn cho VR** vì logic set payment_status, paid_at, booking_code, gửi mail là KHÁI QUÁT.
- **Nhưng gửi mail cần phân biệt template**:
  → Trong `updatePaymentImpl`, trước khi gọi `getBookingEmailHtml`, query xem `booking.booking_type === 'vr'` không. Nếu 'vr' thì render template **"Xác nhận đặt trải nghiệm VR"** (khác với template booking phim). Nếu không có template VR thì tạm dùng template chung + đổi subject.
  → Tạo hàm mới `getVRBookingEmailTemplate()` trong `server/lib/email-templates.ts`.

- **Sau khi confirm payment (paid thành công)**: Gọi thêm hàm `redeemVoucherAfterPaymentImpl()` để:
  1. `UPDATE vouchers SET used_count = used_count + 1 WHERE id = ?`
  2. INSERT vào `voucher_redemption_logs` (lịch sử dùng voucher).
  → Logic này nên chạy trong cùng update payment flow, ngay sau khi payment_status='paid'.

---

### TASK 2.4 - Đăng ký Worker endpoints MỚI trong `worker/src/index.ts`

> **TẤT CẢ endpoint VR thêm mới. Endpoint cũ giữ nguyên 100%.**
> Đặt endpoint đúng vị trí phù hợp, phân theo nhóm user-public và admin-staff-auth.

| Method | Endpoint | Auth | Permission | Impl từ đâu | Dùng cho gì |
|--------|----------|------|------------|-------------|-------------|
| GET | `/api/vr/packages` | No | - | `listActiveVRPackagesImpl()` | User load danh sách gói VR khi mở trang /vr-booking |
| POST | `/api/vr/voucher/validate` | No/Optional user | - | `validateVoucherForVRImpl()` | User điền mã giảm giá, bấm "Áp dụng" → show discount ngay trên UI |
| POST | `/api/vr/validate-booking` | No | - | `validateVRBookingInput()` | Check trước khi thanh toán (tính tiền, voucher còn hiệu lực) |
| POST | `/api/vr/create-booking` | No | - | `createVRBookingImpl()` | Tạo booking_id + vr_items, sau đó user redirect sang MoMo/VNPay/VietQR (giống flow phim) |
| GET | `/api/vr/bookings/:id` | No/Staff có thể dùng chung | - | `getVRBookingByIdImpl()` | Hiển thị trên trang success-payment, show chi tiết các gói VR đã đặt |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/admin/vouchers` | StaffAuth | `vouchers:view` | `listVouchersImpl()` | Admin list voucher |
| GET | `/api/admin/vouchers/:id` | StaffAuth | `vouchers:view` | `getVoucherImpl()` | Chi tiết 1 voucher |
| POST | `/api/admin/vouchers` | StaffAuth | `vouchers:create` | `createVoucherImpl()` | Tạo voucher mới |
| PUT | `/api/admin/vouchers/:id` | StaffAuth | `vouchers:edit` | `updateVoucherImpl()` | Sửa voucher |
| DELETE | `/api/admin/vouchers/:id` | StaffAuth | `vouchers:delete` | `deleteVoucherImpl()` | Xóa mềm voucher |
| POST | `/api/admin/vouchers/:id/restore` | StaffAuth | `vouchers:restore` | `restoreVoucherImpl()` | Phục hồi |
| POST | `/api/admin/vouchers/:id/toggle-status` | StaffAuth | `vouchers:toggle_status` | `toggleVoucherStatusImpl()` | Nút bật tắt nhanh |
| GET | `/api/admin/deleted/vouchers` | StaffAuth | `vouchers:view_deleted` | `listDeletedVouchersImpl()` | Thùng rác voucher |

---

### TASK 2.5 - Chỉnh sửa endpoint Tickets (admin + user) để phân biệt type
**Vị trí**: `worker/src/index.ts` (GET `/api/tickets-active`, GET `/api/tickets`) + `server/routes/user/tickets.ts` (listActiveTicketPackages)

- **`/api/tickets-active` (dùng cho trang booking PHIM)**: Thêm điều kiện filter `AND (type IS NULL OR type != 'vr')` → để gói VR không bị lẫn vào select "Chọn loại vé" của trang đặt phim cũ.
- **`/api/tickets` (admin list)**: Thêm query param `?type=all|movie|vr` (mặc định 'all') để admin filter theo loại. Forward vào `listTicketPackagesImpl()` → modify hàm này thêm filter type.
- CRUD ticket (`createTicketPackageImpl` / `updateTicketPackageImpl`): Add field `type`, `cover_image`, `duration_min`, `vr_genre`, `min_players`, `max_players` vào args + set data insert/update (để admin khi tạo/sửa gói VR fill được các trường VR).

---

### TASK 2.6 - Seed Permissions RBAC cho module Vouchers
**File**: `server/lib/rbac-seed.ts` và migration `0002_seed_rbac.sql` (hoặc migration 0013 thêm INSERT)

Thêm permissions (module: `vouchers`):
- `vouchers:view` – xem danh sách
- `vouchers:create` – tạo voucher
- `vouchers:edit` – sửa
- `vouchers:delete` – xóa
- `vouchers:restore` – phục hồi
- `vouchers:toggle_status` – bật tắt
- `vouchers:view_deleted` – xem thùng rác

Assign các permissions này cho SuperAdmin, các Role cao nhất (Owner, Manager).

---

### TASK 2.7 - Update Types (shared/api.ts)
**File:** `shared/api.ts`

Thêm mới các interface:
```typescript
export interface VRPackageItem {
  vr_package_id: number;
  quantity: number;
}
export interface VRBookingRequest {
  email: string;
  emailBook: string;
  phone: string;
  name: string;
  vr_items: VRPackageItem[];
  voucher_code?: string;
  branch_id?: number;
  paymentMethod: 'cash' | 'momo' | 'vnpay' | 'vietqr';
  pay_txt_code?: string;
}
export interface VoucherValidateRequest {
  code: string;
  vr_items: VRPackageItem[];
  branch_id?: number;
}
export interface VoucherValidateResponse {
  valid: boolean;
  message?: string;
  discount_amount?: number;
  discount_type?: 'percent' | 'fixed';
  voucher_details?: VoucherSummary;
  order_total_before?: number;
  order_total_after?: number;
}
export interface VoucherSummary {
  id: number; code: string; name: string;
  discount_type: string; discount_value: number;
  max_discount?: number; scope: string;
}
```

Update PaymentRequest nếu cần, hoặc giữ nguyên cho booking phim.

---

## 🎨 PHASE 3 - FRONTEND USER (Next.js client) (P0)

> Không động vào `/booking` cũ (dành cho phim). TẠO TRANG MỚI `/vr-booking`.

---

### TASK 3.1 - Tạo page mới VR Booking
**File (thêm mới):** `next-client/src/app/vr-booking/page.tsx`
**Route:** `/vr-booking?branch_id=...`

UI/UX Flow cho trang này (giống vibe của booking phim nhưng khác structure):
1. **Header** + branch selector (dùng hook `useBranch` có sẵn)
2. **Bước 1 - Chọn gói trải nghiệm VR**:
   - Load từ `/api/vr/packages?branch_id=...`
   - Hiển thị DẠNG CARD GRID (2-4 cột), mỗi card có:
     - Ảnh bìa (`cover_image`) – tỉ lệ 16:9 hoặc 4:5
     - Tên gói VR, thể loại (vr_genre)
     - Thời gian (duration_min phút)
     - Số người chơi (min-max players)
     - Giá tiền (đơn giá)
     - Nút **"+"/"-"** quantity, input số lượng
3. **Bước 2 - Nhập mã giảm giá (nếu có)**:
   - Input + Button "Áp dụng"
   - Khi bấm → gọi POST `/api/vr/voucher/validate`
   - Nếu OK: show badge mã, show "Tiết kiệm: X VND", tính lại tổng
   - Nếu lỗi: toast + inline error, không áp mã (không block user)
4. **Bước 3 - Thông tin khách hàng**: name, phone, email (có thể reuse component từ booking phim, hoặc copy logic validate phone/email)
5. **Tổng kết**:
   - Danh sách các gói VR (name, qty, đơn giá, thành tiền)
   - Subtotal (original_total)
   - Voucher discount (nếu có)
   - Tổng cuối (total_price)
6. **Nút Thanh toán** (3 lựa chọn: VietQR, MoMo, VNPay) – reuse logic payment từ page booking, chỉ khác là gọi `createVRBookingApi` thay vì createBooking.

---

### TASK 3.2 - Tạo API client cho VR
**File (thêm mới):** `next-client/src/lib/api/vr-packages.ts`
Hoặc thêm vào tickets.ts (vì dùng chung bảng, nên tách cũng được):

Các hàm:
```typescript
export function getVRPackages(branch_id?: number, opts?: { signal?: AbortSignal }): Promise<{items: VRPackage[]}>
export function validateVrVoucher(payload: VoucherValidateRequest): Promise<VoucherValidateResponse>
export function validateVRBooking(payload: VRBookingRequest): Promise<any>
export function createVRBooking(payload: VRBookingRequest): Promise<{booking: any}>
export function getVRBookingById(id: number): Promise<any>
```

---

### TASK 3.3 - Update trang success-payment hiển thị VR đúng cách
**File:** `next-client/src/app/success-payment/page.tsx`

Nếu booking có `booking_type === 'vr'` (hoặc query /api/vr/bookings/:id có booking_vr_items):
- Thay title: "Đặt trải nghiệm VR thành công"
- Thay text: thay "Xem phim" bằng "Trải nghiệm VR"
- Hiển thị LIST các gói VR đã đặt (dùng bảng/list): Tên gói, Số lượng, Thời gian, Giá
- Ẩn phần lịch chiếu/thời gian diễn ra (nếu không có concept giờ cho VR)
- Nếu là phim: giữ nguyên UI cũ

→ Lấy booking_type bằng cách gọi `/api/bookings/:id` (nếu booking_type chưa có trong response thì modify `getBookingByIdImpl` trả về thêm `booking_type`).

---

### TASK 3.4 - Thêm link/nút "Đặt VR" vào trang chủ hoặc menu
**File:** `next-client/src/components/user/home/HeroSection.tsx` hoặc `Header.tsx` hoặc `ProductSection.tsx`
- Thêm 1 Banner "Trải nghiệm VR" hoặc 1 Nav item mới (bên cạnh Đặt vé) điều hướng tới `/vr-booking`

---

### TASK 3.5 - Update trang account/user lịch sử giao dịch
**File:** `next-client/src/app/account/page.tsx` (nếu có)
- Khi hiển thị list bookings, có badge "Vé Phim" hoặc "Trải nghiệm VR" phân biệt theo `booking_type`.
- Khi click vào VR booking: mở modal/detail hiển thị danh sách vr_items thay vì phim.

---

## 🛡️ PHASE 4 - FRONTEND ADMIN (React Client) (P1 – ưu tiên ngay sau P0)

> Admin dùng `client/` (React Vite) – không phải Next.js user client.

---

### TASK 4.1 - Chỉnh sửa Trang Tickets / Gói vé (admin) hỗ trợ type VR
**File:** `client/pages/admin/Tickets.tsx` + `client/components/admin/content/TicketsContent.tsx`
**File:** `client/lib/api/tickets.ts` (hoặc file api admin tương ứng)

Làm 4 việc:
1. **Thêm filter "Loại gói"** topbar: Tất cả / Vé Phim / Gói VR (gọi API với `?type=...`)
2. **Thêm trường mới vào Form Tạo/Sửa Gói vé**:
   - Select **"Loại gói"**: `Vé Phim (movie)` / `Gói VR (vr)`
   - Nếu chọn VR → **ẩn input Combo phim** (vì không liên quan)
   - Nếu chọn VR → **hiện input mới** (đã add vào schema/migration):
     - Upload **Ảnh bìa cover_image** (reuse Cloudinary sign/upload flow của movies)
     - Thời gian (duration_min phút)
     - Thể loại VR (vr_genre – text/select)
     - Số người tối thiểu / tối đa (min_players, max_players)
   - Nếu chọn Vé Phim → giữ nguyên tất cả UI cũ (combo, features, …)
3. **Column table** thêm cột "Loại" (badge xanh=Phim, tím=VR)
4. Khi click chi tiết VR → hiển thị ảnh bìa, thời gian thay vì list phim combo.

---

### TASK 4.2 - Tạo TRANG MỚI Quản lý Vouchers
#### 4.2.A Thêm route mới
**File:** `client/App.tsx` (hoặc nơi khai báo router React Router DOM)
- Thêm route `/admin/vouchers` → trang VouchersPage (tạo mới)
- Thêm route `/admin/deleted-vouchers` → thùng rác voucher (tùy chọn, hoặc tab trong trang vouchers)

#### 4.2.B Thêm menu vào Admin Layout
**File:** `client/admin/layouts/AdminLayout.tsx` (hoặc file sidebar tương ứng)
- Thêm item menu **"🎟️ Vouchers"** sau Tickets / Trước Toys

#### 4.2.C Tạo Components và Pages voucher
Tạo các file (clone pattern từ ToysContent / TicketsContent vì UI khá giống: bảng, phân trang, modal CRUD):
- `client/pages/admin/Vouchers.tsx` (wrapper, call API, state)
- `client/components/admin/content/VouchersContent.tsx` (table, pagination, CRUD modal)
- `client/lib/api/admin.ts` – thêm voucher API functions:
  ```
  listVouchersApi(page, pageSize, q, filters)
  getVoucherApi(id)
  createVoucherApi(payload)
  updateVoucherApi(id, payload)
  deleteVoucherApi(id)
  restoreVoucherApi(id)
  toggleVoucherStatusApi(id)
  ```

#### 4.2.D Form Tạo Voucher cần các field
- Tên voucher (name)
- Mã voucher (code) – uppercase, regex `[A-Z0-9_-]`, hint "VD: VR20OFF"
- Mô tả
- Scope (select): 🔒 Đã hardcode "Chỉ gói VR" cho scope 'vr' (hiện tại). Ẩn select hoặc fix cứng. Sau này mở rộng thì add options Vé Phim / Tất cả.
- Loại giảm giá (discount_type): Phần trăm (%) / Cố định (VND)
- Giá trị giảm (discount_value)
- Giảm tối đa (max_discount – chỉ hiện khi loại=Phần trăm)
- Tổng đơn tối thiểu (min_order_value)
- Giới hạn lượt dùng toàn hệ thống (usage_limit) – để trống = không giới hạn
- Giới hạn / user (per_user_limit) – mặc định 1
- Hiệu lực từ ngày - đến ngày (valid_from, valid_until)
- Áp dụng cho gói VR cụ thể (applicable_ticket_package_ids): MultiSelect các gói có type='vr' – để trống = tất cả
- Chi nhánh áp dụng (BranchMultiSelect) – reuse component `BranchMultiSelect.tsx`
- Trạng thái (checkbox is_active)

---

### TASK 4.3 - Update trang TicketCheck (Quét mã xác nhận vé)
**File:** `client/pages/admin/TicketCheck.tsx` + `client/components/admin/content/TicketCheckContent.tsx`

Khi scan mã vé hoặc tìm mã → gọi `/api/bookings-code/:code` → trả booking:
- Nếu `booking_type === 'vr'` (hoặc booking_vr_items có data):
  - Ẩn thông tin phim (poster, lịch chiếu…)
  - Thay bằng bảng **"Chi tiết gói VR đã đặt"** → list từng dòng package_name, quantity, unit_price
  - Badge lớn "TRẢI NGHIỆM VR" thay cho "VÉ PHIM"
  - Xác nhận "Check-in thành công" – text thay "Đã sử dụng vé VR"
- Cần thêm endpoint lấy booking_vr_items theo booking_id (có thể modify `getBookingByCodeImpl` return thêm `vr_items: []` nếu là VR, hoặc API riêng).

---

### TASK 4.4 - Update trang Transactions
**File:** `client/pages/admin/Transactions.tsx` / `TransactionsContent.tsx`
- Thêm filter "Loại đơn": Tất cả / Vé Phim / Trải nghiệm VR
- Thêm cột "Loại" (badge)
- Khi click detail 1 booking VR → show list vr_items thay vì phim combo.

---

### TASK 4.5 - Dashboard metrics (tùy chọn P2)
**File:** `server/routes/admin/dashboard.ts` (phần getDashboardMetricsImpl)
- Có thể tách doanh thu theo booking_type: Revenue Phim, Revenue VR.
- Nếu không cần ngay, làm sau.

---

## 🧪 PHASE 5 - KIỂM THỬ & VERIFY (P1 trước khi deploy)

1. **Test DB migration**: Chạy migration trên local SQLite dev, verify table tồn tại, cột đủ.
2. **Test CRUD Ticket Package VR trên Admin**: Tạo 2-3 gói VR, upload cover_image, set type='vr', verify list `/api/vr/packages` trả đúng.
3. **Test Voucher flow**:
   - Tạo voucher VR20 (percent 20%, max 50k)
   - Tạo voucher VR50FIX (fixed 50k, đơn tối thiểu 200k)
   - Dùng hết lượt → test chặn
   - Hết hạn → test chặn
4. **Test đặt VR trên user site**:
   - Không chọn voucher → flow chuẩn
   - Có voucher valid → discount đúng, booking_vr_items lưu giá đúng, vouchers.used_count tăng +1 sau khi confirm payment
   - Thanh toán MoMo VNPay success flow (dùng sandbox)
5. **Test TicketCheck VR**: Scan code VR → show VR info, check-in set is_used.
6. **Test KHÔNG LÃM HỎI BOOKING PHIM CŨ**: Đặt vé phim bình thường như trước, không thấy gói VR hiện ra, voucher movie scope chưa implement nên không cần test (nếu user apply VR voucher cho phim nó sẽ bị chặn scope).

---

## 📦 PHASE 6 - DEPLOYMENT NOTES (P1)

1. **Migration**: Trên Cloudflare dashboard D1 → run migrations 0012 (đã sửa) + 0013 (mới). Dùng `wrangler d1 migrations apply cinema_db --remote` (thay tên DB đúng).
2. **Seeding permissions**: Insert voucher permissions vào DB production, assign cho các role (nếu không có trong migration seed, insert thủ công qua dashboard hoặc file SQL).
3. **Rollback plan**: Nếu có bug nghiêm trọng VR: Admin set toàn bộ ticket_packages type='vr' → is_active=false; ẩn route `/vr-booking` → không ảnh hưởng booking phim.
4. **Monitor**: Log các lỗi booking VR, voucher validation failures → theo dõi 1-2 ngày đầu.

---

## 🎯 ƯU TIÊN THỰC THI

- **P0 (Bắt buộc chạy trước)**: Phase 1 (DB Schema) → Phase 2 (Backend APIs) → Phase 3 (User VR Booking UI). Đây là 3 phase để user đặt được VR + voucher cơ bản.
- **P1 (Ngay sau P0, trước khi ra mắt public)**: Phase 4 (Admin Vouchers CRUD) + Phase 5 (Test toàn diện) + Phase 6 (Deploy) + TicketCheck VR.
- **P2 (Tối ưu/làm sau)**: Dashboard VR revenue, report VR usage analytics, VR booking slot giờ đặt (nếu VR cần theo giờ như lịch chiếu phim – client chưa yêu cầu nên bỏ qua hiện tại).

---

## 📋 CHECKLIST QUICK TRACKER

Khi bắt tay vào làm, tick từng mục nhỏ để theo dõi:

- [ ] 1.1 Sửa migration 0012 booking_vr_items (thêm cột voucher, snapshot)
- [ ] 1.2 Tạo migration 0013: cột VR trên ticket_packages, cột voucher trên bookings, bảng vouchers, redemption_logs
- [ ] 1.3 Update worker/src/schema.ts khai báo đầy đủ + relations
- [ ] 2.1 Tạo server/routes/user/vouchers.ts, server/routes/admin/vouchers.ts CRUD
- [ ] 2.2 Tạo server/routes/user/vr-bookings.ts: listVRPackages, validateVRBookingInput, createVRBookingImpl
- [ ] 2.3 Update confirm payment → apply redeemVoucher, VR email template
- [ ] 2.4 Đăng ký endpoints VR mới trong worker/index.ts
- [ ] 2.5 Update tickets-active filter hidden VR packages; admin tickets filter ?type
- [ ] 2.6 Seed voucher permissions RBAC
- [ ] 2.7 Thêm types VR/Voucher vào shared/api.ts
- [ ] 3.1 Tạo next-client/src/app/vr-booking/page.tsx (UI chọn VR, voucher, checkout)
- [ ] 3.2 Tạo lib/api/vr-packages.ts client functions
- [ ] 3.3 Update success-payment phân biệt VR / phim
- [ ] 3.4 Add link VR vào trang chủ / header
- [ ] 3.5 Update lịch sử account (nếu có)
- [ ] 4.1 Admin Tickets: filter + form VR fields
- [ ] 4.2 Admin trang Vouchers CRUD mới 100%
- [ ] 4.3 Admin TicketCheck hiển thị VR info
- [ ] 4.4 Admin Transactions filter loại
- [ ] 5.1 Test migration local
- [ ] 5.2 Test CRUD gói VR admin
- [ ] 5.3 Test toàn bộ voucher lifecycle
- [ ] 5.4 Test đặt VR thành công end-to-end
- [ ] 5.5 Test booking phim không bị regression (quan trọng nhất)
- [ ] 6.1 Deploy migration production + seeding permissions
- [ ] 6.2 Deploy worker + next-client + admin-client
- [ ] 6.3 Monitor error 2 ngày đầu

---

> End of Plan. Khi user approve, implement theo PHASE 1 → 2 → 3 → 4 theo thứ tự ưu tiên.
