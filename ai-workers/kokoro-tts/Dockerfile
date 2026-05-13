FROM python:3.11-slim

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    espeak-ng \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

VOLUME ["/outputs"]
EXPOSE 8104
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8104", "--workers", "1"]
