#!/bin/bash

# Startup script for combined infrastructure on Heroku

# Set the port from Heroku's environment variable
export APP_PORT=${PORT:-8080}

# Configure OpenSearch to use port 9200 internally
cat > /etc/opensearch/opensearch.yml << EOF
cluster.name: heroku-opensearch
node.name: heroku-node
network.host: 127.0.0.1
http.port: 9200
discovery.type: single-node
plugins.security.disabled: true
bootstrap.memory_lock: false
path.data: /var/lib/opensearch
path.logs: /var/log/opensearch
EOF

# Configure Redis to use port 6379 internally
cat > /etc/redis/redis.conf << EOF
bind 127.0.0.1
port 6379
maxmemory 128mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfsync everysec
EOF

# Configure Nginx to proxy requests
cat > /etc/nginx/nginx.conf << EOF
events {
    worker_connections 1024;
}

http {
    upstream opensearch {
        server 127.0.0.1:9200;
    }
    
    upstream redis {
        server 127.0.0.1:6379;
    }

    server {
        listen ${APP_PORT};
        
        # OpenSearch proxy
        location / {
            proxy_pass http://opensearch;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
        }
        
        # Redis proxy (for HTTP-based Redis clients)
        location /redis {
            proxy_pass http://redis;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
        }
        
        # Health check endpoint
        location /health {
            return 200 "OK";
            add_header Content-Type text/plain;
        }
    }
}
EOF

# Install Nginx
apt-get update && apt-get install -y nginx

# Start supervisor to manage all services
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
