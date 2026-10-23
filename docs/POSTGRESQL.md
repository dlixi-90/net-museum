> Đích triển khai online: [Neon + Render Free](RENDER_NEON.md). Database Neon đã nạp; hướng dẫn dưới đây dành cho Docker cục bộ, vẫn dùng cho phát triển và kiểm thử.

# PostgreSQL bằng Docker Desktop — hướng dẫn sử dụng

## 1. Những gì đã được chuẩn bị

- File Compose: compose.postgresql.yml, image postgres:17.
- Container: net-museum-postgres.
- Host: 127.0.0.1; cổng máy tính: 5433; cổng trong container: 5432.
- Database và user: net_museum.
- Mật khẩu ngẫu nhiên: trong .env.postgresql; chuỗi kết nối: DATABASE_URL trong .env.
- Schema đang dùng dữ liệu đã chuyển: net_museum_import, được đặt bằng PG_SCHEMA.
- Volume bền vững: net-museum_postgres_data.

Không đưa .env, .env.postgresql hoặc các bản sao lưu dữ liệu lên Git hay gửi công khai. Không đổi mật khẩu trong file rồi kỳ vọng tài khoản trong volume đã khởi tạo tự đổi theo: biến POSTGRES_PASSWORD chỉ dùng khi tạo cluster mới.

## 2. Mở Docker Desktop và chạy

1. Mở Docker Desktop và chờ Docker Engine running.
2. Mở terminal tại thư mục di-san-viet.
3. Chạy:

```powershell
npm.cmd run db:docker:setup
npm.cmd run db:start
npm.cmd run db:check
npm.cmd run db:seed
npm.cmd start
```

Mở http://localhost:3000. Khi cấu hình đã có, lần sau chỉ cần db:start và npm start. Script setup giữ nguyên DATABASE_URL hiện có; không tạo lại tài khoản hoặc thay cấu hình Cloudinary.

Trong Docker Desktop → Containers, mở nhóm net-museum để xem trạng thái postgres, log và nút Start/Stop. Cổng PostgreSQL là kết nối CSDL, không phải địa chỉ website để mở trong trình duyệt.

## 3. Kiểm tra trực tiếp bằng psql trong container

Không cần cài psql trên Windows:

```powershell
docker exec -it net-museum-postgres psql -U net_museum -d net_museum
```

Trong psql:

```sql
SET search_path TO net_museum_import, public;
SELECT COUNT(*) FROM artifacts;
SELECT COUNT(*) FROM users;
SELECT id,title FROM artifacts ORDER BY id;
```

Lệnh psql \dn liệt kê schema; \dt net_museum_import.* liệt kê bảng; \q để thoát. Trong bộ dữ liệu đã chuyển, số hiện vật là 7, số tài khoản là 1. Không in password_hash ra ảnh chụp báo cáo.

## 4. Kết nối bằng pgAdmin hoặc DBeaver

Tạo kết nối PostgreSQL với host 127.0.0.1, port 5433, database net_museum, username net_museum. Mật khẩu xem trực tiếp trong file .env.postgresql trên máy. Sau khi kết nối, mở Schemas → net_museum_import → Tables.

Nếu pgAdmin cũng chạy trong một container, localhost trỏ tới container pgAdmin. Có thể dùng host.docker.internal và cổng 5433 trên Docker Desktop, hoặc cùng network Compose rồi dùng tên service postgres và cổng 5432.

## 5. Dừng và bật lại

```powershell
npm.cmd run db:stop
npm.cmd run db:start
```

Dừng backend bằng Ctrl+C trong terminal chạy npm start. Dừng container không xóa volume. Không dùng thao tác xóa volume nếu muốn giữ dữ liệu.

## 6. Dữ liệu ứng dụng

Tài khoản, tài nguyên, hiện vật và từ khóa nằm trong schema net_museum_import. Mã công khai, mật khẩu đã băm, revision và URL ảnh hiện có được giữ. Backend chỉ đọc schema PG_SCHEMA đang chọn; không đổi schema này nếu muốn tiếp tục dùng dữ liệu hiện tại.

## 7. Khi gặp lỗi

| Hiện tượng | Kiểm tra |
|---|---|
| Không kết nối được Docker Engine | Mở Docker Desktop, chờ Engine chạy |
| Port 5433 đã dùng | Chọn cổng khác trong .env.postgresql và sửa DATABASE_URL cho khớp |
| PostgreSQL từ chối mật khẩu | Kiểm tra DATABASE_URL và mật khẩu dùng khi volume được khởi tạo |
| Database không tồn tại | Database trong URL phải là net_museum của container này |
| Không thấy 7 tác phẩm đã chuyển | Kiểm tra PG_SCHEMA=net_museum_import; chạy db:check, rồi API catalogue |
| Trang vẫn có ảnh dù backend lỗi | Frontend có snapshot; xác minh /api/health báo postgresql, connected true |
| Cloudinary lỗi upload | DB và dịch vụ media có cấu hình độc lập; kiểm tra các biến Cloudinary |

## 8. Khi triển khai Vercel

DATABASE_URL trỏ 127.0.0.1 chỉ dùng trên máy này. Vercel cần PostgreSQL truy cập được từ môi trường triển khai, với tài khoản và TLS phù hợp. Chưa cập nhật môi trường online trong lần chuyển đổi này.
