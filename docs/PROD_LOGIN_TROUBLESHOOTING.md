# Hướng Dẫn Xử Lý Lỗi Đăng Nhập & Khởi Tạo Tài Khoản Admin Trên Production

---

## 1. Hiện Tượng & Dấu Hiệu Nhận Biết

Khi truy cập trang quản trị Production (`https://admin.cinesphere.com.vn` hoặc `https://cinesphere.com.vn/login`) và đăng nhập:
- **Thông báo trên giao diện**: *"Email hoặc mật khẩu không đúng"*
- **Mã lỗi HTTP**: `400 Bad Request` (từ API `POST /api/admin/auth/login`)
- **API Response**: `{"status": "error", "message": "Email hoặc mật khẩu không đúng"}`

---

## 2. Nguyên Nhân Gốc Rễ

1. **Database D1 Production (`cinema-db`) chưa có dữ liệu tài khoản**:
   - Khi triển khai hệ thống mới hoặc khởi tạo lại database trên Cloudflare D1, bảng `staffs` hoàn toàn trống (`0 rows`).
2. **Sai thông tin tài khoản hoặc mật khẩu chưa được hash bằng Bcrypt**:
   - Mật khẩu lưu trong bảng `staffs` phải được mã hóa bằng chuẩn `bcrypt` (10 rounds). Nếu chèn mật khẩu dạng plain text, hệ thống sẽ từ chối đăng nhập.
3. **Database thiếu cột hoặc chưa chạy migrations**:
   - Bảng `email_logs` cần có đủ các cột: `recipient_type` (`TEXT`), `staff_id` (`INTEGER`).

---

## 3. Các Cách Khởi Tạo & Xử Lý Tài Khoản Super Admin Trên Production

---

### Cách 1: Sử dụng Lệnh Cloudflare Wrangler D1 CLI (Khuyên Dùng - Nhanh & Trực Tiếp Nhất)

Nếu bạn có quyền truy cập terminal dự án, chạy các lệnh sau để tạo hoặc cập nhật tài khoản:

#### Bước 1: Kiểm tra xem đã có tài khoản nào trong database chưa
```bash
npx wrangler d1 execute cinema-db --remote --config worker/wrangler.toml --command "SELECT id, email, fullname, is_super_admin, is_active FROM staffs;"
```

#### Bước 2: Tạo mới hoặc cập nhật tài khoản Super Admin
Tạo hash mật khẩu Bcrypt (ví dụ mật khẩu `admin123` có hash là `$2b$10$RRnpN0xSHXG6CA6v6L2lDuhq5GvxVT4sw5TKBtNi3k5VH9QrPbE6q`):

- **Nếu bảng `staffs` đang trống (Thêm mới)**:
```bash
npx wrangler d1 execute cinema-db --remote --config worker/wrangler.toml --command "INSERT INTO staffs (email, password, fullname, is_super_admin, is_active, force_password_change, created_at, updated_at) VALUES ('admin@cinesphere.com', '\$2b\$10\$RRnpN0xSHXG6CA6v6L2lDuhq5GvxVT4sw5TKBtNi3k5VH9QrPbE6q', 'Super Admin Cinesphere', 1, 1, 0, datetime('now'), datetime('now'));"
```

- **Nếu muốn đổi mật khẩu / cập nhật tài khoản Super Admin hiện có**:
```bash
npx wrangler d1 execute cinema-db --remote --config worker/wrangler.toml --command "UPDATE staffs SET email = 'admin@cinesphere.com', password = '\$2b\$10\$RRnpN0xSHXG6CA6v6L2lDuhq5GvxVT4sw5TKBtNi3k5VH9QrPbE6q', fullname = 'Super Admin Cinesphere', is_super_admin = 1, is_active = 1, force_password_change = 0 WHERE id = 1;"
```

---

### Cách 2: Sử Dụng API Khởi Tạo Ban Đầu (`POST /api/admin/setup/super-admin`)

Khi hệ thống **chưa có bất kỳ Super Admin nào** (`staffs.is_super_admin = 1` count = 0), bạn có thể gọi API setup:

```bash
curl --location 'https://api.cinesphere.com.vn/api/admin/setup/super-admin' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "email": "admin@cinesphere.com",
    "password": "admin123",
    "fullname": "Super Admin Cinesphere"
  }'
```

> **Lưu ý**: API này sẽ tự động khóa lại (`"message": "Super admin đã tồn tại"`) ngay khi đã có ít nhất 1 tài khoản Super Admin trong hệ thống để đảm bảo tính an toàn bảo mật.

---

## 4. Kiểm Tra & Xác Thực Sau Khi Xử Lý

Chạy lệnh `curl` kiểm tra trực tiếp API đăng nhập:

```bash
curl -s -X POST https://api.cinesphere.com.vn/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@cinesphere.com","password":"admin123"}'
```

**Kết quả mong đợi (200 OK)**:
```json
{
  "status": "success",
  "staff": {
    "id": 1,
    "email": "admin@cinesphere.com",
    "fullname": "Super Admin Cinesphere",
    "isSuperAdmin": true,
    "forcePasswordChange": false
  },
  "permissions": [],
  "branchIds": [],
  "token": "..."
}
```

---

## 5. Checklist Kiểm Tra Toàn Diện Khi Deploy Production Mới

| Hạng mục | Lệnh / Thao tác kiểm tra | Trạng thái cần đạt |
| :--- | :--- | :--- |
| **Bảng staffs** | `SELECT count(*) FROM staffs WHERE is_super_admin = 1;` | `>= 1` |
| **Bảng roles** | `SELECT count(*) FROM roles;` | `>= 3` (`superadmin`, `manager`, `staff`) |
| **Bảng permissions** | `SELECT count(*) FROM permissions;` | `>= 60` quyền |
| **Bảng email_logs** | `PRAGMA table_info(email_logs);` | Có đủ `recipient_type` và `staff_id` |
| **Biến môi trường Worker** | `worker/wrangler.toml` [vars] | Đã gán đúng `VITE_CLIENT_BASE_URL` và `VITE_SERVER_BASE_URL` |
