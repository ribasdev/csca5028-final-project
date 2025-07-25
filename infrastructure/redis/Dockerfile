FROM redis:7-alpine

# Copy custom Redis configuration
COPY redis.conf /usr/local/etc/redis/redis.conf
COPY startup.sh /startup.sh

# Make startup script executable
RUN chmod +x /startup.sh

# Expose port for Heroku
EXPOSE $PORT

CMD ["/startup.sh"]
