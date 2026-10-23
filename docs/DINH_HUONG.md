# Kiến trúc hiện tại

Frontend JavaScript gọi HTTP API Node.js cùng origin; pg Pool thực thi SQL có tham số trên PostgreSQL 17. Tệp ngoài CSDL: bộ mẫu trong dist/assets/samples, tệp mới trong uploads ở chế độ local hoặc trên Cloudinary ở chế độ cloud; ảnh cũ Cloudinary vẫn giữ. Cần ổ đĩa bền vững cho backend cục bộ.

## CSDL

database/schema.sql kết hợp database/multimedia.sql tạo 27 bảng và hai view artwork_catalog/media_catalog. ID user/hiện vật/tài nguyên là text; danh mục dùng bigint identity. Metadata chung ở resources, thuộc tính chuyên biệt ở images/audio/videos/documents/texts. artifact_resources, resource_keywords và resource_topics biểu diễn quan hệ N–N. app_settings giữ mốc seed để hồ sơ mẫu đã xóa không tự xuất hiện lại. media_deletions là hàng đợi dọn tệp.

server/repository.mjs và multimedia-repository.mjs dùng transaction cùng pg client, khóa hàng và revision; advisory lock bảo vệ lần khởi tạo và admin cuối cùng. FK ghép kiểm tra loại tài nguyên, PK/UNIQUE/CHECK bảo vệ khóa và miền dữ liệu.

## Chức năng

feature-routes.mjs triển khai tìm kiếm metadata, CBIR, quản trị user, CRUD tài nguyên, yêu thích và thống kê. files.mjs kiểm tra nội dung thật bằng sharp, FFprobe, pdf-lib và fflate; phục vụ HTTP Range. local-uploads.mjs tiếp nhận khối tối đa 6 MiB, lưu offset trong DB, chủ sở hữu và hạn 24 giờ. Video tối đa 1 GiB. Không có chuyển mã nền/HLS.

Ảnh được trích histogram RGB 64 chiều, tiền xử lý tối đa 128×128, phiên bản rgb4x4x4-128-v2. PostgreSQL tính cosine bằng unnest WITH ORDINALITY; lọc quyền công khai và loại ảnh truy vấn. Không dùng mô hình nhận dạng vật thể.

Quyền admin lấy từ users.role; khóa/đổi quyền/đổi mật khẩu thu hồi phiên. Yêu thích và sự kiện khai thác lưu tập trung; khách vẫn có danh sách yêu thích cục bộ. [Hướng dẫn sử dụng](MULTIMEDIA.md).

## Môi trường

Docker Desktop chạy PostgreSQL tại 127.0.0.1:5433. DATABASE_URL/PG_SCHEMA chọn đích; dữ liệu hiện tại trong net_museum_import. Neon đã nạp dữ liệu và đối chiếu 27 bảng. render.yaml chuẩn bị Web Service Free, dùng Cloudinary thay ổ upload; service Render chưa được tạo/deploy trong tài khoản. Xem RENDER_NEON.md.

## Luồng cloud cho Render Free

cloud-uploads.mjs và cloud-media.mjs ký public ID cố định, giới hạn theo loại/cỡ, chủ sở hữu và hạn một giờ. cloud-upload.js gửi FormData/Content-Range trực tiếp đến Cloudinary, ghi offset gợi ý vào Neon. Complete xác minh bằng Admin API, tải tệp tạm có giới hạn, inspect nội dung thật và ghi resource/vector trong transaction; hoàn tất lặp dùng resource cũ. Không dựa vào ổ Render để lưu media bền vững.

Neon dùng Direct URL có TLS và pg.Pool tối đa ba kết nối; không dùng URL -pooler vì repository đang đặt search_path theo phiên. Render lấy HOST=0.0.0.0, PORT do nền tảng cấp, origin từ RENDER_EXTERNAL_URL và IP client sau proxy cho rate limit.
