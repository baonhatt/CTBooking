# Admin UI sync – tình trạng và việc còn lại

Quy ước chung nằm ở `client/components/admin/common/` (AdminDialog, ConfirmDialog, RowActionButton, StatusBadge, PageHeader, AdminPagination, EmptyState, FormField, notify, adminTokens).

Quyết định đã chốt:
- Modal thêm/sửa (`mode="form"`): không đóng khi bấm ra ngoài; X, Esc, nút Hủy khi đang sửa dở thì hỏi "Thay đổi chưa được lưu". Modal xem (`mode="view"`) đóng tự do.
- Trạng thái chuẩn: "Hoạt động" / "Ngừng hoạt động" (khóa: "Đã khóa"); badge 5 tone.
- Uploads dùng giao diện sáng. Users: chỉ xem + khóa/mở khóa. Module Đồ chơi đang tạm ẩn (`/toys`, tìm "TẠM ẨN ĐỒ CHƠI").
- Responsive: dưới 1024px dùng menu kéo ra; từ 1024px sidebar cố định. Bảng trên điện thoại cuộn ngang trong khung.

## Đã xong và đã kiểm tra
- Toàn bộ trang admin đã chuyển sang component chung, duyệt trình duyệt ở 1440px; responsive 375/768/1024.
- Khóa/mở khóa tài khoản chạy thật trên local (đã mở khóa lại). Có test tự động: endpoint khóa, router, đăng nhập/phiên/middleware khi bị khóa, đặt lại mật khẩu bị chặn cho tài khoản khóa. Toàn bộ 63 file / 814 test đạt; `tsc` sạch; `vite build` thành công.
- Thanh công cụ soạn thảo bài viết: bỏ menu "ba chấm" (toolbar tự xuống dòng), bỏ toolbar dính chồng với header dính, cô lập lớp z-index của CKEditor.
- Kiểm tra phân quyền bằng đối chiếu code (không có hồi quy): mọi hasPermission cũ còn nguyên, nút mới đều có điều kiện quyền bằng nút trên hàng.
- Đã test phân quyền thật (tài khoản test local, đã xóa): vai trò T-VIEW chỉ vào được Dashboard (các URL khác báo "Truy cập bị từ chối"); vai trò manager thấy đúng menu, không có nút khóa/xóa/thêm ngoài quyền, API khóa trả 403.
- Nút Uploads (tải lên/xóa) và nút gửi lại email (Email logs) giờ ẩn/vô hiệu theo quyền như server.

## Còn lại – cần người làm / quyết định
| Việc | Ghi chú |
|---|---|
| Quyền mới `users:lock` trên DB đã có | Seed chỉ chạy khi cài; DB đang chạy cần thêm quyền cho vai trò (Roles UI) hoặc chạy lại seed. KHÔNG bấm "Khởi tạo vai trò mặc định" nếu đã tùy chỉnh vai trò mặc định (nó ghi đè quyền). |
| Popup hết phiên (còn 5 phút / 1 phút) | Chưa xem trực quan (cần chờ đồng hồ). |
| Kéo thả file ở Uploads | Đã viết, chưa thử với file thật. |
| Login admin, `SetupSuperAdmin` | Giao diện tối riêng, chưa xét đồng bộ. |
| Dashboard: 2 thẻ màu đậm | Giữ làm điểm nhấn; quyết định có đồng bộ không. |
| Tên trang Soát vé "Kiểm tra vé" | Xác nhận tên (trước: "Hệ thống kiểm soát"). |
| Bảng trên điện thoại | Dạng thẻ cho Giao dịch/Gói vé/Voucher nếu nhân viên dùng điện thoại. |
| `ui/dialog.tsx` | Dialog nào chưa dùng AdminDialog vẫn có X cyan + chặn Esc/outside. |
| Push | Chưa push (chỉ commit cục bộ). |

## Lỗi/giới hạn đã biết, chưa sửa
- `forgetPassImpl` trả 404 "Email không tồn tại!" cho email lạ (cho phép dò email) – có từ trước.
- Toys: chưa có nút khôi phục (cần API); module đang ẩn.
- Một số cột phụ ẩn dưới màn 1536px để bảng vừa 1440px.
- Chưa có test tự động cho `loginWithSessionImpl`, `validateOTPImpl`, `resendOTPImpl` khi tài khoản bị khóa (code đã chặn).
