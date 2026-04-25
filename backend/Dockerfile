# backend/Dockerfile
FROM python:3.12-slim

# (Optional, aber praktisch) schnellere/sauberere Python-Logs
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# System-Dependencies für rasterio (mindestens expat)
RUN apt-get update \
 && apt-get install -y --no-install-recommends libexpat1 \
 && rm -rf /var/lib/apt/lists/*

# Erst nur requirements kopieren → bessere Docker-Cache-Nutzung
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Dann erst den Rest des Codes
COPY . .

# Standard-Port für FastAPI
EXPOSE 8000

# Startet FastAPI automatisch über Uvicorn
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
