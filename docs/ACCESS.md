# Đăng nhập và quyền quản trị

Quyền admin được xác định ở backend bằng email của tài khoản đã đăng nhập và biến `ADMIN_EMAILS` trong **`di-san-viet/.env`**. Khai báo nhiều địa chỉ bằng dấu phẩy; khoảng trắng và chữ hoa/thường được chuẩn hóa.

```dotenv
ADMIN_EMAILS=admin1@example.com,admin2@example.com
```

Sau khi thay đổi danh sách, khởi động lại backend bằng `npm.cmd start`. Tài khoản không còn trong danh sách sẽ thành user thường, kể cả khi MongoDB vẫn lưu `role: admin` hoặc phiên cũ chưa hết hạn. Không lấy quyền từ localStorage hay từ trường `role` gửi lên từ trình duyệt.

## Tạo tài khoản và đăng nhập

1. Chạy bản Node.js đầy đủ trên máy cục bộ với `ALLOW_ADMIN_SETUP=true` và `NODE_ENV=development`.
2. Bấm **Đăng nhập** ở đầu trang. Nếu chưa có admin, biểu mẫu thiết lập mở sẵn. Nếu đã có tài khoản đầu tiên, chọn **Thiết lập tài khoản quản trị trên máy này** để tạo tài khoản thứ hai.
3. Nhập đúng email trong `ADMIN_EMAILS`, họ tên và mật khẩu riêng dài ít nhất 10 ký tự. Mỗi email chỉ tạo được một tài khoản; không ghi đè mật khẩu tài khoản đã có.
4. Đăng nhập lại bằng mật khẩu Nét đã tạo. Việc thêm email vào `.env` không tự tạo mật khẩu và không phải đăng nhập Google.

Trên production, dùng `ALLOW_ADMIN_SETUP=false`, `NODE_ENV=production`, HTTPS và `PUBLIC_ORIGIN` đúng origin. Thiết lập tài khoản trên môi trường cục bộ an toàn trước khi triển khai.

## Khách, user và admin

- Khách thấy nút **Đăng nhập**, bộ sưu tập và chức năng xem/lưu tác phẩm.
- User thường không thấy **Quản lý**, liên kết quản trị ở chân trang hoặc liên kết chỉnh sửa tác phẩm. Mở trực tiếp `/quan-ly/` cũng không hiện bảng quản lý hay biểu mẫu thêm/sửa.
- Admin đã được máy chủ xác nhận mới thấy các chức năng này. Mỗi yêu cầu ghi, tải ảnh hoặc video đều kiểm tra lại phiên và danh sách email trên server.
- Chưa đăng nhập: API ghi trả `401`. Đã đăng nhập nhưng không có quyền admin: trả `403`.
- Khi mất phiên, đổi tài khoản hoặc làm mới quyền sau khi quay lại tab, giao diện ẩn các chức năng quản trị và đóng biểu mẫu đang mở nếu quyền không còn hợp lệ.

Frontend ẩn nút quản trị ngay trong HTML ban đầu. Khi API phiên không kết nối được, nút vẫn ẩn. Bản Sites hiện tại phục vụ website tĩnh; đăng nhập và phân quyền API hoạt động trên bản có backend Node.js cùng origin, không chạy MongoDB trong gói Sites.

## Kiểm thử

`npm.cmd run check` gồm kiểm thử chuẩn hóa email, quyền phiên và mật khẩu. `npm.cmd run test:integration` gồm kiểm thử HTTP với database `net_test_*` riêng: khách/user bị chặn, hai admin độc lập được phép ghi, giả mạo role không có tác dụng, đăng xuất, phiên hết hạn và thu hồi quyền sau đổi cấu hình. Kiểm thử không cần gọi Cloudinary thật.
