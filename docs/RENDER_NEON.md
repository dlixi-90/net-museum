# Triển khai Render + Neon + Cloudinary

Bản đang chạy: **https://net-museum.onrender.com**. Render liên kết nhánh `main` của repository `dlixi-90/net-museum`; mã được push lên nhánh này sẽ được triển khai tự động.

## Kiến trúc và cấu hình

Render chạy Node.js 24 và phục vụ cả giao diện/API. Neon PostgreSQL lưu tài khoản, metadata, liên kết, vector ảnh và sự kiện. Cloudinary lưu tệp tải mới. Bộ mẫu trong `dist/assets/` đi cùng bản triển khai; không phụ thuộc ổ đĩa Render.

`render.yaml` là cấu hình hiện hành: root directory để trống, build `npm ci && npm run build`, start `npm start`, health check `/api/health`. Có thể dùng Blueprint này cho một service mới.

| Biến môi trường | Thiết lập |
|---|---|
| `DATABASE_URL` | Neon Direct connection URI có TLS; nhập riêng trên Render |
| `PG_SCHEMA` | `net_museum_import` trên bản hiện hành; giữ đúng schema đang chứa dữ liệu |
| `PG_POOL_MAX` | `3` |
| `PG_CONNECT_TIMEOUT_MS` | `15000` |
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0`; `PORT` do Render cấp |
| `ALLOW_ADMIN_SETUP` | `false` |
| `UPLOAD_STORAGE` | `cloudinary` |
| `CLOUD_UPLOAD_MAX_MIB` | `100` theo cấu hình ứng dụng hiện hành |
| `CLOUDINARY_CLOUD_NAME` | Nhập riêng trên Render |
| `CLOUDINARY_API_KEY` | Nhập riêng trên Render |
| `CLOUDINARY_API_SECRET` | Nhập riêng trên Render |

Ứng dụng dùng `search_path` theo phiên và tự quản lý pool, nên kết nối Neon phải là **Direct**, không có `-pooler` trong hostname. Kết nối Neon được chuẩn hóa `sslmode=verify-full`. Tài khoản PostgreSQL cần quyền tạo schema/bảng trong database của dự án.

Với domain Render, để `PUBLIC_ORIGIN` trống để backend dùng `RENDER_EXTERNAL_URL`. Nếu dùng domain riêng, đặt `PUBLIC_ORIGIN` đúng origin HTTPS, không có dấu `/` cuối. Không đưa kết nối Docker localhost lên Render.

Database mới cần được cấp tài khoản quản trị trong môi trường khởi tạo cục bộ trước khi công bố; database hiện hành đã có admin. Giữ `ALLOW_ADMIN_SETUP=false` trên máy chủ công khai. Không chia sẻ tài khoản và mật khẩu trong README.

## Cập nhật bản đang chạy

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd run check
npm.cmd run test:integration

git status --short
git add .
git diff --cached --stat
git commit -m "Describe the completed change"
git push origin main
```

Integration test dùng PostgreSQL phát triển và schema riêng. Trước khi commit, kiểm tra không có `.env` thật, `.local/`, bản sao lưu hoặc `uploads/`. Theo dõi commit và trạng thái deploy trong Render Dashboard; đối chiếu `/api/health` và giao diện sau khi deploy.

Kiểm tra API trả `database=postgresql`, `connected=true`; mở bộ sưu tập, tìm kiếm, chi tiết tác phẩm, nghe audio, phát video và tải tài liệu. Với thay đổi upload, kiểm tra thêm một tệp thử, metadata và việc tệp còn tồn tại sau redeploy. Trang tĩnh có snapshot nên việc mở được trang chủ chưa chứng minh database đã kết nối.

## Kho tệp và giới hạn ứng dụng

Trong chế độ cloud, trình duyệt gửi các khối tối đa 6 MiB trực tiếp đến Cloudinary bằng chữ ký do backend cấp. Phiên cloud có hạn một giờ. Backend xác minh thông tin từ nhà cung cấp, định dạng thật, dung lượng, SHA-256 và metadata trước khi lưu resource. Tệp tạm dùng để xác minh được dọn sau xử lý.

Giới hạn theo loại: ảnh 8 MiB, audio 64 MiB, PDF/DOCX 20 MiB, TXT 5 MiB; video theo `CLOUD_UPLOAD_MAX_MIB`. Hạn mức tài khoản Cloudinary có thể thấp hơn giới hạn của ứng dụng. Ảnh cloud giữ định dạng thật; chế độ ổ đĩa cục bộ chuẩn hóa ảnh sang WebP.

Trong Cloudinary, bật **Allow delivery of PDF and ZIP files** để phân phối PDF. Các URL Cloudinary dạng public có thể được mở trực tiếp ngoài website; không dùng kho này để chứa tài liệu mật.

`npm.cmd run media:publish` kiểm tra các tệp `/uploads/` còn tham chiếu trong database đã cấu hình. Chỉ thêm `-- --apply` khi muốn chuyển chúng sang Cloudinary; công cụ giữ tệp cục bộ và cập nhật metadata sau khi tải thành công. Không cần chạy lệnh này cho bộ mẫu đóng gói trong `dist/`.

## Sao lưu và xử lý lỗi

Sao lưu PostgreSQL bằng công cụ của nhà cung cấp hoặc `pg_dump`, đồng thời giữ tài sản Cloudinary. Sao lưu có thể chứa hash mật khẩu và dữ liệu tài khoản; lưu ở nơi riêng, không commit. Không xóa volume PostgreSQL cục bộ khi chỉ muốn dừng dự án. Giữ nguyên `PG_SCHEMA` khi phục hồi hoặc cập nhật ứng dụng.

| Hiện tượng | Kiểm tra |
|---|---|
| Service chưa chạy | Deploy log, nhánh/commit, Node.js 24 và build command |
| API 503 | Neon Direct URI, TLS, schema và quyền database |
| Đăng nhập/lưu bị từ chối origin | `PUBLIC_ORIGIN` hoặc domain Render, bỏ origin localhost cũ |
| Upload thất bại | `UPLOAD_STORAGE`, khóa Cloudinary, định dạng, dung lượng và quota |
| PDF không mở được | Quyền phân phối PDF/ZIP trong Cloudinary |
| Thiếu audio/video mẫu | Tệp hoàn chỉnh và manifest đã có trong commit triển khai |

Không dùng ổ đĩa Render làm nơi lưu bền vững. Theo dõi quota và trạng thái của Render, Neon, Cloudinary trong dashboard tương ứng; khả năng khởi động và xử lý phụ thuộc gói dịch vụ đang sử dụng.
