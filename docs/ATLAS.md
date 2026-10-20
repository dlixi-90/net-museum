# Kết nối cluster MongoDB Atlas đã có

## Điền URI trên máy

File `.env.atlas.example` chứa mẫu cho Atlas. File `.env` cục bộ đã được chuẩn bị nếu trước đó chưa tồn tại; file này được bỏ qua bởi Git và không được phục vụ ra web.

1. Trong Atlas, chọn cluster → **Connect → Drivers**, chọn Node.js và sao chép URI.
2. Tạo hoặc dùng **database user** có quyền `readWrite` trên database `net_museum`. Tài khoản database khác tài khoản đăng nhập trang Atlas.
3. Trong **Network Access / IP Access List**, thêm IP public của máy đang chạy backend. Nếu sau này đưa backend lên máy chủ, thêm IP outbound của máy chủ đó.
4. Mở `.env`, thay toàn bộ giá trị `MONGODB_URI` bằng URI thật, thay phần username/password. Giữ `MONGODB_DB=net_museum` hoặc đổi thành tên database bạn muốn dùng cho dự án.
5. Nếu mật khẩu có ký tự đặc biệt, mã hóa URL phần mật khẩu theo hướng dẫn của MongoDB. Không mã hóa toàn bộ URI.

```dotenv
MONGODB_URI="mongodb+srv://<DB_USERNAME>:<DB_PASSWORD>@<CLUSTER_HOST>/net_museum?retryWrites=true&w=majority"
MONGODB_DB=net_museum
```

Các phần trong `<...>` là giữ chỗ, không phải thông tin cluster thật. Lấy hostname trực tiếp từ Atlas, không tự đoán. Không cần dán URI hoặc mật khẩu vào chat.

## Kiểm tra rồi chạy

```powershell
npm.cmd run db:check
npm.cmd start
```

`db:check` chỉ ping, không thay đổi dữ liệu. Khi `npm start` thành công, backend tạo index và nhập 7 tác phẩm mẫu bằng `$setOnInsert` vào database đã chọn. Những bản ghi đã có cùng ID không bị ghi đè. Dùng database riêng `net_museum` để tách dữ liệu dự án khỏi ứng dụng khác.

Mở http://localhost:3000 → **Quản lý tác phẩm** → tạo admin lần đầu. Tài khoản quản trị website này lưu trong MongoDB và khác database user dùng trong URI.

Với Atlas **không cần chạy `npm run db:start`**. Database ở đám mây; frontend và backend Node.js vẫn có thể chạy trên máy bạn. Ảnh tự tải lên hiện lưu trong thư mục `uploads/` của backend, không tự chuyển thành file trong Atlas.

## Khi cần website hoạt động trực tuyến

Atlas chỉ cung cấp database. Cần triển khai backend Node.js cùng frontend và thư mục ảnh bền vững lên một máy chủ phù hợp. Link Sites hiện tại vẫn là bản tĩnh, không tự kết nối Atlas bằng URI. Khi production, dùng HTTPS, cấu hình PUBLIC_ORIGIN, tắt ALLOW_ADMIN_SETUP và giữ URI trong biến môi trường của máy chủ.

## Nguồn chính thức

- [Atlas: kết nối bằng driver, database user và IP Access List](https://www.mongodb.com/docs/atlas/driver-connection/)
- [Node.js: chọn kết nối MongoDB Atlas](https://www.mongodb.com/docs/drivers/node/current/connect/connection-targets/)
- [Atlas: xử lý lỗi kết nối](https://www.mongodb.com/docs/atlas/troubleshoot-connection/)
