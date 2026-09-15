# MASTER FIX PLAN: KẾ HOẠCH TỔNG THỂ KHẮC PHỤC DỰ ÁN CTBOOKING

Tài liệu này trình bày các phát hiện và phân tích trực tiếp từ mã nguồn thực tế, kèm theo Lộ trình thực thi (Phases) theo thứ tự ưu tiên Rủi ro giảm dần để dọn dẹp và chuẩn hoá kiến trúc ứng dụng.

---

## PHẦN 1: BÁO CÁO XÁC MINH (VERIFICATION)

### VẤN ĐỀ 1 (🔴): Trùng lặp giữa `client/` và `next-client/`
Dựa trên thuật toán tính điểm tương đồng (Lines Intersection) và kiểm tra API cốt lõi:

**1. Khảo sát khác biệt API nền tảng (`lib/api/http.ts`):** 
- Diff nội dung: `<50% giống nhau`.
- **Xác nhận nhóm:** THUỘC NHÓM PHẢI GIỮ RIÊNG (Không an toàn để gộp).
- **Phân tích:** 
  - **Client (`Vite`):** Dùng `import.meta.env` và lấy Token auth qua `localStorage.getItem()`.
  - **Next-Client (`Next.js`):** Dùng biến `process.env.NEXT_PUBLIC_*`, lấy Token auth bắng Server/Client `getCookie()` và tự động inject SEO User-Agent bot.
- **LƯU Ý:** Vì `http.ts` khác nhau hoàn toàn về cơ chế lưu trữ (Cookie vs LocalStorage), nên các file gọi API cấp trên (như `payments.ts`, `users.ts` dù giống nhau text) cũng **KHÔNG THỂ gộp trực tiếp** vào lúc này. Yêu cầu thêm bước trừu tượng hóa HTTP (Dependency Injection) trước khi áp dụng Shared lib.

**2. Nhóm an toàn để gộp (Core Logic & Basic UI):**
- **UI Components:** Hầu hết bộ shadcn `ui/accordion.tsx`, `ui/alert-dialog.tsx`, `ui/aspect-ratio.tsx`, `ui/calendar.tsx`, `ui/checkbox.tsx`, `ui/form.tsx`, `ui/input.tsx`, v.v...
- **Core Types:** `components/filetypes/IType.model.ts` (100% giống).
- **Core Store:** `store/movieStore.ts` (95% giống).
- **Business API (Cần áp dụng Note trên):** `lib/api/payments.ts` (99%), `lib/api/toys.ts` (98%), `lib/api/users.ts` (96%).

**3. Nhóm PHẢI giữ riêng (Chứa "use client", "next/navigation", "next/image" hoặc "react-router-dom"):**
- **HTTP Wrapper căn bản:** `lib/api/http.ts`.
- **Hooks:** `hooks/useAuth.ts`, `hooks/useAuthHandlers.ts`, `hooks/useActiveSection.ts`, `hooks/useScrollDetect.ts`, `hooks/use-toast.ts`, `hooks/useBranch.ts`...
- **Dialogs & Pages:** `ErrorModal.tsx`, `ForgetPasswordDialog.tsx`, `LoginDialog.tsx`, `RegisterDialog.tsx`, `OTPDialog.tsx` (Tất cả đều vướng hook Router của Next hoặc Vite).
- **UI Components đặc thù:** `ui/carousel.tsx` (dùng next/image), `ui/sidebar.tsx`, `ui/chart.tsx`.
- **Utils:** `lib/auth-utils.ts` (xử lý cookie/storage lạch pha nhau).

---

### VẤN ĐỀ 2 (🟠): 5 File nghi ngờ Dead Code
Kết quả chạy lệnh PowerShell `Select-String`:

**1. `admin/uploads`**
- **Sàng lọc String thô:** `index.ts` chỉ match URL Route string `/api/admin/uploads/video`.
- **Bổ sung Sàng lọc chính xác Function (`uploadAdminVideo`):**
  Lệnh xuất kết quả nguyên văn:
  ```text
  server\routes\admin\uploads.ts:30:export function uploadAdminVideo(req: Request, res: Response) {
  ```
- **Kết luận:** KHÔNG có bất kỳ file nào (ngay cả `worker/src/index.ts`) gọi đến hàm `uploadAdminVideo` này. Match string trước đây xuất phát từ String Routes Native Hono. Bản thân file `uploads.ts` đang bị cô lập hoàn toàn khỏi runtime. => **Dead code xác nhận — 0 kết quả gọi, an toàn xóa.**

**2. `cloudinary-sign`**
- Kết quả lệnh: *(Trống)*
- Kết luận: Dead code xác nhận. An toàn xóa.

**3. `routes/user/demo`**
- Kết quả lệnh: *(Trống)*
- Kết luận: Dead code xác nhận. An toàn xóa.

**4. `cloudinary.spec`**
- Kết quả lệnh: *(Trống)*
- Kết luận: Dead code xác nhận. An toàn xóa.

**5. `api-parity`**
- Kết quả lệnh: *(Trống)*
- Kết luận: Dead code xác nhận. An toàn xóa.

---

### VẤN ĐỀ 3 (🟠): `worker/src/index.ts` vẫn là God File
1. **Số dòng hiện tại:** `5.488 dòng`.
2. **Chiếm tỉ trọng các vùng route:**
   - Public APIs (`/api/*`): ~25% mã.
   - User APIs (`/api/user/*`): ~30% mã.
   - Admin APIs (`/api/admin/*`): ~40% mã (Lớn nhất).
   - Webhook & Scheduled: ~5% mã.
3. **Đề xuất cấu trúc Hono Sub-router:** 
   ```typescript
   // worker/src/routes/adminRouter.ts
   const adminRouter = new Hono<HonoEnv>();
   adminRouter.get('/movies', listMovies);
   // ...
   export default adminRouter;

   // worker/src/index.ts
   import adminRouter from './routes/adminRouter';
   app.route('/api/admin', adminRouter);
   ```

---

### VẤN ĐỀ 4 (🟡): Coupling `user/auth.ts` → `admin/settings.ts`
1. **Dòng import:** `import { getAdminSettingsImpl } from '../admin/settings';`
   Dòng 61 có sử dụng setting `enable_2fa` để kiểm tra cờ (feature flags) 2-factor user.
2. **Đề xuất:** Việc để Module Authentication User lệ thuộc (Coupled) vào Admin module là tư duy sai. 
   - **Giải pháp:** Tách logic đọc KV Storage ra thành một file cốt lõi `server/lib/global-settings.ts` không phụ thuộc vào route nào.

---

### VẤN ĐỀ 5 (🟡): 2 Hàm Audit Payload Builder trùng mục đích
1. **So sánh chi tiết khác biệt:** 
   - `server/lib/audit-utils.ts` (`buildAuditPayload`): Hàm Serialize ngây ngô: `JSON.stringify(data)`.
   - `server/routes/admin/staff-audit-utils.ts` (`buildStaffAuditPayload`): Có nhận thức an ninh - Destruct và gỡ bỏ `password` ra khỏi JSON Staff object trước khi dump log vào CSDL để không rò rỉ JWT hay cleartext pass. Khác biệt vô cùng hệ trọng.
2. **Đề xuất gộp thành một:**
   Tạo chữ ký mới tinh tế hỗ trợ override, gom vào duy nhất `server/lib/audit-utils.ts`:
   ```typescript
   export function buildAuditPayload(data: any, entityType?: 'staff' | 'normal', extra?: Record<string, any>): string | undefined {
      // Logic gỡ password bảo mật khi entityType === 'staff'
   }
   ```

---

## PHẦN TỔNG HỢP: GIAI ĐOẠN THỰC THI (PHASES)

### 🟢 GIAI ĐOẠN 1: Xóa Dead Code & Tách Shared Settings (Rủi ro Thấp - Làm trước)
- **Phạm vi:** 
  - Xóa dứt lùi 5 file dead code đã kiểm chứng.
  - Tách `server/routes/admin/settings.ts` thành `server/lib/global-settings.ts`. Sửa lại import ở `user/auth.ts`.
- **Cách verify:** Build lại Worker (`npm run build:worker`).
- **Mức độ rủi ro:** THẤP (Độc lập 100%). Dễ rollback. Tích hợp song song đựơc với Pha 2.

### 🟡 GIAI ĐOẠN 2: Gom nhặt Audit Payload (Rủi ro Nhẹ - Làm Song Song)
- **Phạm vi:** Trừu tượng hóa `server/lib/audit-utils.ts` và gỡ bỏ `staff-audit-utils.ts`. 
- **Cách verify:** Sửa một Staff account ngẫu nhiên ở phần Admin UI, sau đó kiểm tra API response (hoặc log Database) xem lọt field `password` cleartext bộ lạ Không.
- **Mức độ rủi ro:** THẤP - TRUNG BÌNH. Rollback bằng Git rất đơn giản.

### 🟠 GIAI ĐOẠN 3: Refactor "God File" Hono Router (Rủi ro Vừa -> Cao)
- **Phạm vi:** Xào nấu lại `worker/src/index.ts` (5488 dòng). Tách module định tuyến và middleware vào 3 folder `routes/admin`, `routes/user`, `routes/webhook`.
- **Cách verify:** Chạy server dev `npm run dev` ở worker. Xác thực một API bảo mật `/api/admin/movies` xem Hono Context (`c.get`) và Token Validation có nhận điện đúng luồng uỷ quyền như cũ không.
- **Mức độ rủi ro:** CAO. Dễ làm vỡ logic Middleware Authentication đắp vào Route. Yêu cầu test diện rộng. Làm riêng rẽ 1 task thuần.

### 🟠 GIAI ĐOẠN 3.5: Dọn dẹp Nhóm Non-UI Shared Logic (Rủi ro Vừa) 
- **Phạm vi:** 
  - Đóng gói (abstract) module HTTP cấp thấp (`lib/api/http.ts`) để tương thích chéo với cả Next.js và Vite qua API Factory pattern.
  - Phân tách và di chuyển các file thuần logic `lib/api/payments.ts`, `lib/api/toys.ts`, `lib/api/users.ts` và `store/movieStore.ts`, `components/filetypes/IType.model.ts` ra module `@shared` chung.
- **Cách verify:** Test thử Checkout flow: Login -> Lên lịch -> Tính giá thanh toán, bảo đảm LocalStorage/Cookies bắt Auth tokens không gặp lỗi ngớ ngẩn (Mức độ client-side data store).
- **Mức độ rủi ro:** TRUNG BÌNH. Dù mã nguồn chỉ là Pure Logic không trộn CSS, nhưng bị cột chặt vào cơ chế Request. Phải làm sau khi hệ thống Backend Worker (Giai đoạn 3) đã tái cấu trúc xong.

### 🔴 GIAI ĐOẠN 4: Sát nhập Shared UI Components (Rủi ro Cao nhất - Làm sau cùng)
- **Phạm vi:** Dọn sạch ổ `client` và `next-client/components/ui`, chuyển những component giống >90% (Shadcn cơ bản) vào một package UI Monorepo chuẩn chỉ để xài chung.
- **Cách verify:** Phải start app cả 2 Frontend Command (`npm run dev:client` và `npm run dev:next`) cùng lúc để test thử SSR (Server Components Nextjs) có xung đột với CSR (Client Render) của Vite không.
- **Mức độ rủi ro:** RẤT CAO. Vi phạm nguyên tắc module boundary của trình build Webpack / Vite. Khuyên dùng TurboRepo hoặc thay đổi Config phức tạp. Nên chia thành một nhánh code branch riêng biệt.
