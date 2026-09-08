# 🧬 SRGH IVF Specimen Storage & Clinic Record System

[![Deploy IVF System to Production](https://github.com/Aditya07024/IVF-Storage-Clinic-Record-System/actions/workflows/deploy.yml/badge.svg)](https://github.com/Aditya07024/IVF-Storage-Clinic-Record-System/actions/workflows/deploy.yml)
[![5-Minute Keep-Alive Cron Ping](https://github.com/Aditya07024/IVF-Storage-Clinic-Record-System/actions/workflows/cron-ping.yml/badge.svg)](https://github.com/Aditya07024/IVF-Storage-Clinic-Record-System/actions/workflows/cron-ping.yml)

An enterprise-grade, hardened clinical management system designed for **SRGH IVF Cryo Bank**. It handles patient registration, cryopreservation storage hierarchy tracking, AI-assisted medical report OCR extraction, transactional report emailing, and audit logging.

---

## 🌟 Key Features

### 🧊 1. Cryo Storage Hierarchy & Inventory
- **Multi-Level Storage Model**: Real-time physical location mapping across **Tanks / Canisters / Levels / Viso Tubes / Straws**.
- **Visual Location Guide**: Auto-generates exact physical retrieval pathways (e.g., `Can 04 • Canister 06 • Level 1 (Bottom) • Viso Tube - Grey`).
- **Straw Color Cascading & Grading**: Clinic-standard color coding (`Pink`, `Green`, `Blue`, `Yellow`, `White`) with straw #1 auto-cascading and embryo grade tracking (`5AA`, `4AB`, etc.).

### 🤖 2. Medical Document AI OCR Extraction
- **Google Vision & Gemini AI Pipeline**: Extracts clinical notes and lab reports using Vision REST API fallback and Gemini candidate models (`gemini-3.6-flash`, `gemini-3.1-pro-preview`, `gemini-3.5-flash-lite`).
- **Deep Pattern Extractor**: Dynamic regex pattern parser that maps patient demographic and embryo details without static mock data.

### 📄 3. Report Generation & Email Dispatch
- **Automated PDF Reports**: Generates formal clinical PDF reports for Day 0 Oocyte, Day 3 Cleavage, and Day 5/6 Blastocyst stages.
- **Gmail OAuth2 & SMTP Dispatch**: Secure report delivery directly to patients and partners with anti-spam queue management and full audit log tracking.

### 🛡️ 4. Enterprise Security Hardening
- **Layer 1 Site Access Key Guard**: Cryptographic SHA-256 access key verification.
- **Layer 2 Staff Authentication**: Role-Based Access Control (Admin vs. Staff) via JWT access/refresh tokens.
- **Localhost Bound Backend**: API service listens strictly on `127.0.0.1:4000` behind Nginx reverse proxy.
- **Security Headers & Rate Limiting**: Helmet anti-XSS/Clickjacking headers and IP-based rate limiting on sensitive routes.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite, Lucide Icons, Vanilla CSS / Tailwind Utilities |
| **Backend** | Node.js (v20 LTS), Express, TypeScript, Prisma ORM, Sharp, PDFKit |
| **Database** | PostgreSQL 16 (Localhost bound, SSL enforced) |
| **Hosting & CI/CD** | Hostinger KVM VPS (Ubuntu 24.04), PM2, Nginx, Certbot SSL, GitHub Actions |

---

## 📂 Repository Structure

```
├── .github/
│   └── workflows/
│       ├── deploy.yml          # GitHub Actions SSH auto-deployment pipeline
│       └── cron-ping.yml       # 5-Minute automated health check cron
├── apps/
│   ├── backend/                # Node.js + Express + Prisma API service
│   │   ├── prisma/             # Schema definitions and database migrations
│   │   └── src/                # Controllers, services, and modules
│   └── frontend/               # React + Vite web application interface
├── scripts/
│   ├── backend-health-check.sh # Post-deployment backend verification script
│   └── frontend-health-check.sh# Post-deployment frontend verification script
├── .env.example                # Template environment configuration
├── invoice.html                # Official project invoice & scope agreement
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v20.x LTS or higher
- **npm**: v10.x or higher
- **PostgreSQL**: v16.x

### 1. Installation
Clone the repository and install workspace dependencies:
```bash
git clone https://github.com/Aditya07024/IVF-Storage-Clinic-Record-System.git
cd IVF-Storage-Clinic-Record-System
npm install
```

### 2. Environment Configuration
Copy the `.env.example` template to `.env` in the root directory:
```bash
cp .env.example .env
```

Update your `.env` with your database connection string and secret keys:
```env
PORT=4000
NODE_ENV=development
DATABASE_URL="postgresql://user:password@localhost:5432/ivf_production?schema=public"
APP_ACCESS_KEY_HASH="<sha256_hash>"
JWT_ACCESS_SECRET="<your_jwt_secret>"
JWT_REFRESH_SECRET="<your_refresh_secret>"
GEMINI_API_KEY="<your_gemini_api_key>"
GOOGLE_VISION_API_KEY="<your_vision_api_key>"
```

### 3. Database Initialization
Run Prisma schema sync:
```bash
npm run build:backend
```

### 4. Running Development Servers
Start both backend and frontend development servers concurrently:
```bash
npm run dev
```
- **Frontend App**: `http://localhost:3000`
- **Backend API**: `http://localhost:4000`

---

## 🏥 Post-Deployment Health Checks

The repository includes executable shell scripts to verify production deployments:

### Backend Health Check
```bash
./scripts/backend-health-check.sh https://api.sgrhivfcryo.in/api/health
```

### Frontend Health Check
```bash
./scripts/frontend-health-check.sh https://www.sgrhivfcryo.in
```

---

## 🔄 CI/CD & Deployment

Deployments are fully automated via **GitHub Actions**:
- **Automatic Trigger**: Any push to the `main` branch triggers `.github/workflows/deploy.yml`.
- **Server Execution**: SSHs into the production VPS (`/var/www/ivf`), pulls latest code, runs `npm ci`, builds project artifacts, and restarts `ivf-backend` under PM2.
- **Keep-Alive Cron**: `.github/workflows/cron-ping.yml` executes every 5 minutes to verify API responsiveness.

---

## 🔒 Security Guidelines

- **Zero Secret Exposure**: Never commit `.env` files, API keys, or private SSH keys.
- **Strict Database Binding**: PostgreSQL port `5432` and backend port `4000` are bound to `127.0.0.1` and protected by UFW default-deny firewall policies.
- **Audit Trails**: All patient record modifications, OCR verifications, report emails, and password changes are stored in immutable audit logs.
