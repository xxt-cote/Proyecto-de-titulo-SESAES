FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /app
COPY requirements.txt .
RUN python -m pip install -r requirements.txt
COPY app ./app
COPY alembic ./alembic
COPY alembic.ini .
RUN useradd --create-home --uid 10001 sesaes && chown -R sesaes:sesaes /app
USER sesaes
EXPOSE 8080
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
