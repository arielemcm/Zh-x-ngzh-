FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TF_CPP_MIN_LOG_LEVEL=2 \
    HOST=0.0.0.0 \
    PORT=8001

WORKDIR /app

COPY modules/diagnostico-hojas/requirements.txt /app/modules/diagnostico-hojas/requirements.txt
RUN python -m pip install --no-cache-dir --upgrade pip \
    && python -m pip install --no-cache-dir -r /app/modules/diagnostico-hojas/requirements.txt

COPY . /app

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD python -c "import json,urllib.request; data=json.load(urllib.request.urlopen('http://127.0.0.1:8001/api/model', timeout=4)); assert data.get('status') == 'ready'"

CMD ["python", "modules/diagnostico-hojas/server.py"]
