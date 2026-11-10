# Cinesphere (CTBooking)

Hệ thống đặt vé xem phim và trải nghiệm VR nhiều chi nhánh. Thanh toán VietQR qua SePay. Chạy trên Cloudflare.

Ghi chú nghiệp vụ, quy tắc đã chốt, tính năng đang tạm ẩn và việc còn mở nằm ở [docs/NOTES.md](docs/NOTES.md).

## Thư mục

| Thư mục | Là gì |
|---|---|
| `client/` | Trang admin (React + Vite), cổng 8080 |
| `next-client/` | Website khách (Next.js, chạy trên Cloudflare Pages), cổng 3000. Có `package.json` riêng |
| `worker/` | Cloudflare Worker (Hono): `src/index.ts` là điểm vào, `src/routes/*` là các router, `wrangler.toml` là cấu hình, `migrations/` là cấu trúc database |
| `server/` | Logic nghiệp vụ dùng chung cho Worker (`routes/*` là các hàm `...Impl`, `lib/*` là hàm tiện ích). Có test đặt cạnh file |
| `shared/` | Schema database (`schema.ts`, Drizzle) và kiểu dùng chung |
| `scripts/` | Lệnh phụ cho database local |

Công nghệ: Cloudflare Workers + Hono, D1 (SQLite) qua Drizzle ORM, KV (`SETTINGS_KV`), Cron mỗi 5 phút (hết hạn đơn chưa thanh toán), React 18 + Vite + Tailwind + shadcn/ui, Next.js 14, Cloudinary (ảnh, video), Brevo (email), Cloudflare Turnstile.

## Chạy trên máy

```bash
npm install
cd next-client && npm install && cd ..
```

1. **Biến môi trường.** Sao `worker/.dev.vars.example` thành `worker/.dev.vars` rồi điền (file này không vào git). Sao `.env.example` thành `.env` nếu cần upload Cloudinary ở admin. Website khách đọc `next-client/.env.local` (`NEXT_PUBLIC_API_URL=http://localhost:8787`).
2. **Database local (D1 trong `worker/.wrangler`).**
   - Rỗng: `npm run db:init-local` (xóa DB local cũ, có sao lưu, rồi tạo cấu trúc và vai trò mặc định).
   - Bản sao của production (có dữ liệu khách thật, cần `wrangler login`): `npm run db:clone-prod-local`. File dump `cinema_db_prod*.sql` không vào git.
3. **Chạy 3 phần** (3 cửa sổ terminal):
   - Worker: `npm run dev:worker:local` (cổng 8787)
   - Admin: `npm run dev` (cổng 8080, tự chuyển `/api` sang cổng 8787)
   - Website: `cd next-client && npm run dev` (cổng 3000)
4. **Tài khoản Super Admin đầu tiên** (DB rỗng): đặt `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, `SUPER_ADMIN_FULLNAME` (local trong `worker/.dev.vars`; production: `SUPER_ADMIN_PASSWORD` là secret, hai giá trị còn lại nằm trong `wrangler.toml`), rồi gọi một lần `POST /api/admin/setup/super-admin`. Nếu thiếu biến môi trường, API nhận `{ email, password, fullname }` trong body. API tự khóa khi đã có Super Admin. Đăng nhập admin trên `localhost` không cần Turnstile.

## Kiểm tra

```bash
npm run typecheck                    # admin + server + worker
npx vitest run                       # toàn bộ test
cd next-client && npm run typecheck  # website khách
```

## Database

`worker/migrations/0001_init.sql` là file duy nhất: toàn bộ bảng, chỉ mục, vai trò và quyền mặc định. File chỉ dùng `IF NOT EXISTS` nên chạy lại trên DB đã có dữ liệu thì không đổi gì.

- Áp dụng: `npm run db:migrate:local`, `npm run db:migrate:preview`, `npm run db:migrate:prod` (sao lưu production trước: `npm run db:export-prod`).
- Đổi cấu trúc bảng: thêm file `0002_<tên>.sql` cạnh file init, đồng thời sửa `shared/schema.ts` cho khớp.
- Production và preview đã có sẵn bảng từ các migration cũ (đã gộp vào file init), nên lệnh `migrate` chỉ ghi nhận file init mà không đổi dữ liệu.

## Triển khai

```bash
npm run deploy:preview                 # Worker preview
npm run deploy:prod                    # Worker production
npm run pages:deploy:prod              # admin (Cloudflare Pages)
cd next-client && npm run pages:deploy:prod   # website khách
```

Cấu hình Cloudflare cần có (đặt bằng `npx wrangler secret put TÊN --config worker/wrangler.toml`, thêm `--env preview` cho preview, giá trị mỗi môi trường khác nhau):

| Tên | Dùng cho |
|---|---|
| `ORDER_TOKEN_SECRET` (bắt buộc) | Mã bí mật từng đơn. Thiếu thì đặt vé ngoài localhost trả lỗi 500 |
| `SEPAY_API_KEY` | Webhook ngân hàng (`Authorization: Apikey ...`) |
| `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_CLOUD_NAME` | Ảnh và video |
| `BREVO_API_KEY` và tên, email người gửi | Gửi email |
| `TURNSTILE_SECRET` | Captcha đăng nhập (đang nằm trong `wrangler.toml`, xem NOTES) |
| KV `SETTINGS_KV` | Giới hạn đăng nhập sai, OTP, cài đặt OTP |

Khi deploy các thay đổi về đặt vé và thanh toán: deploy Worker, admin và website khách cùng lúc, lúc không có đơn đang chờ thanh toán.
