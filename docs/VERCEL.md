# Triển khai Nét trên Vercel

Thư mục gốc của dự án là `di-san-viet`. `vercel.json` chạy `npm run build`, phục vụ các trang trong `dist` và chuyển `/api/*` đến backend Node.js 24 ở `api/index.mjs`.

## Cấu hình production

Thêm các biến sau vào Vercel → Project → Settings → Environment Variables → Production. Sao chép giá trị từ `.env` trên máy; không đưa file `.env` vào Git hoặc thư mục `dist`.

- `MONGODB_URI`
- `MONGODB_DB`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `ADMIN_EMAILS`

Backend tự dùng hostname production do Vercel cung cấp để kiểm tra nguồn yêu cầu. Nếu dùng tên miền riêng, đặt `PUBLIC_ORIGIN=https://ten-mien-cua-ban` rồi triển khai lại. Không sao chép địa chỉ localhost vào `PUBLIC_ORIGIN` trên Vercel.

MongoDB Atlas phải cho phép kết nối từ môi trường Vercel. Tài khoản admin đã tạo trong database hiện tại được giữ nguyên. Chức năng tạo tài khoản quản trị ban đầu luôn bị tắt trên Vercel.

## Cách hoạt động

Các lần gọi API trong cùng một instance dùng chung kết nối MongoDB. Backend khởi tạo index nhưng không chèn lại dữ liệu mẫu trên production.

Ảnh và video đi từ trình duyệt lên Cloudinary bằng chữ ký do backend cấp sau khi kiểm tra quyền admin. Backend xác nhận tệp qua Cloudinary trước khi lưu metadata vào MongoDB. File lớn không đi qua Vercel Function. API secret chỉ nằm trong biến môi trường của backend.

## Triển khai lại

Trong PowerShell tại thư mục `di-san-viet`:

```powershell
npm.cmd run build
npm.cmd run check
vercel.cmd --prod
```

Kiểm tra `/api/health` trả về `connected: true`, mở bộ sưu tập và thử đăng nhập bằng tài khoản hiện có. Không dùng bản build Vercel tạo trên Windows để deploy bằng `--prebuilt`: bản triển khai cần build trên Vercel để lấy đúng thư viện Sharp cho Linux.
