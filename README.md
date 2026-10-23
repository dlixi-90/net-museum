# Nét — Bảo tàng nghệ thuật số

Backend hiện sử dụng **Node.js + PostgreSQL + Cloudinary**. PostgreSQL lưu dữ liệu quan hệ trong 27 bảng; ảnh/video nằm ngoài CSDL. Giao diện và URL tác phẩm được giữ nguyên.

## Neon + Render Free

Dữ liệu đã được sao chép sang Neon: 1 tài khoản, 7 hiện vật, 49 tài nguyên. Cấu hình `render.yaml` dùng Web Service Free và Cloudinary cho mọi tệp tải mới. Xem [hướng dẫn triển khai từng bước](docs/RENDER_NEON.md). File `.env.render` riêng đã có cấu hình để nhập vào Render Environment; không commit file này. Chưa tạo/deploy service trong tài khoản Render.

Xem trước bằng `npm.cmd run start:neon`; `.env` Docker được giữ cho phát triển và kiểm thử.

## Chạy với Docker Desktop trên Windows

Mở Docker Desktop, đợi Engine chạy, mở PowerShell trong thư mục di-san-viet:

```powershell
npm.cmd install
npm.cmd run db:docker:setup
npm.cmd run db:start
npm.cmd run db:check
npm.cmd run db:seed
npm.cmd start
```

Mở **http://localhost:3000**. Container PostgreSQL của dự án tên **net-museum-postgres**, cổng **127.0.0.1:5433**, database/user **net_museum**. Mật khẩu ngẫu nhiên lưu trong .env.postgresql; DATABASE_URL lưu trong .env. Hai file được Git bỏ qua. Lệnh setup không ghi đè DATABASE_URL đã có.

Xem [hướng dẫn Docker Desktop, pgAdmin, sao lưu và phục hồi](docs/POSTGRESQL.md).

## Dữ liệu PostgreSQL

Cấu hình hiện tại dùng schema **net_museum_import**. Tài khoản, mật khẩu đã băm, ID hiện vật và URL ảnh hiện có được giữ. Backend chỉ dùng DATABASE_URL và PG_SCHEMA để truy cập PostgreSQL. Lệnh seed không thay thế hồ sơ đã chỉnh sửa trong schema đang chọn.

## Sử dụng PostgreSQL khác

Tạo database UTF-8 và điền DATABASE_URL trong .env. PG_SCHEMA mặc định net_museum; ứng dụng chỉ tạo/ghi trong schema riêng, không sửa bảng ở public. Tài khoản DB cần quyền tạo schema/bảng trong database của dự án. Xem .env.example.

## Chức năng hiện có

- CRUD hiện vật và tài nguyên; nhiều ảnh, audio tiếng Việt, video, PDF, TXT, DOCX.
- Quản trị người dùng, tên tài khoản, phân quyền lưu trong PostgreSQL, khóa và thu hồi phiên.
- Kho tài nguyên, biên tập đầy đủ metadata, gắn nhiều tư liệu vào một hiện vật.
- Tìm kiếm kết hợp metadata, loại, dung lượng và khoảng ngày; tìm ảnh tương tự bằng histogram/cosine.
- Upload chia khối 6 MiB, tiếp tục trong 24 giờ, video tối đa 1 GiB; HTTP Range.
- Yêu thích theo tài khoản; thống kê xem/tải, đủ năm loại, chủ đề và hiện vật quan tâm.

Bộ mẫu gồm 7 hiện vật, 49 tài nguyên: 14 ảnh, 7 audio tiếng Việt, 7 video minh họa có thuyết minh, 14 PDF/DOCX và 7 TXT. [Hướng dẫn sử dụng](docs/MULTIMEDIA.md), [nguồn/giọng đọc mẫu](docs/SAMPLE_ASSETS.md), [đối chiếu đề bài](../DANH_GIA_MUC_DO_DAP_UNG_DE_BAI.md).

Với UPLOAD_STORAGE=local, tệp mới lưu trong uploads/; với cloudinary, trình duyệt tải trực tiếp lên Cloudinary và metadata lưu PostgreSQL. [Phân quyền hiện hành](docs/ACCESS.md). Luồng Cloudinary cũ vẫn giữ cho tài sản hiện có; upload chia khối không hỗ trợ Vercel serverless.

## Kiểm tra

```powershell
npm.cmd run check
npm.cmd run test:integration
npm.cmd run db:queries
```

Đã chạy đạt 19 unit test, 9 integration test trên PostgreSQL thật và đủ 15 SQL. Integration test dùng schema net_test_* riêng, tự dọn đúng schema của bài test, dùng giả lập Cloudinary. Xem [kết quả kiểm tra](docs/KIEM_THU.md).

## Cấu trúc chính

- database/schema.sql: lược đồ PostgreSQL đang chạy, 23 bảng nền; multimedia.sql bổ sung thành 27 bảng và 2 view.
- database/queries.sql: 15 truy vấn của mô hình hiện tại.
- database/seed-postgresql.mjs: seed từ JSON UTF-8, giữ nguyên ID.
- server/repository.mjs: SQL có tham số, transaction và ánh xạ API.
- server/db.mjs, server/pg-config.mjs: pool, khởi tạo và kiểm tra kết nối.
- web/: template; dist/: frontend; server/app.mjs: HTTP API.
- database/legacy-postgresql/: thiết kế cũ, không dùng để khởi tạo runtime mới.

Sau khi sửa template chạy npm.cmd run build. npm.cmd run preview chỉ phục vụ giao diện tĩnh/snapshot. Chức năng ghi cần backend Node.js và PostgreSQL.

## Triển khai trực tuyến

Đích triển khai hiện tại là Neon + Render Free; database Neon đã nạp và kiểm chứng, service Render cần được tạo theo hướng dẫn. Vercel/Sites chưa được triển khai lại. PostgreSQL trong Docker trên máy cá nhân không thể được Vercel truy cập qua localhost. Triển khai online cần PostgreSQL cloud hoặc máy chủ backend/DB có kết nối phù hợp và DATABASE_URL riêng trên host. Xem [Vercel](docs/VERCEL.md).

## Nguồn ảnh

Bộ 7 hiện vật gốm Việt dùng tư liệu The Met Open Access; metadata và giấy phép trong dist/assets/sources.json. Ảnh không gian, kiến trúc và phông chữ có thông tin nguồn trong dist/assets/. Việc chuyển DB không thay ảnh, nguồn hoặc quyền sử dụng.
