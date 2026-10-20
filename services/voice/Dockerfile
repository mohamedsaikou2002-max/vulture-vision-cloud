FROM python:3.12-slim
WORKDIR /app
COPY services/voice/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY services /app/services
USER 65534:65534
EXPOSE 8090
CMD ["uvicorn","services.voice.app:app","--host","0.0.0.0","--port","8090","--workers","1"]
