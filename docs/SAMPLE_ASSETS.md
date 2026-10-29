# Bộ tài nguyên đa phương tiện tiếng Việt

Bộ mẫu trong `dist/assets/samples/` bổ sung tài nguyên có thể mở, nghe và tải thật cho bảy hiện vật hiện có. Mỗi hiện vật có một ảnh chi tiết, một bản thuyết minh MP3 tiếng Việt, một video MP4 có âm thanh, một hồ sơ PDF, một bản TXT và một bản DOCX. `manifest.json` chứa siêu dữ liệu và mã ổn định để nhập vào PostgreSQL.

Video là ảnh hiện vật được dựng thành phim minh họa với nhãn ghi rõ trên khung hình và phần thuyết minh. Video không phải phim tư liệu lịch sử. Nội dung bổ sung dùng tiếng Việt, ghi nguồn và quyền sử dụng trong từng hồ sơ.

Audio dùng giọng AI **Minh Đức**, nam miền Bắc, của **VieNeu-TTS v3 Turbo** (`vieneu==3.8.3`). Giọng được tạo trên máy, không cần tài khoản hoặc API trả phí. Đây là giọng tổng hợp, không phải bản thu hướng dẫn viên. MP3 và âm thanh trong MP4 có cùng nội dung; `transcript` và các tệp `*-transcript.txt` chứa lời đọc để đối chiếu.

Mô hình và giọng dựng sẵn được tác giả phát hành theo Apache-2.0, cho phép sử dụng audio tạo ra trong sản phẩm. [Thông tin mô hình và quyền sử dụng](https://huggingface.co/pnnbao-ump/VieNeu-TTS-v3-Turbo), [mã nguồn VieNeu-TTS](https://github.com/pnnbao97/VieNeu-TTS). Dự án chỉ triển khai các tệp âm thanh/video đã tạo, không đưa mô hình lên Render.

## Tái tạo bộ mẫu

Điều kiện: Node.js và các dependency của dự án đã cài; Docker Desktop đang chạy Linux containers. Máy Windows sử dụng font Arial có sẵn để nhúng các ký tự tiếng Việt vào PDF. Trên hệ điều hành khác, đặt biến môi trường `SAMPLE_ASSET_FONT` thành đường dẫn tệp TTF hỗ trợ tiếng Việt nếu không có DejaVu Sans.

Chạy tại thư mục `di-san-viet` trong PowerShell:

```powershell
node scripts/generate-sample-assets.mjs --prepare
New-Item -ItemType Directory -Force .local/tts-cache | Out-Null
docker build -f scripts/neural-tts.Dockerfile -t net-museum-neural-tts:local scripts
docker run --rm --cpus=4 --memory=3g --mount "type=bind,source=$((Get-Location).Path)/dist/assets/samples,target=/samples" --mount "type=bind,source=$((Get-Location).Path)/.local/tts-cache,target=/cache" net-museum-neural-tts:local
docker build -f scripts/sample-assets.Dockerfile -t net-museum-sample-media:local .
docker run --rm --network none --mount "type=bind,source=$((Get-Location).Path)/dist/assets/samples,target=/samples" net-museum-sample-media:local
node scripts/generate-sample-assets.mjs --finalize
```

Bước tạo WAV chạy VieNeu-TTS trong container riêng. Lần đầu tải mô hình vào cache; các lần sau tái sử dụng. Mặc định dùng `fp32` để giữ chất lượng trên CPU không có VNNI; không tự chuyển sang giọng dự phòng. Khi cache đã đủ, có thể thêm `--network none -e HF_HUB_OFFLINE=1` cho container tạo giọng. Bước render MP3/MP4 chạy FFmpeg trong container không có mạng.

`--prepare` tạo TXT, DOCX, PDF, ảnh chi tiết và lệnh render. Bộ tạo giọng ghi `narration-profile.json`, kiểm tra âm thanh hữu hạn, có tín hiệu và ghi WAV theo từng bản; chạy lại sẽ bỏ qua bản đã hoàn tất nếu lời đọc/giọng/mã băm khớp. FFmpeg chuẩn hóa mức âm lượng MP3 và tạo video từ cùng audio. `--finalize` đối chiếu lời đọc/WAV/MP3/MP4 bằng SHA-256, kiểm tra luồng âm thanh và thời lượng bằng FFprobe rồi ghi manifest. Dữ liệu cũ được cập nhật một lần khi máy chủ khởi động; ID và liên kết tư liệu được giữ nguyên.

Các tệp WAV, ảnh nguồn video, nhãn video và script render được tạo cục bộ trong thư mục mẫu, được Git bỏ qua và không đưa lên bản triển khai. Chạy đủ quy trình trên để tái tạo chúng. Repository giữ lời đọc, hồ sơ giọng và manifest để đối chiếu nguồn. Tài nguyên đưa vào kho qua manifest gồm 42 tệp hoàn chỉnh (sáu tệp cho mỗi hiện vật); không nhập các tệp trung gian vào danh mục.

Đây là bộ mẫu cho chức năng đa phương tiện. Tư liệu do bảo tàng cung cấp trong tương lai có thể thay thế từng tệp mà không thay đổi các hiện vật gốc.
