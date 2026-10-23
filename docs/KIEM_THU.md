# Kết quả kiểm thử — 23/10/2026

Môi trường Windows, Node.js 24, PostgreSQL 17 qua Docker Desktop. Test tạo schema net_test_* riêng và dọn đúng schema của nó; không sửa tài khoản nghiệp vụ. Các tệp kiểm thử mới dùng thư mục tạm riêng. Cloudinary trong test cũ được giả lập tại ranh giới dịch vụ.

## Các phép kiểm tra

- npm.cmd run check: build 14 trang, kiểm tra cú pháp và 19/19 unit test.
- npm.cmd run test:integration: 9/9 integration test PostgreSQL thật (4 bài nền + 4 bài multimedia + 1 bài cloud).
- npm.cmd run db:queries: cả 15 SQL chạy thành công; số dòng trước các tương tác QA là 7,3,7,3,2,7,5,2,7,0,0,0,7,4,5.
- npm.cmd run media:index: 14 ảnh được lập chỉ mục, 0 lỗi, bao gồm ảnh cũ Cloudinary và ảnh chi tiết cục bộ.
- npm.cmd run test:cbir: bảy truy vấn leave-one-out, sáu có ảnh liên quan; P@5=0,40, R@5=1,00. Xem results/cbir-evaluation.json.

## Kiểm thử tích hợp multimedia

1. Đủ năm loại/49 tài nguyên, MP3 tiếng Việt thật, PDF thật, DOCX có nội dung, tìm không dấu/nhiều điều kiện, CBIR top-5, loại ảnh truy vấn, seed không khôi phục hồ sơ đã xóa.
2. Tải/chia khối/tiếp tục MP4 hơn 50 MiB, offset sai, trạng thái từ kết nối DB mới, hoàn tất lặp không trùng, tệp sai định dạng, hết hạn, HTTP 206/416, kiểm tra metadata, xóa vật lý qua hàng đợi.
3. CRUD user, tên tài khoản khi đăng nhập, khóa và thu hồi phiên, không lộ hash, giữ admin cuối cùng khi đồng thời, yêu thích theo tài khoản.
4. Sửa metadata, chặn URL nguồn nguy hiểm và user ghi, gắn/gỡ tài nguyên, revision, sự kiện xem/tải chống lặp, thống kê năm loại/chủ đề/hiện vật.

## Kiểm tra Chrome

Chrome headless trên schema và tài khoản QA riêng đã chạy tìm kiếm, CBIR, xem PDF/DOCX, phát MP3 tiếng Việt 38,27 giây, tạo user, tải TXT bằng File thật từ biểu mẫu, sửa metadata/gắn tài liệu, tạo hồ sơ kèm ảnh và TXT, lưu yêu thích rồi mở lại trang đã lưu, xem thống kê. Không có exception JavaScript hoặc lỗi backend trong lần chạy hoàn tất.

Ảnh chụp desktop 1440 và mobile 390 px xác nhận các trang tìm kiếm, chi tiết, thống kê không tràn ngang; đã xem thêm quản trị user/kho/tác phẩm. Bộ QA dùng dữ liệu riêng và được dọn, không để tài khoản thử trong DB nghiệp vụ. Website có 14 trang template.

## Giới hạn

Chưa đo video sát 1 GiB hoặc tải phát đồng thời, chưa thử mạng WAN thật, Safari/Firefox/điện thoại thật. MP4 thử lớn dùng video mẫu hợp lệ với phần đệm để kiểm tra vận chuyển, không đại diện độ phức tạp nội dung phim dài. DOCX chỉ trích văn bản; chưa kiểm chứng mọi codec MOV. Audio mẫu là giọng tổng hợp. Tập đánh giá CBIR nhỏ, nhãn nhóm gốm rộng và k lớn; không suy rộng chất lượng. Chưa triển khai bản mới online.

## Bổ sung Neon + Render Free

- Đã phục hồi vào Neon schema net_museum_import: 27 bảng, 1 user, 7 hiện vật, 49 resource. Số dòng nghiệp vụ, hash/quyền và metadata khớp nguồn sau chuẩn hóa thứ tự nhãn theo collation. 15 SQL chạy được trên Neon.
- Cloudinary thật: sáu định dạng JPG/MP3/MP4/PDF/DOCX/TXT upload và inspect thành công; PDF được bật quyền phân phối. Tệp thử đã xóa.
- Chrome thật: luồng tải trực tiếp qua CORS, sửa metadata/gắn TXT, tạo hồ sơ kèm ảnh/TXT, yêu thích và thống kê; schema QA riêng, không exception JavaScript/backend trong lần hoàn tất.
- Cloud integration có upload nhiều khối, ngắt mạng rồi chọn lại tệp để tiếp tục, mất xác nhận cuối rồi hoàn tất lại không gửi trùng, owner/hạn/cỡ/định dạng, từ chối lưu local khi bật cloud.
- Unit mới kiểm tra chữ ký không lộ secret, URL/size provider, nội dung tải thật và địa chỉ client chỉ tin proxy nền tảng.
- Chưa xác nhận triển khai Render thực tế: cấu hình và file môi trường đã chuẩn bị; cần push mã nguồn và tạo service trong Dashboard.
- Đã chạy backend bằng cấu hình production Neon/Cloudinary trên cổng thử riêng: health kết nối, 7 hồ sơ, 49 resource, 7 audio, CBIR trả5, thiết lập admin tắt và chặn origin lạ; không lỗi backend. Tiến trình thử đã dừng. Đây là kiểm chứng cấu hình production trên máy, chưa thay cho kiểm tra URL Render sau deploy.
