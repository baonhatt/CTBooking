# BÁO CÁO KIỂM KÊ (BƯỚC 0)

**1. Số dòng thật của worker/src/index.ts hiện tại:** 5489 dòng

**2 & 3. Liệt kê ĐẦY ĐỦ các route được đăng ký & Phân loại:**

### GLOBAL MIDDLEWARES (Áp dụng toàn cục)
*ĐÂY LÀ ĐIỂM CHÚ Ý SỐ 5: Cần giữ nguyên hành vi khi tách sang sub-router*

- `PATH: *` | `MIDDLEWARE: cors({
    origin: (origin`
- `PATH: /api/admin/*` | `MIDDLEWARE: requireStaffAuth`
- `PATH: *` | `MIDDLEWARE: async (c`
- `PATH: *` | `MIDDLEWARE: async (c`

### NHÓM ADMIN (/api/admin/*) (69 routes)
| METHOD | PATH | MIDDLEWARE ÁP DỤNG | HANDLER |
|---|---|---|---|
| `POST` | `/api/admin/login` | `NONE` | `Inline Response / c.json` |
| `GET` | `/api/admin/revenue` | `requireStaffAuth, requirePermission('dashboard', 'view_revenue')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `GET` | `/api/admin/transactions` | `requireStaffAuth, requirePermission('transactions', 'view')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `GET` | `/api/admin/transactions/:id` | `requireStaffAuth, requirePermission('transactions', 'view')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `GET` | `/api/admin/dashboard/metrics` | `requireStaffAuth, requirePermission('dashboard', 'view')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `GET` | `/api/admin/users` | `requireStaffAuth, requirePermission('users', 'view')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `GET` | `/api/admin/settings` | `requireStaffAuth, requirePermission('settings', 'view')` ⚠️ **PERMISSION_SCOPED** | `getAdminSettingsImpl` |
| `POST` | `/api/admin/settings` | `requireStaffAuth, requirePermission('settings', 'manage')` ⚠️ **PERMISSION_SCOPED** | `updateAdminSettingsImpl` |
| `GET` | `/api/admin/users/:id` | `requireStaffAuth, requirePermission('users', 'view_detail')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `POST` | `/api/admin/cloudinary/sign` | `requireStaffAuth, requirePermission('uploads', 'upload')` ⚠️ **PERMISSION_SCOPED** | `cloudinarySignedParams` |
| `POST` | `/api/admin/uploads/video` | `requireStaffAuth, requirePermission('uploads', 'upload')` ⚠️ **PERMISSION_SCOPED** | `cloudinarySignedParams` |
| `POST` | `/api/admin/movies/:id/restore` | `requireStaffAuth, requirePermission('movies', 'restore')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `GET` | `/api/admin/deleted/movies` | `requireStaffAuth, requirePermission('movies', 'view_deleted')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `GET` | `/api/admin/email-logs` | `requireStaffAuth, requirePermission('email_logs', 'view')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `POST` | `/api/admin/toys/:id/restore` | `requireStaffAuth, requirePermission('toys', 'restore')` ⚠️ **PERMISSION_SCOPED** | `import` |
| `GET` | `/api/admin/deleted/toys` | `requireStaffAuth, requirePermission('toys', 'view_deleted')` ⚠️ **PERMISSION_SCOPED** | `import` |
| `POST` | `/api/admin/tickets/:id/restore` | `requireStaffAuth, requirePermission('tickets', 'restore')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `GET` | `/api/admin/deleted/tickets` | `requireStaffAuth, requirePermission('tickets', 'view_deleted')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `POST` | `/api/admin/site-media` | `requireStaffAuth, requirePermission('uploads', 'upload')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `PUT` | `/api/admin/site-media` | `requireStaffAuth, requirePermission('uploads', 'upload')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `DELETE` | `/api/admin/site-media/:id` | `requireStaffAuth, requirePermission('uploads', 'delete')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `GET` | `/api/admin/posts` | `requireStaffAuth, requirePermission('posts', 'view')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `GET` | `/api/admin/posts/:id` | `requireStaffAuth, requirePermission('posts', 'view')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `GET` | `/api/admin/branches` | `requireStaffAuth, requirePermission('branches', 'view')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `GET` | `/api/admin/branches/options` | `requireStaffAuth` | `Inline Function / Mixed` |
| `GET` | `/api/admin/branches/:id` | `requireStaffAuth, requirePermission('branches', 'view')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `POST` | `/api/admin/branches` | `requireStaffAuth, requirePermission('branches', 'create')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `PUT` | `/api/admin/branches/:id` | `requireStaffAuth, requirePermission('branches', 'edit')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `DELETE` | `/api/admin/branches/:id` | `requireStaffAuth, requirePermission('branches', 'delete')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `POST` | `/api/admin/branches/:id/toggle-open` | `requireStaffAuth, requirePermission('branches', 'edit')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `POST` | `/api/admin/branches/:id/restore` | `requireStaffAuth, requirePermission('branches', 'restore')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `GET` | `/api/admin/deleted/branches` | `requireStaffAuth, requirePermission('branches', 'view_deleted')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `GET` | `/api/admin/setup/super-admin` | `NONE` | `import` |
| `POST` | `/api/admin/setup/super-admin` | `NONE` | `import` |
| `POST` | `/api/admin/setup/seed-roles` | `requireStaffAuth` | `import` |
| `POST` | `/api/admin/auth/login` | `NONE` | `import` |
| `POST` | `/api/admin/auth/logout` | `requireStaffAuth` | `import` |
| `POST` | `/api/admin/auth/extend-session` | `requireStaffAuth` | `import` |
| `GET` | `/api/admin/auth/me` | `requireStaffAuth` | `import` |
| `POST` | `/api/admin/auth/change-password` | `requireStaffAuth` | `import` |
| `POST` | `/api/admin/auth/force-change-password` | `requireStaffAuth` | `import` |
| `POST` | `/api/admin/auth/request-password-change-otp` | `requireStaffAuth` | `import` |
| `POST` | `/api/admin/auth/change-password-with-otp` | `requireStaffAuth` | `import` |
| `POST` | `/api/admin/auth/forgot-password` | `NONE` | `import` |
| `POST` | `/api/admin/auth/reset-password` | `NONE` | `import` |
| `GET` | `/api/admin/staff` | `requireStaffAuth, requirePermission('staff', 'view')` ⚠️ **PERMISSION_SCOPED** | `import` |
| `GET` | `/api/admin/staff/:id` | `requireStaffAuth, requirePermission('staff', 'view')` ⚠️ **PERMISSION_SCOPED** | `import` |
| `POST` | `/api/admin/staff` | `requireStaffAuth, requirePermission('staff', 'create')` ⚠️ **PERMISSION_SCOPED** | `import` |
| `PUT` | `/api/admin/staff/:id` | `requireStaffAuth, requirePermission('staff', 'edit')` ⚠️ **PERMISSION_SCOPED** | `import` |
| `DELETE` | `/api/admin/staff/:id` | `requireStaffAuth, requirePermission('staff', 'delete')` ⚠️ **PERMISSION_SCOPED** | `import` |
| `POST` | `/api/admin/staff/:id/restore` | `requireStaffAuth, requirePermission('staff', 'restore')` ⚠️ **PERMISSION_SCOPED** | `import` |
| `GET` | `/api/admin/deleted/staff` | `requireStaffAuth, requirePermission('staff', 'view_deleted')` ⚠️ **PERMISSION_SCOPED** | `import` |
| `GET` | `/api/admin/roles` | `requireStaffAuth, requirePermission('roles', 'view')` ⚠️ **PERMISSION_SCOPED** | `import` |
| `GET` | `/api/admin/roles/:id` | `requireStaffAuth, requirePermission('roles', 'view')` ⚠️ **PERMISSION_SCOPED** | `import` |
| `POST` | `/api/admin/roles` | `requireStaffAuth, requirePermission('roles', 'create')` ⚠️ **PERMISSION_SCOPED** | `import` |
| `PUT` | `/api/admin/roles/:id` | `requireStaffAuth, requirePermission('roles', 'edit')` ⚠️ **PERMISSION_SCOPED** | `import` |
| `DELETE` | `/api/admin/roles/:id` | `requireStaffAuth, requirePermission('roles', 'delete')` ⚠️ **PERMISSION_SCOPED** | `import` |
| `POST` | `/api/admin/roles/:id/restore` | `requireStaffAuth, requirePermission('roles', 'restore')` ⚠️ **PERMISSION_SCOPED** | `import` |
| `GET` | `/api/admin/deleted/roles` | `requireStaffAuth, requirePermission('roles', 'view_deleted')` ⚠️ **PERMISSION_SCOPED** | `import` |
| `GET` | `/api/admin/permissions` | `requireStaffAuth, requirePermission('roles', 'view')` ⚠️ **PERMISSION_SCOPED** | `import` |
| `GET` | `/api/admin/audit-logs` | `requireStaffAuth, requirePermission('audit_logs', 'view')` ⚠️ **PERMISSION_SCOPED** | `import` |
| `GET` | `/api/admin/vouchers` | `requireStaffAuth, requirePermission('vouchers', 'view')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `GET` | `/api/admin/vouchers/:id` | `requireStaffAuth, requirePermission('vouchers', 'view')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `POST` | `/api/admin/vouchers` | `requireStaffAuth, requirePermission('vouchers', 'create')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `PUT` | `/api/admin/vouchers/:id` | `requireStaffAuth, requirePermission('vouchers', 'edit')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `DELETE` | `/api/admin/vouchers/:id` | `requireStaffAuth, requirePermission('vouchers', 'delete')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `POST` | `/api/admin/vouchers/:id/restore` | `requireStaffAuth, requirePermission('vouchers', 'restore')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `GET` | `/api/admin/deleted/vouchers` | `requireStaffAuth, requirePermission('vouchers', 'view_deleted')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `GET` | `/api/admin/vouchers/deleted` | `requireStaffAuth, requirePermission('vouchers', 'view_deleted')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |

### NHÓM USER (/api/user/* & Auth) (12 routes)
| METHOD | PATH | MIDDLEWARE ÁP DỤNG | HANDLER |
|---|---|---|---|
| `POST` | `/api/login` | `rateLimiter(5, 60)` 🛑 **RATE_LIMIT** | `Inline Function / Mixed` |
| `POST` | `/api/validate-otp` | `rateLimiter(5, 60)` 🛑 **RATE_LIMIT** | `Inline Function / Mixed` |
| `POST` | `/api/resend-otp` | `rateLimiter(5, 60)` 🛑 **RATE_LIMIT** | `Inline Function / Mixed` |
| `POST` | `/api/register` | `NONE` | `Inline Function / Mixed` |
| `POST` | `/api/forget-password` | `NONE` | `Inline Function / Mixed` |
| `POST` | `/api/reset-password` | `NONE` | `Inline Function / Mixed` |
| `GET` | `/api/users` | `requireStaffAuth, requirePermission('users', 'view')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `GET` | `/api/users/:id` | `requireStaffAuth, requirePermission('users', 'view_detail')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `GET` | `/api/users-profile` | `requireAuth` | `Inline Function / Mixed` |
| `POST` | `/api/users-profile` | `requireAuth` | `Inline Function / Mixed` |
| `POST` | `/api/users-password` | `requireAuth` | `Inline Function / Mixed` |
| `GET` | `/api/usersprofile/transactions` | `requireAuth` | `Inline Function / Mixed` |

### NHÓM WEBHOOK (/api/webhook/* & Sepay) (1 routes)
| METHOD | PATH | MIDDLEWARE ÁP DỤNG | HANDLER |
|---|---|---|---|
| `POST` | `/api/sepay/webhook` | `NONE` | `import` |

### NHÓM PUBLIC / KHÁC (56 routes)
| METHOD | PATH | MIDDLEWARE ÁP DỤNG | HANDLER |
|---|---|---|---|
| `GET` | `/uploads/*` | `NONE` | `import` |
| `GET` | `/api/ping` | `NONE` | `Inline Response / c.json` |
| `GET` | `/api/demo` | `NONE` | `Inline Response / c.json` |
| `POST` | `/api/logout` | `NONE` | `Inline Function / Mixed` |
| `GET` | `/api/getActiveMovies` | `NONE` | `Inline Function / Mixed` |
| `POST` | `/api/validate-booking` | `NONE` | `Inline Function / Mixed` |
| `POST` | `/api/create-booking` | `NONE` | `Inline Function / Mixed` |
| `POST` | `/api/cancel-booking` | `NONE` | `Inline Function / Mixed` |
| `POST` | `/api/confirm-booking` | `requireStaffAuth, requirePermission('ticket_check', 'validate')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `GET` | `/api/bookings/:id` | `NONE` | `Inline Function / Mixed` |
| `GET` | `/api/bookings-code/:code` | `requireStaffAuth, requirePermission('ticket_check', 'scan')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `POST` | `/api/bookings-use` | `requireStaffAuth, requirePermission('ticket_check', 'validate')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `GET` | `/api/movies` | `NONE` | `Inline Function / Mixed` |
| `POST` | `/api/movies` | `requireStaffAuth, requirePermission('movies', 'create')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `GET` | `/api/movies/:id` | `NONE` | `Inline Function / Mixed` |
| `GET` | `/api/movies-detail/:id` | `NONE` | `Inline Function / Mixed` |
| `PUT` | `/api/movies/:id` | `requireStaffAuth, requirePermission('movies', 'edit')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `POST` | `/api/movies-status/:id` | `requireStaffAuth, requirePermission('movies', 'toggle_status')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `DELETE` | `/api/movies/:id` | `requireStaffAuth, requirePermission('movies', 'delete')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `GET` | `/api/schedule` | `NONE` | `Inline Function / Mixed` |
| `GET` | `/api/showtimes` | `requireStaffAuth, requirePermission('showtimes', 'view')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `POST` | `/api/showtimes` | `requireStaffAuth, requirePermission('showtimes', 'create')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `POST` | `/api/showtimes/copy` | `requireStaffAuth, requirePermission('showtimes', 'create')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `PUT` | `/api/showtimes/:id` | `requireStaffAuth, requirePermission('showtimes', 'edit')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `DELETE` | `/api/showtimes/:id` | `requireStaffAuth, requirePermission('showtimes', 'delete')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `GET` | `/api/toys` | `NONE` | `Inline Function / Mixed` |
| `GET` | `/api/toys-active` | `NONE` | `Inline Function / Mixed` |
| `GET` | `/api/toys/:id` | `NONE` | `Inline Function / Mixed` |
| `POST` | `/api/toys` | `requireStaffAuth, requirePermission('toys', 'create')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `PUT` | `/api/toys/:id` | `requireStaffAuth, requirePermission('toys', 'edit')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `DELETE` | `/api/toys/:id` | `requireStaffAuth, requirePermission('toys', 'delete')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `GET` | `/api/tickets` | `NONE` | `Inline Function / Mixed` |
| `GET` | `/api/tickets-active` | `NONE` | `Inline Function / Mixed` |
| `GET` | `/api/tickets/:id` | `NONE` | `Inline Function / Mixed` |
| `POST` | `/api/tickets` | `requireStaffAuth, requirePermission('tickets', 'create')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `PUT` | `/api/tickets/:id` | `requireStaffAuth, requirePermission('tickets', 'edit')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `DELETE` | `/api/tickets/:id` | `requireStaffAuth, requirePermission('tickets', 'delete')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `GET` | `/api/site-media` | `NONE` | `withCache` |
| `GET` | `/api/debug/mail` | `NONE` | `Inline Function / Mixed` |
| `GET` | `/api/debug/test-mail` | `NONE` | `sendMail` |
| `GET` | `/sitemap.xml` | `NONE` | `Inline Function / Mixed` |
| `GET` | `/api/posts` | `NONE` | `Inline Function / Mixed` |
| `GET` | `/api/posts/:identifier` | `NONE` | `Inline Function / Mixed` |
| `POST` | `/api/posts` | `requireStaffAuth, requirePermission('posts', 'create')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `PUT` | `/api/posts/:id` | `requireStaffAuth, requirePermission('posts', 'edit')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `DELETE` | `/api/posts/:id` | `requireStaffAuth, requirePermission('posts', 'delete')` ⚠️ **PERMISSION_SCOPED** | `Inline Function / Mixed` |
| `POST` | `/api/posts/:id/view` | `NONE` | `Inline Function / Mixed` |
| `GET` | `/api/branches/default` | `NONE` | `Inline Function / Mixed` |
| `GET` | `/api/branches/options` | `NONE` | `Inline Function / Mixed` |
| `GET` | `/api/branches/:id` | `NONE` | `Inline Function / Mixed` |
| `GET` | `/api/branches` | `NONE` | `Inline Function / Mixed` |
| `GET` | `/api/vr/packages` | `NONE` | `Inline Function / Mixed` |
| `POST` | `/api/vr/voucher/validate` | `NONE` | `Inline Function / Mixed` |
| `POST` | `/api/vr/validate-booking` | `NONE` | `Inline Function / Mixed` |
| `POST` | `/api/vr/create-booking` | `NONE` | `Inline Function / Mixed` |
| `GET` | `/api/vr/bookings/:id` | `NONE` | `Inline Function / Mixed` |

## ĐÁNH GIÁ RỦI RO & CHÚ Ý (BƯỚC 0.4 & 0.5)
1. **Middleware Admin Global:** Cực kỳ quan trọng. Có khai báo `app.use('/api/admin/*', requireStaffAuth);`. Khi tạo sub-router Admin, bắt buộc phải chèn `adminRouter.use('*', requireStaffAuth)` ở đầu file.
2. **Rate Limit ở nhóm User:** Các API Login, OTP đăng ký `rateLimiter(5, 60)` cứng ở tầng route. Tuyệt đối bưng nguyên xi khi cắt ghép vào `userRouter`.
3. **Webhooks độc lập auth:** Hoàn toàn lệ thuộc vào crypto signature, không gắn user token middleware.
