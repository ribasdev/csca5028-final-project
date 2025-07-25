#!/bin/sh

# Startup script for Redis on Heroku
# Uses the PORT environment variable provided by Heroku

# Set the port from Heroku's environment variable
REDIS_PORT=${PORT:-6379}

echo "Starting Redis on port ${REDIS_PORT}"

# Start Redis with custom configuration
exec redis-server \
  --port ${REDIS_PORT} \
  --bind 0.0.0.0 \
  --maxmemory 256mb \
  --maxmemory-policy allkeys-lru \
  --save 900 1 \
  --save 300 10 \
  --save 60 10000 \
  --dir /data \
  --appendonly yes \
  --appendfsync everysec
