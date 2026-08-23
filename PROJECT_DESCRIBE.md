# CTBooking - Project Documentation

## 1. TECH STACK

### Frontend - Admin Panel
- **Framework**: React 18.3.1 + Vite 7.1.2
- **Language**: TypeScript 5.9.2
- **Styling**: TailwindCSS 3.4.17 + shadcn/ui components
- **UI Components**: Radix UI (@radix-ui/*)
- **Icons**: Lucide React
- **State Management**: TanStack React Query 5.84.2
- **Routing**: React Router DOM 6.30.1
- **Forms**: React Hook Form 7.62.0
- **Rich Text Editor**: CKEditor 5
- **Charts**: Recharts 2.12.7
- **3D**: Three.js + React Three Fiber (for visual effects)
- **SEO**: react-helmet-async

### Frontend - User Client
- **Framework**: Next.js 14.2.29 (App Router)
- **Language**: TypeScript 5.9.2
- **Styling**: TailwindCSS 3.4.17
- **State Management**: TanStack React Query 5.84.2
- **Icons**: Lucide React
- **Loading**: nextjs-toploader
- **Deployment**: Cloudflare Pages via @cloudflare/next-on-pages

### Backend - API Server
- **Runtime**: Cloudflare Workers
- **Framework**: Hono 4.11.1
- **Language**: TypeScript 5.9.2
- **Database**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM 0.45.1
- **Migrations**: Drizzle Kit 0.31.8

### Database
- **Primary**: Cloudflare D1 (SQLite)
- **ORM**: Drizzle ORM
- **Migration Tool**: Drizzle Kit

### Storage & Media
- **Primary**: Cloudinary (image/video upload, optimization)
- **Backup**: Cloudflare R2 (object storage)
- **Image Processing**: Sharp

### Email Services
- **Primary**: Resend
- **Secondary**: Brevo
- **Fallback**: MailChannels (Cloudflare native)
- **Queue**: Custom mail queue with waitUntil

### Payment Gateways
- **MoMo**: Test environment integration
- **VNPay**: Sandbox environment integration
- **Webhook**: SePay webhook support

### Caching
- **KV Store**: Cloudflare KV (for settings, rate limiting, cache)
- **CDN**: Cloudflare CDN cache headers

### AI
- **Provider**: Cloudflare Workers AI
- **Model**: @cf/meta/llama-3-8b-instruct
- **Use Case**: Analytics Q&A, data analysis

### Authentication
- **Password Hashing**: bcryptjs
- **Session**: HTTP-only cookies
- **2FA**: Email-based OTP

### Deployment
- **Platform**: Cloudflare Pages + Workers
- **CI/CD**: Git-based auto-deploy (push to trigger)
- **Preview**: Automatic preview deployments on PRs
- **Domains**: 
  - Production: cinesphere.com.vn, api.cinesphere.com.vn, admin.cinesphere.com.vn
  - Preview: cinema-pages.pages.dev, cinema-next-pages.pages.dev, cinema-admin-pages.pages.dev

### Development Tools
- **Package Manager**: pnpm 10.14.0
- **Build Tool**: Vite (admin), Next.js (user)
- **Testing**: Vitest
- **Linting**: Prettier
- **Type Checking**: TypeScript

---

## 2. PROJECT STRUCTURE

```
CTBooking/
├── client/                          # Admin Panel (React + Vite)
│   ├── admin/
│   │   ├── auth/                    # Admin authentication (AdminGate.tsx)
│   │   └── layouts/                 # Admin layouts (AdminLayout.tsx)
│   ├── components/
│   │   ├── admin/                   # Admin components
│   │   └── ui/                      # shadcn/ui components
│   ├── hooks/                       # RBAC hooks (useStaffPermission.ts)
│   ├── pages/
│   │   ├── admin/                   # Admin pages (Staff, Movies, etc.)
│   │   └── ...
│   ├── store/                       # State (staffStore.ts)
│   └── App.tsx
│
├── next-client/                      # User Client (Next.js)
│
├── server/                           # Shared business logic
│   ├── lib/                         # audit-logger, branch-guard, etc.
│   └── routes/                      # admin/ and user/ implementations
│
├── worker/                           # Cloudflare Worker (API Server)
│   ├── src/
│   │   ├── index.ts                 # Hono server
│   │   ├── middleware.ts            # Auth & RBAC
│   │   └── schema.ts                # Drizzle schema
│
├── shared/                          # Shared API types
└── ...
│
├── tests/
│   └── api-parity.spec.ts          # API parity tests
│
├── .dockerignore
├── .env                             # Local environment variables
├── .env.production                  # Production environment variables
├── .env.preview                     # Preview environment variables
├── .gitignore
├── .npmrc
├── .nvmrc
├── .prettierignore
├── .prettierrc
├── components.json                  # shadcn/ui config
├── index.html
├── package.json                     # Root package.json (admin)
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── postcss.config.js
├── README.md
├── tailwind.config.ts
├── tsconfig.json
├── vite.config.ts
└── wrangler.toml                    # Root wrangler config
```

---

## 3. DATABASE SCHEMA

### Tables Overview

#### **users**
User profile information
- `id` (INTEGER, PK, AUTOINCREMENT)
- `fullname` (TEXT)
- `phone` (TEXT)
- `avatar` (TEXT)
- `gender` (TEXT)
- `dob` (TEXT)
- `created_at` (TEXT)
- `updated_at` (TEXT)

**Relations**: 
- One-to-many with `accounts`
- One-to-many with `bookings`

#### **accounts**
User authentication accounts
- `id` (INTEGER, PK, AUTOINCREMENT)
- `user_id` (INTEGER, FK → users.id, ON DELETE CASCADE)
- `email` (TEXT, NOT NULL, UNIQUE)
- `password` (TEXT)
- `login_type` (TEXT, DEFAULT 'email')
- `is_active` (BOOLEAN, DEFAULT true)
- `created_at` (TEXT)
- `updated_at` (TEXT)

**Relations**:
- Many-to-one with `users`
- One-to-many with `tokens`

#### **tokens**
Session and OTP tokens
- `id` (INTEGER, PK, AUTOINCREMENT)
- `account_id` (INTEGER, FK → accounts.id, ON DELETE CASCADE)
- `type` (TEXT, NOT NULL) - 'session' or 'otp'
- `token` (TEXT, NOT NULL, UNIQUE)
- `expired_at` (TEXT)
- `created_at` (TEXT, NOT NULL)

**Relations**:
- Many-to-one with `accounts`

#### **movies**
Movie information
- `id` (INTEGER, PK, AUTOINCREMENT)
- `title` (TEXT, NOT NULL)
- `description` (TEXT)
- `cover_image` (TEXT)
- `detail_images` (TEXT, JSON)
- `genres` (TEXT, JSON)
- `rating` (REAL)
- `duration_min` (INTEGER)
- `branch_id` (INTEGER, FK → branches.id, ON DELETE RESTRICT)
- `created_at` (TEXT, NOT NULL)
- `updated_at` (TEXT, NOT NULL)
- `is_active` (BOOLEAN, DEFAULT true)
- `release_date` (TEXT)
- `deleted_at` (TEXT) - Soft delete timestamp
- `deleted_by_staff_id` (INTEGER, FK → staffs.id, ON DELETE SET NULL) - Who deleted the record

**Relations**:
- One-to-many with `bookings`
- Many-to-one with `branches`

#### **ticket_packages**
Ticket/package pricing
- `id` (INTEGER, PK, AUTOINCREMENT)
- `name` (TEXT, NOT NULL)
- `code` (TEXT, UNIQUE)
- `description` (TEXT)
- `price` (REAL, NOT NULL)
- `features` (TEXT, JSON)
- `type` (TEXT)
- `combo` (TEXT)
- `min_group_size` (INTEGER)
- `max_group_size` (INTEGER)
- `is_member_only` (BOOLEAN, DEFAULT false)
- `is_active` (BOOLEAN, DEFAULT true)
- `display_order` (INTEGER, DEFAULT 0)
- `branch_id` (INTEGER, FK → branches.id, ON DELETE RESTRICT)
- `created_at` (TEXT, NOT NULL)
- `updated_at` (TEXT, NOT NULL)
- `deleted_at` (TEXT) - Soft delete timestamp
- `deleted_by_staff_id` (INTEGER, FK → staffs.id, ON DELETE SET NULL) - Who deleted the record

**Relations**:
- One-to-many with `bookings`
- Many-to-one with `branches`

#### **bookings**
Booking/transaction records
- `id` (INTEGER, PK, AUTOINCREMENT)
- `user_id` (INTEGER, FK → users.id, ON DELETE CASCADE, nullable for guest)
- `ticket_count` (INTEGER, DEFAULT 1, NOT NULL)
- `total_price` (REAL, NOT NULL)
- `created_at` (TEXT, NOT NULL)
- `paid_at` (TEXT)
- `payment_method` (TEXT, DEFAULT 'cash')
- `payment_status` (TEXT, DEFAULT 'pending') - 'pending', 'paid', 'failed'
- `transaction_id` (TEXT)
- `updated_at` (TEXT, NOT NULL)
- `name` (TEXT, DEFAULT '', NOT NULL)
- `phone` (TEXT, DEFAULT '', NOT NULL)
- `email` (TEXT, DEFAULT '', NOT NULL)
- `booking_code` (TEXT, UNIQUE)
- `pay_txt_code` (TEXT, UNIQUE)
- `combo` (TEXT)
- `movie_title` (TEXT)
- `movie_duration` (TEXT)
- `movie_poster` (TEXT)
- `ticket_package_name` (TEXT)
- `ticket_unit_price` (REAL)
- `is_used` (BOOLEAN, DEFAULT false)
- `movie_id` (INTEGER, FK → movies.id, ON DELETE CASCADE)
- `ticket_package_id` (INTEGER, FK → ticket_packages.id)
- `expiry_date` (TEXT)
- `checked_in_at` (TEXT)
- `branch_id` (INTEGER, FK → branches.id, ON DELETE RESTRICT)

**Relations**:
- Many-to-one with `users`
- Many-to-one with `movies`
- Many-to-one with `ticket_packages`
- Many-to-one with `branches`

#### **toys**
Merchandise/toys inventory
- `id` (INTEGER, PK, AUTOINCREMENT)
- `name` (TEXT, NOT NULL)
- `category` (TEXT)
- `price` (REAL, NOT NULL)
- `stock` (INTEGER, DEFAULT 0, NOT NULL)
- `status` (TEXT, DEFAULT 'active', NOT NULL)
- `image_url` (TEXT)
- `created_at` (TEXT, NOT NULL)
- `updated_at` (TEXT, NOT NULL)
- `deleted_at` (TEXT) - Soft delete timestamp

#### **email_logs**
Email sending logs
- `id` (INTEGER, PK, AUTOINCREMENT)
- `recipient` (TEXT, NOT NULL)
- `subject` (TEXT, NOT NULL)
- `email_type` (TEXT, NOT NULL) - 'welcome', 'reset_password', 'booking_confirmation'
- `status` (TEXT, NOT NULL, DEFAULT 'pending') - 'pending', 'sent', 'failed'
- `provider` (TEXT) - 'mailtrap', 'brevo', 'mailchannels', 'resend'
- `error_message` (TEXT)
- `user_id` (INTEGER, FK → users.id, ON DELETE SET NULL)
- `booking_id` (INTEGER, FK → bookings.id, ON DELETE SET NULL)
- `metadata` (TEXT, JSON)
- `sent_at` (TEXT)
- `created_at` (TEXT, NOT NULL)
- `updated_at` (TEXT, NOT NULL)

**Relations**:
- Many-to-one with `users`
- Many-to-one with `bookings`

#### **site_media**
Site media management (hero banners, promotions, etc.)
- `id` (INTEGER, PK, AUTOINCREMENT)
- `section` (TEXT, NOT NULL)
- `type` (TEXT, NOT NULL) - 'image', 'video'
- `title` (TEXT)
- `description` (TEXT)
- `public_id` (TEXT)
- `url` (TEXT, NOT NULL)
- `format` (TEXT)
- `width` (INTEGER)
- `height` (INTEGER)
- `duration` (REAL)
- `display_order` (INTEGER, DEFAULT 0)
- `is_active` (BOOLEAN, DEFAULT true)
- `created_at` (TEXT, NOT NULL)
- `updated_at` (TEXT, NOT NULL)
- `deleted_at` (TEXT) - Soft delete timestamp

#### **branches**
Cinema branch locations
- `id` (INTEGER, PK, AUTOINCREMENT)
- `name` (TEXT, NOT NULL)
- `code` (TEXT, UNIQUE, NOT NULL)
- `address` (TEXT)
- `phone` (TEXT)
- `email` (TEXT)
- `is_default` (BOOLEAN, DEFAULT false)
- `is_active` (BOOLEAN, DEFAULT true)
- `created_at` (TEXT, NOT NULL)
- `updated_at` (TEXT, NOT NULL)
- `deleted_at` (TEXT) - Soft delete timestamp
- `deleted_by_staff_id` (INTEGER, FK → staffs.id, ON DELETE SET NULL) - Who deleted the record

**Relations**:
- One-to-many with `movies`
- One-to-many with `ticket_packages`
- One-to-many with `bookings`

#### **posts**
Blog posts
- `id` (INTEGER, PK, AUTOINCREMENT)
- `title` (TEXT, NOT NULL)
- `slug` (TEXT, UNIQUE)
- `content` (TEXT, NOT NULL)
- `excerpt` (TEXT)
- `featured_image` (TEXT)
- `meta_description` (TEXT)
- `meta_keywords` (TEXT)
- `seo_title` (TEXT)
- `og_image` (TEXT)
- `canonical_url` (TEXT)
- `schema_type` (TEXT, DEFAULT 'Article')
- `author_id` (INTEGER, FK → users.id, ON DELETE SET NULL)
- `status` (TEXT, DEFAULT 'draft') - 'draft', 'published'
- `is_featured` (BOOLEAN, DEFAULT false)
- `view_count` (INTEGER, DEFAULT 0)
- `published_at` (TEXT)
- `created_at` (TEXT)
- `updated_at` (TEXT)

**Relations**:
- Many-to-one with `users`

---

## 4. AUTHENTICATION & SESSION

### Authentication Flow

#### User Login Flow
1. **POST /api/login**
   - Body: `{ email, password }`
   - Validates email/password with bcrypt
   - Checks 2FA settings from KV (admin settings)
   - If 2FA enabled:
     - Generates OTP (configurable length, default 6 digits)
     - Stores OTP in `tokens` table with type='otp'
     - Sends OTP email via mail queue
     - Returns: `{ requires_otp: true, temp_account_id, email }`
   - If 2FA disabled:
     - Generates session token (random string)
     - Calculates expiry (default 30 days)
     - Stores in `tokens` table with type='session'
     - Sets HTTP-only cookie: `session_token=<token>; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`
     - Returns: `{ user, token }`

2. **POST /api/validate-otp** (if 2FA enabled)
   - Body: `{ temp_account_id, otp }`
   - Validates OTP from `tokens` table
   - Checks expiry
   - On success:
     - Deletes OTP token
     - Creates session token
     - Sets HTTP-only cookie
     - Returns: `{ user, token }`

3. **POST /api/resend-otp**
   - Body: `{ temp_account_id, email }`
   - Checks cooldown (configurable, default 30 seconds)
   - Generates new OTP
   - Sends email
   - Returns success or error with retry time

#### Staff Login Flow (RBAC)
3. **POST /api/admin/auth/me**
   - Middleware: requireStaffAuth
   - Returns current staff info with permissions and branchIds
   - Loads from DB or KV cache

4.  **POST /api/admin/login (DEPRECATED)**
    - **Status**: 410 Gone
    - **Reason**: Security hardening. All admin auth migrated to `/api/admin/auth/login`.

5. **POST /api/admin/auth/change-password**
   - Body: `{ oldPassword, newPassword }`
   - Middleware: requireStaffAuth
   - Verifies old password
   - Hashes new password
   - Updates password and sets `forcePasswordChange = false`
   - Revokes all other sessions (except current)
   - Logs audit action: 'change_password' for 'staff'
   - Returns success

5. **POST /api/admin/auth/forgot-password**
   - Body: `{ email }`
   - Generates reset token (64-char hex)
   - Expiry: 1 hour
   - Stores in `staff_tokens` table with type='reset'
   - TODO: Send email with reset link (currently returns success without email)
   - Returns: `{ status: 'success', message: 'Đã gửi email reset mật khẩu' }`

6. **POST /api/admin/auth/reset-password**
   - Body: `{ token, newPassword }`
   - Validates reset token (not revoked, not expired)
   - Hashes new password
   - Updates password and sets `forcePasswordChange = true`
   - Revokes reset token
   - Revokes all sessions
   - Invalidates permission cache
   - Returns success

#### Super Admin Setup Flow
1. **GET /api/admin/setup/super-admin**
   - Checks if any staff with `is_super_admin = true` exists
   - Returns: `{ exists: boolean }`

2. **POST /api/admin/setup/super-admin**
   - Body: `{ email, password, fullname }`
   - Creates staff with `is_super_admin = true`, `isActive = true`
   - Hashes password
   - Returns success
   - Frontend reloads after success

3. **POST /api/admin/setup/seed-roles**
   - Seeds default roles and permissions from `server/lib/rbac-seed.ts`
   - Creates permissions if not exist
   - Creates roles (staff, manager, admin) if not exist
   - Assigns permissions to roles
   - Returns success

#### Registration Flow
1. **POST /api/register**
   - Body: `{ name, email, password, gender, dob, phone }`
   - Validates email uniqueness
   - Hashes password with bcrypt (salt rounds: 10)
   - Creates user record first (due to FK constraint)
   - Creates account record with user_id
   - Sends welcome email via mail queue
   - Returns: `{ user, emailSent: true }`

#### Password Reset Flow
1. **POST /api/forget-password**
   - Body: `{ email }`
   - Finds account by email
   - Generates reset token
   - Stores in `tokens` table with type='reset'
   - Sends reset email with dynamic URL (supports preview domains)
   - Returns success

2. **POST /api/reset-password**
   - Body: `{ token, newPassword, confirmPassword }`
   - Validates token
   - Hashes new password
   - Updates account password
   - Deletes reset token
   - Returns success

#### Logout Flow
1. **POST /api/logout**
   - Reads session token from cookie or Authorization header
   - Deletes token from `tokens` table
   - Clears cookie: `session_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
   - Returns success

### Session Validation Middleware

**File**: `worker/src/middleware.ts`

#### requireAuth (User Sessions)
```typescript
export async function requireAuth(c: Context, next: any)
```

- Extracts token from:
  - Cookie: `session_token=([^;]+)`
  - Authorization header: `Bearer <token>`
- Validates token against `tokens` table
- Checks expiry
- Sets `userId` and `accountId` in context
- Returns 401 if invalid

#### requireStaffAuth (Staff Sessions)
```typescript
export async function requireStaffAuth(c: Context, next: any)
```

- Extracts token from:
  - Cookie: `staff_session=([^;]+)`
  - Authorization header: `Bearer <token>`
- Validates token against `staff_tokens` table
- Checks:
  - Token not revoked (`revoked_at IS NULL`)
  - Token not expired (`expired_at > NOW`)
  - Staff is active (`isActive = true`)
- Loads permissions and branchIds:
  - First checks KV cache with key `staff_perms:{staffId}` (TTL 300s)
  - If cache miss, loads from DB:
    - `staff_roles` → `role_permissions` → `permissions`
    - `staff_branches` → `branches`
  - Sets cache if super admin (all permissions, all branches)
- Sets context keys:
  - `staffId` - Staff ID
  - `staff` - Staff record
  - `staffPermissions` - Array of `{ module, action }`
  - `staffBranchIds` - Array of branch IDs
  - `isSuperAdmin` - Boolean
- Returns 401 if invalid

#### requirePermission (Permission Checking)
```typescript
export function requirePermission(module: string, action: string)
```

- Factory function that creates middleware for specific permissions
- Checks if staff has the required permission:
  - If `isSuperAdmin = true`, bypasses all checks
  - Otherwise, checks if `{ module, action }` exists in `staffPermissions`
- Returns 403 if permission denied
- Returns 401 if not authenticated

### Differences: User Auth vs Staff Auth (RBAC)

| Aspect | User Auth | Staff Auth (RBAC) |
|--------|-----------|------------------|
| Endpoint | `/api/login` | `/api/admin/auth/login` |
| Session Expiry | 30 days | 1 day |
| Cookie Name | `session_token` | `staff_session` |
| Cookie Max-Age | 2592000s | 86400s |
| Token Table | `tokens` | `staff_tokens` |
| 2FA Support | Yes (configurable) | No (not implemented) |
| Middleware | `requireAuth` | `requireStaffAuth` |
| Permission Check | No | Yes (via `requirePermission`) |
| Branch Filtering | No | Yes (via `staff_branches`) |
| Audit Logging | No | Yes (via `audit_logs`) |
| Force Password Change | No | Yes (via `forcePasswordChange`) |
| KV Cache | No | Yes (permissions cached) |

### Token Types

1. **session**: Long-lived authentication token
2. **otp**: Short-lived one-time password (default 5 min expiry)
3. **reset**: Password reset token (expiry configurable)

### Security Features

- HTTP-only cookies prevent XSS
- Secure flag in production
- SameSite=Lax prevents CSRF
- Password hashing with bcrypt (10 rounds)
- OTP rate limiting (configurable cooldown)
- Session token validation on every protected request

---

## 5. RBAC / PHÂN QUYỀN HIỆN TẠI

### Current Status: **ĐÃ IMPLEMENT ĐẦY ĐỦ**

#### Database Schema

**Table: staffs**
- `id` (INTEGER, PK, AUTOINCREMENT)
- `email` (TEXT, NOT NULL, UNIQUE)
- `password` (TEXT, NOT NULL)
- `fullname` (TEXT, NOT NULL)
- `phone` (TEXT)
- `avatar` (TEXT)
- `is_super_admin` (INTEGER, DEFAULT 0)
- `is_active` (INTEGER, DEFAULT 1)
- `force_password_change` (INTEGER, DEFAULT 0)
- `last_login_at` (TEXT)
- `created_at` (TEXT, NOT NULL)
- `updated_at` (TEXT, NOT NULL)
- `deleted_at` (TEXT) - Soft delete timestamp
- `deleted_by_staff_id` (INTEGER, FK → staffs.id, ON DELETE SET NULL) - Who deleted the record (self-reference)

**Table: staff_tokens**
- `id` (INTEGER, PK, AUTOINCREMENT)
- `staff_id` (INTEGER, FK → staffs.id, ON DELETE CASCADE)
- `token` (TEXT, NOT NULL, UNIQUE)
- `type` (TEXT, DEFAULT 'session') - 'session' or 'reset'
- `expired_at` (TEXT, NOT NULL)
- `revoked_at` (TEXT)
- `revoke_reason` (TEXT) - 'logout', 'password_change', 'password_reset'
- `created_at` (TEXT, NOT NULL)

**Table: roles**
- `id` (INTEGER, PK, AUTOINCREMENT)
- `name` (TEXT, NOT NULL, UNIQUE)
- `description` (TEXT)
- `is_system` (INTEGER, DEFAULT 0) - System roles cannot be deleted/modified
- `level` (INTEGER, DEFAULT 0) - Role hierarchy level
- `created_at` (TEXT, NOT NULL)
- `updated_at` (TEXT, NOT NULL)
- `deleted_at` (TEXT) - Soft delete timestamp
- `deleted_by_staff_id` (INTEGER, FK → staffs.id, ON DELETE SET NULL) - Who deleted the record

**Table: permissions**
- `id` (INTEGER, PK, AUTOINCREMENT)
- `module` (TEXT, NOT NULL) - Module name (e.g., 'staff', 'roles', 'movies')
- `action` (TEXT, NOT NULL) - Action name (e.g., 'view', 'create', 'edit', 'delete')
- `description` (TEXT) - Human-readable description

**Table: role_permissions**
- `role_id` (INTEGER, FK → roles.id, ON DELETE CASCADE)
- `permission_id` (INTEGER, FK → permissions.id, ON DELETE CASCADE)
- PRIMARY KEY (role_id, permission_id)

**Table: staff_roles**
- `staff_id` (INTEGER, FK → staffs.id, ON DELETE CASCADE)
- `role_id` (INTEGER, FK → roles.id, ON DELETE CASCADE)
- PRIMARY KEY (staff_id, role_id)

**Table: staff_branches**
- `staff_id` (INTEGER, FK → staffs.id, ON DELETE CASCADE)
- `branch_id` (INTEGER, FK → branches.id, ON DELETE CASCADE)
- PRIMARY KEY (staff_id, branch_id)

**Table: audit_logs**
- `id` (INTEGER, PK, AUTOINCREMENT)
- `staff_id` (INTEGER, FK → staffs.id, ON DELETE SET NULL)
- `staff_email` (TEXT) - Denormalized for filtering
- `staff_fullname` (TEXT) - Denormalized for filtering
- `action` (TEXT, NOT NULL) - 'login', 'create', 'update', 'delete', 'reset_password', etc.
- `entity_type` (TEXT, NOT NULL) - 'staff', 'role', 'movie', etc.
- `entity_id` (INTEGER)
- `old_values` (TEXT) - JSON string of old values
- `new_values` (TEXT) - JSON string of new values
- `ip_address` (TEXT)
- `user_agent` (TEXT)
- `created_at` (TEXT, NOT NULL)

#### Permission System

**File**: `server/lib/rbac-seed.ts`

**Default Permissions** (from PERMISSIONS_SEED):

| Module | Action | Description |
|--------|--------|-------------|
| staff | view | Xem danh sách nhân viên |
| staff | create | Tạo nhân viên mới |
| staff | edit | Chỉnh sửa thông tin nhân viên |
| staff | delete | Xóa nhân viên |
| staff | restore | Khôi phục nhân viên đã xóa |
| staff | view_deleted | Xem danh sách nhân viên đã xóa |
| staff | reset_password | Đặt lại mật khẩu nhân viên |
| roles | view | Xem danh sách vai trò |
| roles | create | Tạo vai trò mới |
| roles | edit | Chỉnh sửa vai trò |
| roles | delete | Xóa vai trò |
| roles | restore | Khôi phục vai trò đã xóa |
| roles | view_deleted | Xem danh sách vai trò đã xóa |
| dashboard | view | Xem dashboard |
| dashboard | view_revenue | Xem doanh thu |
| users | view | Xem danh sách người dùng |
| users | view_detail | Xem chi tiết người dùng |
| movies | view | Xem danh sách phim |
| movies | create | Tạo phim mới |
| movies | edit | Chỉnh sửa phim |
| movies | delete | Xóa phim |
| movies | restore | Khôi phục phim đã xóa |
| movies | view_deleted | Xem danh sách phim đã xóa |
| toys | view | Xem danh sách đồ chơi |
| toys | create | Tạo đồ chơi mới |
| toys | edit | Chỉnh sửa đồ chơi |
| toys | delete | Xóa đồ chơi |
| tickets | view | Xem danh sách vé/gói |
| tickets | create | Tạo gói vé mới |
| tickets | edit | Chỉnh sửa gói vé |
| tickets | delete | Xóa gói vé |
| tickets | restore | Khôi phục gói vé đã xóa |
| tickets | view_deleted | Xem danh sách gói vé đã xóa |
| branches | view | Xem danh sách chi nhánh |
| branches | create | Tạo chi nhánh mới |
| branches | edit | Chỉnh sửa chi nhánh |
| branches | delete | Xóa chi nhánh |
| branches | restore | Khôi phục chi nhánh đã xóa |
| branches | view_deleted | Xem danh sách chi nhánh đã xóa |
| uploads | upload | Upload file |
| uploads | delete | Xóa file |
| email_logs | view | Xem lịch sử email |
| audit_logs | view | Xem nhật ký hoạt động |
| settings | view | Xem cài đặt |
| settings | manage | Quản lý cài đặt |
| transactions | view | Xem giao dịch |

**Default Roles** (from ROLES_SEED):

**Role: staff** (Level: 0)
- Description: Nhân viên cơ bản
- Permissions:
  - dashboard: view
  - tickets: view, create
  - branches: view

**Role: manager** (Level: 1)
- Description: Quản lý chi nhánh
- Permissions:
  - All staff permissions
  - movies: view, create, edit
  - toys: view, create, edit
  - tickets: view, create, edit, delete
  - branches: view, create, edit
  - users: view, view_detail
  - transactions: view
  - email_logs: view

**Role: admin** (Level: 2)
- Description: Quản trị viên hệ thống
- Permissions:
  - All manager permissions
  - staff: view, create, edit, delete, reset_password
  - roles: view, create, edit, delete
  - movies: view, create, edit, delete
  - toys: view, create, edit, delete
  - branches: view, create, edit, delete
  - uploads: upload, delete
  - audit_logs: view
  - settings: view, manage
  - dashboard: view_revenue

**Super Admin** (Level: 99)
- Has `is_super_admin = true` in staffs table
- Bypasses all permission checks
- Has access to all branches
- Can modify system roles (is_system = true)

#### Role Hierarchy

- **staff (0)**: Basic staff with limited permissions
- **manager (1)**: Branch manager with more permissions
- **admin (2)**: System administrator with most permissions
- **super_admin (99)**: Super admin with all permissions and bypass capability

#### KV Cache for Permissions

**File**: `server/lib/staff-auth.ts`

**Cache Key**: `staff_perms:{staffId}`
**TTL**: 300 seconds (5 minutes)

**Cache Structure**:
```json
{
  "permissions": [
    { "module": "staff", "action": "view" },
    { "module": "movies", "action": "create" }
  ],
  "branchIds": [1, 2, 3],
  "isSuperAdmin": false
}
```

**Cache Invalidation**:
- Called when staff roles are updated
- Called when staff branches are updated
- Called when password is reset
- Function: `invalidateStaffPermissionCache(kv, staffId)`

#### Branch Filtering

**File**: `server/lib/branch-guard.ts`

**Functions**:
- `applyBranchFilter(query, branchIds, branchColumn)` - Adds WHERE clause to Drizzle query
- `filterByBranch(items, branchIds, branchIdField)` - Filters array of items
- `hasBranchAccess(staffBranchIds, branchId)` - Checks if staff has access to branch
- `getAllBranchIdsForSuperAdmin(db, tables)` - Returns all branch IDs for super admin

**Usage**:
- Non-super admin staff only see data from assigned branches
- Super admin sees data from all branches
- Applied to movies, ticket_packages, bookings queries

#### Middleware

**File**: `worker/src/middleware.ts`

**requireAuth**: Validates user session tokens
- Extracts token from cookie or Authorization header
- Validates against `tokens` table
- Sets `userId` and `accountId` in context
- Returns 401 if invalid

**requireStaffAuth**: Validates staff session tokens
- Extracts token from cookie or Authorization header
- Validates against `staff_tokens` table
- Loads staff permissions from `staff_roles` → `role_permissions` → `permissions`
- Loads staff branch assignments from `staff_branches`
- Sets `staffId`, `staff`, `permissions`, `branchIds` in context
- Returns 401 if invalid

**requirePermission(module, action)**: Permission checking middleware
- Factory function that creates middleware for specific permissions
- Checks if staff has the required permission
- Super admins bypass all permission checks
- Returns 403 if permission denied

#### Frontend RBAC System

**File**: `client/store/staffStore.ts`

**Staff Interface**:
```typescript
interface Staff {
  id: number;
  email: string;
  fullname: string;
  phone?: string;
  avatar?: string;
  isSuperAdmin: boolean;
  forcePasswordChange: boolean;
  lastLoginAt?: string;
}
```

**StaffState Interface**:
```typescript
interface StaffState {
  staff: Staff | null;
  permissions: Array<{ module: string; action: string }>;
  branchIds: number[];
  token: string | null;
  isAuthenticated: boolean;
  setStaff: (staff: Staff, permissions: Array<{ module: string; action: string }>, branchIds: number[], token: string) => void;
  clearStaff: () => void;
  hasPermission: (module: string, action: string) => boolean;
}
```

**Methods**:
- `setStaff(staff, permissions, branchIds, token)`: Sets staff data in store
- `clearStaff()`: Clears staff data from store
- `hasPermission(module, action)`: Checks if staff has permission (super admin bypass)
- **Persistence**: Uses Zustand persist middleware with key 'staff-storage'

**File**: `client/hooks/useStaffPermission.ts`

**Hooks**:
- `useStaffPermission(module, action)`: Returns boolean if staff has permission
- `useIsSuperAdmin()`: Returns boolean if staff is super admin
- `useStaffPermissions()`: Returns array of staff permissions
- `useStaffBranchIds()`: Returns array of staff's branch IDs

**File**: `client/admin/auth/AdminGate.tsx`

**AdminGate Component**:
- Checks if super admin setup is needed (GET /api/admin/setup/super-admin)
- If setup needed, shows SetupSuperAdmin page
- If staff authenticated, shows admin routes wrapped in AdminLayout
- If not authenticated, shows login page
- Checks `forcePasswordChange` flag and redirects to settings if true
- Routes: /, /users, /movies, /toys, /posts, /transactions, /tickets, /ticket-check, /branches, /uploads, /email-logs, /settings, /staff, /roles, /audit-logs

**SetupSuperAdmin Page** (`client/pages/admin/SetupSuperAdmin.tsx`):
- Default credentials: superadmin@cinesphere.com / superadmin123 / Super Admin
- POST to /api/admin/setup/super-admin
- Reloads after success

#### Admin Pages with RBAC

**Staff Management** (`client/pages/admin/Staff.tsx`):
- **API Calls**:
  - GET /api/admin/staff (requirePermission: staff, view)
  - POST /api/admin/staff (requirePermission: staff, create)
  - PUT /api/admin/staff/:id (requirePermission: staff, edit)
  - DELETE /api/admin/staff/:id (requirePermission: staff, delete)
  - POST /api/admin/staff/:id/reset-password (requirePermission: staff, reset_password)
- **Features**:
  - List staff with pagination
  - Filters: search (email/name), role, branch
  - Create staff with auto-generated password (12 chars)
  - Edit staff: email, fullname, phone, role, branches, forcePasswordChange, isActive
  - Delete staff (soft delete by setting isActive = false)
  - Reset password (generates new password, sets forcePasswordChange = true)
  - Cannot modify/delete super admin
  - Sends welcome email with password on creation
- **Permission-based UI**:
  - "Create staff" button: requires staff, create
  - "Edit" button: requires staff, edit
  - "Delete" button: requires staff, delete (hidden for super admin)
  - "Reset password" button: requires staff, reset_password
- **TODO**: None currently visible

**Roles Management** (`client/pages/admin/Roles.tsx`):
- **API Calls**:
  - GET /api/admin/roles (requirePermission: roles, view)
  - GET /api/admin/roles/:id (requirePermission: roles, view)
  - POST /api/admin/roles (requirePermission: roles, create)
  - PUT /api/admin/roles/:id (requirePermission: roles, edit)
  - DELETE /api/admin/roles/:id (requirePermission: roles, delete)
  - GET /api/admin/permissions (requirePermission: roles, view)
  - POST /api/admin/setup/seed-roles (seed default roles)
- **Features**:
  - Side panel: role list with level and staff count
  - Main panel: permission matrix (modules x actions)
  - Create role: name, description, level
  - Edit role: name, description, permissions
  - Delete role: only if not assigned to any staff
  - Cannot modify/delete system roles (is_system = true)
  - Super admin can modify system roles
  - Seed default roles button
- **Permission Matrix**:
  - Modules: staff, roles, dashboard, users, movies, toys, tickets, branches, uploads, email_logs, audit_logs, settings, transactions
  - Actions: view, create, edit, delete, view_detail, view_revenue, manage, upload, reset_password
  - Applicable actions per module defined in APPLICABLE_ACTIONS constant
- **TODO**: None currently visible

**Audit Logs** (`client/pages/admin/AuditLogs.tsx`):
- **API Calls**:
  - GET /api/admin/audit-logs (requirePermission: audit_logs, view)
  - GET /api/admin/staff (for staff filter dropdown)
- **Features**:
  - List audit logs with pagination
  - Filters: search (staff name/action), staff, action, entity type, date range
  - Detail dialog with diff view (old values vs new values)
  - Action labels: login, create, update, delete, force_logout, reset_password
  - Entity labels: staff, movie, booking, role, ticket_package
  - Ignores auto-generated fields (id, created_at, updated_at) in diff view
- **TODO**: None currently visible

#### Admin UI Components

**Admin Components** (`client/components/admin/`):
- **AdminEditModal.tsx** - Generic edit modal for movies, toys, users
- **content/DashboardContent.tsx** - Dashboard metrics and charts
- **content/MoviesContent.tsx** - Movies table
- **content/TicketsContent.tsx** - Tickets table
- **content/ToysContent.tsx** - Toys table
- **content/TransactionsContent.tsx** - Transactions table
- **content/UsersContent.tsx** - Users table
- **content/PostManagement.tsx** - Posts table
- **content/PostRichTextEditor.tsx** - CKEditor integration
- **content/EmailLogsContent.tsx** - Email logs table
- **content/UploadsContent.tsx** - Uploads management
- **content/TicketCheckContent.tsx** - Ticket check UI
- **content/AIAnalyticsPanel.tsx** - AI analytics chat interface

#### Routing Structure

**File**: `client/App.tsx`

**Routes**:
- `/*` → AdminGate (catch-all for admin routes)

**AdminGate Routes** (`client/admin/auth/AdminGate.tsx`):
- `/` → Dashboard
- `/users` → Users
- `/movies` → Movies
- `/toys` → Toys
- `/posts` → Posts
- `/transactions` → Transactions
- `/tickets` → Tickets
- `/ticket-check` → TicketCheck
- `/uploads` → Uploads
- `/email-logs` → EmailLogs
- `/settings` → Settings
- `/branches` → Branches
- `/staff` → Staff
- `/roles` → Roles
- `/audit-logs` → AuditLogs
- `/posts/:id/edit` → PostEdit

#### Những gì còn thiếu (Updated)

1. **Permission-based UI rendering**:
   - Status: **PARTIALLY COMPLETED**. 
   - Implemented in: Staff management, Roles management.
   - Remaining: Consistently apply to other minor modules (Toys, Posts).

2. **Audit logging**:
   - Status: **COMPLETED**.
   - Implemented in: Auth, Staff management, Roles management, Movie management.

3. **Staff-Branch assignment UI**:
   - Status: **COMPLETED**. 
   - Implemented in: `Staff.tsx`.

---

## 6. BRANCH (CHI NHÁNH) HIỆN TẠI

### Database Schema

**Table**: `branches`
- `id` (INTEGER, PK, AUTOINCREMENT)
- `name` (TEXT, NOT NULL)
- `code` (TEXT, UNIQUE, NOT NULL)
- `address` (TEXT)
- `phone` (TEXT)
- `email` (TEXT)
- `is_default` (BOOLEAN, DEFAULT false)
- `is_active` (BOOLEAN, DEFAULT true)
- `created_at` (TEXT, NOT NULL)
- `updated_at` (TEXT, NOT NULL)

**Foreign Key Relationships**:
- `movies.branch_id` → `branches.id` (ON DELETE RESTRICT)
- `ticket_packages.branch_id` → `branches.id` (ON DELETE RESTRICT)
- `bookings.branch_id` → `branches.id` (ON DELETE RESTRICT)

### API Endpoints

#### Public Endpoints
- **GET /api/branches** - List all active branches (for dropdown)
- **GET /api/branches/default** - Get default branch

#### Admin Endpoints
- **GET /api/admin/branches** - List branches with pagination and stats
  - Query: `page`, `pageSize`, `q`, `includeInactive`
  - Returns: movie_count, package_count, booking_count per branch
- **GET /api/admin/branches/:id** - Get branch by ID
- **POST /api/admin/branches** - Create branch
- **PUT /api/admin/branches/:id** - Update branch
- **DELETE /api/admin/branches/:id** - Delete branch (with validation)

### Frontend Implementation

#### Admin Panel (React)
- **File**: `client/pages/admin/Branches.tsx`
- **Features**:
  - List branches with stats
  - Create/Edit/Delete branches
  - Set default branch
  - Activate/Deactivate branches

#### User Client (Next.js)
- **Hook**: `next-client/src/hooks/useBranch.ts`
- **API**: `next-client/src/lib/api/branches.ts`
- **Features**:
  - Branch selection dropdown
  - Filter movies by branch
  - Filter ticket packages by branch
  - Store selected branch in localStorage

### Branch Logic

#### Default Branch
- Only one branch can have `is_default = true`
- When setting a new default, old default is unset
- Used as fallback when no branch selected

#### Branch Validation
- Cannot delete default branch
- Cannot delete branch with active movies
- Cannot delete branch with active ticket packages
- Cannot delete branch with booking history

#### Branch Filtering
- Movies filtered by `branch_id`
- Ticket packages filtered by `branch_id`
- Bookings associated with `branch_id`

### Những gì còn thiếu

1. **Staff-Branch Assignment UI**:
   - Đã có bảng `staff_branches` trong database
   - Middleware `requireStaffAuth` đã load branchIds vào context
   - Frontend hook `useStaffBranchIds()` đã có
   - **CHƯA CÓ UI** để gán branches cho staff trong admin panel

2. **Branch-Specific Settings**:
   - Chưa có branch-level settings (giờ mở cửa, số lượng ghế, v.v.)
   - Chưa có branch-specific pricing

3. **Branch Transfer**:
   - Chưa có chức năng chuyển booking giữa branches
   - Chưa có chức năng chuyển ticket packages giữa branches

---

## 7. SEO HIỆN TẠI

### Implementation Status: **ĐÃ IMPLEMENT ĐẦY ĐỦ**

### Next.js Metadata API

**File**: `next-client/src/app/layout.tsx`

```typescript
export const metadata: Metadata = {
  title: {
    default: 'Cinesphere | Trải Nghiệm Điện Ảnh Đỉnh Cao',
    template: '%s | Cinesphere',
  },
  description: 'Đặt vé xem phim trực tuyến tại Cinesphere...',
  metadataBase: new URL(SITE_URL),
  icons: {
    icon: '/icon.svg',
    apple: '/logo.svg',
  },
  keywords: ['đặt vé xem phim', 'rạp chiếu phim', 'cinesphere', ...],
  alternates: { canonical: '/' },
  openGraph: { ... },
  twitter: { ... },
  robots: { ... },
}
```

### Open Graph & Twitter Card

**Open Graph**:
- siteName: 'Cinesphere'
- type: 'website'
- locale: 'vi_VN'
- url: SITE_URL
- images: [{ url: '/og-default.jpg', width: 1200, height: 630, alt: '...' }]

**Twitter Card**:
- card: 'summary_large_image'
- title, description, images

### Structured Data / JSON-LD

**File**: `next-client/src/app/layout.tsx`

**Organization Schema**:
```json
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Cinesphere",
  "url": SITE_URL,
  "logo": "${SITE_URL}/logo.svg",
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+84-036-643-1179",
    "contactType": "customer service",
    "availableLanguage": "Vietnamese"
  }
}
```

**WebSite Schema**:
```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Cinesphere",
  "url": SITE_URL,
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "${SITE_URL}/bai-viet?q={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
}
```

### Sitemap

**Next.js Sitemap**: `next-client/src/app/sitemap.ts`
- Runtime: edge
- Static pages: home, blog listing, booking
- Dynamic pages: blog posts (from database)
- Priority: home (1.0), blog (0.9), booking (0.8), posts (0.7-0.85)
- Change frequency: daily, weekly, monthly

**Worker Sitemap**: `worker/src/index.ts` (GET /sitemap.xml)
- Fallback sitemap for non-Next.js routes
- Includes posts from database
- XML format with proper namespaces

### Robots.txt

**File**: `public/robots.txt` (and `next-client/public/robots.txt`)

```
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

User-agent: Twitterbot
Allow: /

User-agent: facebookexternalhit
Allow: /

User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/

Sitemap: https://cinesphere.com.vn/sitemap.xml
```

### IndexNow Integration

**File**: `worker/src/utils.ts`

- Function: `pingIndexNow(env, urls)`
- Automatically pings search engines when:
  - New post published
  - Post updated to published status
- Key: `INDEXNOW_KEY` in wrangler.toml

### Blog Post SEO

**File**: `server/routes/admin/posts.ts`

**Posts Table SEO Fields**:
- `seo_title` - Custom SEO title
- `meta_description` - Meta description
- `meta_keywords` - Meta keywords
- `og_image` - Open Graph image
- `canonical_url` - Canonical URL
- `schema_type` - Schema.org type (default: 'Article')

### Robots Meta

**File**: `next-client/src/app/layout.tsx`

```typescript
robots: {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    'max-video-preview': -1,
    'max-image-preview': 'large',
    'max-snippet': -1,
  },
}
```

### File Locations

- **Next.js Layout**: `next-client/src/app/layout.tsx`
- **Next.js Sitemap**: `next-client/src/app/sitemap.ts`
- **Worker Sitemap**: `worker/src/index.ts` (GET /sitemap.xml)
- **Robots.txt**: `public/robots.txt`, `next-client/public/robots.txt`
- **Post SEO**: `server/routes/admin/posts.ts`

---

## 7.5 DATABASE MIGRATIONS

### Migration Files

**Location**: `worker/migrations/`

#### 0001_initial_schema.sql
- Creates initial database schema for all core tables:
  - `users` - User profile information
  - `accounts` - User authentication accounts
  - `tokens` - Session and OTP tokens
  - `branches` - Cinema branch locations
  - `movies` - Movie information
  - `ticket_packages` - Ticket/package pricing
  - `bookings` - Booking/transaction records
  - `toys` - Merchandise/toys inventory
  - `email_logs` - Email sending logs
  - `site_media` - Site media management
  - `posts` - Blog posts
  - `staffs` - Staff accounts
  - `staff_tokens` - Staff session tokens
  - `roles` - Role definitions
  - `permissions` - Permission definitions
  - `role_permissions` - Role-permission junction table
  - `staff_roles` - Staff-role junction table
  - `staff_branches` - Staff-branch junction table
  - `audit_logs` - Audit logging

#### 0002_seed_rbac.sql
- Seeds default permissions into `permissions` table:
  - 50+ permissions across modules: dashboard, movies, tickets, toys, transactions, branches, posts, users, staff, roles, settings, email_logs, uploads, ticket_check, audit
  - Each permission has module, action, and description (Vietnamese)
- Seeds default roles into `roles` table:
  - `staff` (Level 0) - Basic staff with limited permissions
  - `manager` (Level 1) - Branch manager with more permissions
  - `admin` (Level 2) - System administrator with most permissions
- Assigns permissions to roles via `role_permissions` table:
  - Staff: dashboard:view, transactions:view, ticket_check:scan/validate/history
  - Manager: All staff permissions + movies/tickets/toys/posts/users management
  - Admin: All manager permissions + staff/roles/branches management + audit logs

#### 0003_add_soft_delete_columns.sql
- Adds `deleted_at` columns for soft delete functionality:
  - `movies.deleted_at`
  - `ticket_packages.deleted_at`
  - `toys.deleted_at`
  - `site_media.deleted_at`
  - `branches.deleted_at`
  - `roles.deleted_at`
  - `staffs.deleted_at`
- Adds `confirmed_by_staff_id` column to `bookings` for tracking who confirmed the booking
- Creates indexes for deleted_at columns to optimize queries:
  - `idx_movies_deleted_at`
  - `idx_ticket_packages_deleted_at`
  - `idx_toys_deleted_at`
  - `idx_site_media_deleted_at`
  - `idx_branches_deleted_at`
  - `idx_roles_deleted_at`
  - `idx_staffs_deleted_at`
  - `idx_bookings_confirmed_by_staff_id`

#### 0004_add_deleted_by_staff_id.sql
- Adds `deleted_by_staff_id` columns to track who deleted records:
  - `movies.deleted_by_staff_id` → references staffs(id)
  - `ticket_packages.deleted_by_staff_id` → references staffs(id)
  - `branches.deleted_by_staff_id` → references staffs(id)
  - `staffs.deleted_by_staff_id` → references staffs(id) (self-reference)
  - `roles.deleted_by_staff_id` → references staffs(id)
- All foreign keys have ON DELETE SET NULL to preserve audit trail

### Database Status

**Local Database**:
- Path: `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/`
- Status: Active for local development
- Migrations: Should be run using `npx wrangler d1 migrations apply cinema_db --local`

**Production Database**:
- Binding: `cinema_db` in Cloudflare Workers
- Status: Active in production
- Migrations: Deployed via GitHub Actions workflow

---

## 8. API ENDPOINTS

### Public Endpoints (User)

#### Authentication
- **POST /api/login** - User login with session
- **POST /api/register** - User registration
- **POST /api/validate-otp** - Validate 2FA OTP
- **POST /api/resend-otp** - Resend OTP
- **POST /api/forget-password** - Request password reset
- **POST /api/reset-password** - Confirm password reset
- **POST /api/logout** - Logout

#### Movies
- **GET /api/getActiveMovies** - Get active movies for today (cached, rate-limited)
- **GET /api/movies** - List movies with pagination
  - Query: `page`, `pageSize`, `q`, `sort`, `dir`, `status`, `branch_id`
- **GET /api/movies/:id** - Get movie by ID
- **GET /api/movies-detail/:id** - Get movie details with packages

#### Ticket Packages
- **GET /api/tickets-active** - Get active ticket packages (cached)
- **GET /api/tickets** - List ticket packages (admin use)
- **GET /api/tickets/:id** - Get ticket package by ID

#### Toys
- **GET /api/toys-active** - Get active toys
- **GET /api/toys** - List toys (admin use)
- **GET /api/toys/:id** - Get toy by ID

#### Bookings
- **POST /api/validate-booking** - Validate booking before payment
- **POST /api/create-booking** - Create booking record
- **POST /api/confirm-booking** - Confirm booking after payment
- **GET /api/bookings/:id** - Get booking by ID
- **GET /api/bookings-code/:code** - Get booking by code (**KV Rate-limited**)
- **POST /api/bookings-use** - Confirm ticket usage

#### Payments
- **POST /api/momo/create-payment** - Create MoMo payment
- **POST /api/momo/ipn** - MoMo IPN webhook
- **POST /api/vnpay/create-payment** - Create VNPay payment
- **POST /api/vnpay/ipn** - VNPay IPN webhook

#### Branches
- **GET /api/branches** - List active branches
- **GET /api/branches/default** - Get default branch

#### Posts (Blog)
- **GET /api/posts** - List published posts
- **GET /api/posts/:identifier** - Get post by ID or slug

#### Site Media
- **GET /api/site-media** - Get site media (cached)
  - Query: `section`, `type`, `active`

#### Sitemap
- **GET /sitemap.xml** - XML sitemap

#### Debug
- **GET /api/ping** - Health check
- **GET /api/demo** - Demo endpoint

### Protected User Endpoints (Require Auth)

Middleware: `requireAuth`

- **GET /api/users-profile** - Get user profile by email
- **POST /api/users-profile** - Update user profile
- **POST /api/users-password** - Change password
- **GET /api/usersprofile/transactions** - Get user transaction history

### Admin Endpoints

#### Authentication
- **POST /api/admin/auth/login** - Admin login (1-day session)
- **POST /api/admin/login** - **DEPRECATED** (410 Gone)

#### Dashboard
- **GET /api/admin/dashboard/metrics** - Get dashboard metrics
  - Query: `period`, `year`
- **GET /api/admin/dashboard/revenue-date** - Get revenue by date
  - Query: `date`, `status`, `year`
- **GET /api/admin/dashboard/revenue-7days** - Get revenue last 7 days
  - Query: `year`
- **GET /api/admin/dashboard/revenue-month** - Get monthly revenue
  - Query: `year`, `month`, `status`

#### Revenue & Transactions
- **GET /api/admin/revenue** - Get revenue summary
  - Query: `from`, `to`, `status`
- **GET /api/admin/transactions** - List transactions
  - Query: `page`, `pageSize`, `searchText`, `status`, `sort`, `dir`, `payment_method`, `from`, `to`
- **GET /api/admin/transactions/:id** - Get transaction by ID

#### Users
- **GET /api/admin/users** - List users
  - Query: `page`, `pageSize`, `q`
- **GET /api/admin/users/:id** - Get user by ID

#### Movies
- **POST /api/movies** - Create movie (**requirePermission: movies, create**)
- **PUT /api/movies/:id** - Update movie (**requirePermission: movies, edit**)
- **DELETE /api/movies/:id** - Delete movie (soft delete) (**requirePermission: movies, delete**)
- **POST /api/movies-status/:id** - Update movie status (**requirePermission: movies, toggle_status**)
- **POST /api/admin/movies/:id/restore** - Restore deleted movie (**requirePermission: movies, restore**)
- **GET /api/admin/deleted/movies** - List deleted movies (**requirePermission: movies, view_deleted**)

#### Ticket Packages
- **POST /api/tickets** - Create ticket package
- **PUT /api/tickets/:id** - Update ticket package
- **DELETE /api/tickets/:id** - Delete ticket package (soft delete)
- **POST /api/admin/tickets/:id/restore** - Restore deleted ticket package (**requirePermission: tickets, restore**)
- **GET /api/admin/deleted/tickets** - List deleted ticket packages (**requirePermission: tickets, view_deleted**)

#### Toys
- **POST /api/toys** - Create toy (**requirePermission: toys, create**)
- **PUT /api/toys/:id** - Update toy (**requirePermission: toys, edit**)
- **DELETE /api/toys/:id** - Delete toy (**requirePermission: toys, delete**)

#### Posts (Blog)
- **GET /api/admin/posts** - List all posts (admin)
  - Query: `page`, `pageSize`, `q`, `status`
- **GET /api/admin/posts/:id** - Get post by ID (admin)
- **POST /api/posts** - Create post (**requirePermission: posts, create**)
- **PUT /api/posts/:id** - Update post (**requirePermission: posts, edit**)
- **DELETE /api/posts/:id** - Delete post (**requirePermission: posts, delete**)

#### Branches
- **GET /api/admin/branches** - List branches with stats
  - Query: `page`, `pageSize`, `q`, `includeInactive`
- **GET /api/admin/branches/:id** - Get branch by ID
- **POST /api/admin/branches** - Create branch
- **PUT /api/admin/branches/:id** - Update branch
- **DELETE /api/admin/branches/:id** - Delete branch (soft delete)
- **POST /api/admin/branches/:id/restore** - Restore deleted branch (**requirePermission: branches, restore**)
- **GET /api/admin/deleted/branches** - List deleted branches (**requirePermission: branches, view_deleted**)

#### Site Media
- **POST /api/admin/site-media** - Create site media
- **PUT /api/admin/site-media** - Update site media
- **DELETE /api/admin/site-media/:id** - Delete site media

#### Uploads
- **POST /api/admin/uploads/video** - Upload video to Cloudinary/R2

#### Cloudinary
- **POST /api/admin/cloudinary/sign** - Generate Cloudinary signature (**Hardened: size/type limits**)

#### Settings
- **GET /api/admin/settings** - Get admin settings (from KV)
- **POST /api/admin/settings** - Update admin settings (to KV)

#### Email Logs
- **GET /api/admin/email-logs** - List email logs
  - Query: `status`, `email_type`, `search`, `page`, `limit`

#### Staff Management (RBAC)
- **GET /api/admin/staff** - List staff members
  - Query: `page`, `pageSize`, `q`, `includeInactive`
  - Returns: staff list with roles, branches, roleCount
  - Middleware: requireStaffAuth, requirePermission('staff', 'view')
- **GET /api/admin/staff/:id** - Get staff by ID
  - Returns: staff details with roles and branches
  - Middleware: requireStaffAuth, requirePermission('staff', 'view')
- **POST /api/admin/staff** - Create staff
  - Body: `{ email, password?, fullname, phone?, avatar?, roleIds?, branchIds?, forcePasswordChange? }`
  - Auto-generates password if not provided (12 chars)
  - Sends welcome email with password
  - Middleware: requireStaffAuth, requirePermission('staff', 'create')
- **PUT /api/admin/staff/:id** - Update staff
  - Body: `{ email?, fullname?, phone?, avatar?, isActive?, roleIds?, branchIds?, forcePasswordChange? }`
  - Cannot modify super admin
  - Invalidates permission cache
  - Middleware: requireStaffAuth, requirePermission('staff', 'edit')
- **DELETE /api/admin/staff/:id** - Delete staff (soft delete)
  - Sets deleted_at timestamp
  - Cannot delete super admin
  - Middleware: requireStaffAuth, requirePermission('staff', 'delete')
- **POST /api/admin/staff/:id/restore** - Restore deleted staff
  - Clears deleted_at timestamp
  - Cannot restore super admin
  - Middleware: requireStaffAuth, requirePermission('staff', 'restore')
- **GET /api/admin/deleted/staff** - List deleted staff
  - Query: `page`, `pageSize`, `search`
  - Returns: deleted staff list with roles
  - Middleware: requireStaffAuth, requirePermission('staff', 'view_deleted')
- **POST /api/admin/staff/:id/reset-password** - Reset staff password
  - Body: `{ newPassword }`
  - Generates new password, sets forcePasswordChange = true
  - Revokes all sessions
  - Invalidates permission cache
  - Middleware: requireStaffAuth, requirePermission('staff', 'reset_password')

#### Roles Management (RBAC)
- **GET /api/admin/roles** - List roles
  - Query: `page`, `pageSize`
  - Returns: roles with permissions and staff count
  - Middleware: requireStaffAuth, requirePermission('roles', 'view')
- **GET /api/admin/roles/:id** - Get role by ID
  - Returns: role details with permissions
  - Middleware: requireStaffAuth, requirePermission('roles', 'view')
- **POST /api/admin/roles** - Create role
  - Body: `{ name, description, level, permissionIds }`
  - Middleware: requireStaffAuth, requirePermission('roles', 'create')
- **PUT /api/admin/roles/:id** - Update role
  - Body: `{ name?, description?, level?, permissionIds? }`
  - Cannot modify system roles (is_system = true)
  - Middleware: requireStaffAuth, requirePermission('roles', 'edit')
- **DELETE /api/admin/roles/:id** - Delete role (soft delete)
  - Cannot delete if assigned to any staff
  - Cannot delete system roles
  - Middleware: requireStaffAuth, requirePermission('roles', 'delete')
- **POST /api/admin/roles/:id/restore** - Restore deleted role
  - Cannot restore if assigned to any staff
  - Cannot restore system roles
  - Middleware: requireStaffAuth, requirePermission('roles', 'restore')
- **GET /api/admin/deleted/roles** - List deleted roles
  - Query: `page`, `pageSize`
  - Returns: deleted roles with permissions
  - Middleware: requireStaffAuth, requirePermission('roles', 'view_deleted')
- **GET /api/admin/permissions** - List all permissions
  - Returns: all permissions with module, action, description
  - Middleware: requireStaffAuth, requirePermission('roles', 'view')

#### Audit Logs (RBAC)
- **GET /api/admin/audit-logs** - List audit logs
  - Query: `page`, `pageSize`, `search`, `staffId`, `action`, `module`, `from`, `to`
  - Returns: paginated audit logs with staff info
  - Middleware: requireStaffAuth, requirePermission('audit_logs', 'view')

#### Admin Authentication (RBAC)
- **POST /api/admin/auth/login** - Staff login
  - Body: `{ email, password }`
  - Returns: `{ status, staff, permissions, branchIds, token }`
  - Sets cookie: staff_session
- **POST /api/admin/auth/logout** - Staff logout
  - Soft revokes token
- **GET /api/admin/auth/me** - Get current staff info
  - Returns: staff with permissions and branchIds
  - Middleware: requireStaffAuth
- **POST /api/admin/auth/change-password** - Change staff password
  - Body: `{ oldPassword, newPassword }`
  - Revokes all other sessions
  - Middleware: requireStaffAuth
- **POST /api/admin/auth/forgot-password** - Request password reset
  - Body: `{ email }`
  - TODO: Send email with reset link (currently returns success without email)
- **POST /api/admin/auth/reset-password** - Confirm password reset
  - Body: `{ token, newPassword }`
  - Invalidates permission cache

#### Setup (RBAC)
- **GET /api/admin/setup/super-admin** - Check if super admin exists
  - Returns: `{ exists: boolean }`
- **POST /api/admin/setup/super-admin** - Create super admin
  - Body: `{ email, password, fullname }`
  - Creates staff with is_super_admin = true
- **POST /api/admin/setup/seed-roles** - Seed default roles and permissions
  - Seeds from server/lib/rbac-seed.ts
  - Creates permissions and roles if not exist

#### AI Analytics
- **POST /api/ai-analytics** - AI-powered analytics Q&A
  - Body: `{ query: string }`
  - Uses Cloudflare Workers AI (@cf/meta/llama-3-8b-instruct)
  - Collects business data from database:
    - Overall booking summary
    - Revenue by payment method
    - Top movies
    - Peak booking hours
    - Monthly revenue
    - Top ticket packages
    - Active movies
    - Recent bookings
    - Daily revenue (last 30 days)
    - Top users with failed bookings
  - Returns: JSON with `internal_thought`, `display_type`, `analysis_summary`, `ui_config`, `processed_data`
  - Display types: `dynamic_chart`, `table`, `summary`
  - Response in Vietnamese

#### Webhooks
- **POST /api/sepay/webhook** - SePay webhook handler

#### Static Files (Development)
- **GET /uploads/*/* - Serve local uploads (localhost only)

---

## 9. FRONTEND ARCHITECTURE

### Admin Panel (React + Vite)

#### Pages
**Location**: `client/pages/admin/`

- **AdminIndex.tsx** - Admin dashboard index
- **Dashboard.tsx** - Dashboard with metrics, charts
- **Movies.tsx** - Movie management (CRUD)
- **DeletedMovies.tsx** - Deleted movies management (restore, view deleted)
- **Tickets.tsx** - Ticket package management
- **Toys.tsx** - Toys inventory management
- **Transactions.tsx** - Transaction/booking management
- **Users.tsx** - User management
- **Branches.tsx** - Branch management
- **Posts.tsx** - Blog post management
- **PostEdit.tsx** - Blog post editor (rich text)
- **Uploads.tsx** - Media upload management
- **EmailLogs.tsx** - Email log viewer
- **Settings.tsx** - Admin settings (2FA, OTP config)
- **TicketCheck.tsx** - Ticket validation/check-in
- **Staff.tsx** - Staff management (CRUD, role/branch assignment)
- **DeletedStaff.tsx** - Deleted staff management (restore, view deleted)
- **Roles.tsx** - Role management (permission matrix)
- **RoleDetailPage.tsx** - Role detail page
- **AuditLogs.tsx** - Audit log viewer
- **Profile.tsx** - Staff profile page
- **SetupSuperAdmin.tsx** - Super admin setup page

#### Components
**Location**: `client/components/`

**Admin Components** (`components/admin/`):
- **AdminEditModal.tsx** - Generic edit modal
- **content/DashboardContent.tsx** - Dashboard content
- **content/MoviesContent.tsx** - Movies table/content
- **content/TicketsContent.tsx** - Tickets table/content
- **content/ToysContent.tsx** - Toys table/content
- **content/TransactionsContent.tsx** - Transactions table/content
- **content/UsersContent.tsx** - Users table/content
- **content/PostManagement.tsx** - Posts table/content
- **content/PostRichTextEditor.tsx** - CKEditor integration
- **content/EmailLogsContent.tsx** - Email logs table
- **content/UploadsContent.tsx** - Uploads management
- **content/TicketCheckContent.tsx** - Ticket check UI
- **content/AIAnalyticsPanel.tsx** - AI analytics chat interface

**UI Components** (`components/ui/`):
- shadcn/ui components (button, dialog, form, table, etc.)

**Shared Components**:
- **LoginDialog.tsx** - Login modal
- **RegisterDialog.tsx** - Register modal
- **OTPDialog.tsx** - OTP input modal
- **ForgetPasswordDialog.tsx** - Password reset modal
- **ProtectedRoute.tsx** - Route protection wrapper
- **UserMenu.tsx** - User dropdown menu
- **LoadingScreen.tsx** - Loading spinner
- **ErrorModal.tsx** - Error display
- **MobileMenu.tsx** - Mobile navigation

#### State Management
- **TanStack React Query** - Server state management
- **movieStore.ts** - Local movie state (Zustand-like pattern)

#### Routing
- **React Router DOM** - Client-side routing
- **AdminGate** (`client/admin/auth/AdminGate.tsx`) - Admin route protection
- All admin routes under `/admin/*`

#### API Client
**Location**: `client/lib/api/`

- **api.ts** - Base API client
- **admin.ts** - Admin-specific API calls
- **movies.ts** - Movie API calls
- **tickets.ts** - Ticket API calls
- **toys.ts** - Toys API calls
- **branches.ts** - Branch API calls
- **uploads.ts** - Upload API calls

#### Styling
- **TailwindCSS** - Utility-first CSS
- **shadcn/ui** - Pre-built components
- **Custom CSS** - `global.css`

### User Client (Next.js)

#### Pages/Routes
**Location**: `next-client/src/app/`

- **page.tsx** - Home page
- **booking/page.tsx** - Booking page
- **checkout/page.tsx** - Checkout page
- **qr-payment/page.tsx** - QR payment display
- **success-payment/page.tsx** - Payment success page
- **account/page.tsx** - User account page
- **reset-password/page.tsx** - Password reset page
- **maintenance/page.tsx** - Maintenance mode page
- **bai-viet/page.tsx** - Blog listing
- **bai-viet/[slug]/page.tsx** - Blog post detail

#### Layout Structure
**Location**: `next-client/src/app/`

- **layout.tsx** - Root layout with metadata, providers
- **providers.tsx** - React providers (QueryClient, Theme)
- Each route has its own `layout.tsx` for route-specific layouts

#### Components
**Location**: `next-client/src/components/`

**User Components** (`components/user/`):
- **home/** - Home page components
  - HeroSection.tsx
  - FilmCarousel.tsx
  - PromotionShowcase.tsx
  - TechnologyBanner.tsx
  - CinesphereShowcase.tsx
- **Header.tsx** - Site header
- **Footer.tsx** - Site footer
- **MobileMenu.tsx** - Mobile navigation

**UI Components** (`components/ui/`):
- shadcn/ui components (button, dialog, form, etc.)

#### Data Fetching Pattern
- **TanStack React Query** - Server state management
- **API Client** (`src/lib/api/`) - Typed API functions
- **Hooks** (`src/hooks/`) - Custom hooks (useBranch)
- **Server Components** - Next.js App Router server components
- **Client Components** - Interactive components with 'use client'

#### API Client
**Location**: `next-client/src/lib/api/`

- **http.ts** - Base HTTP client with fetch
- **movies.ts** - Movie API calls
- **tickets.ts** - Ticket API calls
- **toys.ts** - Toys API calls
- **posts.ts** - Blog API calls
- **branches.ts** - Branch API calls
- **uploads.ts** - Upload API calls
- **products.ts** - Product API calls

#### Configuration
**Location**: `next-client/src/config/`

- **site.ts** - Site configuration (domain, name, etc.)

#### Styling
- **TailwindCSS** - Utility-first CSS
- **shadcn/ui** - Pre-built components
- **Custom CSS** - `globals.css`

---

## 10. ENVIRONMENT VARIABLES

### Server-Only Variables (Cloudflare Worker)

**Defined in**: `worker/wrangler.toml` and Cloudflare dashboard

#### Database & Storage
- `cinema_db` - D1 database binding
- `r2_cinemastore` - R2 bucket binding
- `KV_BINDING` - KV namespace binding
- `AI` - Workers AI binding

#### Cloudinary
- `CLOUDINARY_CLOUD_NAME` - Cloudinary cloud name
- `CLOUDINARY_API_KEY` - Cloudinary API key
- `CLOUDINARY_API_SECRET` - Cloudinary API secret
- `CLOUDINARY_UPLOAD_FOLDER` - Upload folder path

#### Email Services
- `BREVO_API_KEY` - Brevo API key
- `BREVO_SENDER_EMAIL` - Brevo sender email
- `BREVO_SENDER_NAME` - Brevo sender name
- `RESEND_API_KEY` - Resend API key (local dev)
- `RESEND_SENDER_EMAIL` - Resend sender email (local dev)
- `RESEND_SENDER_NAME` - Resend sender name (local dev)

#### Payment Gateways
- `VITE_MOMO_PARTNER_CODE` - MoMo partner code
- `VITE_MOMO_ACCESS_KEY` - MoMo access key
- `VITE_MOMO_SECRET_KEY` - MoMo secret key
- `VITE_MOMO_ENDPOINT` - MoMo API endpoint
- `VITE_MOMO_REDIRECT_URL` - MoMo redirect URL
- `VITE_MOMO_IPN_URL` - MoMo IPN URL
- `VITE_VNPAY_TMN_CODE` - VNPay TMN code
- `VITE_VNPAY_HASH_SECRET` - VNPay hash secret
- `VITE_VNPAY_GATEWAY` - VNPay gateway URL
- `VITE_VNPAY_RETURN_URL` - VNPay return URL

#### URLs
- `VITE_SERVER_BASE_URL` - Backend API base URL
- `VITE_CLIENT_BASE_URL` - Frontend base URL

#### Rate Limiting
- `VITE_RATE_LIMIT_BOOKING_CHECK_MAX` - Max requests (default: 10)
- `VITE_RATE_LIMIT_BOOKING_CHECK_WINDOWMS` - Window in ms (default: 60000)

#### SEO
- `INDEXNOW_KEY` - IndexNow API key

#### Environment Flags
- `IS_PREVIEW` - Preview environment flag

### Client-Side Variables (VITE_ / NEXT_PUBLIC_)

#### Admin Panel (Vite)
**Defined in**: `.env`, `.env.production`

- `VITE_API_URL` - API base URL
- `VITE_SERVER_BASE_URL` - Backend URL
- `VITE_CLIENT_BASE_URL` - Frontend URL
- `VITE_IS_MAINTENANCE` - Maintenance mode flag
- `VITE_CLOUDINARY_CLOUD_NAME` - Cloudinary cloud name (client upload)
- `VITE_CLOUDINARY_UPLOAD_PRESET_VIDEO` - Video upload preset
- `VITE_CLOUDINARY_UPLOAD_PRESET_IMAGE` - Image upload preset

#### User Client (Next.js)
**Defined in**: `next-client/.env.production`

- `NEXT_PUBLIC_API_URL` - API base URL
- `NEXT_PUBLIC_SERVER_BASE_URL` - Backend URL
- `NEXT_PUBLIC_CLIENT_BASE_URL` - Frontend URL

### Local Development Variables

**Defined in**: `.env` (root)

- `DATABASE_URL` - PostgreSQL connection string (legacy, not used in Worker)
- `PGSSLROOTCERT` - PostgreSQL SSL cert path (legacy)
- `GMAIL_USER` - Gmail username (legacy)
- `GMAIL_PASS` - Gmail password (legacy)
- `PING_MESSAGE` - Ping message for health check

### Missing / Unused Variables

- `DATABASE_URL` - Legacy PostgreSQL, not used in Cloudflare D1
- `PGSSLROOTCERT` - Legacy PostgreSQL, not used
- `GMAIL_USER`, `GMAIL_PASS` - Legacy Gmail, replaced by Resend/Brevo
- `VITE_PUBLIC_BUILDER_KEY` - Builder.io key, not currently used

### Environment-Specific Configurations

#### Production
- `VITE_SERVER_BASE_URL = https://cinesphere.com.vn`
- `VITE_CLIENT_BASE_URL = https://cinesphere.com.vn`
- Worker routes: `cinesphere.com.vn/api/*`, `cinesphere.com.vn/uploads/*`

#### Preview
- `VITE_SERVER_BASE_URL = https://api.cinesphere.com.vn`
- `VITE_CLIENT_BASE_URL = https://preview.cinema-pages.pages.dev`
- Separate D1 database: `cinema-db-preview`

#### Local
- `VITE_SERVER_BASE_URL = http://localhost:8080`
- `VITE_CLIENT_BASE_URL = http://localhost:8080`

---

## 11. NHỮNG GÌ CÒN THIẾU / CHƯA HOÀN CHỈNH

### 1. RBAC / Phân quyền (COMPLETED)
- **Status**: Đã implement đầy đủ và đồng bộ giữa Backend & Frontend.
- **Implemented**:
  - Bảng database: staffs, staff_tokens, roles, permissions, role_permissions, staff_roles, staff_branches, audit_logs.
  - Middleware: `requireAuth`, `requireStaffAuth`, `requirePermission`.
  - Frontend: `staffStore.ts`, `useStaffPermission` hooks.
  - Client-side Protection: `ProtectedRoute` và `AccessDenied` view trong `AdminGate.tsx`.
  - Admin pages: Staff.tsx, Roles.tsx, AuditLogs.tsx.
  - KV cache for permissions with TTL 300s.
  - Branch filtering via `branch-guard.ts` (Super Admin bypass).

### 2. Staff-Branch Assignment (COMPLETED)
- **Status**: Đã hoàn thiện cả UI và logic backend.
- **Implemented**:
  - Bảng `staff_branches` trong database.
  - UI để gán chi nhánh cho nhân viên trong `Staff.tsx`.
  - Middleware load `branchIds` vào session context.
  - Các API đã bắt đầu áp dụng `restrictToBranchIds` để lọc dữ liệu.

### 3. Soft Delete & Restore (COMPLETED)
- **Status**: Hỗ trợ Xóa mềm và Khôi phục cho tất cả các module quan trọng.
- **Modules**:
  - Phim (Movies)
  - Gói vé (Tickets)
  - Đồ chơi (Toys)
  - Chi nhánh (Branches)
  - Nhân viên (Staff)
  - Vai trò (Roles)
- **Features**: Trang "Đã xóa" riêng biệt cho từng module để quản lý khôi phục.

### 4. Audit Logging (COMPLETED)
- **Status**: Tự động ghi lại nhật ký thay đổi dữ liệu của nhân viên.
- **Features**:
  - Ghi nhận: Người thực hiện, Action (Create/Update/Delete/Restore), Module, Entity ID, và Diff (Old vs New values).
  - UI: `AuditLogs.tsx` cho phép xem chi tiết và lọc theo nhiều tiêu chí.

### 5. Email Queue (COMPLETED)
- **Status**: Sử dụng `mail-queue.ts` kết hợp `c.executionCtx.waitUntil` để gửi mail không chặn response.
- **Features**: Xác nhận đặt vé, Thông báo tạo tài khoản nhân viên, Đặt lại mật khẩu.

### 6. Recent Architectural Updates (June 2026)
- **Client-side Route Protection**: Toàn bộ Route Admin đã được bảo vệ bởi `ProtectedRoute`, ngăn chặn truy cập trái phép từ URL.
- **Dashboard Metrics Fix**: Hàm đếm đồ chơi hiện đã loại bỏ các món đã bị xóa mềm.
- **User-side Movie Filter**: Trang người dùng hiện lọc bỏ các phim đã bị xóa hoặc ẩn trong danh sách combo gói vé.
- **SePay Webhook Support**: Đã thêm khung xử lý webhook cho SePay (chờ cấu thực xác thực bảo mật).

---

## 12. NHỮNG GÌ CÒN THIẾU / CẦN CẢI THIỆN

1. **Bảo mật Webhook**: Cần thêm Signature Validation cho SePay/MoMo/VNPay webhook.
2. **KV Cache Re-enablement**: Cần cấu hình lại cơ chế vô hiệu hóa cache (Invalidation) để bật lại cache cho Movies/Tickets.
3. **Branch-level Settings**: Cấu hình riêng cho từng chi nhánh (giờ mở cửa, số ghế).
4. **Testing Suite**: Cần thêm Unit/Integration tests cho các logic nghiệp vụ quan trọng.
5. **i18n**: Hỗ trợ đa ngôn ngữ nếu mở rộng ra thị trường quốc tế.

---

## SUMMARY

CTBooking là một hệ thống đặt vé xem phim chuyên nghiệp với:
- **Dual Frontend**: Admin Panel (React) + User Client (Next.js).
- **Edge Backend**: Cloudflare Workers (Hono) & D1 Database.
- **RBAC hoàn chỉnh**: Quản lý nhân viên, vai trò, quyền hạn chi tiết đến từng hành động.
- **Multi-branch**: Hỗ trợ nhiều chi nhánh với cơ chế phân quyền truy cập dữ liệu riêng biệt.
- **Dữ liệu an toàn**: Sử dụng Soft Delete, Audit Logs để theo dõi mọi biến động dữ liệu.
- **Giao diện hiện đại**: Sử dụng TailwindCSS, shadcn/ui, và tối ưu hóa SEO vượt trội.
- **Gửi mail tin cậy**: Hệ thống hàng đợi Mail Queue tích hợp sẵn trên Worker.
