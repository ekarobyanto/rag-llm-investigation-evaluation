#!/bin/bash
set -e

# ==============================================================================
# Automated SSL Provisioning Script for investigation.robyantoeka.my.id
# ==============================================================================

DOMAIN="investigation.robyantoeka.my.id"
EMAIL="admin@robyantoeka.my.id"

echo "=== 1. Checking / Generating Initial Fallback Certificate ==="
docker compose run --rm --entrypoint "\
  sh -c 'if [ ! -f /etc/letsencrypt/live/$DOMAIN/fullchain.pem ]; then \
    mkdir -p /etc/letsencrypt/live/$DOMAIN && \
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
      -keyout /etc/letsencrypt/live/$DOMAIN/privkey.pem \
      -out /etc/letsencrypt/live/$DOMAIN/fullchain.pem \
      -subj \"/CN=localhost\"; \
    echo \"Created fallback certificate for Nginx startup.\"; \
  fi'" certbot

echo "=== 2. Starting Nginx ==="
docker compose up -d nginx

echo "=== 3. Requesting Let's Encrypt Certificate from ACME ==="
docker compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    --email $EMAIL --agree-tos --no-eff-email \
    -d $DOMAIN --force-renewal" certbot

echo "=== 4. Reloading Nginx with Production Certificate ==="
docker compose exec nginx nginx -s reload

echo "=== SSL Setup Completed for https://$DOMAIN ==="
