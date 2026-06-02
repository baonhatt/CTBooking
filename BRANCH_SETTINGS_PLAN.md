# Plan: Cấu hình Chi nhánh cho Mô hình Phim 8D Chạy liên tục

Bản kế hoạch này tập trung vào việc quản lý cấu hình riêng cho từng chi nhánh, dựa trên đặc thù: **Mỗi chi nhánh có 1 phòng phim 8D duy nhất, chiếu liên tục, khách mua vé có thể đến xem bất cứ lúc nào trong thời hạn vé.**

## 1. Mục tiêu cốt lõi
- Cho phép Admin bật/tắt hoặc giới hạn vận hành của từng chi nhánh một cách độc lập.
- Tùy chỉnh thời hạn vé và thông tin hỗ trợ riêng theo đặc thù từng cơ sở.

## 2. Các cấu hình cần quản lý (Branch Settings)
Dữ liệu sẽ lưu dưới dạng JSON trong cột `settings` của bảng `branches`:

1.  **Vận hành & Trạng thái**:
    - `is_open`: Bật/Tắt chế độ nhận khách tại chi nhánh (nếu tắt, website sẽ ẩn hoặc báo chi nhánh đang bảo trì).
    - `maintenance_message`: Thông báo riêng khi chi nhánh tạm đóng cửa (ví dụ: "Đang bảo trì ghế 8D").
2.  **Giờ phục vụ**:
    - `business_hours`: Giờ mở cửa/đóng cửa (để khách biết khi nào có thể đến xem).
3.  **Chính sách vé (Đặc thù 8D)**:
    - `ticket_validity_days`: Số ngày vé có hiệu lực kể từ khi thanh toán (mặc định hiện tại là 10 ngày, có thể chỉnh riêng cho từng chi nhánh).
4.  **Thông tin liên hệ**:
    - `hotline`: Số điện thoại hỗ trợ riêng cho chi nhánh.
    - `map_url`: Link Google Maps để khách dễ dàng tìm đường đến chi nhánh đó.

## 3. Các bước triển khai

### Giai đoạn 1: Database & Backend
- **SQL Migration**: Thêm cột `settings` (TEXT/JSON) vào bảng `branches`.
- **API Admin**: 
  - Cập nhật `GET /api/admin/branches`: Trả về thông tin chi nhánh kèm số lượng đơn hàng đang chờ thanh toán (`pending_bookings_count`).
  - Cập nhật `PUT /api/admin/branches/:id`: 
    - Nếu Admin muốn chuyển `is_open` từ `true` sang `false`: Kiểm tra xem có đơn hàng nào của chi nhánh này đang ở trạng thái `pending` và còn trong thời gian chờ thanh toán (ví dụ: 15 phút) hay không.
    - Nếu có đơn hàng chờ: Trả về lỗi 400 kèm thông báo: "Không thể đóng cửa. Hiện đang có [X] đơn hàng đang trong quá trình thanh toán. Vui lòng đợi khách hoàn tất hoặc hết thời gian chờ."
- **Cơ chế bảo vệ (Race Condition Protection)**:
  - Cập nhật API `POST /api/validate-booking`: Kiểm tra `is_open` của chi nhánh trước khi cho phép đi tiếp.
  - Cập nhật API tạo thanh toán: Re-verify trạng thái chi nhánh trước khi gọi Gateway (MoMo/VNPay).
- **Logic Helper**: Viết hàm lấy `ticket_validity_days` từ chi nhánh khi xử lý thanh toán để tính `expiry_date` cho vé.

### Giai đoạn 2: Tích hợp Frontend (Admin)
- Cập nhật Modal chỉnh sửa chi nhánh trong `Branches.tsx`:
  - Thêm phần cấu hình giờ giấc, số ngày hết hạn vé.
  - Thêm Switch `is_open` (Trạng thái nhận khách).
  - **Logic chặn đóng cửa**: Nếu API trả về lỗi có đơn hàng chờ, hiển thị Modal cảnh báo chi tiết danh sách/số lượng đơn hàng đang chờ để Admin nắm tình hình.
  - Ràng buộc: Không được phép tắt `is_open` nếu chi nhánh đang là Mặc định (Default).

### Giai đoạn 3: Tích hợp Frontend (Người dùng)
- **Dropdown Home**: Chỉ hiển thị chi nhánh có `is_active = true` AND `is_open = true`.
- **Xử lý lỗi Mid-session**: Nếu API trả về lỗi chi nhánh đóng cửa, hiển thị thông báo và chuyển hướng khách về trang Home để chọn lại chi nhánh.
- **Trang chi tiết vé/Email**: Hiển thị đúng Hotline và link chỉ đường của chi nhánh khách đã chọn.

## 4. Ưu điểm của Plan này
- **Đúng mô hình**: Không làm phức tạp hóa việc chọn ghế/suất chiếu vì phòng phim 8D chạy liên tục.
- **Linh hoạt**: Nếu chi nhánh A hỏng thiết bị, chỉ cần tắt `is_open` của chi nhánh đó, các chi nhánh khác vẫn hoạt động bình thường.
- **Tối giản**: Chỉ tập trung vào những field thực sự cần thiết cho việc vận hành hiện tại.
