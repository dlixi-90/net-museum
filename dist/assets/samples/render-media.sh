#!/bin/sh
set -eu
cd /samples
espeak-ng --voices=vi
espeak-ng --voices=vi | grep -q Vietnamese
espeak-ng -v vi -s 142 -f 37557-transcript.txt -w 37557-audio.wav
ffmpeg -hide_banner -loglevel error -y -i 37557-audio.wav -codec:a libmp3lame -b:a 96k 37557-audio.mp3
ffmpeg -hide_banner -loglevel error -y -loop 1 -i 37557-video-source.jpg -i 37557-audio.mp3 -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x151310,drawbox=x=0:y=620:w=iw:h=100:color=black@0.8:t=fill,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=37557-video-title.txt:fontcolor=white:fontsize=22:line_spacing=8:x=32:y=640" -r 15 -c:v libx264 -preset fast -tune stillimage -crf 26 -pix_fmt yuv420p -c:a aac -b:a 96k -shortest -movflags +faststart 37557-video.mp4
ffmpeg -hide_banner -loglevel error -i 37557-audio.mp3 -f null -
ffmpeg -hide_banner -loglevel error -i 37557-video.mp4 -f null -
espeak-ng -v vi -s 142 -f 37451-transcript.txt -w 37451-audio.wav
ffmpeg -hide_banner -loglevel error -y -i 37451-audio.wav -codec:a libmp3lame -b:a 96k 37451-audio.mp3
ffmpeg -hide_banner -loglevel error -y -loop 1 -i 37451-video-source.jpg -i 37451-audio.mp3 -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x151310,drawbox=x=0:y=620:w=iw:h=100:color=black@0.8:t=fill,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=37451-video-title.txt:fontcolor=white:fontsize=22:line_spacing=8:x=32:y=640" -r 15 -c:v libx264 -preset fast -tune stillimage -crf 26 -pix_fmt yuv420p -c:a aac -b:a 96k -shortest -movflags +faststart 37451-video.mp4
ffmpeg -hide_banner -loglevel error -i 37451-audio.mp3 -f null -
ffmpeg -hide_banner -loglevel error -i 37451-video.mp4 -f null -
espeak-ng -v vi -s 142 -f 37563-transcript.txt -w 37563-audio.wav
ffmpeg -hide_banner -loglevel error -y -i 37563-audio.wav -codec:a libmp3lame -b:a 96k 37563-audio.mp3
ffmpeg -hide_banner -loglevel error -y -loop 1 -i 37563-video-source.jpg -i 37563-audio.mp3 -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x151310,drawbox=x=0:y=620:w=iw:h=100:color=black@0.8:t=fill,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=37563-video-title.txt:fontcolor=white:fontsize=22:line_spacing=8:x=32:y=640" -r 15 -c:v libx264 -preset fast -tune stillimage -crf 26 -pix_fmt yuv420p -c:a aac -b:a 96k -shortest -movflags +faststart 37563-video.mp4
ffmpeg -hide_banner -loglevel error -i 37563-audio.mp3 -f null -
ffmpeg -hide_banner -loglevel error -i 37563-video.mp4 -f null -
espeak-ng -v vi -s 142 -f 38546-transcript.txt -w 38546-audio.wav
ffmpeg -hide_banner -loglevel error -y -i 38546-audio.wav -codec:a libmp3lame -b:a 96k 38546-audio.mp3
ffmpeg -hide_banner -loglevel error -y -loop 1 -i 38546-video-source.jpg -i 38546-audio.mp3 -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x151310,drawbox=x=0:y=620:w=iw:h=100:color=black@0.8:t=fill,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=38546-video-title.txt:fontcolor=white:fontsize=22:line_spacing=8:x=32:y=640" -r 15 -c:v libx264 -preset fast -tune stillimage -crf 26 -pix_fmt yuv420p -c:a aac -b:a 96k -shortest -movflags +faststart 38546-video.mp4
ffmpeg -hide_banner -loglevel error -i 38546-audio.mp3 -f null -
ffmpeg -hide_banner -loglevel error -i 38546-video.mp4 -f null -
espeak-ng -v vi -s 142 -f 37450-transcript.txt -w 37450-audio.wav
ffmpeg -hide_banner -loglevel error -y -i 37450-audio.wav -codec:a libmp3lame -b:a 96k 37450-audio.mp3
ffmpeg -hide_banner -loglevel error -y -loop 1 -i 37450-video-source.jpg -i 37450-audio.mp3 -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x151310,drawbox=x=0:y=620:w=iw:h=100:color=black@0.8:t=fill,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=37450-video-title.txt:fontcolor=white:fontsize=22:line_spacing=8:x=32:y=640" -r 15 -c:v libx264 -preset fast -tune stillimage -crf 26 -pix_fmt yuv420p -c:a aac -b:a 96k -shortest -movflags +faststart 37450-video.mp4
ffmpeg -hide_banner -loglevel error -i 37450-audio.mp3 -f null -
ffmpeg -hide_banner -loglevel error -i 37450-video.mp4 -f null -
espeak-ng -v vi -s 142 -f 75915-transcript.txt -w 75915-audio.wav
ffmpeg -hide_banner -loglevel error -y -i 75915-audio.wav -codec:a libmp3lame -b:a 96k 75915-audio.mp3
ffmpeg -hide_banner -loglevel error -y -loop 1 -i 75915-video-source.jpg -i 75915-audio.mp3 -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x151310,drawbox=x=0:y=620:w=iw:h=100:color=black@0.8:t=fill,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=75915-video-title.txt:fontcolor=white:fontsize=22:line_spacing=8:x=32:y=640" -r 15 -c:v libx264 -preset fast -tune stillimage -crf 26 -pix_fmt yuv420p -c:a aac -b:a 96k -shortest -movflags +faststart 75915-video.mp4
ffmpeg -hide_banner -loglevel error -i 75915-audio.mp3 -f null -
ffmpeg -hide_banner -loglevel error -i 75915-video.mp4 -f null -
espeak-ng -v vi -s 142 -f 37449-transcript.txt -w 37449-audio.wav
ffmpeg -hide_banner -loglevel error -y -i 37449-audio.wav -codec:a libmp3lame -b:a 96k 37449-audio.mp3
ffmpeg -hide_banner -loglevel error -y -loop 1 -i 37449-video-source.jpg -i 37449-audio.mp3 -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0x151310,drawbox=x=0:y=620:w=iw:h=100:color=black@0.8:t=fill,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=37449-video-title.txt:fontcolor=white:fontsize=22:line_spacing=8:x=32:y=640" -r 15 -c:v libx264 -preset fast -tune stillimage -crf 26 -pix_fmt yuv420p -c:a aac -b:a 96k -shortest -movflags +faststart 37449-video.mp4
ffmpeg -hide_banner -loglevel error -i 37449-audio.mp3 -f null -
ffmpeg -hide_banner -loglevel error -i 37449-video.mp4 -f null -
