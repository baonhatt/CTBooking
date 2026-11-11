# Admin UI sync – tình trạng và việc còn lại

Quy ước chung nằm ở `client/components/admin/common/` (AdminDialog, ConfirmDialog, RowActionButton, StatusBadge, PageHeader, AdminPagination, EmptyState, FormField, notify, adminTokens).

Quyết định đã chốt:
- Modal thêm/sửa (`mode="form"`): không đóng khi bấm ra ngoài; X, Esc, nút Hủy khi đang sửa dở thì hỏi "Thay đổi chưa được lưu". Modal xem (`mode="view"`) đóng tự do.
- Trạng thái chuẩn: "Hoạt động" / "Ngừng hoạt động" (khóa: "Đã khóa"); badge 5 tone.
- Uploads dùng giao diện sáng. Users: chỉ xem + khóa/mở khóa. Module Đồ chơi đang tạm ẩn (`/toys`).
- Responsive: dưới 1024px dùng menu kéo ra (hamburger), từ 1024px sidebar cố định. Điện thoại: Soát vé dùng tốt; các bảng cuộn ngang trong khung (mức "dùng được").

## Đã xong và đã kiểm tra trình duyệt
Toàn bộ trang admin (list, form, modal, Dashboard, Settings, Profile, Soát vé, Lịch chiếu, Chi tiết vai trò, trang đã xóa), AdminLayout (breakpoint lg, nhãn menu kéo ra), khóa/mở khóa tài khoản (đã chạy thật trên local, đã mở khóa lại), cảnh báo chưa lưu trên 6 form lớn (không bị dirty khi vừa mở), công tắc trạng thái, không lỗi console, tsc sạch.

## Còn lại – cần làm / kiểm tra
| Việc | Ghi chú |
|---|---|
| Test RBAC bằng tài khoản không phải Super Admin | Cần tài khoản + mật khẩu test local. Kiểm tra nút xem/sửa/xóa/khóa và nút "Chỉnh sửa" trong modal xem hiện đúng quyền. |
| Quyền mới `users:lock` | Chạy lại seed phân quyền; tới lúc đó chỉ Super Admin khóa/mở khóa. |
| Test đăng nhập phía khách khi bị khóa | Chỉ mới đọc code (5 điểm chặn); chưa có test tự động cho endpoint khóa. |
| Popup hết phiên (còn 5 phút / 1 phút) | Chưa xem trực quan. |
| Menu thả của thanh soạn thảo bài viết (phông, tiêu đề) | Chưa mở thử, kiểm tra không bị cắt. |
| Bảng trên điện thoại | Cột Thao tác phải vuốt ngang; cân nhắc dạng thẻ cho Giao dịch/Gói vé/Voucher nếu nhân viên dùng điện thoại. |
| Login admin, `SetupSuperAdmin` | Giao diện tối riêng, chưa xét đồng bộ. |
| Dashboard: 2 thẻ màu đậm (VIP xanh, Hệ thống tối) | Giữ làm điểm nhấn; quyết định có đồng bộ không. |
| `ui/dialog.tsx` | Dialog chưa dùng AdminDialog vẫn có X cyan + chặn Esc/outside. |
| Tên trang Soát vé "Kiểm tra vé" (trước: "Hệ thống kiểm soát") | Xác nhận tên. |
| Nút xác nhận Soát vé không còn đổi màu theo hành động | Xem có chấp nhận được. |
| Line endings: nhiều file TS đang là LF | Kiểm tra quy ước repo trước khi commit (git cảnh báo LF->CRLF). |
| Chưa commit | 50+ file đã đổi, 1 file xóa (`UserEditModal.tsx`), thư mục mới `components/admin/common/`. |

## Lỗi cũ phát hiện, chưa sửa
- Toys: không có nút khôi phục; xóa dùng `fetch` thô, bỏ qua prop `deleteToyApi` (module đang ẩn).
- Đặt lại mật khẩu vẫn chạy cho tài khoản bị khóa.
- Dashboard đọc năm/chi nhánh từ `localStorage` không kiểm tra hợp lệ.
- Staff/Users/Posts: một số cột phụ ẩn dưới màn 1536px để bảng vừa 1440px.
- `getUserById` ở `client/lib/api/users.ts` đã có kiểu đầy đủ; kiểm tra các nơi khác dùng kiểu cũ nếu có.
- Dropzone Uploads: kéo thả đã làm, chưa test bằng file thật.
