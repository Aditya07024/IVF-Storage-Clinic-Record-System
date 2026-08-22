# Deployment Guide

## Hosting Architecture
- **Frontend**: Vercel
- **Backend / DB / Queue**: Hostinger KVM 1 (Ubuntu 22.04 LTS, Docker Compose, Nginx, PostgreSQL, Redis)
- **Security / Proxy**: Cloudflare DNS, HTTPS SSL, Web Application Firewall (WAF)
- **Object Storage**: Private Cloudflare R2 / local server disk (`./uploads`)

## Deployment Steps
1. Clone repository on Hostinger KVM:
   ```bash
   git clone <repo_url> ivf-system
   cd ivf-system
   ```
2. Copy environment secrets:
   ```bash
   cp .env.example .env
   # Edit .env with production credentials
   ```
3. Run Docker Compose:
   ```bash
   docker-compose up -d --build
   ```
4. Run Database Seed & Prisma Migrations:
   ```bash
   npm run prisma:push
   npm run seed
   ```
5. Configure Nginx Reverse Proxy & Cloudflare SSL certificate.
