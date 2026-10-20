# Kết quả kiểm tra bản mẫu

Kiểm tra trong môi trường Windows, Node.js 24 và Chrome headless, ngày 20/10/2026.

- `npm.cmd run check`: kiểm tra cú pháp hai module, 2 bài kiểm tra thuật toán đều đạt.
- Trình duyệt tải đủ 7 tác phẩm và ảnh cục bộ, không ghi nhận exception JavaScript trong các luồng kiểm tra.
- Lọc gốm men lam trả về 3 tác phẩm.
- Tìm `dia mau` trả về Đĩa hoa mẫu đơn; từ khóa không có kết quả hiển thị trạng thái trống.
- Lưu tác phẩm cập nhật danh sách yêu thích; mở cửa sổ chi tiết và phóng lớn ảnh hoạt động.
- Thống kê hiển thị đủ 3 nhóm trưng bày, hoạt động theo dữ liệu trình duyệt.
- Dùng ảnh 37557 làm truy vấn CBIR: tác phẩm 37557 đứng đầu với độ tương đồng màu 100%. Đây là kiểm tra thuật toán, **không phải đánh giá chất lượng retrieval trên dữ liệu có nhãn**.
- Kiểm tra viewport 1440×1100 và 390×844; trang điện thoại không tràn ngang.
- Bản thiết kế theo ảnh tham khảo: ảnh hero phủ toàn chiều ngang; hai khối trắng chồng lên chân ảnh; chuyển cả ba mục nội dung nổi bật cập nhật đúng tiêu đề/liên kết; menu điện thoại mở, đóng và tự đóng khi chọn liên kết. Các chức năng bộ sưu tập cũ tiếp tục đạt kiểm tra.

Giới hạn: chưa có PostgreSQL trong môi trường, nên các script SQL chưa chạy trên DB thật. Chưa kiểm tra giọng đọc trên thiết bị có giọng Việt; SpeechSynthesis phụ thuộc trình duyệt/hệ điều hành. Chưa kiểm tra Safari/Firefox hoặc thiết bị di động thật.

Ghi nhận ở lần dựng đầu: kho Git của dịch vụ từng trả HTTP 403 với thông báo `Invalid or expired token`. Khi cập nhật thiết kế theo ảnh tham khảo, bước mở kho nguồn đã thành công với credential mới. ID Site được giữ nguyên trong `.openai/hosting.json`.
