FROM python:3.12-slim-bookworm
ENV PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1 HF_HOME=/cache HF_HUB_DISABLE_XET=1 HF_HUB_DISABLE_TELEMETRY=1
RUN pip install --no-cache-dir vieneu==3.8.3
COPY generate-neural-narration.py /app/generate-neural-narration.py
WORKDIR /samples
ENTRYPOINT ["python", "/app/generate-neural-narration.py"]
