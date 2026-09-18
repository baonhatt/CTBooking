# CHI TIẾT CẤU TRÚC DỰ ÁN CTBOOKING

## PHẦN A: Làm rõ các thư mục còn mơ hồ

**1. Thư mục `app/`**
- Đây **không phải** là Admin SPA. 
- Thư mục `app/` ở root hiện tại chỉ chứa thư mục con `uploads/` (nơi lưu trữ mock/media file hoặc do multer/local fs sinh ra). Nó không chứa logic SPA. Trái lại, dự án có một thư mục `next-client/src/app` — đây mới thực sự là Next.js App Router (Giao diện người dùng).

**2. Thư mục `client/`**
- Đây **chính là** Admin SPA (React + Vite).
- Không phải dead code. SPA này được trỏ trực tiếp từ `index.html` ở thư mục root (`<script type="module" src="/client/App.tsx"></script>`) và được config alias `@` trong `vite.config.ts`.
- Lệnh build: `npm run build:client` (chạy `vite build`), output ra `dist/spa`, và được deploy thẳng lên Cloudflare Pages qua lệnh `npm run pages:deploy:prod`.

**3. Sự trùng lặp giữa `app/` và `client/`**
- Hoàn toàn **không trùng lặp**. `client/` là thư mục source code React cho Admin, trong khi `app/` ở root là một thư mục rỗng chỉ chứa `uploads/`. (Lưu ý đừng nhầm `app/` ở root với `next-client/src/app` là UI Client Frontend).

**4. Thư mục `shared/`**
- Hiện tại chứa **3 file**:
  - `schema.ts`: (File vừa được di chuyển) Drizzle schema định nghĩa toàn bộ database.
  - `api.ts`: Các interface/type definitions chung.
  - `booking-invoice.ts`: Các hàm generate PDF hoặc invoice utils dùng chung được cho biên dịch tĩnh (hoặc Node env).

---

## PHẦN B: Cây thư mục đầy đủ (đã loại bỏ node_modules, dist, build, .next...)

```text
CTBooking/
├── app/
├── client/
│   ├── admin/
│   │   ├── auth/
│   │   │   └── AdminGate.tsx
│   │   └── layouts/
│   │       └── AdminLayout.tsx
│   ├── components/
│   │   ├── admin/
│   │   │   ├── content/
│   │   │   │   ├── DashboardContent.tsx
│   │   │   │   ├── EmailLogsContent.tsx
│   │   │   │   ├── MoviesContent.tsx
│   │   │   │   ├── PostManagement.tsx
│   │   │   │   ├── PostRichTextEditor.tsx
│   │   │   │   ├── ShowtimesContent.tsx
│   │   │   │   ├── TicketCheckContent.tsx
│   │   │   │   ├── TicketsContent.tsx
│   │   │   │   ├── ToysContent.tsx
│   │   │   │   ├── TransactionsContent.tsx
│   │   │   │   ├── UploadsContent.tsx
│   │   │   │   ├── UsersContent.tsx
│   │   │   │   └── VouchersContent.tsx
│   │   │   ├── dialogs/
│   │   │   │   ├── ConfirmDeleteDialog.tsx
│   │   │   │   ├── MovieEditModal.tsx
│   │   │   │   ├── ToyEditModal.tsx
│   │   │   │   └── UserEditModal.tsx
│   │   │   ├── AdminEditModal.tsx
│   │   │   ├── BranchIdsBadge.tsx
│   │   │   ├── BranchMultiSelect.tsx
│   │   │   └── SessionTimeoutModal.tsx
│   │   ├── filetypes/
│   │   │   └── IType.model.ts
│   │   ├── ui/
│   │   │   ├── accordion.tsx
│   │   │   ├── alert-dialog.tsx
│   │   │   ├── alert.tsx
│   │   │   ├── aspect-ratio.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── breadcrumb.tsx
│   │   │   ├── button.tsx
│   │   │   ├── calendar.tsx
│   │   │   ├── chart.tsx
│   │   │   ├── checkbox.tsx
│   │   │   ├── collapsible.tsx
│   │   │   ├── command.tsx
│   │   │   ├── context-menu.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── drawer.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── form.tsx
│   │   │   ├── hover-card.tsx
│   │   │   ├── input-otp.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── menubar.tsx
│   │   │   ├── navigation-menu.tsx
│   │   │   ├── pagination.tsx
│   │   │   ├── popover.tsx
│   │   │   ├── progress.tsx
│   │   │   ├── radio-group.tsx
│   │   │   ├── resizable.tsx
│   │   │   ├── scroll-area.tsx
│   │   │   ├── select.tsx
│   │   │   ├── separator.tsx
│   │   │   ├── sheet.tsx
│   │   │   ├── sidebar.tsx
│   │   │   ├── skeleton.tsx
│   │   │   ├── slider.tsx
│   │   │   ├── sonner.tsx
│   │   │   ├── switch.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── toaster.tsx
│   │   │   ├── toggle-group.tsx
│   │   │   ├── toggle.tsx
│   │   │   ├── tooltip.tsx
│   │   │   └── use-toast.ts
│   │   ├── constants.ts
│   │   ├── ErrorModal.tsx
│   │   ├── ForgetPasswordDialog.tsx
│   │   ├── LoadingScreen.tsx
│   │   ├── LoginDialog.tsx
│   │   ├── MobileMenu.tsx
│   │   ├── NavItem.tsx
│   │   ├── OTPDialog.tsx
│   │   ├── ProtectedRoute.tsx
│   │   ├── RegisterDialog.tsx
│   │   └── UserMenu.tsx
│   ├── hooks/
│   │   ├── use-mobile.tsx
│   │   ├── use-toast.ts
│   │   ├── useActiveSection.ts
│   │   ├── useAuth.ts
│   │   ├── useAuthHandlers.ts
│   │   ├── useAuthState.ts
│   │   ├── useBranch.ts
│   │   ├── useConfirmUnsaved.tsx
│   │   ├── useMovies.ts
│   │   ├── useScrollDetect.ts
│   │   └── useStaffPermission.ts
│   ├── lib/
│   │   ├── api/
│   │   │   ├── admin.ts
│   │   │   ├── auth.ts
│   │   │   ├── booking.ts
│   │   │   ├── branches.ts
│   │   │   ├── http.ts
│   │   │   ├── movies.ts
│   │   │   ├── payments.ts
│   │   │   ├── posts.ts
│   │   │   ├── showtimes.ts
│   │   │   ├── tickets.ts
│   │   │   ├── toys.ts
│   │   │   ├── uploads.ts
│   │   │   └── users.ts
│   │   ├── api.ts
│   │   ├── auth-utils.ts
│   │   ├── branch-ids.ts
│   │   ├── exportUtils.ts
│   │   ├── utils.spec.ts
│   │   └── utils.ts
│   ├── pages/
│   │   ├── admin/
│   │   │   ├── AdminIndex.tsx
│   │   │   ├── AuditLogs.tsx
│   │   │   ├── Branches.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── DeletedBranches.tsx
│   │   │   ├── DeletedMovies.tsx
│   │   │   ├── DeletedRoles.tsx
│   │   │   ├── DeletedStaff.tsx
│   │   │   ├── DeletedTickets.tsx
│   │   │   ├── DeletedVouchers.tsx
│   │   │   ├── EmailLogs.tsx
│   │   │   ├── Movies.tsx
│   │   │   ├── PostCreate.tsx
│   │   │   ├── PostEdit.tsx
│   │   │   ├── Posts.tsx
│   │   │   ├── Profile.tsx
│   │   │   ├── roleConstants.ts
│   │   │   ├── RoleDetailPage.tsx
│   │   │   ├── Roles.tsx
│   │   │   ├── Settings.tsx
│   │   │   ├── SetupSuperAdmin.tsx
│   │   │   ├── Showtimes.tsx
│   │   │   ├── Staff.tsx
│   │   │   ├── TicketCheck.tsx
│   │   │   ├── Tickets.tsx
│   │   │   ├── Toys.tsx
│   │   │   ├── Transactions.tsx
│   │   │   ├── Uploads.tsx
│   │   │   ├── Users.tsx
│   │   │   └── Vouchers.tsx
│   │   ├── Maintenance.tsx
│   │   └── NotFound.tsx
│   ├── store/
│   │   ├── movieStore.ts
│   │   └── staffStore.ts
│   ├── App.tsx
│   └── vite-env.d.ts
├── next-client/
│   ├── src/
│   │   ├── app/
│   │   │   ├── account/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── loading.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── bai-viet/
│   │   │   │   ├── [slug]/
│   │   │   │   │   ├── loading.tsx
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── PostSidebar.tsx
│   │   │   │   │   └── PostViewIncrementor.tsx
│   │   │   │   ├── loading.tsx
│   │   │   │   ├── page.tsx
│   │   │   │   └── PostsSearchClient.tsx
│   │   │   ├── booking/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── loading.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── checkout/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── loading.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── maintenance/
│   │   │   │   ├── layout.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── qr-payment/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── loading.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── reset-password/
│   │   │   │   ├── layout.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── success-payment/
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── loading.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── vr/
│   │   │   │   └── page.tsx
│   │   │   ├── vr-booking/
│   │   │   │   └── page.tsx
│   │   │   ├── layout.tsx
│   │   │   ├── loading.tsx
│   │   │   ├── not-found.tsx
│   │   │   ├── page.tsx
│   │   │   ├── providers.tsx
│   │   │   └── sitemap.ts
│   │   ├── components/
│   │   │   ├── filetypes/
│   │   │   │   └── IType.model.ts
│   │   │   ├── ui/
│   │   │   │   ├── accordion.tsx
│   │   │   │   ├── alert-dialog.tsx
│   │   │   │   ├── alert.tsx
│   │   │   │   ├── aspect-ratio.tsx
│   │   │   │   ├── avatar.tsx
│   │   │   │   ├── badge.tsx
│   │   │   │   ├── breadcrumb.tsx
│   │   │   │   ├── button.tsx
│   │   │   │   ├── calendar.tsx
│   │   │   │   ├── card.tsx
│   │   │   │   ├── carousel.tsx
│   │   │   │   ├── chart.tsx
│   │   │   │   ├── checkbox.tsx
│   │   │   │   ├── collapsible.tsx
│   │   │   │   ├── command.tsx
│   │   │   │   ├── context-menu.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   ├── drawer.tsx
│   │   │   │   ├── dropdown-menu.tsx
│   │   │   │   ├── form.tsx
│   │   │   │   ├── hover-card.tsx
│   │   │   │   ├── input-otp.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── label.tsx
│   │   │   │   ├── menubar.tsx
│   │   │   │   ├── navigation-menu.tsx
│   │   │   │   ├── pagination.tsx
│   │   │   │   ├── popover.tsx
│   │   │   │   ├── progress.tsx
│   │   │   │   ├── radio-group.tsx
│   │   │   │   ├── resizable.tsx
│   │   │   │   ├── scroll-area.tsx
│   │   │   │   ├── select.tsx
│   │   │   │   ├── separator.tsx
│   │   │   │   ├── sheet.tsx
│   │   │   │   ├── sidebar.tsx
│   │   │   │   ├── skeleton.tsx
│   │   │   │   ├── slider.tsx
│   │   │   │   ├── sonner.tsx
│   │   │   │   ├── switch.tsx
│   │   │   │   ├── table.tsx
│   │   │   │   ├── tabs.tsx
│   │   │   │   ├── textarea.tsx
│   │   │   │   ├── toast.tsx
│   │   │   │   ├── toaster.tsx
│   │   │   │   ├── toggle-group.tsx
│   │   │   │   ├── toggle.tsx
│   │   │   │   ├── tooltip.tsx
│   │   │   │   └── use-toast.ts
│   │   │   ├── user/
│   │   │   │   ├── home/
│   │   │   │   │   ├── ClearStorageOnMount.tsx
│   │   │   │   │   ├── FilmCarousel.tsx
│   │   │   │   │   ├── HeroSection.tsx
│   │   │   │   │   ├── MovieScheduleSection.tsx
│   │   │   │   │   ├── ProductSection.tsx
│   │   │   │   │   ├── PromotionShowcase.tsx
│   │   │   │   │   ├── TechnologyBanner.tsx
│   │   │   │   │   └── VRShowcase.tsx
│   │   │   │   ├── CartDrawer.tsx
│   │   │   │   ├── CinesphereShowcase.tsx
│   │   │   │   ├── FloatingActions.tsx
│   │   │   │   ├── Footer.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   └── UploadSection.tsx
│   │   │   ├── constants.ts
│   │   │   ├── ErrorModal.tsx
│   │   │   ├── ForgetPasswordDialog.tsx
│   │   │   ├── LoginDialog.tsx
│   │   │   ├── MobileMenu.tsx
│   │   │   ├── MovieSchedulePanel.tsx
│   │   │   ├── NavItem.tsx
│   │   │   ├── OTPDialog.tsx
│   │   │   ├── PageLoading.tsx
│   │   │   ├── ProtectedRoute.tsx
│   │   │   ├── RegisterDialog.tsx
│   │   │   └── UserMenu.tsx
│   │   ├── config/
│   │   │   └── site.ts
│   │   ├── hooks/
│   │   │   ├── use-mobile.tsx
│   │   │   ├── use-toast.ts
│   │   │   ├── useActiveSection.ts
│   │   │   ├── useAuth.ts
│   │   │   ├── useAuthHandlers.ts
│   │   │   ├── useAuthState.ts
│   │   │   ├── useBranch.ts
│   │   │   ├── useMovies.ts
│   │   │   └── useScrollDetect.ts
│   │   ├── layouts/
│   │   │   └── UserLayout.tsx
│   │   ├── lib/
│   │   │   ├── api/
│   │   │   │   ├── admin.ts
│   │   │   │   ├── auth.ts
│   │   │   │   ├── booking.ts
│   │   │   │   ├── branches.ts
│   │   │   │   ├── http.ts
│   │   │   │   ├── movies.ts
│   │   │   │   ├── payments.ts
│   │   │   │   ├── posts.ts
│   │   │   │   ├── products.ts
│   │   │   │   ├── schedule.ts
│   │   │   │   ├── tickets.ts
│   │   │   │   ├── toys.ts
│   │   │   │   ├── uploads.ts
│   │   │   │   ├── users.ts
│   │   │   │   └── vr-packages.ts
│   │   │   ├── api.ts
│   │   │   ├── auth-utils.ts
│   │   │   ├── cookies.ts
│   │   │   └── utils.ts
│   │   └── store/
│   │       ├── cartStore.ts
│   │       └── movieStore.ts
│   ├── package.json
│   ├── tailwind.config.ts
│   └── wrangler.toml
├── server/
│   ├── lib/
│   │   ├── audit-logger.ts
│   │   ├── audit-utils.ts
│   │   ├── booking-utils.ts
│   │   ├── branch-guard.ts
│   │   ├── branch-ids.ts
│   │   ├── date-utils.ts
│   │   ├── email-templates.ts
│   │   ├── mail-queue.ts
│   │   ├── media-utils.ts
│   │   ├── otp-utils.ts
│   │   ├── rbac-seed.ts
│   │   ├── showtime-utils.ts
│   │   └── staff-auth.ts
│   ├── routes/
│   │   ├── admin/
│   │   │   ├── branches.ts
│   │   │   ├── cloudinary-sign.ts
│   │   │   ├── dashboard.ts
│   │   │   ├── email-logs.ts
│   │   │   ├── movies.ts
│   │   │   ├── payments.ts
│   │   │   ├── posts.ts
│   │   │   ├── roles.ts
│   │   │   ├── sepay.ts
│   │   │   ├── settings.ts
│   │   │   ├── setup.ts
│   │   │   ├── showtimes.ts
│   │   │   ├── site-media.ts
│   │   │   ├── staff-audit-utils.ts
│   │   │   ├── staff-auth.ts
│   │   │   ├── staff-management.ts
│   │   │   ├── tickets.ts
│   │   │   ├── toys.ts
│   │   │   ├── uploads.ts
│   │   │   ├── users.ts
│   │   │   └── vouchers.ts
│   │   ├── scheduled/
│   │   │   └── booking-expiry.ts
│   │   ├── user/
│   │   │   ├── auth.ts
│   │   │   ├── demo.ts
│   │   │   ├── movies.ts
│   │   │   ├── password.ts
│   │   │   ├── payments.ts
│   │   │   ├── showtimes.ts
│   │   │   ├── tickets.ts
│   │   │   ├── toys.ts
│   │   │   ├── users.ts
│   │   │   ├── vouchers.ts
│   │   │   └── vr-bookings.ts
│   │   └── mail-service.ts
│   ├── cloudinary.spec.ts
│   └── cloudinary.ts
├── shared/
│   ├── api.ts
│   ├── booking-invoice.ts
│   └── schema.ts
├── tests/
│   └── api-parity.spec.ts
├── worker/
│   ├── src/
│   │   ├── index.ts
│   │   ├── middleware.ts
│   │   └── utils.ts
│   ├── drizzle.config.ts
│   ├── package.json
│   └── wrangler.toml
├── index.html
├── package.json
├── tailwind.config.ts
├── vite.config.ts
└── wrangler.toml
```

---

## PHẦN C: Chi tiết từng file theo từng thư mục lớn

### C1. Thư mục `worker/src/`
- **`worker/src/index.ts`**
  - **Vai trò:** Entry-point (file gốc) của toàn bộ hệ thống API Backend trên Cloudflare Workers. Chịu trách nhiệm khởi tạo Hono Router, mount định tuyến các sub-router (`/api/admin`, `/api`), xử lý dependency injection cho Database kết nối DB (D1).
  - **Export chính:** `export default app` (Hono application instance).
  - **Import từ đâu:** `server/routes/...` (toàn bộ logic route của admin, user), `middleware.ts`, `utils.ts`, `shared/schema.ts`.
  - **Được import bởi:** Không có (được Cloudflare Worker Runtime gọi trực tiếp).

- **`worker/src/middleware.ts`**
  - **Vai trò:** Chứa các middleware bảo mật và phân quyền dùng chung cho API. Xác thực HTTP Authorization / JWT, kiểm tra quyền hạn của vòng đời Staff/Admin, và xác thực Cloudflare Turnstile bảo vệ bot.
  - **Export chính:** `requireAuth`, `requireStaffAuth`, `requirePermission`.
  - **Import từ đâu:** `server/routes/user/auth.ts`, `server/lib/staff-auth.ts`, `shared/schema.ts`.
  - **Được import bởi:** `worker/src/index.ts`.

- **`worker/src/utils.ts`**
  - **Vai trò:** Tập hợp các hàm tiện ích nhỏ đặc thù cho Worker Runtime (xử lý Cloudflare Cache API, mã hóa mật khẩu SHA1/HMac), format tiền tệ, log lỗi và các logic về Cloudinary/Media chạy không cần Node.js.
  - **Export chính:** `withCache`, `deleteCache`, `hmacHex`, `logSystemError`, `formatCurrencyVi`, `sha1Hex`, và bộ Cloudinary functions.
  - **Import từ đâu:** `server/lib/media-utils.ts`.
  - **Được import bởi:** `worker/src/index.ts`. *(Ghi chú: Lỗi circular từ admin/tickets đã bị gỡ bỏ nên giờ nó sạch 100%)*.

### C5. Thư mục `server/routes/scheduled/`
- **`server/routes/scheduled/booking-expiry.ts`**
  - **Vai trò:** Chứa logic thực thi các Cron Job (Scheduled Tasks). Bao gồm việc quét các booking quá 15 phút chưa thanh toán thành công để hủy tự động, kết hợp với việc trả lại (refund) số lượng voucher bị giữ trước đó.
  - **Export chính:** `expireStaleBookingsImpl`, `releaseVoucherForCancelledBooking`.
  - **Import từ đâu:** `server/lib/date-utils.ts`, và các ORM functions.
  - **Được import bởi:** `worker/src/index.ts` (gọi bên trong callback `app.scheduled`).

### C6. Thư mục `shared/`
- **`shared/api.ts`**
  - **Vai trò:** Định nghĩa các Interface, Type Definitions chuẩn hoá gọi là Hợp đồng dữ liệu (Data Contracts). Đảm bảo tính nhất quán (type-safe) về cấu trúc payload JSON giữa API Backend gửi đi và Frontend (Vite/Next) nhận vào.
  - **Export chính:** Hàng loạt interface như `Movie`, `MoviesResponse`, `PaymentRequest`, `VRBookingRequest`, `VoucherSummary`, `Login`...
  - **Import từ đâu:** Thường không import logic ngoài, chỉ dùng thuần types hoặc schema validation nhỏ (nếu có).
  - **Được import bởi:** File này được dùng rộng rãi khắp toàn bộ thư mục `client/`, `next-client/`, và `server/`.

- **`shared/booking-invoice.ts`**
  - **Vai trò:** Module dùng để parse và tính toán logic về vé/giá trị cho các booking. Được shared vì hóa đơn cần hiển thị ở UI Frontend, cũng như cần Backend sử dụng để sinh nội dung Email PDF/Invoice mà vẫn đồng bộ công thức tính toán.
  - **Export chính:** `parseMoviePackages`, `moviePackagesTotalQty`, `moviePackageLineTotal`, `vrLineTotal`, `isLineDiscounted`, `buildPriceBreakdown`, `hasVrContent`, `bookingTypeBadge`...
  - **Import từ đâu:** Không depend (phụ thuộc) vào API file nào phức tạp.
  - **Được import bởi:** `server/routes/user/payments.ts`, `server/lib/email-templates.ts` và logic Store của Frontend.

- **`shared/schema.ts`**
  - **Vai trò:** Trái tim của Hệ Thống Data Access. Định nghĩa cấu trúc các bảng SQL và quan hệ liên kết (Relations) theo chuẩn thư viện Drizzle ORM để query vào SQLite/D1 DB.
  - **Export chính:** Các định nghĩa bảng `users`, `accounts`, `movies`, `bookings`, `tickets`, `email_logs`, `vouchers`... và block Relations báo hiệu liên kết bảng tương ứng.
  - **Import từ đâu:** Hoàn toàn chỉ import hàm từ thư viện (`drizzle-orm/sqlite-core`).
  - **Được import bởi:** Hầu như tất cả các Router nội bộ ở `server/routes/...`, `worker/src/index.ts` để injection, và `worker/drizzle.config.ts`. Mốc kết thúc xử lý Circular của chúng ta.

### C2. Thư mục `server/lib/`
- **`server/lib/audit-logger.ts`**
  - **Vai trò:** Hệ thống ghi log kiểm toán (Audit Trail) cho toàn bộ thao tác của Admin/Staff (thêm/sửa/xóa).
  - **Export chính:** `logAuditAction`, `getAuditLogsImpl`.
  - **Import từ đâu:** `shared/schema.ts`, `drizzle-orm`.
  - **Được import bởi:** Các route xử lý dữ liệu nhạy cảm như `staff-audit-utils.ts`, `server/routes/admin/...` (tickets, branches, movies).

- **`server/lib/audit-utils.ts`**
  - **Vai trò:** Hỗ trợ xử lý payload (biến đổi/mã hóa DTO trước khi lưu) cho mục đích phân tích Audit Logging.
  - **Export chính:** `buildAuditPayload`.
  - **Import từ đâu:** Chủ yếu logic code tĩnh utils, không import module nội bộ.
  - **Được import bởi:** Các Admin route (movies, tickets, v.v) cần format object cũ/mới để log.

- **`server/lib/booking-utils.ts`**
  - **Vai trò:** Logic helper nghiệp vụ sinh mã giao dịch (Booking Code) độc nhất cho hệ thống đặt vé. Đồng thời làm proxy re-export toàn bộ module `email-templates`.
  - **Export chính:** `generateBookingCode`, và các hàm re-export từ `./email-templates`.
  - **Import từ đâu:** `shared/schema.ts`, `./email-templates`.
  - **Được import bởi:** `server/routes/user/payments.ts`.

- **`server/lib/branch-guard.ts`**
  - **Vai trò:** Guard (bảo vệ) cấp độ thư viện. Inject tự động các SQL Filter theo `branch_id` để ngăn cản việc một Staff chi nhánh này có thể xem/sửa được dữ liệu của chi nhánh khác.
  - **Export chính:** `applyBranchFilter`, `hasBranchAccess`, `filterItemsByBranchIds`.
  - **Import từ đâu:** `./branch-ids`.
  - **Được import bởi:** Gần như mọi route quản lý bảng thực thể đa chi nhánh trong `server/routes/admin/`.

- **`server/lib/branch-ids.ts`**
  - **Vai trò:** Dữ liệu Parser để đọc ghi trường dữ liệu `branch_ids` (được lưu vào DB JSON string `[1, 2, 3]` hoặc `null` cho all chi nhánh).
  - **Export chính:** `parseBranchIds`, `staffCanAccessBranchIds`, `sqlBranchIdsMatchFilter`, `getBranchIdsDisplayStatus`... 
  - **Import từ đâu:** `drizzle-orm`.
  - **Được import bởi:** `./branch-guard.ts`, `server/routes/admin/branches.ts`, và một cơ số API route liên quan quản lý chi nhánh.

- **`server/lib/date-utils.ts`**
  - **Vai trò:** Chuẩn hóa Date/Time format. Chuyển đổi timezone an toàn cho SQLite.
  - **Export chính:** `formatDateForDb`.
  - **Import từ đâu:** Không import file khác.
  - **Được import bởi:** Rất nhiều modules (`admin/movies.ts`, `admin/tickets.ts`, `lib/otp-utils.ts`...).

- **`server/lib/email-templates.ts`**
  - **Vai trò:** File "Trung tâm thẩm mỹ Mail". Gói gọn mã HTML của toàn bộ hệ thống gửi thư báo để nhất quán thiết kế (cho Booking, OTP, Reset Pass, Đổi OTP Staff).
  - **Export chính:** `getBookingEmailTemplate`, `getResetPasswordEmailTemplate`, `getWelcomeEmailTemplate`, `getOTPEmailTemplate`...
  - **Import từ đâu:** Không phụ thuộc file nội bộ.
  - **Được import bởi:** `./booking-utils.ts`, `./otp-utils.ts`, `server/routes/mail-service.ts`.

- **`server/lib/mail-queue.ts`**
  - **Vai trò:** Queue Data Layer để lưu trữ thông tin hàng đợi gửi Mail vào DB. Cơ sở cho cron job hoặc async fetcher xả queue.
  - **Export chính:** `MailQueue` class, `mailQueue` instance.
  - **Import từ đâu:** `./date-utils.ts` và ORM/DB logic.
  - **Được import bởi:** `./otp-utils.ts` và logic Webhook.

- **`server/lib/media-utils.ts`**
  - **Vai trò:** Logic Parse URL hình ảnh. Xác định một media link là Cloudinary hay Local Server để xử lý việc xóa file cho phù hợp.
  - **Export chính:** `isLocal`, `parseMediaUrl`, `localUploader`, `localDeleter`.
  - **Import từ đâu:** Core file utils, không import.
  - **Được import bởi:** `worker/src/utils.ts`.

- **`server/lib/otp-utils.ts`**
  - **Vai trò:** Chịu trách nhiệm hoàn chỉnh End-to-End cho quy trình xác thực OTP, gồm: tạo chuỗi random 6 số, đưa thư vào hàng đợi (mail_queue), mã hóa và kiểm tra đối chiếu hạn sống OTP trên Database.
  - **Export chính:** `generateOTP`, `sendOTPEmail`, `createOTPRecord`, `validateOTP`, `sendStaffPasswordChangeOTP`...
  - **Import từ đâu:** `./mail-queue`, `./email-templates`, `./date-utils`.
  - **Được import bởi:** `server/routes/user/password.ts`, `server/routes/user/auth.ts`, `server/routes/admin/staff-management.ts`.

- **`server/lib/rbac-seed.ts`**
  - **Vai trò:** Metadata khởi tạo cơ sở cho hệ thống phần quyền. Chứa constant dữ liệu Mặc Định (Viewer, Manager, Developer) với các Permission chuẩn xác.
  - **Export chính:** `PERMISSIONS_SEED`, `ROLES_SEED`.
  - **Import từ đâu:** Không có import phụ thuộc.
  - **Được import bởi:** `server/routes/admin/setup.ts`.

- **`server/lib/showtime-utils.ts`**
  - **Vai trò:** Engine phép tính liên quan đến thời gian của suất chiếu. Hỗ trợ tính thời gian phim chiếu dựa trên thời lượng kéo dài.
  - **Export chính:** `normalizeTime`, `isValidTime`, `timeToMinutes`, `addMinutesToTime`.
  - **Import từ đâu:** Không có.
  - **Được import bởi:** `server/routes/admin/showtimes.ts`.

- **`server/lib/staff-auth.ts`**
  - **Vai trò:** Trái tim của cơ chế xác thực riêng biệt cho Staff Admin. Hỗ trợ băm mật khẩu `bcrypt` và check pass an toàn, xử lý session token JWT/Cookie và quét quyền từ phân bảng `staff_roles`.
  - **Export chính:** `hashPassword`, `verifyPassword`, `generateToken`, `getStaffSessionExpiry`, `loadStaffPermissions`...
  - **Import từ đâu:** `bcryptjs`, ORM tools, `shared/schema.ts`.
  - **Được import bởi:** `worker/src/middleware.ts`, `server/routes/admin/staff-auth.ts`, `server/routes/admin/staff-management.ts`.

### C3. Thư mục `server/routes/admin/` (20 files)
- **`server/routes/admin/branches.ts`**
  - **Vai trò:** API Quản lý danh mục Chi nhánh (Rạp phim). Thực hiện các thao tác CRUD và truy xuất dropdown options.
  - **Export chính:** `listBranchesImpl`, `getBranchImpl`, `createBranchImpl`, `updateBranchImpl`, `deleteBranchImpl`...
  - **Import từ đâu:** `lib/audit-logger`, `lib/date-utils`.
  - **Được import bởi:** `worker/src/index.ts`.

- **`server/routes/admin/cloudinary-sign.ts`**
  - **Vai trò:** Cung cấp API sinh Cloudinary Signature cho chế độ Direct Upload từ client.
  - **Export chính:** `generateCloudinarySignature`.
  - **Import từ đâu:** `server/cloudinary.ts`.
  - **Được import bởi:** Cấu hình ngoài hoặc route upload đặc biệt.

- **`server/routes/admin/dashboard.ts`**
  - **Vai trò:** Máy chủ thống kê (Analytics). Cấp số liệu tổng quan (người dùng mới, doanh thu) và các format biểu đồ chart (hàng ngày/tuần/tháng) cho Giao diện Dashboard admin.
  - **Export chính:** `getDashboardMetricsImpl`, `getRevenueByDateImpl`, `getRevenue7DaysImpl`, `getRevenueByMonthImpl`.
  - **Import từ đâu:** `lib/branch-ids`, `lib/date-utils`.
  - **Được import bởi:** `worker/src/index.ts`.

- **`server/routes/admin/email-logs.ts`**
  - **Vai trò:** API xem lịch sử nhật ký (logs) việc hệ thống đã gửi thư nào thành công/thất bại.
  - **Export chính:** `getEmailLogsImpl`.
  - **Import từ đâu:** Query DB thường.
  - **Được import bởi:** `worker/src/index.ts`.

- **`server/routes/admin/movies.ts`**
  - **Vai trò:** CRUD quản lý thông tin toàn bộ Phim (Poster, trailer, độ tuổi, thể loại).
  - **Export chính:** `createMovieImpl`, `updateMovieImpl`, `deleteMovieImpl`, `listDeletedMoviesImpl`, `getMovieByIdImpl`...
  - **Import từ đâu:** `lib/audit-logger`, `lib/date-utils`, utils JSON.
  - **Được import bởi:** `worker/src/index.ts`.

- **`server/routes/admin/payments.ts`**
  - **Vai trò:** Truy vấn và hiển thị danh sách các Giao dịch tài chính (Transactions) của khách hàng.
  - **Export chính:** `getRevenueImpl`, `listTransactionsImpl`, `getTransactionByIdImpl`.
  - **Import từ đâu:** `lib/date-utils`.
  - **Được import bởi:** `worker/src/index.ts`.

- **`server/routes/admin/posts.ts`**
  - **Vai trò:** CRUD bài viết tĩnh, tin tức, khuyến mãi, quản lý content Markdown/Blog. Xử lý logic tăng View counter.
  - **Export chính:** `listPostsImpl`, `createPostImpl`, `getPostImpl`, `incrementPostViewImpl`...
  - **Import từ đâu:** `lib/audit-logger`, `lib/date-utils`.
  - **Được import bởi:** `worker/src/index.ts`.

- **`server/routes/admin/roles.ts`**
  - **Vai trò:** Quản lý trung tâm hệ thống Phân quyền cấp 2. Thực hiện CRUD danh sách Roles (Guest/Editor) và map với danh sách hạt Permission.
  - **Export chính:** `listRolesImpl`, `createRoleImpl`, `listPermissionsImpl`, `restoreRoleImpl`...
  - **Import từ đâu:** `lib/audit-logger`.
  - **Được import bởi:** `worker/src/index.ts`.

- **`server/routes/admin/settings.ts`**
  - **Vai trò:** Cấu hình cài đặt Runtime (KV Storage). Bật/tắt bảo trì, sửa setting nóng mà ko cần re-deploy.
  - **Export chính:** `getAdminSettingsImpl`, `updateAdminSettingsImpl`.
  - **Import từ đâu:** (Thao tác thẳng namespace KV).
  - **Được import bởi:** `worker/src/index.ts`, `server/routes/user/auth.ts`.

- **`server/routes/admin/setup.ts`**
  - **Vai trò:** API mồi (Bootstrapping). Sinh tài khoản Super Admin đầu tiên, reset toàn bộ Rules về đúng với hạt giống (seed) ban đầu.
  - **Export chính:** `checkSuperAdminExists`, `setupSuperAdminImpl`, `seedRolesAndPermissionsImpl`.
  - **Import từ đâu:** `lib/rbac-seed.ts`.
  - **Được import bởi:** `worker/src/index.ts`.

- **`server/routes/admin/sepay.ts`**
  - **Vai trò:** Lắng nghe Webhook và xử lý giao dịch khi cổng thanh toán (SePay/VietQR) ping chuyển khoản thành công. Map logic để đổi trạng thái `status` thành `paid` rồi chốt vé.
  - **Export chính:** `handleSePayWebhookImpl`.
  - **Import từ đâu:** `server/routes/user/payments.ts`.
  - **Được import bởi:** `worker/src/index.ts`.

- **`server/routes/admin/showtimes.ts`**
  - **Vai trò:** CRUD lịch chiếu, suất chiếu phim của từng Rạp (Branch). Logic copy lịch nguyên khối qua ngày khác.
  - **Export chính:** `listShowtimesImpl`, `createShowtimeImpl`, `copyShowtimesImpl`...
  - **Import từ đâu:** `lib/showtime-utils.ts`, `lib/audit-logger.ts`.
  - **Được import bởi:** `worker/src/index.ts`.

- **`server/routes/admin/site-media.ts`**
  - **Vai trò:** Cấu hình tài nguyên Ảnh (Asset) UI (Banners trên Hero Section,...).
  - **Export chính:** `createSiteMediaImpl`, `listSiteMediaImpl`, `updateSiteMediaImpl`, `deleteSiteMediaImpl`.
  - **Import từ đâu:** `lib/audit-logger.ts`.
  - **Được import bởi:** `worker/src/index.ts`.

- **`server/routes/admin/staff-audit-utils.ts`**
  - **Vai trò:** Hàm chuyển đổi Object format đặc thù cho việc hiển thị log của nhân sự.
  - **Export chính:** `buildStaffAuditPayload`.
  - **Import từ đâu:** Hàm thuần không export.
  - **Được import bởi:** `staff-auth.ts`, `staff-management.ts`.

- **`server/routes/admin/staff-auth.ts`**
  - **Vai trò:** Route xử lý đăng nhập (Login/Logout), Gia hạn session, Forgot / Đổi mật khẩu kèm kiểm chứng OTP (Chỉ phục vụ cho nhánh Admin). 
  - **Export chính:** `staffLoginImpl`, `staffForgotPasswordImpl`, `staffChangePasswordWithOTP`, `staffGetMeImpl`...
  - **Import từ đâu:** `lib/otp-utils.ts`, `lib/staff-auth.ts`, `lib/audit-logger`.
  - **Được import bởi:** `worker/src/index.ts`.

- **`server/routes/admin/staff-management.ts`**
  - **Vai trò:** Cấp quyền tạo/xóa tài khoản của Nhân Viên. Gắn Role, thay đổi nhánh/Branch hoạt động cho một Manager con.
  - **Export chính:** `listStaffImpl`, `createStaffImpl`, `resetStaffPasswordImpl`, `updateStaffImpl`...
  - **Import từ đâu:** `lib/staff-auth.ts`, `lib/email-templates.ts`.
  - **Được import bởi:** `worker/src/index.ts`.

- **`server/routes/admin/tickets.ts`**
  - **Vai trò:** Logic kinh doanh, định nghĩa các loại "Gói Vé" (Ghế đơn/Đôi/VIP) và giá tiền cơ bản.
  - **Export chính:** `listTicketPackagesImpl`, `createTicketPackageImpl`, `toggleTicketStatusImpl`...
  - **Import từ đâu:** `lib/audit-logger`.
  - **Được import bởi:** `worker/src/index.ts`.

- **`server/routes/admin/toys.ts`**
  - **Vai trò:** CRUD Bắp nước, Sản phẩm đính kèm (Food & Beverage).
  - **Export chính:** `listToysImpl`, `createToyImpl`, `deleteToyImpl`...
  - **Import từ đâu:** `lib/audit-logger`.
  - **Được import bởi:** `worker/src/index.ts`.

- **`server/routes/admin/uploads.ts`**
  - **Vai trò:** Hỗ trợ proxy upload/stream local fallback sử dụng Express JS thay cho Cloudinary trực tiếp. 
  - **Export chính:** `uploadAdminVideo`.
  - **Import từ đâu:** NodeJS APIs.
  - **Được import bởi:** Chưa rõ. (Dự phòng dev local).

- **`server/routes/admin/users.ts`**
  - **Vai trò:** API đọc danh bạ tất cả các Khách hàng (End-user) đã từng tải app/web và mua vé.
  - **Export chính:** `getUsersImpl`, `getUserByIdImpl`.
  - **Import từ đâu:** Utils cơ bản.
  - **Được import bởi:** `worker/src/index.ts`.

- **`server/routes/admin/vouchers.ts`**
  - **Vai trò:** Quản lý, cấu hình quy tắc áp dụng Mã khuyến mãi (Scope: Phim gì, rạp nào, giảm % hay tiền mặt).
  - **Export chính:** `listVouchersImpl`, `createVoucherImpl`, `toggleVoucherStatusImpl`...
  - **Import từ đâu:** `lib/audit-logger`, `lib/branch-ids`.
  - **Được import bởi:** `worker/src/index.ts` và dùng chung logic bởi cả `user/vouchers.ts`.

### C4. Thư mục `server/routes/user/` (11 files)
- **`server/routes/user/auth.ts`**
  - **Vai trò:** Nhánh Đăng nhập/Đăng ký dành riêng cho khách hàng (End-user). Xác thực mã Cloudflare Turnstile token trực tiếp qua API `siteverify` chống bot spam, xác nhận mã OTP và gửi email Welcome.
  - **Export chính:** `loginImpl`, `loginWithSessionImpl`, `registerImpl`, `validateSessionTokenImpl`, `validateOTPImpl`...
  - **Import từ đâu:** `lib/otp-utils`, `lib/booking-utils`.
  - **Được import bởi:** `worker/src/index.ts`.

- **`server/routes/user/demo.ts`**
  - **Vai trò:** Route cho Testing hoặc Demo tính năng Sandbox.
  - **Export chính:** `handleDemo`.
  - **Import từ đâu:** `shared/api.ts`.
  - **Được import bởi:** Express dev server cổ.

- **`server/routes/user/movies.ts`**
  - **Vai trò:** Public Filter truy vấn danh sách Phim. Chỉ những phim "Active" mới được Query. Sắp xếp Now Showing và Coming Soon.
  - **Export chính:** `getAllActiveMoviesToday`, `listMovies`, `getMovie`.
  - **Import từ đâu:** SQL Builder.
  - **Được import bởi:** `worker/src/index.ts`.

- **`server/routes/user/password.ts`**
  - **Vai trò:** Xử lý quy trình Quên mật khẩu qua email dành riêng cho Khách. 
  - **Export chính:** `forgetPassImpl`, `resetPasswordImpl`, `changePasswordImpl`.
  - **Import từ đâu:** `lib/mail-queue`, `lib/booking-utils`.
  - **Được import bởi:** `worker/src/index.ts`.

- **`server/routes/user/payments.ts`**
  - **Vai trò:** FILE PHỨC TẠP NHẤT HỆ THỐNG. Chịu trách nhiệm chốt giao dịch. Logic tính toán tổng hóa đơn (quantity * unit_price), map ID thanh toán, và xác nhận vé từ Webhook SePay/VNPay trả về.
  - **Export chính:** `validateBookingImpl`, `createPaymentImpl`, `updatePaymentImpl`, `getBookingByIdImpl`, `confirmUseTicketImpl`.
  - **Import từ đâu:** `lib/booking-utils`, `shared/booking-invoice.ts`, `./vouchers.ts`...
  - **Được import bởi:** `worker/src/index.ts`.

- **`server/routes/user/showtimes.ts`**
  - **Vai trò:** Trả về Public Lịch chiếu phim 7 ngày tới ở frontend cho khách chọn ghế.
  - **Export chính:** `getPublicScheduleImpl`.
  - **Import từ đâu:** SQL.
  - **Được import bởi:** `worker/src/index.ts`.

- **`server/routes/user/tickets.ts`**
  - **Vai trò:** Cung cấp thông tin giá Tiêu Chuẩn / VIP của chi nhánh mà khách đang xem phim.
  - **Export chính:** `listActiveTicketPackages`.
  - **Import từ đâu:** `lib/branch-ids`.
  - **Được import bởi:** `worker/src/index.ts`.

- **`server/routes/user/toys.ts`**
  - **Vai trò:** Liệt kê các dạng Combo bỏng nước đang mở bán.
  - **Export chính:** `listActiveToys`.
  - **Import từ đâu:** SQL.
  - **Được import bởi:** `worker/src/index.ts`.

- **`server/routes/user/users.ts`**
  - **Vai trò:** API đọc/ghi thông tin Profiling của khách (Đổi avatar, lịch sử đã mua, update CCCD).
  - **Export chính:** `updateUserProfileImpl`, `getUserProfileByAccountIdImpl`, `listUserTransactionsImpl`.
  - **Import từ đâu:** `lib/date-utils`.
  - **Được import bởi:** `worker/src/index.ts`.

- **`server/routes/user/vouchers.ts`**
  - **Vai trò:** Public Validation. Hàm được gọi ngay khi người dùng nhập Mã Giảm Giá vào ô thanh toán để báo đúng/sai và re-calculate giá rổ hàng realtime (Redeem).
  - **Export chính:** `validateVoucherForVRImpl`, `redeemVoucherAfterPaymentImpl`, `matchesBranch`.
  - **Import từ đâu:** Logic lấy từ `routes/admin/vouchers.ts`.
  - **Được import bởi:** `user/payments.ts`, `user/vr-bookings.ts`, `worker/src/index.ts`.

- **`server/routes/user/vr-bookings.ts`**
  - **Vai trò:** Custom Checkout Flow cho loại hình thực tế ảo VR (Vì vé VR không cần chọn rạp chiếu, chỉ cần booking date).
  - **Export chính:** `listActiveVRPackagesImpl`, `validateVRBookingImpl`, `createVRBookingImpl`, `getVRBookingByIdImpl`.
  - **Import từ đâu:** `./vouchers`, `lib/branch-ids`.
  - **Được import bởi:** `worker/src/index.ts`.



### C7. Các API ở root `server/` (2 files)
- **`server/routes/mail-service.ts`**
  - **Vai trò:** Wrapper API gửi email. Truy cập qua API Resend hoặc nội bộ Worker.
  - **Export chính:** `sendMail`.
  - **Import từ đâu:** Độc lập.
  - **Được import bởi:** Các cron job Worker.

- **`server/cloudinary.ts`**
  - **Vai trò:** Khởi tạo cấu hình Cloudinary SDK cho ứng dụng.
  - **Export chính:** `cloudinary`, `cloudinaryEnvOk`, `getPublicIdFromUrl`.
  - **Import từ đâu:** Thư viện `cloudinary`.
  - **Được import bởi:** (Sử dụng rất hạn chế ở môi trường Worker).

### C8. Root Configs (Môi trường & Build)
- **`worker/drizzle.config.ts`**
  - **Vai trò:** Khai báo cấu hình D1 DB phục vụ Drizzle Kit Migration.
- **`worker/wrangler.toml`**
  - **Vai trò:** File cốt lõi khởi chạy project lên Cloudflare. Định nghĩa Bindings, Database ID KV Namespace và Env Vars.
- **`package.json`, `index.html`, `vite.config.ts`, `tailwind.config.ts`**
  - **Vai trò:** File cốt lõi khởi chạy SPA React Vite ở `client/`.

---

## PHẦN D: Danh sách File rác / Dead code (Mục tiêu 4)

Qua quá trình quét toàn bộ Repo và xây dựng sơ đồ kiến trúc, dưới đây là danh sách File "Tàn dư" được phát hiện. Chúng là những file chứa logic tương thích với hệ thống cũ (Node.js/Express/Multer) và hoàn toàn bị Crash / không thể khởi chạy trên môi trường V8 Isolate của Cloudflare Workers. Yêu cầu lên kế hoạch làm sạch (Delete) trong tương lai để bảo đảm code-base trong vắt:

1. **`server/routes/admin/uploads.ts`** (Import thư viện `express`, `multer`, native fs module)
2. **`server/routes/admin/cloudinary-sign.ts`** (Hàm route cho Express request)
3. **`server/routes/user/demo.ts`** (Mock API bằng Express)
4. **`server/cloudinary.spec.ts`** (File test trống)
5. **`tests/api-parity.spec.ts`** (Test hỏng hóc rườm rà)

**(HOÀN TẤT `PROJECT_STRUCTURE.md` TẠI ĐÂY)**
