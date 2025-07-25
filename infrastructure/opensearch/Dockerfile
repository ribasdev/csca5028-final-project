FROM opensearchproject/opensearch:2.11.1

# Set environment variables for Heroku deployment
ENV discovery.type=single-node \
    OPENSEARCH_INITIAL_ADMIN_PASSWORD=admin \
    DISABLE_SECURITY_PLUGIN=true \
    DISABLE_INSTALL_DEMO_CONFIG=true \
    cluster.name=heroku-opensearch \
    node.name=heroku-node \
    bootstrap.memory_lock=false \
    ES_JAVA_OPTS="-Xms256m -Xmx256m"

# Expose port for Heroku
EXPOSE $PORT

# Create startup script that uses Heroku's dynamic port
COPY startup.sh /startup.sh
RUN chmod +x /startup.sh

CMD ["/startup.sh"]
