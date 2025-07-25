FROM ubuntu:22.04

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    gnupg \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

# Install OpenSearch
RUN curl -o- https://artifacts.opensearch.org/publickeys/opensearch.pgp | gpg --dearmor --batch --yes -o /usr/share/keyrings/opensearch-keyring && \
    echo "deb [signed-by=/usr/share/keyrings/opensearch-keyring] https://artifacts.opensearch.org/releases/bundle/opensearch/2.x/apt stable main" | tee /etc/apt/sources.list.d/opensearch-2.x.list && \
    apt-get update && apt-get install -y opensearch

# Install Redis
RUN apt-get update && apt-get install -y redis-server

# Create necessary directories
RUN mkdir -p /var/log/supervisor /var/run/supervisor

# Copy configuration files
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY opensearch.yml /etc/opensearch/opensearch.yml
COPY redis.conf /etc/redis/redis.conf
COPY startup.sh /startup.sh

# Make startup script executable
RUN chmod +x /startup.sh

# Expose port for Heroku
EXPOSE $PORT

CMD ["/startup.sh"]
