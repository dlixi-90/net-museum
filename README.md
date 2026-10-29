# Nét — Bảo tàng nghệ thuật số

Ứng dụng giới thiệu gốm nghệ thuật Việt, quản lý hiện vật và tư liệu đa phương tiện. Bản đang triển khai: **https://net-museum.onrender.com**.

Node.js 24 phục vụ giao diện và API cùng origin; PostgreSQL lưu dữ liệu trong 27 bảng và hai view. Bản online dùng Render, Neon PostgreSQL và Cloudinary. Tệp mẫu được đóng gói cùng mã nguồn.

## Phạm vi chức năng hiện tại

- Duyệt bộ sưu tập, khám phá, đọc câu chuyện; tìm kiếm metadata kết hợp bộ lọc và tìm ảnh có màu sắc tương tự.
- Chi tiết tác phẩm trên một trang: ảnh, ảnh chi tiết và video trong cùng khung; thuyết minh cạnh nút lưu; tải xuống qua hộp thoại có tab theo loại tệp.
- Lưu tác phẩm, đăng ký và đăng nhập bằng email hoặc tên tài khoản.
- Admin quản lý tác phẩm, tài nguyên, tài khoản và thống kê. Thao tác sửa/xóa dùng biểu tượng bút chì/thùng rác; liên kết quản trị nằm trong khu vực quản lý.
- Tải lên theo khối, xác minh định dạng thực, phát audio/video và tải tệp; phân quyền được kiểm tra ở API.

Bộ mẫu có bảy hiện vật và 49 tài nguyên: 14 ảnh, bảy audio tiếng Việt, bảy video, bảy PDF, bảy DOCX và bảy TXT. Thuyết minh dùng giọng AI Minh Đức của VieNeu-TTS, được tạo sẵn miễn phí trên máy.

Đây là phạm vi được giữ sau đợt dọn mã nguồn. Các trang đang có đều còn được sử dụng; danh sách và cách dùng nằm trong [hướng dẫn chức năng](docs/MULTIMEDIA.md).

## Chạy trên máy

Cần Node.js 24 và Docker Desktop đang chạy Linux containers. Trong thư mục chứa `package.json`:

```powershell
npm.cmd ci
npm.cmd run db:docker:setup
npm.cmd run db:start
npm.cmd run db:check
npm.cmd run db:seed
npm.cmd start
```

Mở http://localhost:3000. PostgreSQL 17 chạy trong container `net-museum-postgres`, mặc định ở `127.0.0.1:5433`, database/user `net_museum`. Docker và ứng dụng dùng chung một tệp `.env`. Lệnh setup bổ sung `POSTGRES_PASSWORD`, `POSTGRES_PORT` và `DATABASE_URL` còn thiếu; giữ kết nối đã có và dùng lại mật khẩu trong URI Docker cục bộ khi phù hợp.

Với database mới, thêm `ADMIN_EMAILS=dia-chi-email-cua-ban` và `ALLOW_ADMIN_SETUP=true` vào `.env`, rồi khởi động lại. Trang tài khoản sẽ cho thiết lập admin đầu tiên khi chưa có admin. Tắt thiết lập sau khi tạo xong. Dự án không kèm tài khoản hoặc mật khẩu quản trị.

Nếu dùng PostgreSQL sẵn có, tạo database UTF-8 và điền `DATABASE_URL` trong `.env` theo [.env.example](.env.example). `PG_SCHEMA` mặc định là `net_museum`; giữ đúng schema của database đang chạy. Seed giữ các hồ sơ đã chỉnh sửa. Với `UPLOAD_STORAGE=local`, sao lưu cả PostgreSQL và thư mục `uploads/`; dừng container bằng `npm.cmd run db:stop` để giữ volume.

`.env` là tệp cấu hình thật duy nhất trên máy; `.env.example` chỉ là mẫu công khai. Nếu lưu kết nối Neon trong cùng tệp, dùng `NEON_DATABASE_URL` và `NEON_PG_SCHEMA` làm thông tin triển khai; ứng dụng vẫn chọn kết nối qua `DATABASE_URL` và `PG_SCHEMA`. Các giá trị production còn lại nằm trong `render.yaml` và Environment của Render.

## Phát triển và kiểm tra

```powershell
npm.cmd run build
npm.cmd run check
npm.cmd run test:integration
npm.cmd run db:queries
```

Sửa template trong `web/`, rồi build lại HTML trong `dist/`. `check` kiểm tra bản build, cú pháp, liên kết/tệp phụ thuộc và unit test. Integration test dùng PostgreSQL thật với schema `net_test_*` riêng, tự dọn schema test; luồng Cloudinary dùng giả lập. Cấu hình test bằng database phát triển, tách khỏi database nghiệp vụ. `db:queries` chạy 15 truy vấn của mô hình hiện tại.

`npm.cmd run preview` chỉ phục vụ giao diện tĩnh; đăng nhập, ghi dữ liệu và tìm kiếm API cần backend. `npm.cmd run media:index` lập chỉ mục ảnh; `npm.cmd run test:cbir` ghi báo cáo cục bộ vào `.local/reports/`.

## Cấu trúc

| Thư mục/tệp | Vai trò |
|---|---|
| `web/` | Template của 14 trang, layout và biểu mẫu dùng chung |
| `dist/` | HTML được build, JavaScript, CSS, phông chữ và tư liệu đang sử dụng |
| `server/` | HTTP API, xác thực, phân quyền, PostgreSQL và kho tệp |
| `database/` | Schema hiện hành, seed và truy vấn |
| `scripts/` | Build, kiểm tra, vận hành và tái tạo bộ mẫu |
| `tests/` | Unit test và integration test |
| `render.yaml` | Cấu hình triển khai Render |

## Triển khai và tài liệu

- [Render + Neon + Cloudinary](docs/RENDER_NEON.md): cấu hình, cập nhật và sao lưu.
- [Chức năng và phân quyền](docs/MULTIMEDIA.md): các màn hình, upload, metadata, thống kê.
- [Nguồn tư liệu và tái tạo giọng đọc](docs/SAMPLE_ASSETS.md): nguồn ảnh, quyền sử dụng và công cụ dựng mẫu.

Các tệp `.env*` thật, bản sao lưu, upload cá nhân, cache và báo cáo cục bộ được Git bỏ qua. Chỉ `.env.example` chứa giá trị minh họa được công khai. Không đưa dữ liệu tài khoản, phiên đăng nhập hoặc khóa dịch vụ vào repository.

Ảnh hiện vật dùng The Met Open Access; thông tin nguồn và quyền nằm trong [sources.json](dist/assets/sources.json). Phông chữ Be Vietnam Pro có giấy phép trong [OFL.txt](dist/assets/fonts/OFL.txt). Quyền của tư liệu bên ngoài được giữ theo từng nguồn; repository không cấp lại quyền cho các tài sản đó.
