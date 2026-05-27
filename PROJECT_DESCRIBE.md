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
│   │   ├── auth/                    # Admin authentication
│   │   │   └── AdminGate.tsx       # Admin route protection
│   │   └── layouts/                 # Admin layout components
│   ├── components/
│   │   ├── admin/                   # Admin-specific components
│   │   │   └── content/             # Dashboard content components
│   │   ├── filetypes/               # File type components
│   │   ├── ui/                      # shadcn/ui components
│   │   ├── ErrorModal.tsx
│   │   ├── ForgetPasswordDialog.tsx
│   │   ├── LoadingScreen.tsx
│   │   ├── LoginDialog.tsx
│   │   ├── OTPDialog.tsx
│   │   ├── ProtectedRoute.tsx
│   │   ├── RegisterDialog.tsx
│   │   └── UserMenu.tsx
│   ├── lib/
│   │   └── api/                     # API client functions
│   ├── pages/
│   │   ├── admin/                   # Admin pages
│   │   │   ├── AdminIndex.tsx
│   │   │   ├── Branches.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── EmailLogs.tsx
│   │   │   ├── Movies.tsx
│   │   │   ├── PostEdit.tsx
│   │   │   ├── Posts.tsx
│   │   │   ├── Settings.tsx
│   │   │   ├── TicketCheck.tsx
│   │   │   ├── Tickets.tsx
│   │   │   ├── Toys.tsx
│   │   │   ├── Transactions.tsx
│   │   │   ├── Uploads.tsx
│   │   │   └── Users.tsx
│   │   ├── Maintenance.tsx
│   │   └── NotFound.tsx
│   ├── store/
│   │   └── movieStore.ts            # Movie state management
│   ├── App.tsx                      # React app entry
│   ├── global.css                   # Global styles
│   └── vite-env.d.ts
│
├── next-client/                      # User Client (Next.js)
│   ├── public/
│   │   ├── images/
│   │   ├── icon.svg
│   │   ├── logo.svg
│   │   └── robots.txt
│   ├── src/
│   │   ├── app/
│   │   │   ├── account/             # User account page
│   │   │   ├── bai-viet/             # Blog pages
│   │   │   │   ├── [slug]/          # Blog post detail
│   │   │   │   └── page.tsx         # Blog listing
│   │   │   ├── booking/             # Booking page
│   │   │   ├── checkout/            # Checkout page
│   │   │   ├── maintenance/         # Maintenance page
│   │   │   ├── qr-payment/          # QR payment page
│   │   │   ├── reset-password/      # Password reset page
│   │   │   ├── success-payment/     # Payment success page
│   │   │   ├── layout.tsx           # Root layout
│   │   │   ├── page.tsx             # Home page
│   │   │   ├── providers.tsx        # React providers
│   │   │   └── sitemap.ts           # Sitemap generation
│   │   ├── components/
│   │   │   ├── ui/                  # shadcn/ui components
│   │   │   └── user/                # User-specific components
│   │   │       ├── home/            # Home page components
│   │   │       └── ...              # Other user components
│   │   ├── config/
│   │   │   └── site.ts             # Site configuration
│   │   ├── hooks/
│   │   │   └── useBranch.ts         # Branch selection hook
│   │   └── lib/
│   │       ├── api/                 # API client functions
│   │       └── utils.ts             # Utility functions
│   ├── .env.production
│   ├── next.config.js
│   ├── package.json
│   └── tsconfig.json
│
├── server/                           # Shared business logic
│   ├── lib/
│   │   ├── booking-utils.ts         # Booking utilities
│   │   ├── date-utils.ts            # Date formatting utilities
│   │   ├── email-templates.ts       # Email HTML templates
│   │   ├── mail-queue.ts            # Email queue management
│   │   ├── media-utils.ts           # Media processing utilities
│   │   └── otp-utils.ts             # OTP generation/validation
│   ├── routes/
│   │   ├── admin/                   # Admin route implementations
│   │   │   ├── branches.ts
│   │   │   ├── cloudinary-sign.ts
│   │   │   ├── dashboard.ts
│   │   │   ├── email-logs.ts
│   │   │   ├── movies.ts
│   │   │   ├── payments.ts
│   │   │   ├── posts.ts
│   │   │   ├── settings.ts
│   │   │   ├── site-media.ts
│   │   │   ├── tickets.ts
│   │   │   ├── toys.ts
│   │   │   ├── uploads.ts
│   │   │   └── users.ts
│   │   ├── user/                    # User route implementations
│   │   │   ├── auth.ts
│   │   │   ├── demo.ts
│   │   │   ├── momo.ts
│   │   │   ├── movies.ts
│   │   │   ├── password.ts
│   │   │   ├── payments.ts
│   │   │   ├── tickets.ts
│   │   │   ├── toys.ts
│   │   │   ├── users.ts
│   │   │   └── vnpay.ts
│   │   ├── webhook/
│   │   │   └── sepay.ts             # SePay webhook handler
│   │   └── mail-service.ts          # Email service abstraction
│   ├── cloudinary.ts                # Cloudinary configuration
│   └── cloudinary.spec.ts
│
├── worker/                           # Cloudflare Worker (API Server)
│   ├── drizzle/
│   │   └── meta/                    # Drizzle metadata
│   ├── migrations/
│   │   └── 0001_add_branches.sql    # Branch migration
│   ├── src/
│   │   ├── index.ts                 # Main API server (Hono)
│   │   ├── middleware.ts            # Auth middleware
│   │   ├── schema.ts                # Database schema (Drizzle)
│   │   └── utils.ts                 # Worker utilities
│   ├── drizzle.config.ts
│   └── wrangler.toml                # Cloudflare Worker config
│
├── public/                           # Static files (shared)
│   ├── fonts/
│   │   └── InterVariable.woff2
│   ├── favicon.png
│   ├── favicon.svg
│   ├── logo.svg
│   ├── googlec0ac45ab4902cd65.html
│   └── robots.txt
│
├── .agent/
│   └── workflows/                    # AI workflows
│
├── .builder/
│   └── rules/                        # Builder rules
│
├── .github/
│   └── workflows/
│       └── deploy-worker.yml        # Worker deployment workflow
│
├── .trae/
│   └── documents/
│       └── movie-theater-prd.md     # Project requirements
│
├── shared/
│   └── api.ts                       # Shared API types
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

#### Admin Login Flow
1. **POST /api/admin/login**
   - Same as user login but:
     - Session expiry: 1 day (86400 seconds)
     - Cookie: `Max-Age=86400`

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

### Differences: User vs Admin Auth

| Aspect | User Auth | Admin Auth |
|--------|-----------|------------|
| Endpoint | `/api/login` | `/api/admin/login` |
| Session Expiry | 30 days | 1 day |
| Cookie Max-Age | 2592000s | 86400s |
| 2FA Support | Yes (configurable) | Yes (configurable) |
| Middleware | `requireAuth` | `requireAuth` (same) |
| Route Protection | User routes | Admin routes |

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

**Table: staff_tokens**
- `id` (INTEGER, PK, AUTOINCREMENT)
- `staff_id` (INTEGER, FK → staffs.id, ON DELETE CASCADE)
- `token` (TEXT, NOT NULL, UNIQUE)
- `type` (TEXT, DEFAULT 'session')
- `expired_at` (TEXT, NOT NULL)
- `revoked_at` (TEXT)
- `revoke_reason` (TEXT)
- `created_at` (TEXT, NOT NULL)

**Table: roles**
- `id` (INTEGER, PK, AUTOINCREMENT)
- `name` (TEXT, NOT NULL, UNIQUE)
- `description` (TEXT)
- `is_system` (INTEGER, DEFAULT 0)
- `level` (INTEGER, DEFAULT 0)
- `created_at` (TEXT, NOT NULL)
- `updated_at` (TEXT, NOT NULL)

**Table: permissions**
- `id` (INTEGER, PK, AUTOINCREMENT)
- `module` (TEXT, NOT NULL)
- `action` (TEXT, NOT NULL)
- `description` (TEXT)

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
- `action` (TEXT, NOT NULL)
- `entity_type` (TEXT, NOT NULL)
- `entity_id` (INTEGER)
- `old_values` (TEXT)
- `new_values` (TEXT)
- `ip_address` (TEXT)
- `user_agent` (TEXT)
- `created_at` (TEXT, NOT NULL)

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

#### Frontend Permission System

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

**File**: `client/hooks/useStaffPermission.ts`

**Hooks**:
- `useStaffPermission(module, action)`: Returns boolean if staff has permission
- `useIsSuperAdmin()`: Returns boolean if staff is super admin
- `useStaffPermissions()`: Returns array of staff permissions
- `useStaffBranchIds()`: Returns array of staff's branch IDs

#### Admin Auth Flow

**File**: `client/admin/auth/AdminGate.tsx`

**Operation**:
1. Checks if super admin setup is needed (GET /api/admin/setup/super-admin)
2. If setup needed, shows SetupSuperAdmin page
3. If staff authenticated, shows admin routes wrapped in AdminLayout
4. If not authenticated, shows login page

**API Calls**:
- GET /api/admin/setup/super-admin - Check if super admin exists
- POST /api/admin/setup/super-admin - Create super admin
- POST /api/admin/auth/login - Staff login
- POST /api/admin/auth/logout - Staff logout
- GET /api/admin/auth/me - Get current staff info

**Redirect Logic**:
- Unauthenticated: Redirect to login page
- After login: Redirect to dashboard
- After logout: Redirect to login page

#### Admin Pages with Permission Checks

**Staff Management** (`client/pages/admin/Staff.tsx`):
- API: GET /api/admin/staff (requirePermission: staff, view)
- API: POST /api/admin/staff (requirePermission: staff, create)
- API: PUT /api/admin/staff/:id (requirePermission: staff, edit)
- API: DELETE /api/admin/staff/:id (requirePermission: staff, delete)
- Filters: search, role, branch
- TODO: None currently visible

**Roles Management** (`client/pages/admin/Roles.tsx`):
- API: GET /api/admin/roles (requirePermission: roles, view)
- API: POST /api/admin/roles (requirePermission: roles, create)
- API: PUT /api/admin/roles/:id (requirePermission: roles, edit)
- API: DELETE /api/admin/roles/:id (requirePermission: roles, delete)
- API: GET /api/admin/permissions (requirePermission: roles, view)
- Filters: None
- TODO: None currently visible

**Audit Logs** (`client/pages/admin/AuditLogs.tsx`):
- API: GET /api/admin/audit-logs (requirePermission: audit_logs, view)
- Filters: search, staff, action, entity type, date range
- TODO: None currently visible

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

#### Những gì còn thiếu

1. **Permission-based UI rendering**:
   - Frontend permission checks exist but not consistently used in UI
   - Some admin pages don't hide buttons based on permissions

2. **Audit logging**:
   - Audit log function exists but not consistently called
   - Many actions don't log to audit_logs table

3. **Staff-Branch assignment UI**:
   - Database table exists but UI for assigning branches to staff is not visible in current pages

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
- Creates initial database schema for core tables:
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

#### 0002_rbac_system.sql
- Creates RBAC system tables:
  - `staffs` - Staff accounts
  - `staff_tokens` - Staff session tokens
  - `roles` - Role definitions
  - `permissions` - Permission definitions
  - `role_permissions` - Role-permission junction table
  - `staff_roles` - Staff-role junction table
  - `staff_branches` - Staff-branch junction table
  - `audit_logs` - Audit logging

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
- **GET /api/bookings-code/:code** - Get booking by code (rate-limited)
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
- **POST /api/admin/login** - Admin login (1-day session)

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
- **POST /api/movies** - Create movie
- **PUT /api/movies/:id** - Update movie
- **DELETE /api/movies/:id** - Delete movie
- **POST /api/movies-status/:id** - Update movie status

#### Ticket Packages
- **POST /api/tickets** - Create ticket package
- **PUT /api/tickets/:id** - Update ticket package
- **DELETE /api/tickets/:id** - Delete ticket package

#### Toys
- **POST /api/toys** - Create toy
- **PUT /api/toys/:id** - Update toy
- **DELETE /api/toys/:id** - Delete toy

#### Posts (Blog)
- **GET /api/admin/posts** - List all posts (admin)
  - Query: `page`, `pageSize`, `q`, `status`
- **GET /api/admin/posts/:id** - Get post by ID (admin)
- **POST /api/posts** - Create post
- **PUT /api/posts/:id** - Update post
- **DELETE /api/posts/:id** - Delete post

#### Branches
- **GET /api/admin/branches** - List branches with stats
  - Query: `page`, `pageSize`, `q`, `includeInactive`
- **GET /api/admin/branches/:id** - Get branch by ID
- **POST /api/admin/branches** - Create branch
- **PUT /api/admin/branches/:id** - Update branch
- **DELETE /api/admin/branches/:id** - Delete branch

#### Site Media
- **POST /api/admin/site-media** - Create site media
- **PUT /api/admin/site-media** - Update site media
- **DELETE /api/admin/site-media/:id** - Delete site media

#### Uploads
- **POST /api/admin/uploads/video** - Upload video to Cloudinary/R2

#### Cloudinary
- **POST /api/admin/cloudinary/sign** - Generate Cloudinary signature

#### Settings
- **GET /api/admin/settings** - Get admin settings (from KV)
- **POST /api/admin/settings** - Update admin settings (to KV)

#### Email Logs
- **GET /api/admin/email-logs** - List email logs
  - Query: `status`, `email_type`, `search`, `page`, `limit`

#### Staff Management (RBAC)
- **GET /api/admin/staff** - List staff members
  - Query: `page`, `pageSize`, `q`, `roleId`, `branchId`
  - Middleware: requireStaffAuth, requirePermission('staff', 'view')
- **GET /api/admin/staff/:id** - Get staff by ID
  - Middleware: requireStaffAuth, requirePermission('staff', 'view')
- **POST /api/admin/staff** - Create staff
  - Middleware: requireStaffAuth, requirePermission('staff', 'create')
- **PUT /api/admin/staff/:id** - Update staff
  - Middleware: requireStaffAuth, requirePermission('staff', 'edit')
- **DELETE /api/admin/staff/:id** - Delete staff
  - Middleware: requireStaffAuth, requirePermission('staff', 'delete')
- **POST /api/admin/staff/:id/reset-password** - Reset staff password
  - Middleware: requireStaffAuth, requirePermission('staff', 'reset_password')

#### Roles Management (RBAC)
- **GET /api/admin/roles** - List roles
  - Query: `page`, `pageSize`
  - Middleware: requireStaffAuth, requirePermission('roles', 'view')
- **GET /api/admin/roles/:id** - Get role by ID
  - Middleware: requireStaffAuth, requirePermission('roles', 'view')
- **POST /api/admin/roles** - Create role
  - Middleware: requireStaffAuth, requirePermission('roles', 'create')
- **PUT /api/admin/roles/:id** - Update role
  - Middleware: requireStaffAuth, requirePermission('roles', 'edit')
- **DELETE /api/admin/roles/:id** - Delete role
  - Middleware: requireStaffAuth, requirePermission('roles', 'delete')
- **GET /api/admin/permissions** - List all permissions
  - Middleware: requireStaffAuth, requirePermission('roles', 'view')

#### Audit Logs (RBAC)
- **GET /api/admin/audit-logs** - List audit logs
  - Query: `page`, `pageSize`, `search`, `staffId`, `action`, `module`, `from`, `to`
  - Middleware: requireStaffAuth, requirePermission('audit_logs', 'view')

#### Admin Authentication (RBAC)
- **POST /api/admin/auth/login** - Staff login
- **POST /api/admin/auth/logout** - Staff logout
- **GET /api/admin/auth/me** - Get current staff info
  - Middleware: requireStaffAuth
- **POST /api/admin/auth/change-password** - Change staff password
  - Middleware: requireStaffAuth
- **POST /api/admin/auth/forgot-password** - Request password reset
- **POST /api/admin/auth/reset-password** - Confirm password reset

#### Setup (RBAC)
- **GET /api/admin/setup/super-admin** - Check if super admin exists
- **POST /api/admin/setup/super-admin** - Create super admin
- **POST /api/admin/setup/seed-roles** - Seed default roles and permissions

#### AI Analytics
- **POST /api/ai-analytics** - AI-powered analytics Q&A

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
- **Status**: Đã implement đầy đủ
- **Implemented**:
  - Bảng database: staffs, staff_tokens, roles, permissions, role_permissions, staff_roles, staff_branches, audit_logs
  - Middleware: requireAuth, requireStaffAuth, requirePermission
  - Frontend: staffStore.ts, useStaffPermission hooks
  - Admin pages: Staff.tsx, Roles.tsx, AuditLogs.tsx
- **Still Missing**:
  - Permission-based UI rendering (not consistently used in all admin pages)
  - Audit logging (function exists but not consistently called)
  - Staff-Branch assignment UI (database and middleware exist, UI missing)

### 2. Staff-Branch Assignment UI (PARTIAL)
- **Status**: Database và middleware đã có, UI còn thiếu
- **Implemented**:
  - Bảng staff_branches trong database
  - Middleware requireStaffAuth load branchIds vào context
  - Frontend hook useStaffBranchIds()
- **Missing**:
  - UI để gán branches cho staff trong admin panel
  - Logic filter data theo branchIds trong các admin pages
- **Impact**: Staff có thể xem tất cả branches (chưa bị giới hạn)

### 3. KV Cache (TEMPORARILY DISABLED)
- **Status**: Đã vô hiệu hóa tạm thời
- **Location**: `worker/src/index.ts` (lines 1031-1089, 1892-1920)
- **Reason**: Fix lỗi không cập nhật dữ liệu
- **Missing**:
  - Cache cho /api/getActiveMovies
  - Cache cho /api/tickets-active
- **Impact**: Tăng load lên database, không có performance benefit từ cache

### 4. Rate Limiting (PARTIALLY IMPLEMENTED)
- **Status**: Chỉ implement cho /api/bookings-code/:code
- **Location**: `worker/src/index.ts` (lines 1256-1302)
- **Missing**:
  - Rate limiting cho các endpoints khác
  - Rate limiting dựa trên KV (code hiện tại là placeholder)
- **Impact**: Có thể bị abuse các endpoints khác

### 5. Branch-Specific Features
- **Status**: Chưa hoàn chỉnh
- **Missing**:
  - Branch-level settings (giờ mở cửa, số ghế, v.v.)
  - Branch-specific pricing
  - Branch transfer functionality
- **Impact**: Tất cả branches dùng chung cấu hình

### 6. Email Queue (IMPLEMENTED but could be improved)
- **Status**: Đã implement với mail-queue.ts
- **Missing**:
  - Retry logic cho failed emails
  - Email priority queue
  - Batch email sending
- **Impact**: Email failures không được retry tự động

### 7. Payment Webhook Validation
- **Status**: Basic implementation
- **Missing**:
  - Webhook signature validation (MoMo, VNPay)
  - IP whitelist cho webhook calls
- **Impact**: Có thể bị fake webhook calls

### 8. Testing
- **Status**: Minimal tests
- **Existing**: `tests/api-parity.spec.ts`
- **Missing**:
  - Unit tests cho business logic
  - Integration tests cho API endpoints
  - E2E tests cho user flows
- **Impact**: Harder to catch regressions

### 9. Error Handling
- **Status**: Basic try-catch
- **Missing**:
  - Centralized error logging
  - Error tracking (Sentry, etc.)
  - User-friendly error messages
- **Impact**: Harder to debug production issues

### 10. Analytics
- **Status**: AI analytics implemented
- **Missing**:
  - Traditional analytics (Google Analytics, etc.)
  - User behavior tracking
  - Conversion funnel tracking
- **Impact**: Limited insight into user behavior

### 11. Performance Monitoring
- **Status**: Cloudflare observability enabled
- **Missing**:
  - APM integration
  - Performance metrics dashboard
  - Alerting for slow endpoints
- **Impact**: Harder to identify performance issues

### 12. Documentation
- **Status**: This file exists
- **Missing**:
  - API documentation (Swagger/OpenAPI)
  - Component documentation (Storybook)
  - Deployment guide
  - Onboarding guide for new developers
- **Impact**: Harder for new developers to onboard

### 13. Accessibility
- **Status**: Basic semantic HTML
- **Missing**:
  - ARIA labels
  - Keyboard navigation
  - Screen reader testing
  - WCAG compliance
- **Impact**: Not accessible for users with disabilities

### 14. Internationalization (i18n)
- **Status**: Not implemented
- **Missing**:
  - i18n library setup
  - Translation files
  - Language switcher
- **Impact**: Only Vietnamese language supported

### 15. PWA Support
- **Status**: Not implemented
- **Missing**:
  - Service worker
  - Manifest file
  - Offline support
- **Impact**: No offline functionality, no installable app

---

## SUMMARY

CTBooking is a cinema booking system with:
- **Dual frontend**: React admin panel + Next.js user client
- **Cloudflare Workers backend**: Serverless, edge computing
- **D1 database**: SQLite with Drizzle ORM
- **Multi-branch support**: Full implementation with staff_branches table, UI for assignment missing
- **Payment integration**: MoMo, VNPay
- **Email system**: Resend, Brevo, MailChannels with queue
- **AI analytics**: Cloudflare Workers AI integration
- **SEO**: Full implementation with sitemap, robots.txt, structured data
- **Authentication**: Session-based with 2FA OTP support for users, separate staff auth for admin
- **RBAC**: **FULLY IMPLEMENTED** - staffs, roles, permissions, audit_logs tables with middleware and frontend hooks
- **Deployment**: Git-based auto-deploy to Cloudflare Pages + Workers

**Critical Missing Features**:
1. Staff-Branch assignment UI (database and middleware exist, UI missing)
2. Permission-based UI rendering (not consistently used in all admin pages)
3. Audit logging (function exists but not consistently called)
4. KV cache re-enablement
5. Comprehensive rate limiting
6. Testing suite
7. Webhook security validation
