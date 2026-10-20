# Ảnh và video trên Cloudinary

Backend Node.js tải tệp lên Cloudinary bằng SDK chính thức. MongoDB Atlas giữ hồ sơ tác phẩm và metadata; không lưu binary ảnh/video trong MongoDB. API secret chỉ nằm trong `.env` của backend.

## Thiết lập

1. Mở [Cloudinary Console](https://console.cloudinary.com/), chọn product environment, lấy **Cloud name** và vào **Settings → API Keys** để lấy **API key**, **API secret**.
2. Điền trực tiếp ba giá trị vào `di-san-viet/.env` (đã thêm sẵn các dòng trống):

   ```dotenv
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

   Thay toàn bộ giá trị ví dụ bằng thông tin thật. Không gửi khóa bí mật vào chat, không commit `.env`. Không cần unsigned upload preset; backend ký yêu cầu bằng SDK.
3. Mở PowerShell tại thư mục dự án:

   ```powershell
   cd C:\Users\nguye\Desktop\Museum\di-san-viet
   npm.cmd install
   npm.cmd run cloudinary:check
   npm.cmd start
   ```

   Nếu máy chủ đang chạy, dừng bằng Ctrl+C và chạy lại sau khi sửa `.env`. Lệnh kiểm tra chỉ ping Cloudinary, không tạo hoặc xóa tài sản.
4. Mở http://localhost:3000/quan-ly/, đăng nhập, chọn **Thêm tác phẩm** hoặc **Chỉnh sửa**, chọn ảnh đại diện và video giới thiệu tùy chọn, rồi lưu. Video xuất hiện trên trang chi tiết tác phẩm.

## Tệp và dữ liệu

- Ảnh JPG/PNG/WebP: tối đa 8 MB đầu vào, giới hạn 40 triệu pixel; chuyển WebP, cạnh dài tối đa 2000 px.
- Video MP4/WebM/MOV: tối đa 50 MB; kiểm tra header container và để Cloudinary xác thực nội dung, chuyển đầu ra MP4. Video cần có hình; không nhận tệp chỉ có âm thanh.
- Public ID do server đặt trong `net-museum/image/` hoặc `net-museum/video/`. Dữ liệu trả về frontend chỉ gồm URL HTTPS và metadata, không có thông tin xác thực.
- Media lưu `storage`, `publicId`, `resourceType`, `url`, `format`, `mimeType`, `sizeBytes`, kích thước, thời lượng (video), người tải và thời điểm. Artwork giữ `imageId`/`videoId` và đường dẫn tương ứng.
- Nếu upload thành công nhưng MongoDB không ghi được media, backend yêu cầu xóa tài sản vừa tải để tránh tệp thừa. Nếu lưu hồ sơ thất bại sau khi đã ghi media, lần thử lại trong cùng biểu mẫu dùng lại media đó.
- Gỡ hoặc thay video/ảnh khỏi tác phẩm không xóa tài sản cũ trên Cloudinary; tài sản có thể vẫn được hồ sơ khác sử dụng. Có thể xem tệp trong Media Library. Hiện chưa có tác vụ dọn media không tham chiếu.
- Hạn mức tài khoản Cloudinary có thể thấp hơn giới hạn ứng dụng. Khi upload thất bại, kiểm tra cấu hình, dung lượng và hạn mức trong Console.

## Chuyển ảnh hiện có

Sao lưu MongoDB trước khi chuyển, tạm ngừng chỉnh sửa tác phẩm trong lúc chạy.

```powershell
# Chỉ đếm, chưa tải lên hoặc sửa dữ liệu:
npm.cmd run media:migrate
# Tải ảnh lên Cloudinary và cập nhật URL trong MongoDB:
npm.cmd run media:migrate -- --apply
```

Lệnh xử lý ảnh đã lưu trong `uploads/` và ảnh tác phẩm mẫu `dist/assets/` có bản ghi trong collection `media`. Không tự tải URL bên ngoài, không chuyển ảnh trang trí như banner. Tệp gốc trên máy được giữ nguyên. Revision hồ sơ được tăng khi URL thay đổi để cửa sổ chỉnh sửa cũ không ghi đè âm thầm. Nếu gián đoạn, có thể chạy lại: media đã chuyển không upload lại, các tham chiếu chưa đồng bộ được sửa tiếp.

## Kiểm thử và triển khai

`npm.cmd run check` chạy kiểm tra mã và unit test. `npm.cmd run test:integration` cần MongoDB cục bộ, tạo database `net_test_*` riêng và dùng stub ở ranh giới Cloudinary để kiểm tra HTTP, auth, upload, tham chiếu ảnh/video, cập nhật và xử lý lỗi. Đây không phải xác nhận upload thực tế lên tài khoản của bạn. Chạy `cloudinary:check` và thêm thử một tác phẩm sau khi điền khóa thật để xác nhận môi trường Cloudinary.

Link Sites hiện tại chỉ phục vụ `dist/`; không chạy backend Node.js. Để thêm/sửa/upload trên Internet, triển khai toàn bộ backend và frontend trên cùng origin ở host hỗ trợ Node.js, cấu hình MongoDB Atlas và ba biến Cloudinary trên host đó. Upload mới không cần volume ổ đĩa. Thư mục `uploads/` cũ cần giữ cho đến khi đã chuyển hết các ảnh đang dùng.

Tham khảo: [Cloudinary Node.js SDK](https://cloudinary.com/documentation/node_integration), [Node.js image and video upload](https://cloudinary.com/documentation/node_image_and_video_upload).
