# Deployment Guide (Direct Node.js & Cloud Services)

## Hosting Architecture
- **Frontend**: Vercel / Netlify / Static Server (Vite Single Page App)
- **Backend / DB**: Node.js Service (Render / Hostinger KVM / PM2) with Neon PostgreSQL Database
- **Security / Proxy**: Cloudflare DNS, HTTPS SSL, Web Application Firewall (WAF)
- **Object Storage**: Local server disk (`./uploads`) / Private Cloudflare R2

---

## Deployment Steps (Direct Node.js Service)

1. **Clone repository**:
   ```bash
   git clone <repo_url> ivf-system
   cd ivf-system
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with production credentials & DATABASE_URL
   ```

4. **Run Database Migrations & Prisma Client Generation**:
   ```bash
   npm run prisma:generate
   npm run prisma:push
   npm run seed
   ```

5. **Start Production Backend (PM2 or Render)**:
   ```bash
   # Build backend
   npm run build:backend

   # Start backend service
   npm --prefix apps/backend start
   ```

6. **Build & Serve Frontend**:
   ```bash
   npm run build:frontend
   ```
