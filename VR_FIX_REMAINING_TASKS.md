# 🎮 VR FIX & HOÀN THIỆN - PLAN CÔNG VIỆC CÒN LẠI

> Dựa trên đánh giá ngày 2026-08-19
> Auth: Trae Agent
> File gốc đánh giá chi tiết: `VR_IMPLEMENTATION_PLAN.md`
> File kế hoạch fix này: `VR_FIX_REMAINING_TASKS.md` (root project)

---

## 📌 TỔNG KẾT ĐÁNH GIÁ

| Mục | Tình trạng | Ghi chú |
|-----|-----------|---------|
| Luồng đặt VR (frontend user) | ✅ 95% OK | Thiếu link homepage tới /vr-booking |
| Backend VR booking API | ✅ 100% OK | list/validate/create/get đủ |
| Backend Voucher CRUD API | ✅ 100% OK | 9 endpoints đủ (list/create/update/delete/restore/toggle/deleted) |
| Payment confirm + redeem voucher | ✅ 100% OK | updatePaymentImpl() phân biệt booking_type='vr', gửi mail VR riêng |
| **Admin Tickets (chung với VR)** | ✅ RẤT TỐT | **Giữ nguyên phương án, KHÔNG tách.** Filter pills + tab form làm rất hợp lý |
| **❌ Admin Vouchers UI** | 🔴 CHƯA LÀM | Thiếu page, route, menu, api client → **P0** |
| **❌ TicketCheck phân biệt VR** | 🟡 CHƯA LÀM | UI không show vr_items → **P1** |
| **❌ Transactions filter loại đơn** | 🟡 CHƯA LÀM | Filter + cột badge booking_type → **P1** |
| Link VR trên homepage | 🟠 CHƯA LÀM | User phải gõ tay URL /vr-booking → **P2** |
| Seed voucher permissions (Manager/Owner) | 🟠 Cần verify | SuperAdmin OK, role thấp hơn cần seed → **P2** |

---

## 🎯 ƯU TIÊN THỰC THI

| Priority | Tên module | Ước lượng thời gian |
|----------|-----------|---------------------|
| **P0 - Bắt buộc trước khi có khách dùng VR** | Phase 1: Admin Vouchers UI CRUD | ~4-6h |
| **P1 - Trước khi go-live public** | Phase 2: TicketCheck VR + Transactions VR | ~2-3h |
| **P2 - Tối ưu sau go-live** | Phase 3: Link homepage + Permissions seed + Fix nhỏ | ~1-2h |

---

## 🔧 PHASE 1 — ADMIN VOUCHERS UI CRUD (P0 - CAO NHẤT)

> Tại sao P0? Vì VR không có voucher thì mất USP khuyến mãi, người dùng KHÔNG THỂ tạo voucher từ giao diện admin dù backend đã sẵn sàng.

### TASK 1.1 — Thêm API client voucher vào admin client

**File tạo/sửa:** `client/lib/api/admin.ts` (thêm vào cuối file, không tạo file mới)

Copy pattern từ `getTicketsApi/createTicketApi/...` nhưng gọi endpoint `/api/admin/vouchers`:

```typescript
// ===== VOUCHERS =====
interface VoucherFilters {
  page?: number;
  pageSize?: number;
  q?: string;
  scope?: string;   // 'vr' | 'movie' | 'all'
  is_active?: string; // 'true' | 'false' | 'all'
}

export async function listVouchersApi(filters: VoucherFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  });
  return requestWithAuth(`/api/admin/vouchers?${params.toString()}`);
}

export async function getVoucherApi(id: number) {
  return requestWithAuth(`/api/admin/vouchers/${id}`);
}

export async function createVoucherApi(payload: Record<string, any>) {
  return requestWithAuth(`/api/admin/vouchers`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateVoucherApi(id: number, payload: Record<string, any>) {
  return requestWithAuth(`/api/admin/vouchers/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export async function deleteVoucherApi(id: number) {
  return requestWithAuth(`/api/admin/vouchers/${id}`, { method: 'DELETE' });
}

export async function restoreVoucherApi(id: number) {
  return requestWithAuth(`/api/admin/vouchers/${id}/restore`, { method: 'POST' });
}

export async function toggleVoucherStatusApi(id: number) {
  return requestWithAuth(`/api/admin/vouchers/${id}/toggle-status`, { method: 'POST' });
}

export async function listDeletedVouchersApi(filters: VoucherFilters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
  });
  return requestWithAuth(`/api/admin/deleted/vouchers?${params.toString()}`);
}

// Also export to lib/api.ts barrel if needed
```

### TASK 1.2 — Tạo Component `VouchersContent.tsx`

**File mới:** `client/components/admin/content/VouchersContent.tsx`

Pattern: CLONE `TicketsContent.tsx` (vì UI rất giống: bảng, phân trang, modal CRUD, switch active), chỉ khác fields:

#### A. Toolbar (top)
- Search input (tìm theo code / name)
- Filter scope select: Tất cả / Chỉ VR / Chỉ Phim / Tất cả loại (option hiện tại: chỉ show "Chỉ VR" vì scope mặc định 'vr')
- Filter active: Switch "Chỉ hiện đang bật"
- Button "Thêm mới" + Button "Xem đã xóa" (nếu có permission `vouchers:view_deleted`)
- Refresh button

#### B. Table columns
| Cột | Mô tả |
|-----|-------|
| Mã voucher | `code` (uppercase, font-mono, bold, badge màu tím) |
| Tên CT | `name` |
| Loại giảm | `discount_type` + `discount_value`: Badge "20%" hoặc "50,000₫" |
| Đã dùng / Giới hạn | `used_count / usage_limit` (VD: 12/100, progress bar nhỏ nếu thích) |
| Hiệu lực | `valid_from` → `valid_until` (nếu có) + icon ⚠️ nếu hết hạn |
| Chi nhánh | `BranchIdsBadge` component (reuse từ TicketsContent) |
| Trạng thái | `is_active` Switch (gọi `toggleVoucherStatusApi` + confirm dialog) |
| Thao tác | Eye (detail) / Pencil (edit) / Trash (delete) |

#### C. Create / Edit Modal Form
> ⚠️ **Scope mặc định hardcode = 'vr'** (ẩn scope select, set payload.scope='vr' tự động). Sau này mở rộng movie/all thì add select.

Các field form (đầu vào cho admin):

```
1. Mã voucher (code) *  [uppercase, hint "VD: VR20OFF"]
   - Auto generate button: random 6 ký tự [A-Z0-9]
   - Validate unique (tự backend trả lỗi → toast)

2. Tên chương trình (name) *  [VD: "Khai trương VR Giảm 20%"]

3. Mô tả (description)  [textarea, optional]

4. 🔒 Scope (ẩn, mặc định = 'vr')

5. Loại giảm giá (discount_type) *  Radio/Tabs:
   - [ ] Phần trăm (%) → discount_value (1-100)
   - [ ] Cố định (VND) → discount_value (số, min 1000)

6. Giá trị giảm (discount_value) *

7. Giảm tối đa (max_discount)  [Chỉ hiện khi discount_type='percent']
   - VD: giảm 20% tối đa 50,000đ (để trống = không giới hạn)

8. Tổng đơn tối thiểu (min_order_value)  [Default 0 = không yêu cầu]

9. Giới hạn lượt dùng toàn hệ thống (usage_limit)  [Để trống = không giới hạn]

10. Giới hạn / user (per_user_limit)  [Default 1]

11. Hiệu lực từ ngày (valid_from)  [DateTime picker, trống = ngay lập tức]

12. Hiệu lực đến ngày (valid_until)  [DateTime picker, trống = không hết hạn]

13. Áp dụng cho gói VR cụ thể (applicable_ticket_package_ids)
    - MultiSelect, gọi `/api/tickets?type=vr&pageSize=100` để load list gói VR
    - Hiển thị tên gói, để trống = áp dụng tất cả gói VR

14. Loại trừ các gói (excluded_ticket_package_ids)
    - MultiSelect tương tự trên, để trống = không loại trừ

15. Chi nhánh áp dụng (branch_ids)
    - Reuse <BranchMultiSelect /> component (giống TicketsContent)
    - Để trống = tất cả chi nhánh

16. Áp dụng cho user IDs cụ thể (applicable_user_ids) [Tạm ẩn, làm sau nếu cần]

17. Trạng thái (is_active) Checkbox, default true
```

#### D. Detail Modal
- Tương tự Edit nhưng readonly + thêm tab thống kê:
  - Tổng lượt redemption: `redemption_total_count` (từ `getVoucherImpl`)
  - 20 giao dịch gần nhất: bảng `recent_redemptions` (user_id, booking_id, redeemed_at, discount_amount_applied)
  - Audit: created_by_staff_name, updated_by_staff_name

### TASK 1.3 — Tạo Page Wrapper `Vouchers.tsx`

**File mới:** `client/pages/admin/Vouchers.tsx`

Clone pattern `Tickets.tsx`:
```tsx
// client/pages/admin/Vouchers.tsx
import AdminLayout from '@/admin/layouts/AdminLayout';
import VouchersContent from '@/components/admin/content/VouchersContent';
import {
  listVouchersApi, deleteVoucherApi, getBranches, toggleVoucherStatusApi
} from '@/lib/api';

export default function VouchersPage() {
  // state: vouchers[], page, pageSize, total, search, scopeFilter, activeFilter,
  //        isEditOpen, editData, isLoading, branches, selectedBranchId, isDeleteDialogOpen
  // useStaffPermission('vouchers', 'view_deleted') / 'create' / 'edit' / 'delete' / 'restore' / 'toggle_status'

  // useEffect: call listVouchersApi with filters on change
  // openCreate: setEditData({...default values: {scope:'vr', is_active:true, per_user_limit:1, discount_type:'percent'})
  // openEdit: pass voucher object
  // handleDelete: confirm + call deleteVoucherApi
  // pass all props → <VouchersContent />
}
```

**File mới (nếu có view deleted):** `client/pages/admin/DeletedVouchers.tsx` (giống `DeletedTickets.tsx`)

### TASK 1.4 — Thêm Route Vouchers vào Router

**File sửa:** `client/App.tsx`

Thêm 2 route (pattern giống Tickets / DeletedTickets):
```tsx
{ path: '/admin/vouchers', element: (
  <AdminGate permission={{module:'vouchers',action:'view'}}>
    <Vouchers />
  </AdminGate>
)},
{ path: '/admin/deleted/vouchers', element: (
  <AdminGate permission={{module:'vouchers',action:'view_deleted'}}>
    <DeletedVouchers />
  </AdminGate>
)},
```
Import 2 pages mới.

### TASK 1.5 — Thêm Menu Vouchers vào Admin Layout Sidebar

**File sửa:** `client/admin/layouts/AdminLayout.tsx`

Vị trí insert: Sau `Tickets` / Trước `Toys` (theo plan gốc):
```tsx
{
  id: 'vouchers',
  icon: <Ticket className="w-5 h-5" />,  // hoặc Tag / Percent từ lucide-react
  label: '🎟️ Vouchers',
  path: '/admin/vouchers',
  permission: { module: 'vouchers', action: 'view' } as any
},
```

---

## 🔧 PHASE 2 — TICKETCHECK VR + TRANSACTIONS VR (P1)

### TASK 2.1 — TicketCheckContent phân biệt VR + Hiển thị vr_items

**File sửa:** `client/components/admin/content/TicketCheckContent.tsx`

Cần làm các thay đổi:
1. **Fetch thêm vr_items khi tìm booking**: Nếu `getBookingByCodeApi` trả về `booking_type === 'vr'` → gọi `getVRBookingById(booking_id)` thêm để get `vr_items` (hoặc tối ưu backend trả vr_items luôn trong `getBookingByCodeImpl` - nên làm backend cho dễ)
2. **Banner phân biệt lớn**: Nếu booking_type='vr' → Banner lớn màu tím "🎮 TRẢI NGHIỆM VR" (thay banner xanh "VÉ PHIM")
3. **Ẩn section thông tin phim** (poster, lịch chiếu, duration…) khi là VR
4. **Thêm bảng "Chi tiết gói VR"**: Khi có vr_items:
   ```
   | Tên gói VR          | SL | Đơn giá | Thành tiền |
   | VR Escape Room      | 2  | 150,000 | 300,000    |
   | VR Horror 30 phút   | 1  | 120,000 | 120,000    |
   ```
5. **Text xác nhận check-in**: Thay "Đã sử dụng vé" thành "Đã xác nhận vào phòng VR" hoặc chung "Check-in thành công" là được.
6. **Voucher info**: Nếu có `voucher_code_snapshot` và `voucher_discount_amount > 0` → show dòng "Đã áp mã: VR20OFF (-50,000₫)"

**Lưu ý tối ưu cho BE (nếu muốn):** Sửa `getBookingByCodeImpl` trong `payments.ts` return luôn `vr_items: []` join `booking_vr_items` khi `booking_type='vr'` → frontend không cần gọi thêm 1 API.

### TASK 2.2 — TransactionsContent filter Loại đơn + Badge cột

**File liên quan:**
- `client/pages/admin/Transactions.tsx`
- `client/components/admin/content/TransactionsContent.tsx`
- `server/routes/admin/payments.ts` (`listTransactionsImpl` / getDashboard)

Cần làm:
1. **Backend listTransactionsImpl**: Add query param `?booking_type=all|movie|vr` (mặc định 'all'), filter theo `bookings.booking_type`
2. **Frontend Toolbar**: Thêm filter pills tương tự Tickets: `Tất cả / 🎬 Vé Phim / 🎮 Trải nghiệm VR` (set state `bookingTypeFilter`)
3. **Table Thêm cột "Loại"**: Badge màu xanh (Vé Phim) / tím (VR), tương tự cột Phân loại trong TicketsContent
4. **Detail Modal booking VR**: Khi click view detail 1 VR booking → show list `vr_items` bảng (thay vì list phim combo). Cần gọi `getVRBookingById(id)` hoặc backend join trả vr_items luôn vào `getTransactionByIdImpl`.

---

## 🔧 PHASE 3 — TỐI ƯU & NHỎ (P2)

### TASK 3.1 — Thêm Link/Nút "Đặt VR" ra Trang chủ + Nav Menu

**File liên quan:**
- `next-client/src/components/user/Header.tsx` — Thêm NavItem bên cạnh "Đặt vé"
  ```tsx
  // NavItem mới:
  { label: '🎮 Trải nghiệm VR', href: '/vr-booking', section: 'vr-booking' }
  ```
  (Kiểm tra useActiveSection hook đã hỗ trợ section 'vr-booking' chưa)
- `next-client/src/components/user/home/ProductSection.tsx` Hoặc HeroSection:
  Thêm 1 Banner block "🎮 TRẢI NGHIỆM VR MỚI" CTA button "Đặt ngay" → href="/vr-booking" (hoặc thêm vào TechnologyBanner nếu đã có sẵn)

### TASK 3.2 — Seed/Verify RBAC Permissions cho Module Vouchers

**File liên quan:** `server/lib/rbac-seed.ts` (nếu có), hoặc migration SQL, hoặc insert thủ công dashboard

Verify đã có 7 permissions voucher trong bảng `permissions`:
```sql
INSERT INTO permissions (module, action, name, description, created_at) VALUES
('vouchers', 'view',            'Xem danh sách voucher',       NULL, datetime('now')),
('vouchers', 'create',          'Tạo voucher mới',             NULL, datetime('now')),
('vouchers', 'edit',            'Sửa voucher',                 NULL, datetime('now')),
('vouchers', 'delete',          'Xóa voucher (soft)',          NULL, datetime('now')),
('vouchers', 'restore',         'Phục hồi voucher đã xóa',     NULL, datetime('now')),
('vouchers', 'toggle_status',   'Bật/Tắt voucher nhanh',       NULL, datetime('now')),
('vouchers', 'view_deleted',    'Xem thùng rác voucher',       NULL, datetime('now'));
```

Assign cho các role:
- **SuperAdmin**: all 7
- **Owner / Manager**: view, create, edit, delete, toggle_status (tùy cấp độ)
- **Staff thường**: chỉ view danh sách thôi (nếu cần)

### TASK 3.3 — [Bug nhỏ nếu có] Check openCreate trên Tickets.tsx

File `Tickets.tsx` line 158-162: `openCreate()` chỉ set `type`=movie/empty. **Nên thêm Tab selector "Vé Phim / Gói VR" ở trạng thái create mới** (hoặc mặc định khi create mới = movie tab, như hiện tại là chấp nhận được vì staff có thể switch tab trong form).

### TASK 3.4 — [Nghiêm ngặt] Verify migration 0012 & 0013 đã chạy trên production DB

Nếu chưa chạy → thực hiện theo Step 6.1 của plan gốc (Phase 6 Deployment):
```bash
# Cloudflare D1
wrangler d1 migrations apply cinema_db --remote  # hoặc tên DB thực tế
# Verify tables
wrangler d1 execute cinema_db --remote --command ".tables"
wrangler d1 execute cinema_db --remote --command "PRAGMA table_info(ticket_packages);"
wrangler d1 execute cinema_db --remote --command "PRAGMA table_info(bookings);"
wrangler d1 execute cinema_db --remote --command "PRAGMA table_info(vouchers);"
wrangler d1 execute cinema_db --remote --command "PRAGMA table_info(booking_vr_items);"
```

### TASK 3.5 — Env vars NEXT_PUBLIC_* ở next-client production

Verify các biến MoMo/VNPay env production tồn tại (tương tự booking phim, nên đã OK vì share code):
- NEXT_PUBLIC_MOMO_PARTNER_CODE
- NEXT_PUBLIC_MOMO_ACCESS_KEY
- NEXT_PUBLIC_MOMO_SECRET_KEY
- NEXT_PUBLIC_MOMO_REDIRECT_URL=/checkout (OK default)
- NEXT_PUBLIC_VNPAY_RETURN_URL=/checkout (OK default)
- NEXT_PUBLIC_CLIENT_BASE_URL

---

## ✅ CHECKLIST QUICK TRACKER (COPY TICK ĐỂ THEO DÕI)

### PHASE 1 — ADMIN VOUCHERS UI (P0)
- [ ] 1.1 Thêm 8 voucher API functions vào `client/lib/api/admin.ts`
- [ ] 1.2 Tạo `VouchersContent.tsx` (toolbar + table + CRUD modal + 16 fields form)
- [ ] 1.3 Tạo `Vouchers.tsx` page wrapper
- [ ] 1.3.b [Tùy chọn] Tạo `DeletedVouchers.tsx` page thùng rác
- [ ] 1.4 Add 2 route vouchers vào `client/App.tsx`
- [ ] 1.5 Add menu item Vouchers vào `AdminLayout.tsx` sidebar

### PHASE 2 — TICKETCHECK + TRANSACTIONS (P1)
- [ ] 2.1 TicketCheckContent: detect booking_type='vr', ẩn phim, show bảng vr_items, banner tím
- [ ] 2.1.b [BE tùy chọn] getBookingByCodeImpl trả luôn vr_items cho VR booking (không gọi API lần 2)
- [ ] 2.2 Transactions: BE add ?booking_type filter + FE add pills filter + cột badge Loại
- [ ] 2.2.b Transactions detail VR show list vr_items

### PHASE 3 — TỐI ƯU NHỎ (P2)
- [ ] 3.1 Header NavItem + Homepage Banner "Đặt VR" → link /vr-booking
- [ ] 3.2 Verify / Seed 7 voucher permissions + assign cho Owner/Manager role
- [ ] 3.3 [Nghiêm ngặt] Run migration 0012 + 0013 trên production DB (nếu chưa)
- [ ] 3.4 Test voucher: Tạo 1 voucher VR20OFF trên admin → user page apply → đặt vé → confirm paid → used_count tăng 1

---

## 🚀 SAU KHI HOÀN THÀNH TẤT CẢ — TEST E2E KỊCH BẢN

```
🎯 Kịch bản 1: Đặt VR không voucher
Admin tạo gói VR → user vào /vr-booking chọn 2 gói → nhập info → VietQR pay → callback /checkout → success → nhận mail VR

🎯 Kịch bản 2: Đặt VR có voucher (test quan trọng nhất)
Admin tạo voucher VR20 (percent 20%, max 50k, min_order 100k, per_user_limit 1)
→ User apply mã → thấy discount = 50k cap
→ Thanh toán MoMo success
→ Kiểm tra DB: bookings.booking_type='vr', voucher_id đúng, voucher_code_snapshot đúng, voucher_discount_amount=50000
→ booking_vr_items có 2 dòng, voucher_id trên mỗi dòng, discounted_unit_price đúng
→ vouchers.used_count = +1
→ voucher_redemption_logs có 1 dòng
→ User nhận mail xác nhận VR

🎯 Kịch bản 3: TicketCheck VR
Scan mã VR booking → banner "TRẢI NGHIỆM VR" hiện bảng vr_items → check-in success → is_used=true

🎯 Kịch bản 4: KHÔNG LÃM HỎI BOOKING PHIM CŨ (regression test)
Vào /booking chọn phim + vé → gói VR KHÔNG xuất hiện ở dropdown loại vé → Đặt phim OK → Mail template phim OK
```

---

> End of Fix Plan. Làm theo thứ tự: **Phase 1 (Vouchers UI) → Phase 2 (TicketCheck+Transactions) → Phase 3 (Tối ưu)**. SuperAdmin có thể test liền sau khi xong Phase 1 (vì role này auto-pass tất cả permissions).
