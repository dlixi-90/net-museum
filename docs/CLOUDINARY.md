# Cloudinary cho Render Free

PostgreSQL Neon giữ metadata; Cloudinary giữ ảnh, audio, video, PDF, DOCX và TXT tải mới. Backend ký yêu cầu và xác minh tệp, trình duyệt gửi trực tiếp khối6 MiB đến Cloudinary. [Hướng dẫn Render + Neon](RENDER_NEON.md).

## Thiết lập

Điền CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET trong môi trường backend, đặt UPLOAD_STORAGE=cloudinary. Với Render, nhập các giá trị từ file riêng .env.render. API secret không trả về trình duyệt; không cần unsigned preset. Trong Cloudinary Settings → Security, bật Allow delivery of PDF and ZIP files.

## Giới hạn và metadata

Ảnh≤8 MiB, audio≤64 MiB, PDF/DOCX≤20 MiB, TXT≤5 MiB. CLOUD_UPLOAD_MAX_MIB mặc định100 nên video cloud≤100 MiB; quota tài khoản có thể thấp hơn. Ảnh cloud giữ đúng JPG/PNG/WebP thực tế; luồng local vẫn chuyển WebP. FFprobe kiểm tra audio/video, pdf-lib đọc PDF, fflate đọc DOCX, TXT kiểm tra UTF-8. Vector lấy từ chính ảnh đã lưu; SHA-256 tính server-side.

Public ID do backend tạo trong net-museum/direct/<kind>/<UUID>; raw có phần mở rộng. Audio dùng resource_type=video trên Cloudinary, tài liệu/TXT dùng raw. Không nhận URL hoặc public ID do client tự khai làm metadata đã xác minh.

## Tiếp tục và hoàn tất

Phiên cloud có hạn một giờ, lưu owner/offset/completed ID trong PostgreSQL. Chọn lại cùng tệp để thử tiếp; việc giữ khối còn phụ thuộc Cloudinary. Complete idempotent, kiểm tra metadata provider và nội dung thật trước khi tạo resource. Nếu mất xác nhận cuối, thử lại có thể xác minh tệp đã có mà không gửi lại dữ liệu.

Tệp tạm dùng để inspect được dọn; không lưu bền trên Render. Tệp đã tải nhưng chưa gắn hiện vật chỉ admin truy cập qua API. Cloudinary URL của tài sản public vẫn là URL phân phối trực tiếp; không dùng mô hình này cho tài liệu cần bảo mật riêng.

## Xóa và chuyển tệp local

Gỡ liên kết không xóa tệp. Xóa resource còn dùng bị chặn; tài nguyên chưa dùng được xóa metadata và đưa vào media_deletions. Nút Dọn tệp đã xóa xử lý xóa vật lý, có thể thử lại. Tệp hoàn tất tại provider nhưng chưa ghi được DB có thể cần kiểm tra/dọn qua Cloudinary Console nếu phiên đã hết hạn.

Chạy npm.cmd run media:publish để kiểm tra các resource có URL /uploads/. Thêm -- --apply để chuyển sang cloud, giữ tệp gốc và metadata nghiệp vụ. Bộ samples trong dist/assets đi cùng mã nguồn, không cần chuyển. Công cụ media:migrate cũ chỉ chuyển ảnh vẫn được giữ cho tương thích.

## Kiểm chứng

Đã upload, xác minh và đọc thật JPG, MP3, MP4, PDF, DOCX, TXT trên tài khoản hiện có; xóa tệp thử sau kiểm tra. Chrome đã chạy tải TXT, tạo hồ sơ kèm ảnh/TXT và kiểm tra resource nằm trên Cloudinary trong schema QA riêng. Bộ kiểm thử có ca mất mạng giữa hai khối và mất xác nhận cuối; không gửi tài sản thử vào dữ liệu nghiệp vụ Neon.

Tham khảo: [Cloudinary upload](https://cloudinary.com/documentation/upload_images), [Admin API](https://cloudinary.com/documentation/admin_api).
