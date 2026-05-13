FROM jrottenberg/ffmpeg:6.1-ubuntu2204

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

VOLUME ["/outputs", "/tmp/ffmpeg"]
EXPOSE 8105
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8105", "--workers", "2"]
