# Google Cloud Vision OCR Integration Guide

## Overview
This document outlines the secure backend integration of **Google Cloud Vision OCR** into the IVF Storage Clinic Record Management System backend.

The OCR system accepts scanned clinic patient records and handwritten documents, sends them to Google Cloud Vision API for raw text extraction, structures extracted text using Gemini AI, and requires human staff verification before committing records to PostgreSQL.

---

## Security Architecture & Data Flow

```
React SPA Frontend (Web)
       │ (Authenticated POST /api/ocr/extract or /api/ocr/upload)
       ▼
NestJS / Express Backend API (Strict Auth: accessKeyGuard + jwtAuthGuard)
       │ (Google Cloud Vision Node.js SDK)
       ▼
Google Cloud Vision API (Server-to-Server authenticated via Service Account)
```

### Security Safeguards
- **Backend-Only Credentials**: Service account credentials reside exclusively in `apps/backend/credentials/google-vision-service-account.json`.
- **Git Protection**: `.gitignore` strictly ignores `credentials/`, `*.json` credential files, and `.env`.
- **Zero Frontend Exposure**: No API keys, credentials, or Google Cloud tokens are ever sent to the React frontend or printed in public API responses.
- **Protected Endpoint**: `POST /api/ocr/extract` and `POST /api/ocr/upload` require valid Layer 1 site access keys and JWT staff authentication.
- **Safe Error Handling**: All Google Vision API errors are sanitized into friendly user messages (e.g. `"Unable to process the image. Please try again."`) without leaking private keys or system paths.

---

## Environment Variables

Configure the following variables in `apps/backend/.env` (and see `.env.example` for reference):

```env
# OCR Provider Selection ('google' or 'mock')
OCR_PROVIDER=google

# Google Cloud Project ID
GOOGLE_CLOUD_PROJECT_ID=ivf-storage-management-system

# Path to backend service account JSON credential file
GOOGLE_APPLICATION_CREDENTIALS=/Users/aditya/Downloads/ivf/apps/backend/credentials/google-vision-service-account.json

# Gemini AI Key for structured text JSON extraction
GEMINI_API_KEY=your_gemini_api_key_here
```

---

## Credential File Location

The service account key is stored at:
```
apps/backend/credentials/google-vision-service-account.json
```

To switch credentials for production:
1. Place the new production Google Cloud service account JSON in `apps/backend/credentials/`.
2. Update `GOOGLE_APPLICATION_CREDENTIALS` in `.env` to point to the new JSON file.
3. Restart the backend service.

---

## API Endpoints

### 1. Raw Text Extraction
**`POST /api/ocr/extract`**
- **Authentication**: Required (`accessKeyGuard`, `jwtAuthGuard`).
- **Body**: `multipart/form-data` with `image` file field.
- **Allowed MIME Types**: `image/jpeg`, `image/png`, `image/webp`, `image/tiff`, `application/pdf`.
- **Max File Size**: 10 MB.
- **Response**:
```json
{
  "success": true,
  "text": "Extracted OCR raw text content...",
  "provider": "google-vision",
  "status": "success"
}
```

### 2. Full OCR Upload & Candidate Structuring
**`POST /api/ocr/upload`**
- **Authentication**: Required.
- **Body**: `multipart/form-data` with `image` file field and optional `patientId`.
- **Response**:
```json
{
  "success": true,
  "ocrRecordId": "clx...",
  "storageKey": "1724411500-scan.jpg",
  "fileSize": 14663,
  "rawOcrText": "...",
  "structuredFields": {
    "fullName": "Sunita Verma",
    "partnerName": "Deepak Verma",
    "visitDate": "2026-08-23",
    "freezingDate": "2026-08-23"
  },
  "provider": "google-vision",
  "status": "PENDING"
}
```

---

## Image Optimization & Storage (`ImageProcessingService`)
To support the clinic's long-term retention of ~8,000 scanned records without bloating storage:
- Scanned documents with width > 2,000px are automatically resized.
- Images exceeding 2 MB are compressed to quality 85 to preserve handwriting readability.
- Images already <= 2 MB are retained in their original state.

---

## Switching OCR Providers for Local/Offline Testing

To test offline without calling Google Cloud Vision API, update `.env`:
```env
OCR_PROVIDER=mock
```
When set to `mock`, the backend uses the mock extraction engine without connecting to external services.

---

## Running Tests Locally

Run the automated Vitest integration suite:
```bash
cd apps/backend
npm test test/ocr.spec.ts
```
