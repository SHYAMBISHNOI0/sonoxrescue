FROM python:3.14-slim
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend backend
COPY scripts/start_backend.py scripts/start_backend.py
ENV CONTAINER=1
RUN useradd -u 10001 -m sonorescue && mkdir -p /app/data && chown -R sonorescue /app
USER sonorescue
EXPOSE 8000
CMD ["python", "scripts/start_backend.py"]
