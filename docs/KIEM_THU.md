# Kết quả kiểm tra bản mẫu

## Cập nhật tách trang và thiết kế nghệ thuật

- Đã sinh 10 trang HTML từ template, có đường dẫn trực tiếp và tài nguyên tải bằng đường dẫn gốc.
- Kiểm tra Chrome: điều hướng bằng liên kết thật, trạng thái menu đúng trang, tải trực tiếp và tải lại trang con, bộ lọc category giữ trong URL, yêu thích xuyên trang, tìm từ khóa tiếng Việt, CBIR top-5, trang chi tiết và phóng ảnh.
- Kiểm tra bố cục desktop 1440 px và mobile 390 px trên các trang; menu thu gọn và không tràn ngang.
- Trang quản trị riêng được kiểm tra thêm/sửa với MongoDB thật trong database `net_test_ui_*`: tạo admin, upload, thêm, sửa, chuyển sang bộ sưu tập, tải lại và đăng xuất. Không dùng tài khoản hay dữ liệu Atlas của người dùng để thử nghiệm.
- `npm run check` còn kiểm tra HTML đã sinh khớp template. Backend API và cấu hình Atlas được giữ lại.

Kiểm tra trong môi trường Windows, Node.js 24 và Chrome headless, ngày 20/10/2026.

- `npm.cmd run check`: kiểm tra cú pháp và 4 bài kiểm tra tìm kiếm/CBIR/validation đều đạt.
- Trình duyệt tải đủ 7 tác phẩm và ảnh cục bộ, không ghi nhận exception JavaScript trong các luồng kiểm tra.
- Lọc gốm men lam trả về 3 tác phẩm.
- Tìm `dia mau` trả về Đĩa hoa mẫu đơn; từ khóa không có kết quả hiển thị trạng thái trống.
- Lưu tác phẩm cập nhật danh sách yêu thích; mở cửa sổ chi tiết và phóng lớn ảnh hoạt động.
- Thống kê hiển thị 7 nhóm nghệ thuật với số lượng thực tế; lượt xem/yêu thích vẫn theo dữ liệu trình duyệt.
- Dùng ảnh 37557 làm truy vấn CBIR: tác phẩm 37557 đứng đầu với độ tương đồng màu 100%. Đây là kiểm tra thuật toán, **không phải đánh giá chất lượng retrieval trên dữ liệu có nhãn**.
- Kiểm tra viewport 1440×1100 và 390×844; trang điện thoại không tràn ngang.
- Bản thiết kế theo ảnh tham khảo: ảnh hero phủ toàn chiều ngang; hai khối trắng chồng lên chân ảnh; chuyển cả ba mục nội dung nổi bật cập nhật đúng tiêu đề/liên kết; menu điện thoại mở, đóng và tự đóng khi chọn liên kết. Các chức năng bộ sưu tập cũ tiếp tục đạt kiểm tra.

## Cập nhật MongoDB và quản lý tác phẩm

- MongoDB 8.0.17 chạy thật trên localhost, dùng WiredTiger và thư mục dữ liệu bền vững.
- `npm.cmd run test:integration` đạt: seed 7 tác phẩm; chặn ghi khi chưa đăng nhập; tạo admin; mật khẩu được băm; chặn thiết lập admin lần hai; từ chối tệp giả ảnh; tạo ảnh WebP; thêm hồ sơ thật; sửa và tăng revision; trả 409 khi dùng revision cũ; dữ liệu còn sau khởi động lại backend; seed không ghi đè chỉnh sửa; audit log; đăng xuất chặn thao tác ghi; đăng nhập lại.
- Kiểm tra Chrome qua biểu mẫu: tạo admin → chọn ảnh → thêm tác phẩm → sửa tên/tác giả → xem bộ sưu tập cập nhật → tải lại trang → dữ liệu còn → đăng xuất. Dữ liệu có markup trong tên được hiển thị dưới dạng văn bản, không chèn HTML.
- Biểu mẫu thêm/sửa kiểm tra tại 1440×1000 và 390×844, không tràn ngang; không ghi nhận exception JavaScript.
- Các kiểm tra dùng database `net_test_*` và thư mục ảnh tạm riêng, đã dọn sau chạy. Không để lại admin thử nghiệm trong database `net_museum`.

Giới hạn: chưa triển khai backend MongoDB lên máy chủ trực tuyến; bản Sites chỉ có snapshot đọc và thông báo chưa kết nối khi mở quản lý. Chưa kiểm tra giọng Việt, Safari/Firefox hoặc thiết bị di động thật. Bộ truy vấn MongoDB tham khảo chưa chạy bằng mongosh trong môi trường này.

Ghi nhận ở lần dựng đầu: kho Git của dịch vụ từng trả HTTP 403 với thông báo `Invalid or expired token`. Khi cập nhật thiết kế theo ảnh tham khảo, bước mở kho nguồn đã thành công với credential mới. ID Site được giữ nguyên trong `.openai/hosting.json`.
