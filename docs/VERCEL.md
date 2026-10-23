> Đích triển khai hiện tại: [Render Free + Neon + Cloudinary](RENDER_NEON.md). Tài liệu này chỉ giữ cho phương án Vercel khác; chưa kiểm chứng toàn bộ chức năng trên Vercel.

# Triển khai backend PostgreSQL lên Vercel

Mã nguồn cục bộ hiện dùng PostgreSQL. Môi trường online chưa được cập nhật trong lần chuyển đổi này.

## Chuẩn bị database online

PostgreSQL trong Docker Desktop chỉ dùng cục bộ. 127.0.0.1 trong Vercel là máy của function, không phải máy cá nhân. Cần một PostgreSQL cloud hoặc máy chủ có kết nối phù hợp, dùng TLS theo nhà cung cấp và chọn giới hạn pool cho serverless.

Đặt các biến môi trường trên Vercel: DATABASE_URL, PG_SCHEMA, PG_POOL_MAX, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, ADMIN_EMAILS và PUBLIC_ORIGIN nếu có tên miền riêng. Không đưa secret vào dist hoặc Git.

Chạy schema/seed hoặc migration vào database online trước khi dùng. api/index.mjs khởi tạo schema nhưng seed=false. Tài khoản quản trị cần được cấp qua môi trường khởi tạo được phép trước khi công bố; setup luôn tắt trên Vercel.

## Hoạt động

Frontend ở dist; rewrite /api/* vào api/index.mjs. Các request trong một instance dùng chung pool PostgreSQL. Upload video/ảnh có chữ ký đi từ trình duyệt tới Cloudinary rồi server xác minh trước khi ghi metadata. Không đổi giao diện để chứa URI CSDL.

Sau triển khai, kiểm tra /api/health trả database=postgresql, connected=true; kiểm tra catalogue từ API, đăng nhập và thêm/sửa bằng tài khoản demo. Không xem dữ liệu hiển thị từ snapshot là bằng chứng API thành công.
