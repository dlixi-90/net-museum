# Nét — Bảo tàng nghệ thuật số

Website mỹ thuật với giao diện bảo tàng theo ảnh tham khảo. Phiên bản hiện tại dùng **Node.js + MongoDB Atlas + Cloudinary** để lưu tác phẩm, tài khoản quản trị, phiên đăng nhập và metadata ảnh/video. Bộ sưu tập ban đầu có 7 hiện vật gốm Việt từ The Met.

## Các trang riêng

| Trang | Đường dẫn |
|---|---|
| Trang chủ | `/` |
| Bộ sưu tập | `/bo-suu-tap/` |
| Khám phá theo chủ đề | `/kham-pha/` |
| Câu chuyện nghệ thuật | `/cau-chuyen/` |
| Về bảo tàng và nguồn tư liệu | `/ve-bao-tang/` |
| Tác phẩm đã lưu | `/da-luu/` |
| Chi tiết tác phẩm | `/tac-pham/?id=37557` |
| Quản lý và thêm/sửa tác phẩm | `/quan-ly/` |
| Thống kê bộ sưu tập | `/thong-ke/` |

Các mục điều hướng mở tài liệu HTML riêng, có thể mở trực tiếp và tải lại. Bộ lọc lưu trong query string, ví dụ `/bo-suu-tap/?category=blue`. Nguồn template tại `web/`; chạy `npm.cmd run build` sau khi sửa template để sinh các file trong `dist/`. JavaScript và CSS phục vụ từ đường dẫn gốc để hoạt động trên mọi trang con. Giao diện theo phong cách Artversnght: nền trắng, chữ Be Vietnam Pro hỗ trợ tiếng Việt, nội dung và giao diện dùng cỡ chữ lớn hơn, banner phòng tranh phủ tối, nút dạng viên thuốc, ảnh tác phẩm bo góc với chú thích phủ trên ảnh và khu tuyển chọn nền đen. Menu có bố cục một hàng; các trang con sử dụng cùng ngôn ngữ thiết kế. Trang chủ có trình chiếu 3 chủ đề bằng nút bấm và FAQ dùng details/summary; không tự chuyển slide.

Ô tìm kiếm tên tác phẩm có ở đầu mọi trang. Khi đang ở Bộ sưu tập, kết quả lọc trực tiếp theo tên; từ các trang khác, nhấn Enter để mở `/bo-suu-tap/?q=...`. Hỗ trợ tiếng Việt có/không dấu và không phân biệt hoa/thường, chỉ tìm trong tên hiển thị. `/tim-kiem/` cũ chuyển sang Bộ sưu tập và giữ tham số `q`; không còn trang tìm bằng ảnh. Nhãn đánh số đầu tiêu đề đã bỏ trên các trang.

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

Mở **http://localhost:3000** → **Quản lý tác phẩm** → lần đầu tạo tài khoản quản trị → **Thêm tác phẩm**. Điền thông tin, chọn ảnh và video giới thiệu tùy chọn. Thiết lập Cloudinary theo hướng dẫn bên dưới trước khi tải tệp. Muốn sửa, chọn **Chỉnh sửa** trong bảng quản lý. Khi lưu thành công, danh sách và bộ sưu tập được cập nhật từ MongoDB.

Backend tự tạo index và nhập 7 tác phẩm mẫu bằng `$setOnInsert`: khởi động lại không ghi đè tác phẩm đã chỉnh sửa. Muốn chạy seed riêng: `npm.cmd run db:seed`.

## Dùng MongoDB Atlas hoặc MongoDB sẵn có

**Lựa chọn hiện tại: MongoDB Atlas.** Xem [hướng dẫn cho cluster đã có](docs/ATLAS.md), điền URI trong `.env`, chạy `npm.cmd run db:check` rồi `npm.cmd start`. Với Atlas không cần chạy `db:start`.

Sao chép `.env.example` thành `.env`, điền `MONGODB_URI` và `MONGODB_DB` trên máy bạn. Không đưa URI chứa mật khẩu vào mã trình duyệt hoặc Git. Sau đó chạy `npm.cmd start`; không cần `db:start`. `.env` đã được loại khỏi Git và thư mục phát web.

Khi triển khai thật, phục vụ **cả frontend và backend Node.js trên cùng origin**, cấu hình `PUBLIC_ORIGIN=https://...`, TLS, `NODE_ENV=production`, `ALLOW_ADMIN_SETUP=false`, MongoDB đã có tài khoản quản trị và các biến Cloudinary. Khởi tạo admin trong môi trường cục bộ an toàn trước khi công bố. Sao lưu MongoDB và quản lý tài sản trong Cloudinary Media Library. Tệp upload mới không lưu trên ổ đĩa máy chủ.

## Lưu ảnh và video trên Cloudinary

Xem [hướng dẫn Cloudinary](docs/CLOUDINARY.md). Điền `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` trong `.env`, chạy `npm.cmd run cloudinary:check`, rồi khởi động lại `npm.cmd start`. Khóa chỉ dùng ở backend, không đưa vào frontend hoặc Git.

Ảnh đại diện (JPG/PNG/WebP, tối đa 8 MB) được chuyển WebP; video giới thiệu tùy chọn (MP4/WebM/MOV, tối đa 50 MB) được lưu và phát dưới dạng MP4. MongoDB lưu URL HTTPS, public ID, loại tệp, dung lượng, kích thước và thời lượng. Mở trang chi tiết để phát video. Gỡ video khỏi hồ sơ không xóa tài sản trên Cloudinary.

Ảnh cũ vẫn xem được. Chạy `npm.cmd run media:migrate` để xem số ảnh có thể chuyển, sau đó `npm.cmd run media:migrate -- --apply` để chuyển các ảnh trong `uploads/` và ảnh tác phẩm mẫu trong `dist/assets/`. Lệnh giữ tệp gốc, cập nhật URL hồ sơ và có thể chạy lại khi gián đoạn.

## Phân biệt bản đầy đủ và bản Sites

- `npm.cmd start`: frontend + API + MongoDB; thêm/sửa và upload hoạt động.
- `npm.cmd run preview`: chỉ website tĩnh; hiện snapshot mẫu có nhãn, không lưu tác phẩm.
- Link Sites hiện tại triển khai từ `dist/`, vẫn là hosting tĩnh. MongoDB không chạy bên trong gói này. Nút quản lý sẽ giải thích khi chưa có backend, không báo lưu thành công giả và không dùng localStorage để thay thế MongoDB.

Để có thêm/sửa trực tuyến, cần triển khai backend Node.js với MongoDB lên máy chủ hỗ trợ Node/TCP và cấu hình Cloudinary. Chỉ đưa URI Atlas vào frontend không đủ và sẽ làm lộ mật khẩu.

## Chức năng đã có

- Thêm tác phẩm với ảnh, tên, tác giả, niên đại, năm bắt đầu, nhóm nghệ thuật, chất liệu, xuất xứ, mô tả, từ khóa và nguồn.
- Sửa metadata hoặc thay ảnh; kiểm tra revision để trả lỗi 409 khi có cập nhật mới từ cửa sổ khác.
- Thiết lập admin lần đầu trên máy cục bộ; đăng nhập/đăng xuất. Mật khẩu băm scrypt; phiên cookie HttpOnly lưu hash token trong MongoDB và hết hạn sau 24 giờ.
- API ghi bắt buộc đăng nhập, kiểm tra origin, allowlist trường dữ liệu và loại tệp. Ảnh JPG/PNG/WebP tối đa 8 MB được giải mã thật và chuyển WebP, cạnh dài tối đa 2000 px.
- Danh mục gốm, hội họa, điêu khắc, đồ họa; tìm theo tên có/không dấu, niên đại và sắp xếp.
- Chi tiết, phóng ảnh và giọng đọc tổng hợp. Các hàm CBIR cũ trong `core.js` chỉ còn là tiện ích tham khảo, không có giao diện tìm bằng ảnh.
- Yêu thích và lượt mở chi tiết vẫn là dữ liệu trình duyệt; hồ sơ tác phẩm và tài khoản lưu trong MongoDB.

Chưa triển khai xóa tác phẩm, quản lý nhiều tài khoản, nhiều ảnh/tác phẩm, audio/PDF thật, bộ đếm truy cập tập trung và đánh giá CBIR có nhãn.

## Cấu trúc và kiểm thử

```text
server/                   Backend HTTP, MongoDB, auth, validation, upload
dist/                     Giao diện và snapshot chỉ đọc cho hosting tĩnh
web/                      Template chung và nội dung 9 trang riêng
scripts/build-pages.mjs   Sinh HTML tĩnh; không cần framework mới
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

Integration test dùng bộ giả lập tại ranh giới Cloudinary (không gọi tài khoản thật), tạo database riêng tên `net_test_*` và thư mục ảnh tạm riêng, sau đó chỉ xóa dữ liệu thử nghiệm của chính nó; không xóa `net_museum`. Đã kiểm tra giao diện Chrome trên máy tính/điện thoại, thêm/sửa qua biểu mẫu, tải lại trang, đăng xuất và giữ dữ liệu sau khởi động lại backend.

## Nguồn tư liệu

Tham khảo thiết kế: [Artversnght — Luthfi Setiaji / Pickolab](https://dribbble.com/shots/23724133-Artversnght-Art-Gallery-Landing-Page). Giao diện được triển khai lại bằng HTML/CSS cho nội dung Nét; không sử dụng ảnh chụp thiết kế làm giao diện. Nguồn homepage tại `web/home.mjs`, theme mới tại `dist/gallery.css`, trình chiếu tại `dist/hero.js`.

Ảnh banner: [Phòng trưng bày Bảo tàng Mỹ thuật Việt Nam, Hà Nội — Daderot / Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Interior_view_-_Vietnam_National_Museum_of_Fine_Arts_-_Hanoi,_Vietnam_-_DSC05276.JPG), theo [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Lưu tại `dist/assets/vietnam-fine-arts-museum.jpg`; nguồn ghi trong `vietnam-fine-arts-museum-source.json`. Ảnh được tối ưu kích thước; cắt khung và phủ tối bằng CSS.

Ảnh và metadata mẫu: [The Met Open Access](https://www.metmuseum.org/about-the-met/policies-and-documents/open-access). API xác nhận `isPublicDomain: true` cho 7 ảnh. Metadata gốc ở `dist/assets/sources.json`; tên, mô tả tiếng Việt và phân nhóm trưng bày do dự án biên soạn. Tác phẩm tự thêm hiển thị tác giả và nguồn do quản trị viên nhập.

Ảnh kiến trúc: [Natural History Museum Main Hall — DAVID ILIFF](https://commons.wikimedia.org/wiki/File:Natural_History_Museum_Main_Hall,_London,_UK_-_Diliff.jpg), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/), cắt khung và phủ tối bằng CSS; dùng minh họa, không phải địa điểm thực tế của Nét. Font Be Vietnam Pro được phục vụ trực tiếp từ `dist/assets/fonts/` với các subset tiếng Việt, Latin mở rộng và Latin; giấy phép SIL OFL đi kèm. Không cần tải font từ Google khi xem trang.

Theo yêu cầu mới, MongoDB thay thế thiết kế PostgreSQL ban đầu. Tài liệu môn học gốc yêu cầu CSDL quan hệ và SQL; bản SQL cũ được giữ trong thư mục lịch sử để đối chiếu với yêu cầu bài nộp.
