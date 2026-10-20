FROM python:3.12-slim
WORKDIR /app
COPY news-crawler/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY news-crawler /app
RUN mkdir -p /data && chown 65534:65534 /data
ENV NEWS_CRAWLER_CACHE=/data/crawler.sqlite NEWS_INCLUDE_GLOBAL=true NEWS_CRAWL_INTERVAL_SECONDS=300
USER 65534:65534
CMD ["python","-u","live_pipeline.py"]
