#!/bin/bash
# ============================================================================
# IVF Production Deployment Script
# Builds backend + frontend locally, then deploys to VPS via SSH
# ============================================================================
set -e

SERVER_ALIAS="ivf"  # SSH alias from ~/.ssh/config
REMOTE_APP_DIR="/var/www/ivf"  # Server app location

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║       IVF CLINIC — PRODUCTION DEPLOYMENT SCRIPT         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# ── Step 1: Build Backend ──
echo "━━━ [1/5] Building Backend (TypeScript → JavaScript) ━━━"
cd "$PROJECT_ROOT/apps/backend"
npm install --include=dev
npx prisma generate
npx tsc
echo "✅ Backend build complete → apps/backend/dist/"

# ── Step 2: Build Frontend ──
echo ""
echo "━━━ [2/5] Building Frontend (Vite Production Build) ━━━"
cd "$PROJECT_ROOT/apps/frontend"
npm install
npx vite build
echo "✅ Frontend build complete → apps/frontend/dist/"

# ── Step 3: Upload Backend to Server ──
echo ""
echo "━━━ [3/5] Uploading Backend to Server ━━━"
cd "$PROJECT_ROOT"

# Upload backend dist, package.json, prisma schema, and .env
rsync -avz --delete apps/backend/dist/ "$SERVER_ALIAS:$REMOTE_APP_DIR/apps/backend/dist/"
scp apps/backend/package.json "$SERVER_ALIAS:$REMOTE_APP_DIR/apps/backend/package.json"
rsync -avz apps/backend/prisma/ "$SERVER_ALIAS:$REMOTE_APP_DIR/apps/backend/prisma/"
scp .env "$SERVER_ALIAS:$REMOTE_APP_DIR/.env"
echo "✅ Backend files uploaded"

# ── Step 4: Upload Frontend to Server ──
echo ""
echo "━━━ [4/5] Uploading Frontend to Server ━━━"
rsync -avz --delete apps/frontend/dist/ "$SERVER_ALIAS:$REMOTE_APP_DIR/apps/frontend/dist/"
echo "✅ Frontend files uploaded"

# ── Step 5: Restart Backend on Server ──
echo ""
echo "━━━ [5/5] Installing Dependencies & Restarting Server ━━━"
ssh "$SERVER_ALIAS" << 'REMOTE_COMMANDS'
  cd /root/ivf/apps/backend || cd ~/ivf/apps/backend
  
  # Install production dependencies
  npm install --omit=dev 2>/dev/null || npm install --production
  npx prisma generate
  
  # Restart with PM2 if available, otherwise try systemctl
  if command -v pm2 &> /dev/null; then
    pm2 restart ivf-backend 2>/dev/null || pm2 start dist/src/main.js --name ivf-backend
    pm2 save
    echo "✅ Backend restarted via PM2"
  elif systemctl is-active --quiet ivf-backend 2>/dev/null; then
    sudo systemctl restart ivf-backend
    echo "✅ Backend restarted via systemd"
  else
    echo "⚠️  No process manager found. You may need to manually restart the backend:"
    echo "   cd ~/ivf/apps/backend && node dist/src/main.js"
  fi
REMOTE_COMMANDS

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║           ✅  DEPLOYMENT COMPLETE!                      ║"
echo "║  Backend:  https://api.sgrhivfcryo.in                   ║"
echo "║  Frontend: https://www.sgrhivfcryo.in                   ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Run health check:  ./scripts/backend-health-check.sh"
