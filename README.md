# Nét — Bảo tàng nghệ thuật số

Website mỹ thuật với giao diện bảo tàng theo ảnh tham khảo. Phiên bản hiện tại dùng **Node.js + MongoDB** để lưu tác phẩm, tài khoản quản trị, phiên đăng nhập và metadata ảnh. Bộ sưu tập ban đầu có 7 hiện vật gốm Việt từ The Met.

## Chạy bản đầy đủ trên máy

Cần Node.js 22.14+ hoặc 24. Mở terminal tại thư mục `di-san-viet`.

```powershell
npm.cmd install
```

Terminal thứ nhất — nếu máy chưa có MongoDB chạy tại cổng 27017:

```powershell
npm.cmd run db:start
```

Lệnh này chạy tiến trình MongoDB thật trên `127.0.0.1:27017`, dùng WiredTiger và giữ dữ liệu trong `.local/mongodb-data`. Lần đầu tải MongoDB binary cho máy, có thể mất thời gian và dung lượng đáng kể. Đây là công cụ phát triển cục bộ, không phải dịch vụ MongoDB production. Nếu đã có MongoDB ở cổng này, dùng luôn instance đó và bỏ qua lệnh này.

Terminal thứ hai:

```powershell
npm.cmd start
```

Mở **http://localhost:3000** → **Quản lý tác phẩm** → lần đầu tạo tài khoản quản trị → **Thêm tác phẩm**. Điền thông tin và chọn ảnh. Muốn sửa, chọn **Chỉnh sửa** trong bảng quản lý. Khi lưu thành công, danh sách và bộ sưu tập được cập nhật từ MongoDB.

Backend tự tạo index và nhập 7 tác phẩm mẫu bằng `$setOnInsert`: khởi động lại không ghi đè tác phẩm đã chỉnh sửa. Muốn chạy seed riêng: `npm.cmd run db:seed`.

## Dùng MongoDB Atlas hoặc MongoDB sẵn có

Sao chép `.env.example` thành `.env`, điền `MONGODB_URI` và `MONGODB_DB` trên máy bạn. Không đưa URI chứa mật khẩu vào mã trình duyệt hoặc Git. Sau đó chạy `npm.cmd start`; không cần `db:start`. `.env` đã được loại khỏi Git và thư mục phát web.

Khi triển khai thật, phục vụ **cả frontend và backend Node.js trên cùng origin**, cấu hình `PUBLIC_ORIGIN=https://...`, TLS, `NODE_ENV=production`, `ALLOW_ADMIN_SETUP=false`, MongoDB đã có tài khoản quản trị và volume bền vững cho `uploads/`. Khởi tạo admin trong môi trường cục bộ an toàn trước khi công bố. Sao lưu cả MongoDB và thư mục ảnh.

## Phân biệt bản đầy đủ và bản Sites

- `npm.cmd start`: frontend + API + MongoDB; thêm/sửa và upload hoạt động.
- `npm.cmd run preview`: chỉ website tĩnh; hiện snapshot mẫu có nhãn, không lưu tác phẩm.
- Link Sites hiện tại triển khai từ `dist/`, vẫn là hosting tĩnh. MongoDB không chạy bên trong gói này. Nút quản lý sẽ giải thích khi chưa có backend, không báo lưu thành công giả và không dùng localStorage để thay thế MongoDB.

Để có thêm/sửa trực tuyến, cần triển khai backend Node.js với MongoDB lên máy chủ hỗ trợ Node/TCP và lưu trữ ảnh bền vững. Chỉ đưa URI Atlas vào frontend không đủ và sẽ làm lộ mật khẩu.

## Chức năng đã có

- Thêm tác phẩm với ảnh, tên, tác giả, niên đại, năm bắt đầu, nhóm nghệ thuật, chất liệu, xuất xứ, mô tả, từ khóa và nguồn.
- Sửa metadata hoặc thay ảnh; kiểm tra revision để trả lỗi 409 khi có cập nhật mới từ cửa sổ khác.
- Thiết lập admin lần đầu trên máy cục bộ; đăng nhập/đăng xuất. Mật khẩu băm scrypt; phiên cookie HttpOnly lưu hash token trong MongoDB và hết hạn sau 24 giờ.
- API ghi bắt buộc đăng nhập, kiểm tra origin, allowlist trường dữ liệu và loại tệp. Ảnh JPG/PNG/WebP tối đa 8 MB được giải mã thật và chuyển WebP, cạnh dài tối đa 2000 px.
- Danh mục gốm, hội họa, điêu khắc, đồ họa; tìm kiếm có/không dấu, niên đại, dung lượng và sắp xếp.
- Chi tiết, phóng ảnh, giọng đọc tổng hợp, CBIR histogram RGB 64 chiều và cosine similarity.
- Yêu thích và lượt mở chi tiết vẫn là dữ liệu trình duyệt; hồ sơ tác phẩm và tài khoản lưu trong MongoDB.

Chưa triển khai xóa tác phẩm, quản lý nhiều tài khoản, nhiều ảnh/tác phẩm, video/audio/PDF thật, bộ đếm truy cập tập trung và đánh giá CBIR có nhãn.

## Cấu trúc và kiểm thử

```text
server/                   Backend HTTP, MongoDB, auth, validation, upload
dist/                     Giao diện và snapshot chỉ đọc cho hosting tĩnh
dist/manage.js            Đăng nhập và biểu mẫu thêm/sửa
scripts/start-mongodb.mjs  MongoDB cục bộ với thư mục dữ liệu bền vững
database/seed-mongodb.mjs  Seed không ghi đè dữ liệu đã sửa
database/queries.mongodb.js  15 truy vấn MongoDB chỉ đọc
database/legacy-postgresql/  Script SQL cũ để tham khảo; không dùng runtime
docs/DINH_HUONG.md         Mô hình MongoDB và API hiện tại
tests/api.test.mjs         Kiểm thử tích hợp với MongoDB thật
```

```powershell
npm.cmd run check
# Cần MongoDB đang chạy:
npm.cmd run test:integration
```

Integration test tạo database riêng tên `net_test_*` và thư mục ảnh tạm riêng, sau đó chỉ xóa dữ liệu thử nghiệm của chính nó; không xóa `net_museum`. Đã kiểm tra giao diện Chrome trên máy tính/điện thoại, thêm/sửa qua biểu mẫu, tải lại trang, đăng xuất và giữ dữ liệu sau khởi động lại backend.

## Nguồn tư liệu

Ảnh và metadata mẫu: [The Met Open Access](https://www.metmuseum.org/about-the-met/policies-and-documents/open-access). API xác nhận `isPublicDomain: true` cho 7 ảnh. Metadata gốc ở `dist/assets/sources.json`; tên, mô tả tiếng Việt và phân nhóm trưng bày do dự án biên soạn. Tác phẩm tự thêm hiển thị tác giả và nguồn do quản trị viên nhập.

Ảnh kiến trúc: [Natural History Museum Main Hall — DAVID ILIFF](https://commons.wikimedia.org/wiki/File:Natural_History_Museum_Main_Hall,_London,_UK_-_Diliff.jpg), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/), cắt khung và phủ tối bằng CSS; dùng minh họa, không phải địa điểm thực tế của Nét. Font từ Google Fonts có font dự phòng hệ thống.

Theo yêu cầu mới, MongoDB thay thế thiết kế PostgreSQL ban đầu. Tài liệu môn học gốc yêu cầu CSDL quan hệ và SQL; bản SQL cũ được giữ trong thư mục lịch sử để đối chiếu với yêu cầu bài nộp.
