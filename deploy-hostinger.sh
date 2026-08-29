#!/usr/bin/env bash

# =============================================================================
# IVF Storage Clinic System - Hostinger KVM 1 Automated VPS Deployment Script
# All Patient Records, Images, Cryo Storage Data & Database run 100% on this VPS.
# =============================================================================

set -e

echo "🚀 Starting IVF System Production Deployment on Hostinger KVM 1 VPS..."

# 1. Update OS packages & Install prerequisites
echo "📦 Installing Node.js 20 LTS, PostgreSQL, Nginx, PM2 & Certbot..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx postgresql postgresql-contrib ufw certbot python3-certbot-nginx

# Install Node.js 20.x LTS if not already installed
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi

# Install PM2 globally
sudo npm install -g pm2

# 2. Configure Local PostgreSQL Database on Hostinger Server
echo "🗄️ Setting up Local PostgreSQL Database on Hostinger VPS..."
DB_NAME="ivf_production"
DB_USER="ivf_admin"
DB_PASS="IvfSecurePass2026!"

sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME};" || true
sudo -u postgres psql -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}'; END IF; END \$\$;"
sudo -u postgres psql -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" || true
sudo -u postgres psql -d ${DB_NAME} -c "GRANT ALL ON SCHEMA public TO ${DB_USER};" || true
sudo -u postgres psql -d ${DB_NAME} -c "ALTER SCHEMA public OWNER TO ${DB_USER};" || true

LOCAL_DB_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}?schema=public"

# 3. Setup Project Directory & Permissions
PROJECT_DIR="/var/www/ivf"
sudo mkdir -p ${PROJECT_DIR}/uploads
sudo chown -R $USER:$USER ${PROJECT_DIR}

# Copy repository files to /var/www/ivf if not already inside
echo "📁 Deploying application files to ${PROJECT_DIR}..."
if [ "$(pwd)" != "${PROJECT_DIR}" ]; then
  cp -r . ${PROJECT_DIR}/
fi

cd ${PROJECT_DIR}

# 4. Configure Backend Environment
echo "⚙️ Configuring Production Environment (.env)..."
if [ -f "${PROJECT_DIR}/apps/backend/.env" ]; then
  echo "✅ Preserving user updated apps/backend/.env credentials"
  sed -i 's|DATABASE_URL=.*|DATABASE_URL="postgresql://ivf_admin:IvfSecurePass2026!@localhost:5432/ivf_production?schema=public"|g' ${PROJECT_DIR}/apps/backend/.env
  sed -i 's|STORAGE_LOCAL_DIR=.*|STORAGE_LOCAL_DIR=/var/www/ivf/uploads|g' ${PROJECT_DIR}/apps/backend/.env
fi
cp ${PROJECT_DIR}/apps/backend/.env ${PROJECT_DIR}/.env

# 5. Install Dependencies & Build Backend Only
echo "🔨 Building IVF System Backend..."
npm install
npm run build:backend

# 6. Push Schema to Local PostgreSQL Database & Seed Admin Account
echo "🌱 Initializing Database Schema & Seeding Storage Hierarchy..."
cd ${PROJECT_DIR}/apps/backend
npx prisma db push --accept-data-loss
cd ${PROJECT_DIR}

# 7. Setup PM2 Process Manager for Backend Service
echo "⚡ Starting IVF Backend with PM2..."
pm2 stop ivf-backend || true
pm2 delete ivf-backend || true
pm2 start apps/backend/dist/src/main.js --name "ivf-backend"
pm2 save
pm2 startup | tail -n 1 | sudo bash || true

# 8. Configure Nginx Reverse Proxy for Backend API & Image Storage
echo "🌐 Configuring Nginx Web Server for Backend API & Image Uploads..."
cat <<EOT | sudo tee /etc/nginx/sites-available/ivf
server {
    listen 80;
    server_name api.sgrhivfcryo.in sgrhivfcryo.in www.sgrhivfcryo.in _;

    client_max_body_size 25M;

    # Reverse Proxy Backend API Requests
    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Serve Uploaded Patient Images & Document Scans Directly from Local Hostinger Server Storage
    location /uploads/ {
        alias ${PROJECT_DIR}/uploads/;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
EOT

sudo ln -sf /etc/nginx/sites-available/ivf /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# 9. Configure Firewall
echo "🛡️ Configuring UFW Firewall Security..."
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

echo "================================================================="
echo "✅ IVF CLINIC SYSTEM DEPLOYMENT SUCCESSFUL ON HOSTINGER KVM 1!"
echo "================================================================="
echo "📍 Local Database URL: ${LOCAL_DB_URL}"
echo "📁 Image Upload Storage Path: ${PROJECT_DIR}/uploads"
echo "🔑 Default Admin Login: Staff ID 'ADMIN001' | Password 'clinic2026'"
echo "🔑 Default Access Key: clinic2026"
echo "================================================================="
