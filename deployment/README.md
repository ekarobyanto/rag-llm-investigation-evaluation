# Production Deployment Architecture

This directory houses the containerized production stack for the **RAG Investigation Evaluation System**.

## 🌐 Stack Overview

```
[ Internet ]
      │
      ▼
[ Nginx Reverse Proxy (:80, :443) ]  (investigation.robyantoeka.my.id)
      │
      ├── / (HTTP/HTTPS)  ──►  [ Next.js Standalone Container (:3000) ]
      │                                     │
      ├── /ws (WebSocket) ──►  [ Live Telemetry Server (:3001) ]
      │                                     │
      └── /.well-known/acme-challenge/      ▼
               │                   [ PostgreSQL + pgvector (:5432) ]
               ▼
      [ Certbot (SSL Auto-renewal) ]
```

## 📂 Directory Structure

```
deployment/
├── docker-compose.yml       # Production compose definition (db, app, nginx, certbot)
├── init-ssl.sh              # One-command Let's Encrypt SSL certificate provisioning
├── nginx/
│   └── default.conf         # Nginx reverse proxy configuration with WebSocket & HTTP/2
└── README.md                # Deployment documentation
```

## 🚀 Deployment Instructions

### 1. Automated Deployment (CI/CD)
Pushing to `master` automatically:
1. Builds the Next.js standalone container via GitHub Actions.
2. Pushes the Docker image to GitHub Container Registry (`ghcr.io`).
3. Deploys to the VPS over SSH, migrates the database, runs the data seeder, and updates Nginx.

### 2. Manual SSL Certificate Setup (Let's Encrypt)
Ensure DNS records point `investigation.robyantoeka.my.id` to your VPS IP (`43.173.33.250`).

On the VPS, execute:
```bash
cd /opt/rag-llm-investigation
chmod +x init-ssl.sh
./init-ssl.sh
```

### 3. Container Management
```bash
cd /opt/rag-llm-investigation

# View container status
docker compose ps

# View live application logs
docker compose logs -f app

# View Nginx access & error logs
docker compose logs -f nginx

# Restart entire stack
docker compose restart
```
