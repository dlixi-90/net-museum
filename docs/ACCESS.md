# Đăng nhập và phân quyền

Quyền hiện hành lấy từ cột users.role trong PostgreSQL, gồm admin và user. Mỗi yêu cầu ghi kiểm tra lại phiên và users.active. Trình duyệt không tự cấp quyền bằng localStorage hoặc trường role trong đăng ký công khai.

ADMIN_EMAILS chỉ dành cho bước thiết lập quản trị viên đầu tiên trên máy cục bộ và giữ các email đó khỏi đăng ký công khai. Khi đã có admin, quản lý người dùng tại /nguoi-dung/; thay ADMIN_EMAILS không thay quyền những tài khoản hiện có. Tài khoản admin hiện có giữ nguyên vai trò và mật khẩu.

Đăng ký tại /tai-khoan/?mode=register với họ tên, email, tên tài khoản, mật khẩu 10–200 ký tự và xác nhận. Đăng nhập bằng email hoặc tên tài khoản. Mật khẩu băm scrypt có salt; cookie HttpOnly/SameSite=Strict; CSDL chỉ giữ hash token và thời hạn. Production cần HTTPS và cookie Secure. Chưa có xác minh email hoặc khôi phục mật khẩu qua thư.

Admin tạo/sửa/xóa tài khoản, đổi vai trò, khóa/mở khóa và đặt mật khẩu mới qua giao diện. Danh sách không trả hash mật khẩu. Không thể xóa, khóa hoặc hạ quyền admin hoạt động cuối cùng; advisory lock bảo vệ cả khi thao tác đồng thời. Thay role, active hoặc mật khẩu thu hồi toàn bộ phiên của tài khoản đó.

Khách xem và tìm tài nguyên đã gắn với hồ sơ công khai. User có yêu thích đồng bộ trong PostgreSQL. Admin quản trị tác phẩm, tài nguyên và người dùng. API trả 401 khi chưa đăng nhập, 403 khi thiếu quyền; tài nguyên chưa công khai trả 404 cho khách/user.

Thiết lập lần đầu: cấu hình ADMIN_EMAILS và ALLOW_ADMIN_SETUP=true trong môi trường cục bộ, mở /quan-ly/. Khi đã có admin, cấp tài khoản tiếp theo qua /nguoi-dung/. Production dùng ALLOW_ADMIN_SETUP=false. Xem [hướng dẫn chức năng](MULTIMEDIA.md) và [kiểm thử](KIEM_THU.md).
