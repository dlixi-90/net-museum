# Bộ tài nguyên đa phương tiện tiếng Việt

Bộ mẫu trong `dist/assets/samples/` bổ sung tài nguyên có thể mở, nghe và tải thật cho bảy hiện vật hiện có. Mỗi hiện vật có một ảnh chi tiết, một bản thuyết minh MP3 tiếng Việt, một video MP4 có âm thanh, một hồ sơ PDF, một bản TXT và một bản DOCX. `manifest.json` chứa siêu dữ liệu và mã ổn định để nhập vào PostgreSQL.

Ảnh chi tiết được cắt từ ảnh gốc The Met Open Access; ảnh gốc được giữ nguyên. Video là ảnh hiện vật được dựng thành phim minh họa với nhãn ghi rõ trên khung hình và phần thuyết minh. Video không phải phim tư liệu lịch sử. Nội dung bổ sung dùng tiếng Việt, ghi nguồn và quyền sử dụng trong từng hồ sơ.

Audio dùng giọng tổng hợp tiếng Việt miền Bắc `vi` của eSpeak NG; đây là giọng máy, không phải bản thu của hướng dẫn viên. Tệp MP3 và rãnh âm thanh trong MP4 có cùng nội dung. Nội dung đọc cũng có trong trường `transcript` của manifest và các tệp `*-transcript.txt` để đọc đối chiếu.

## Tái tạo bộ mẫu

Điều kiện: Node.js và các dependency của dự án đã cài; Docker Desktop đang chạy Linux containers. Máy Windows sử dụng font Arial có sẵn để nhúng các ký tự tiếng Việt vào PDF. Trên hệ điều hành khác, đặt biến môi trường `SAMPLE_ASSET_FONT` thành đường dẫn tệp TTF hỗ trợ tiếng Việt nếu không có DejaVu Sans.

Chạy tại thư mục `di-san-viet` trong PowerShell:

```powershell
node scripts/generate-sample-assets.mjs --prepare
docker build -f scripts/sample-assets.Dockerfile -t net-museum-sample-media:local .
docker run --rm --network none --mount "type=bind,source=$((Get-Location).Path)/dist/assets/samples,target=/samples" net-museum-sample-media:local
node scripts/generate-sample-assets.mjs --finalize
```

Bước build tải Debian, eSpeak NG và FFmpeg. Bước render chạy container tạm không có mạng, chỉ gắn thư mục `samples`; container PostgreSQL không bị sửa hay khởi động lại. Không cần cài phần mềm đọc giọng tiếng Việt lên Windows.

`--prepare` tạo TXT, DOCX, PDF, ảnh chi tiết và lệnh render. `--finalize` kiểm tra tệp MP3/MP4 bằng FFprobe, lấy thời lượng/kích thước và ghi manifest. Lệnh render kiểm tra giọng Việt được cài và giải mã toàn bộ MP3/MP4 bằng FFmpeg; lỗi sẽ dừng quá trình.

Các tệp WAV, ảnh nguồn video và script render nằm trong thư mục mẫu để có thể kiểm tra và tái tạo. Tài nguyên đưa vào kho qua manifest chỉ gồm 42 tệp hoàn chỉnh (sáu tệp cho mỗi hiện vật); không nhập các tệp trung gian vào danh mục.

Đây là bộ mẫu cho chức năng đa phương tiện. Tư liệu do bảo tàng cung cấp trong tương lai có thể thay thế từng tệp mà không thay đổi các hiện vật gốc.
