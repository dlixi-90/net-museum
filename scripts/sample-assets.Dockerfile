FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends espeak-ng ffmpeg fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
WORKDIR /samples
CMD ["sh", "/samples/render-media.sh"]
