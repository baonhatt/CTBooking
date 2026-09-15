## Cấu trúc thư mục (Part B)
`
CTBooking/
├── .agent/
│   └── workflows/
├── .builder/
│   └── rules/
├── .github/
│   └── workflows/
├── .trae/
│   └── documents/
├── .vscode/
├── app/
├── client/
│   ├── admin/
│   │   ├── auth/
│   │   │   └── AdminGate.tsx
│   │   └── layouts/
│   │       └── AdminLayout.tsx
│   ├── assets/
│   │   └── images/
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
│   │   │   ├── card.tsx
│   │   │   ├── carousel.tsx
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
├── db_backup/
├── docs/
├── drizzle/
│   └── meta/
├── next-client/
│   ├── public/
│   │   ├── images/
│   ├── scripts/
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
│   ├── next-env.d.ts
│   ├── package.json
│   ├── tailwind.config.ts
│   └── wrangler.toml
├── public/
│   ├── fonts/
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
│   │   ├── webhook/
│   │   │   └── sepay.ts
│   │   └── mail-service.ts
│   ├── cloudinary.spec.ts
│   └── cloudinary.ts
├── shared/
│   ├── api.ts
│   ├── booking-invoice.ts
│   └── schema.ts
├── tests/
│   └── api-parity.spec.ts
├── tmp/
├── worker/
│   ├── drizzle/
│   │   ├── meta/
│   ├── migrations/
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
`
