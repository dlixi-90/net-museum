# Nét — Bảo tàng nghệ thuật số

Bản mẫu đầu tiên cho đề tài **Hệ thống quản lý bảo tàng số**, môn Hệ cơ sở dữ liệu đa phương tiện. Phạm vi nội dung đã chọn: **mỹ thuật và nghệ thuật**. Bộ sưu tập khởi đầu gồm 7 hiện vật gốm Việt Nam từ The Met Open Access.

## Chạy website

Cần Node.js, không cần cài thư viện.

```sh
npm start
```

Mở http://localhost:3000. Trên PowerShell có chặn npm.ps1, dùng `npm.cmd start` hoặc `node scripts/serve.mjs`. Không mở trực tiếp index.html vì website tải metadata bằng fetch.

```sh
npm.cmd run check
```

## Phần đã thực hiện

- Thiết kế theo ảnh tham khảo: header trắng hai hàng, ảnh kiến trúc toàn chiều ngang, tiêu đề trên ảnh, ba mục nội dung nổi bật chuyển thủ công và hai khối nội dung trắng chồng lên ảnh. Menu thu gọn trên điện thoại.
- Trang chủ tiếng Việt, hiển thị trên máy tính và điện thoại.
- Bộ sưu tập 7 tác phẩm, ảnh thật lưu trong dự án, từng tác phẩm có nguồn gốc rõ ràng.
- Tìm từ khóa có/không dấu theo tên, tác giả, mô tả, chất liệu và nhãn; kết hợp nhóm gốm, niên đại, dung lượng ảnh; sắp xếp tên hoặc niên đại.
- Chi tiết tác phẩm, phóng lớn/thu nhỏ ảnh, đọc mô tả bằng SpeechSynthesis nếu thiết bị hỗ trợ. Đây **không phải file audio** đã thu âm.
- Yêu thích và lượt mở chi tiết lưu trong localStorage; thống kê phản ánh **trình duyệt hiện tại**.
- CBIR thực nghiệm: ảnh JPG/PNG/WebP dưới 10 MB → resize 96×96 → histogram RGB 64 chiều → cosine similarity → xếp hạng. Ảnh truy vấn xử lý trên trình duyệt, không tải lên server.
- Script thiết kế PostgreSQL, dữ liệu mẫu và 15 câu truy vấn. Xem [định hướng](docs/DINH_HUONG.md).

## Phạm vi chưa triển khai

Đây là **bản mẫu frontend**, chưa phải hệ thống hoàn chỉnh đáp ứng toàn bộ bài tập. Chưa có xác thực, phân quyền server, quản trị người dùng, CRUD và upload vào server, CSDL kết nối website, video/audio/PDF thật, bộ đếm tập trung. Các script PostgreSQL là thiết kế để triển khai tiếp; website hiện đọc JSON.

CBIR dựa trên màu, bị ảnh hưởng bởi nền, ánh sáng và tỷ lệ ảnh; không nhận dạng danh tính, phong cách hoặc tác giả. Chưa đánh giá Precision@5 trên bộ dữ liệu có nhãn.

## Cấu trúc

```text
dist/                  Website tĩnh có thể triển khai
  app.js               Tương tác giao diện
  core.js              Lọc và thuật toán CBIR
  assets/              Ảnh, metadata nguồn
scripts/serve.mjs      Máy chủ phát triển cục bộ
database/schema.sql    Mô hình PostgreSQL (18 bảng)
database/seed.sql      Dữ liệu mẫu lấy từ metadata ảnh
database/queries.sql   15 truy vấn minh họa
docs/DINH_HUONG.md     Phạm vi, ERD, API và kế hoạch
tests/core.test.mjs    Kiểm tra tìm kiếm và CBIR
```

## Cơ sở dữ liệu

Tạo CSDL trống `net_museum`, sau đó chạy từ thư mục dự án:

```sh
psql -v ON_ERROR_STOP=1 -d net_museum -f database/schema.sql
psql -v ON_ERROR_STOP=1 -d net_museum -f database/seed.sql
psql -v ON_ERROR_STOP=1 -d net_museum -f database/queries.sql
```

Chưa kết nối các bảng này với frontend. Không có tài khoản hoặc mật khẩu giả trong seed. Khi làm backend, tạo admin bằng lệnh quản trị và băm mật khẩu. Vector CBIR trong seed để NULL cho đến khi trích xuất thật.

## Nguồn tư liệu

Ảnh và metadata: [The Metropolitan Museum of Art Open Access](https://www.metmuseum.org/about-the-met/policies-and-documents/open-access). API xác nhận `isPublicDomain: true` cho cả 7 ảnh. URL và thông tin gốc được lưu ở `dist/assets/sources.json`. Mỗi hồ sơ liên kết đến trang hiện vật gốc. Tên dịch, mô tả và phân nhóm trưng bày là nội dung biên tập của dự án; không phải bản dịch chính thức hay quan hệ hợp tác với The Met.

Font tải từ Google Fonts; có font hệ thống dự phòng khi mất mạng. Ảnh và chức năng chính được phục vụ cùng website.

Ảnh kiến trúc trang chủ: **Natural History Museum Main Hall, London, UK — DAVID ILIFF**, [nguồn Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Natural_History_Museum_Main_Hall,_London,_UK_-_Diliff.jpg), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Ảnh dùng minh họa kiến trúc, được cắt khung bằng CSS và phủ lớp tối khi hiển thị; không phải địa điểm thực tế của dự án Nét. Xem metadata tại `dist/assets/architecture-source.json`. Giấy phép này áp dụng cho ảnh kiến trúc; metadata và ảnh bộ sưu tập The Met vẫn giữ nguồn/giấy phép riêng.
