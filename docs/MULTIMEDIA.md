# Hướng dẫn các chức năng đa phương tiện

Đã chuẩn bị bản online [Render Free + Neon + Cloudinary](RENDER_NEON.md). Chọn `UPLOAD_STORAGE=cloudinary` để tải tệp ra kho ngoài; phiên cloud một giờ, video tối đa100 MiB theo cấu hình mặc định và quota tài khoản. Phần dưới mô tả thêm luồng cục bộ.

Bản cục bộ dùng Node.js, PostgreSQL 17 trong Docker Desktop và kho tệp bên ngoài CSDL. Khởi động trong thư mục `di-san-viet`:

```powershell
npm.cmd run db:start
npm.cmd run db:seed
npm.cmd start
```

Mở http://localhost:3000. Đăng nhập bằng tài khoản cũ; quyền admin đã được giữ trong PostgreSQL.

## Các màn hình

| Địa chỉ | Sử dụng |
|---|---|
| `/tai-khoan/` | Đăng ký, đăng nhập bằng email hoặc tên tài khoản, đăng xuất |
| `/bo-suu-tap/` | Duyệt hiện vật theo bộ sưu tập và niên đại |
| `/tim-kiem/` | Kết hợp tên/nội dung, tác giả, chủ đề, thời kỳ hiện vật, từ khóa, loại, dung lượng và ngày thêm |
| `/tac-pham/?id=37557` | Nhiều ảnh, audio tiếng Việt, video minh họa và hồ sơ PDF/DOCX/TXT |
| `/tai-nguyen/?id=...` | Xem/phát/đọc một tư liệu, metadata đầy đủ, tải tệp |
| `/quan-ly/` | Admin thêm/sửa/xóa hiện vật; chọn nhiều tệp đính kèm trong cùng biểu mẫu |
| `/tai-nguyen/quan-ly/` | Admin tải tệp, sửa metadata, gắn tư liệu vào hồ sơ, xóa tư liệu chưa sử dụng |
| `/nguoi-dung/` | Admin tạo/sửa/xóa tài khoản, đổi vai trò, khóa/mở khóa, đặt mật khẩu mới |
| `/thong-ke/` | Số lượng năm loại, dung lượng, chủ đề, hiện vật quan tâm, tư liệu xem/tải nhiều |
| `/da-luu/` | Yêu thích đồng bộ theo tài khoản; khách lưu trong trình duyệt |

## Audio tiếng Việt

Bộ mẫu có **7 MP3 tiếng Việt**, mỗi bản khoảng 31–34 giây, kèm lời đọc để đối chiếu. Đây là giọng tổng hợp eSpeak NG, được ghi rõ trong giao diện; không phải bản thu hướng dẫn viên. Bảy video minh họa cũng có phần thuyết minh tiếng Việt.

Để thay bằng giọng thu của bạn: vào kho tài nguyên, tải MP3 hoặc WAV, sửa tên/tác giả/nguồn/quyền/lời thuyết minh, chọn tác phẩm để gắn. Sau đó gỡ audio cũ trong biểu mẫu chỉnh sửa tác phẩm. Trường ngôn ngữ của audio dùng `vi-VN`; ứng dụng không tự nhận diện hoặc dịch tiếng nói của tệp người dùng tải lên.

## Tải lên và tải tiếp

| Loại | Định dạng | Giới hạn |
|---|---|---|
| Ảnh | JPG, PNG, WebP | 8 MiB; chuẩn hóa thành WebP |
| Audio | MP3, WAV | 64 MiB |
| Video | MP4, WebM, MOV | 1 GiB |
| Tài liệu | PDF, DOCX | 20 MiB |
| Văn bản | TXT UTF-8 | 5 MiB |

Tệp tải lên được chia thành khối tối đa 6 MiB. Tiến độ đã xác nhận lưu trong PostgreSQL, dữ liệu tạm nằm ở `uploads/.staging/`. Khi mất mạng, dừng hoặc tải lại trang, chọn lại **cùng tệp** trong cùng trình duyệt và tài khoản trong 24 giờ để tiếp tục. Không đổi tên hoặc sửa tệp trong thời gian tải. Tiến độ 100% còn bước kiểm tra định dạng và metadata trước khi tệp xuất hiện trong kho.

FFprobe kiểm tra stream và thời lượng audio/video; PDF được đọc số trang; DOCX được đọc văn bản với giới hạn giải nén; TXT được kiểm tra UTF-8. Tệp lớn được ghi theo khối và phát qua HTTP Range; không nạp toàn bộ video vào RAM. Đã thử tải tiếp một MP4 lớn hơn 50 MiB. Chưa đo tải thực tế với video sát 1 GiB hoặc nhiều người phát đồng thời.

Khi UPLOAD_STORAGE=local, tệp mới được lưu trên ổ đĩa máy chạy Node.js trong `uploads/`; Render Free dùng cloudinary và không giữ tệp mới ở đây. Cần sao lưu thư mục này cùng PostgreSQL. Video MOV có thể cần đổi sang MP4 H.264/AAC để trình duyệt hỗ trợ; hệ thống chưa có worker chuyển mã hay HLS. Ảnh cũ trên Cloudinary vẫn được giữ. Luồng chia khối cần ổ đĩa bền vững, không chạy trên Vercel serverless.

## Metadata và xóa

Mỗi tài nguyên có mã, tên, loại, định dạng, dung lượng, ngày tạo, tác giả, chủ đề, từ khóa, mô tả và đường dẫn. Các trường kỹ thuật lấy từ máy chủ; admin sửa các trường mô tả trong kho tài nguyên. PDF mở bằng trình xem của trình duyệt; DOCX hiển thị văn bản trích xuất và cho tải bản gốc, không giữ bố cục Word.

Xóa hồ sơ tác phẩm chỉ xóa các liên kết, giữ tệp để tái sử dụng. Muốn xóa tài nguyên khỏi kho, trước tiên gỡ khỏi mọi hồ sơ. Hệ thống trả 409 nếu tài nguyên còn được dùng. Nút **Dọn tệp đã xóa** thực hiện công việc xóa vật lý đã ghi trong hàng đợi; tệp mẫu gốc không bị xóa khỏi mã nguồn.

## Tìm ảnh tương tự

Mở phần **Tìm ảnh có màu sắc tương tự** tại trang tìm kiếm hoặc chọn liên kết tương ứng ở trang chi tiết. Hệ thống trích histogram RGB 64 chiều từ ảnh thu nhỏ tối đa 128×128, so cosine với vector cùng phiên bản, loại ảnh truy vấn và trả tối đa năm ảnh. Ảnh truy vấn tạm không được ghi vào kho.

Ảnh mới được lập chỉ mục khi tải xong. Admin có thể bấm **Cập nhật chỉ mục ảnh** để cập nhật ảnh cũ; có lệnh tương đương:

```powershell
npm.cmd run media:index
npm.cmd run test:cbir
```

Kết quả thực nghiệm ghi tại `docs/results/cbir-evaluation.json`: trên bảy ảnh bìa gốc, sáu truy vấn có ảnh cùng nhóm khác, macro P@5 = 0,40 và macro R@5 = 1,00. Một ảnh men trắng không có ảnh liên quan khác nên loại khỏi trung bình. Tập nhỏ, k=5 trong sáu ứng viên; kết quả không chứng minh chất lượng tổng quát và không nhận diện cùng hiện vật.

## Thống kê và quyền truy cập

Xem tư liệu, phát audio/video và tải tệp ghi sự kiện trong PostgreSQL. Mỗi trình duyệt/tư liệu/hành động ghi một lần trong một giờ. Lượt tải là số yêu cầu tải, không xác nhận hoàn tất. Một tư liệu có nhiều chủ đề có thể xuất hiện ở nhiều dòng thống kê.

Chỉ admin quản trị nội dung và tài khoản. Tệp chưa gắn với hồ sơ công khai chỉ admin truy cập được. Đổi quyền, khóa hoặc đổi mật khẩu thu hồi phiên hiện có; hệ thống giữ ít nhất một admin hoạt động.
