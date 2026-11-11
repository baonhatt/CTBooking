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

## Quyết định đã chốt (chủ sản phẩm)
- Quyền `users:lock` trên DB đang chạy: dùng nút "Khởi tạo vai trò mặc định" ở trang Vai trò. Trên DB local nút này chỉ thêm đúng `users:lock` cho `admin` (62 -> 63 quyền); `staff` và `manager` không đổi (đã so sánh với seed). Trước khi bấm trên live nên so sánh quyền 3 vai trò mặc định với seed vì nút ghi đè quyền của `staff`, `manager`, `admin` (không đụng vai trò tùy chỉnh).
- Giao diện đăng nhập admin: nâng cấp cho đồng bộ (split screen, component AuthShell dùng chung cho đăng nhập, OTP, đổi mật khẩu lần đầu, thiết lập super admin).
- Dashboard: giữ 2 thẻ màu đậm làm điểm nhấn.
- Tên trang Soát vé: "Soát vé xem phim" (khớp tên menu).
- SKIP: bảng dạng thẻ trên điện thoại. Admin dùng chính web, tối đa tablet; trên điện thoại bảng cứ cuộn ngang trong khung.

## Còn lại - người dùng tự test
| Việc | Ghi chú |
|---|---|
| Popup hết phiên (còn 5 phút / 1 phút) | Chưa xem trực quan (cần chờ đồng hồ). |
| Kéo thả file ở Uploads | Đã viết, chưa thử với file thật. |
| Push | Chưa push (chỉ commit cục bộ). |
| `ui/dialog.tsx` | Dialog nào chưa dùng AdminDialog vẫn có X cyan + chặn Esc/outside. |

## Lỗi/giới hạn đã biết, chưa sửa
- `forgetPassImpl` trả 404 "Email không tồn tại!" cho email lạ (cho phép dò email) - có từ trước.
- Toys: chưa có nút khôi phục (cần API); module đang ẩn.
- Một số cột phụ ẩn dưới màn 1536px để bảng vừa 1440px.
- Chưa có test tự động cho `loginWithSessionImpl`, `validateOTPImpl`, `resendOTPImpl` khi tài khoản bị khóa (code đã chặn).

## Cập nhật sau đợt review lần 2
- Lý do khóa tài khoản khách: giữ lưu trong nhật ký (`audit_logs.new_values`, trường `reason`); KHÔNG thêm cột vào `accounts` (quyết định: hạn chế tạo cột). Hệ quả: modal khách không hiện lý do, chỉ xem ở trang Nhật ký hoạt động.
- Gói vé: không đổi được loại gói (Vé xem phim / Trải nghiệm VR) sau khi tạo. Sửa gói: ẩn tab, hiện nhãn "Loại gói: ..."; server trả 400 nếu gửi loại khác (có test). Tạo mới và nhân bản vẫn chọn được loại.
- Lịch chiếu: modal 2 cột (danh sách suất + tìm kiếm bên trái, form Thêm/Sửa cố định bên phải), "Sao chép lịch từ chi nhánh khác" thu gọn dưới form.
- Việt hóa: khung "Metadata" ở chi tiết phim -> "Thông tin hệ thống" (Thêm vào lúc / Người thêm / Sửa lần cuối / Người sửa cuối); Email logs: "Dữ liệu đi kèm".
- Chưa làm (ý tưởng, tùy chọn): nút "Tạo nhanh nhiều suất" ở Lịch chiếu (chọn phim, khung giờ, khoảng nghỉ rồi sinh hàng loạt).
- Cần rà tiếp: các từ tiếng Anh còn sót trong modal (chỉ mới đổi Metadata); nên grep các nhãn tiếng Anh khác khi review.
