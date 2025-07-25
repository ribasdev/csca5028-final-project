#!/bin/bash

# Startup script for OpenSearch on Heroku
# Uses the PORT environment variable provided by Heroku

# Set the port from Heroku's environment variable
export OPENSEARCH_PORT=${PORT:-9200}

# Configure OpenSearch to use the Heroku port
cat > /usr/share/opensearch/config/opensearch.yml << EOF
cluster.name: heroku-opensearch
node.name: heroku-node

# Network settings for Heroku
network.host: 0.0.0.0
http.port: ${OPENSEARCH_PORT}

# Single node configuration
discovery.type: single-node

# Disable security for simplicity (enable in production)
plugins.security.disabled: true

# Memory settings for Heroku
bootstrap.memory_lock: false

# Path settings
path.data: /usr/share/opensearch/data
path.logs: /usr/share/opensearch/logs

# Disable demo configuration
plugins.security.allow_default_init_securityindex: false
EOF

# Start OpenSearch
echo "Starting OpenSearch on port ${OPENSEARCH_PORT}"
exec /usr/share/opensearch/bin/opensearch
