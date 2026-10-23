# Triển khai Render Free + Neon + Cloudinary

Đã chuẩn bị ngày 23/10/2026. Repository hiện tại: `https://github.com/dlixi-90/net-museum.git`, nhánh `main`. Thư mục Git gốc là `di-san-viet`, cũng là nơi chứa `package.json` và `render.yaml`.

## 1. Kiến trúc

- Render Free Web Service chạy Node.js và phục vụ giao diện/API cùng origin.
- Neon PostgreSQL lưu 27 bảng, hai view, tài khoản, metadata, vector ảnh và sự kiện.
- Cloudinary lưu tệp tải mới; trình duyệt gửi trực tiếp từng khối đến Cloudinary.
- Bộ mẫu trong `dist/assets/` được đưa lên cùng mã nguồn. Không phụ thuộc thư mục `uploads/` trên Render.

Render chỉ tải tệp về thư mục tạm để xác minh nội dung/metadata, rồi dọn sau mỗi lần hoàn tất. Việc Render ngủ hoặc khởi động lại không làm mất tệp đã được xác minh trong Cloudinary hay dữ liệu Neon. Lượt hoàn tất đang xử lý có thể cần thử lại.

## 2. Trạng thái dữ liệu

Dữ liệu cục bộ đã được sao chép sang schema **net_museum_import** trên Neon:

| Đối tượng | Số lượng |
|---|---|
| Tài khoản hiện có | 1 |
| Hiện vật | 7 |
| Tài nguyên | 49 |
| Ảnh | 14 |
| Audio tiếng Việt | 7 |
| Video | 7 |
| PDF/DOCX | 14 |
| TXT | 7 |

Đã đối chiếu số dòng các bảng nghiệp vụ, hash/quyền tài khoản và metadata; thứ tự nhãn có thể khác do collation. Phiên đăng nhập, giới hạn thử và lượt tải dở không sao chép. Đăng nhập lại bằng tài khoản/mật khẩu cũ. PostgreSQL Docker trên máy được giữ.

Bản sao lưu riêng nằm trong `.local/neon-backups/`, có cả `.dump` và `.sql`, chứa hash mật khẩu nên không đưa lên Git hoặc gửi công khai. Công cụ chuyển từ chối schema đích đã tồn tại; **không chạy migrate lại vào Neon đang dùng**.

## 3. Các file cấu hình riêng

| File | Mục đích |
|---|---|
| `.env` | PostgreSQL Docker và cấu hình phát triển cục bộ |
| `.env.neon` | NEON_DATABASE_URL và PG_SCHEMA cho công cụ chuyển/kiểm tra |
| `.env.render` | DATABASE_URL Neon và khóa Cloudinary để nhập vào Render |
| `.env.neon.example` | Mẫu được phép đưa vào Git |

Ba file đầu được Git bỏ qua. Không dán nội dung vào chat hoặc ảnh chụp. `.env.render` đã được tạo bằng cấu hình hiện có. Muốn tạo lại sau khi đổi khóa:

```powershell
npm.cmd run render:env -- --overwrite
```

Neon dùng **Direct connection**: trong hộp **Connect**, tắt **Connection pooling**. Ứng dụng dùng `search_path` theo phiên và tự có `pg.Pool` tối đa ba kết nối trên Render. Host có `-pooler` bị từ chối để tránh dùng sai schema. Kết nối Neon được chuẩn hóa `sslmode=verify-full`; không tắt TLS.

## 4. Đưa mã nguồn mới lên GitHub

Mở PowerShell trong `di-san-viet`:

```powershell
git status --short
git add .
git status --short
git commit -m "Prepare Neon and Render cloud deployment"
git push origin main
```

Trước khi commit, kiểm tra danh sách không chứa `.env`, `.env.neon`, `.env.render`, `.env.postgresql`, `.local/` hoặc `uploads/`. Bộ `dist/assets/samples/` phải được đưa lên để đủ audio/video/PDF tiếng Việt mẫu. Render chỉ nhận thay đổi đã push lên đúng repository và nhánh đang liên kết.

## 5. Cách nhanh: tạo Render Blueprint

1. Đăng nhập [Render Dashboard](https://dashboard.render.com/), chọn **New → Blueprint**.
2. Kết nối repository `dlixi-90/net-museum`, nhánh `main`.
3. Dùng đường dẫn Blueprint mặc định `render.yaml`.
4. Kiểm tra service `net-digital-museum`, runtime Node, plan **Free**. Blueprint không tạo Render Postgres và không gắn ổ đĩa trả phí.
5. Nhập bốn giá trị được yêu cầu từ `.env.render`: `DATABASE_URL`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
6. Chọn **Deploy Blueprint**. Nếu tên service đã được dùng, đổi tên service trong cấu hình hoặc Dashboard.

Sau khi Render tạo xong, mở URL HTTPS được Dashboard cung cấp. Tên miền được Render cấp có thể khác tên ví dụ; không cần tự đoán.

## 6. Hoặc tạo Web Service thủ công

Chọn **New → Web Service**, kết nối cùng repository, rồi cấu hình:

| Mục | Giá trị |
|---|---|
| Branch | main |
| Root Directory | Để trống vì package.json nằm ở gốc repository |
| Runtime | Node |
| Instance Type | Free |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |

Nếu sau này repository bao gồm cả thư mục Museum thay vì chỉ di-san-viet, đặt Root Directory thành `di-san-viet`.

Trong **Environment → Add from .env**, nhập nội dung **`.env.render`**. Không dùng `.env` cục bộ vì DATABASE_URL của file đó trỏ Docker localhost. Node.js 24 được khai báo trong `package.json`; Render cấp `PORT`, không đặt cứng cổng 3000.

`PUBLIC_ORIGIN` để trống khi dùng domain mặc định. Backend lấy `RENDER_EXTERNAL_URL` do Render cấp để kiểm tra nguồn yêu cầu. Nếu dùng tên miền riêng, thêm `PUBLIC_ORIGIN=https://ten-mien-cua-ban` (không có dấu `/` cuối). Để `ALLOW_ADMIN_SETUP=false`; admin hiện có đã nằm trong Neon.

## 7. Kiểm tra sau khi deploy

1. `/api/health` trả `database=postgresql`, `connected=true`.
2. `/api/artworks` có bảy hồ sơ. Trang tĩnh có thể có snapshot ngay cả khi API lỗi, nên cần kiểm tra API.
3. Đăng nhập tài khoản cũ, mở **Kho tài nguyên**. Tải một TXT nhỏ, sửa metadata và gắn vào hiện vật.
4. Xem/thử tải PDF, nghe thuyết minh tiếng Việt và phát video.
5. Tìm kiếm nâng cao, tìm ảnh tương tự, yêu thích và thống kê.
6. Redeploy service rồi mở lại tư liệu vừa tải; tệp phải còn trên Cloudinary và metadata còn trên Neon.
7. Gỡ/xóa tư liệu thử; chọn **Dọn tệp đã xóa** nếu muốn xóa vật lý khỏi Cloudinary.

Mã nguồn hiện đã được kiểm tra trên PostgreSQL thật, Cloudinary thật và Chrome với schema QA riêng. Chỉ xác nhận bản Render hoạt động sau khi service đã được tạo/deploy và kiểm tra URL thực tế; thao tác Dashboard cần tài khoản của bạn.

## 8. Upload trên Render miễn phí

`UPLOAD_STORAGE=cloudinary` bật luồng mới:

1. Admin yêu cầu chữ ký; server tạo UUID, khóa public ID/loại và chủ sở hữu trong Neon.
2. Trình duyệt gửi khối tối đa 6 MiB trực tiếp tới Upload API Cloudinary bằng `Content-Range` và ID upload cố định.
3. Offset đã nhận được ghi trong Neon để hỗ trợ tiếp tục; đây là gợi ý tiếp tục, không phải bằng chứng tệp hợp lệ.
4. Khi hoàn tất, server hỏi metadata trực tiếp từ Cloudinary, tải về tệp tạm có giới hạn, xác minh định dạng thật, SHA-256 và thuộc tính chuyên biệt, rồi ghi resource trong transaction.
5. Ảnh được trích vector từ chính tệp trên Cloudinary; định dạng ảnh thực JPG/PNG/WebP được giữ đúng trong metadata. Audio dùng `vi-VN`; DOCX/TXT đọc nội dung, PDF đọc số trang, audio/video lấy duration từ FFprobe.

Phiên cloud có hạn **một giờ**. Chọn lại cùng tệp trong cùng trình duyệt/tài khoản để thử tiếp; còn phụ thuộc việc Cloudinary giữ phiên khối. Nếu kho đã có tệp cuối mà xác nhận bị mất, server có thể xác minh lại mà không tải lại. Nếu phiên kho hết hạn, bắt đầu lượt mới. Không cam kết resume cloud 24 giờ như luồng ổ đĩa cục bộ.

`CLOUD_UPLOAD_MAX_MIB=100` là giới hạn chung mặc định của luồng cloud, kết hợp giới hạn theo loại: ảnh8 MiB, audio64 MiB, PDF/DOCX20 MiB, TXT5 MiB. Video cloud tối đa100 MiB theo cấu hình này. Hạn mức thực tế Cloudinary có thể thấp hơn; không đồng nhất giới hạn ứng dụng với quota gói miễn phí. Luồng cục bộ vẫn hỗ trợ video1 GiB.

Trong Cloudinary **Settings → Security**, bật **Allow delivery of PDF and ZIP files** để PDF có thể được đọc/tải. Tài khoản đang dùng đã được bạn bật và kiểm tra PDF thật thành công.

## 9. Giới hạn và xử lý lỗi

Render Free có thể ngủ sau 15 phút không có lưu lượng; lần mở tiếp theo cần chờ khởi động. Không lưu tệp bền vững trên ổ Render Free. Neon và Cloudinary có quota riêng cần theo dõi. Source và sample đi theo bản deploy; dữ liệu nghiệp vụ và tệp tải mới nằm ở hai dịch vụ ngoài.

| Hiện tượng | Kiểm tra |
|---|---|
| Không mở được service | Build/Deploy log; root repo, Node24, HOST=0.0.0.0, PORT do Render cấp |
| Log vẫn báo MongoDB | Đang chạy commit cũ: kiểm tra commit trên GitHub và nhánh main trong Render, rồi deploy commit mới nhất; không thêm cấu hình MongoDB |
| API503 | DATABASE_URL phải là Neon Direct có TLS; PG_SCHEMA=net_museum_import |
| Đăng nhập/bấm lưu báo nguồn không hợp lệ | Xóa PUBLIC_ORIGIN localhost cũ; để Render URL hoặc đặt tên miền HTTPS đúng |
| Upload bị từ chối | UPLOAD_STORAGE=cloudinary, ba khóa Cloudinary, loại/cỡ và quota |
| PDF401/502 | Allow delivery of PDF and ZIP files trong Cloudinary |
| Sau deploy không thấy audio mẫu | Commit và push dist/assets/samples trước khi deploy |
| Mất phiên sau chuyển DB | Đăng nhập lại; phiên nguồn không sao chép |

## 10. Chạy Neon trên máy để xem trước

```powershell
npm.cmd run start:neon
```

Lệnh đọc `.env.render`, dùng Neon và cloud upload, mở localhost để xem trước; không đổi `.env` Docker. Giữ thiết lập admin ban đầu tắt. Ctrl+C để dừng.

Các lệnh vận hành:

```powershell
npm.cmd run db:neon:check
npm.cmd run check
npm.cmd run test:integration
```

Integration test tiếp tục dùng `.env` Docker và schema riêng, không dùng tài khoản nghiệp vụ Neon. Nếu cần chuyển sang một Neon database/branch mới khác: cập nhật `.env.neon`, chạy `media:publish` để kiểm tra tệp local, chạy `db:neon:migrate` để xem kế hoạch, chỉ thêm `-- --apply` khi đích trống. Giữ source tạm ngừng chỉnh sửa trong lúc lấy snapshot.

Tham khảo: [Render Blueprint](https://render.com/docs/blueprint-spec), [Render Free](https://render.com/docs/free), [Neon connection pooling](https://neon.com/docs/connect/connection-pooling), [Neon PostgreSQL migration](https://neon.com/docs/import/migrate-from-postgres), [Cloudinary chunk upload](https://cloudinary.com/documentation/upload_images#chunked_asset_upload).
