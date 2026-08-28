# IVF Embryo Storage & Patient Record Management System - Implementation Report

## 1. What Was Built
- **Access Control & Security Gate (Layer 1)**: Application Access Screen verifying `APP_ACCESS_KEY_HASH` before presenting login.
- **Staff Authentication (Layer 2)**: Staff login via Argon2id password hashing, HTTP-Only SameSite JWT access/refresh token rotation, rate-limiting, and RBAC roles (`ADMIN`, `STAFF`, `VIEWER`).
- **Patient Record Management**: Patient registration with auto-generated unique Patient ID (`IVF-2026-000001`), patient fields (Name, Partner Name, Visit Date, DE Date, Freezing Date, Thaw Date), and multiline staff notes with author and timestamp tracking.
- **Indexed Patient Search & Directory**: Debounced search by Patient ID, Name, Partner Name with paginated directory table and detail drawer.
- **Physical Storage Hierarchy Engine**: Complete representation of 9 Cans $\times$ 10 Canisters $\times$ 2 Levels $\times$ 1 Goblet $\times$ 11 Viso Tubes (1,980 total Viso Tubes with location codes e.g. `CAN01-CANISTER05-L2-G01-V07`).
- **Storage Rules & Allocator**:
  - Maximum 2 embryos per straw server-side enforcement.
  - Non-unique straw color visual metadata (Pink, Blue, White, Yellow, Green) coupled with unique system Straw ID (`STR-000001`).
  - Same-Date embryo grouping into same Viso Tube.
  - Different-Date storage batch isolation.
  - Find Empty Storage recommendation algorithm.
  - Concurrency locking using PostgreSQL transactions.
- **Doctor Embryo Thaw / Warm / Withdrawal Workflow**: Non-sequential straw selection, physical status transition to `VACANT` (freeing capacity for reuse), with 100% immutable historical thaw audit log retention.
- **Storage Movement**: Moving straws between physical locations with history logging.
- **OCR & Gemini AI Verification Pipeline**: Image upload validation, compression ($\le 2\text{ MB}$), Google Vision OCR extraction interface, Gemini AI JSON structurer, and side-by-side Human Verification UI.
- **Document Printing**: PDF summary document generation & browser print stream.
- **Immutable System Audit Logs**: Filterable append-only audit trail logging user, action, entity, metadata, timestamp, and IP address.
- **Operational Dashboard & Visual Container Explorer**: Storage capacity metrics (Total Cans, Viso Tubes, Occupied/Available straws, Utilization %), per-Can occupancy breakdown, pending OCR notice, and interactive visual hierarchy explorer.

## 2. What Was NOT Built
- Third-party lab instrument hardware telemetry integration (out of scope for web application).
- Public patient-facing web portal (explicitly excluded by specification; internal clinic staff application only).

## 3. Database Schema
- `User`: `id`, `staffId`, `email`, `passwordHash`, `name`, `role`, `createdAt`, `updatedAt`.
- `Patient`: `id`, `patientId`, `fullName`, `partnerName`, `visitDate`, `deDate`, `freezingDate`, `thawDate`, `comments`.
- `PatientNote`: `id`, `patientId`, `authorId`, `authorName`, `noteText`, `createdAt`.
- `Can`, `Canister`, `Level`, `Goblet`, `VisoTube`: Physical storage structure tables.
- `StorageBatch`: `id`, `batchId`, `patientId`, `storageDate`, `totalEmbryos`, `visoTubeId`, `notes`.
- `Straw`: `id`, `strawId`, `batchId`, `visoTubeId`, `color`, `maxCapacity` (2), `status`.
- `Embryo`: `id`, `strawId`, `embryoNumber` (1 or 2), `grade`, `status`.
- `ThawRecord`: `id`, `strawId`, `patientId`, `batchId`, `originalLocationCode`, `thawDate`, `doctorId`, `doctorName`, `doctorNotes`.
- `StorageMovement`: `id`, `strawId`, `patientId`, `oldLocationCode`, `newLocationCode`, `movedAt`, `staffId`, `reason`.
- `OcrRecord`: `id`, `patientId`, `originalFilename`, `storageKey`, `mimeType`, `fileSize`, `rawOcrText`, `extractedJson`, `status`, `verifiedBy`, `verifiedAt`.
- `AuditLog`: `id`, `userId`, `userName`, `action`, `entityName`, `entityId`, `oldData`, `newData`, `ipAddress`, `createdAt`.

## 4. API Endpoints
- `POST /api/auth/access-key`: Layer 1 access key check.
- `POST /api/auth/login`: Layer 2 staff login.
- `POST /api/auth/logout`: Sign out.
- `GET /api/auth/me`: Get active user profile.
- `GET /api/patients`: Search patient directory.
- `GET /api/patients/:id`: Get patient details.
- `POST /api/patients`: Create patient record.
- `PUT /api/patients/:id`: Update patient record.
- `POST /api/patients/:id/notes`: Add staff note.
- `GET /api/storage/hierarchy`: Get storage hierarchy & capacity metrics.
- `POST /api/storage/find-empty`: Find empty storage recommendation.
- `POST /api/storage/assign`: Assign embryos to straws with row locking.
- `POST /api/storage/move`: Move straw to new location.
- `POST /api/thaw`: Execute doctor thaw/withdrawal.
- `GET /api/thaw/history/:patientId`: Get thaw history.
- `POST /api/ocr/upload`: Upload image for OCR & Gemini processing.
- `GET /api/ocr/pending`: Get pending OCR records.
- `POST /api/ocr/verify`: Human staff verification & DB save.
- `GET /api/documents/patient/:id/pdf`: Stream patient summary PDF.
- `GET /api/dashboard`: Get dashboard statistics.
- `GET /api/audit/logs`: Query audit trail logs.

## 5. Authentication
- Layer 1: Access Key checked against `APP_ACCESS_KEY_HASH` (SHA-256).
- Layer 2: Password hashed using **Argon2id**. JWT Access Token (15m) + Refresh Token (7d) delivered via HTTP-Only, SameSite secure cookies. Brute-force rate-limiting protects login attempts.

## 6. Authorization
- Designed with Role-Based Access Control (RBAC): `ADMIN`, `STAFF`, `VIEWER`. Backend guards inspect user role on protected API routes.

## 7. OCR
- Uploaded paper records are compressed ($\le 2\text{ MB}$) $\rightarrow$ processed via Google Vision OCR interface $\rightarrow$ structured into candidate JSON by Gemini AI $\rightarrow$ presented on side-by-side Human Verification UI $\rightarrow$ explicit staff approval writes data to patient record.

## 8. Image Storage
- Storage abstraction supports local disk storage (`./uploads`) on Hostinger KVM and Cloudflare R2 / S3. Images are resized/compressed if > 2MB without destroying text readability. Private bucket access enforced via backend authentication.

## 9. Storage Hierarchy
- **Hierarchy**: Can (9) $\rightarrow$ Canister (10) $\rightarrow$ Level (L1/L2) $\rightarrow$ Goblet (1) $\rightarrow$ Viso Tube (11) $\rightarrow$ Straw $\rightarrow$ Embryo (Max 2).
- Unique location codes: e.g. `CAN01-CANISTER05-L2-G01-V07`.

## 10. Storage Business Rules
- Max 2 embryos per straw backend constraint.
- Straw colors are visual metadata; straw IDs (`STR-XXXXXX`) are unique.
- Same-date embryos grouped into same Viso Tube.
- Different-date embryos stored in separate batches.
- Thawing sets physical status to `VACANT` (freeing space), while preserving immutable historical records.
- Row-level locking protects against concurrent double-booking.

## 11. Security Implementation
- Layer 1 Site Access Key Hash verification.
- Argon2id password hashing.
- HTTP-Only SameSite secure JWT cookies.
- Brute-force login rate limiting.
- PostgreSQL row-level transaction locks.
- Immutable append-only audit trail.
- Input validation via Zod schemas.

## 12. Environment Variables Required
- `PORT`
- `NODE_ENV`
- `FRONTEND_URL`
- `BACKEND_URL`
- `DATABASE_URL`
- `APP_ACCESS_KEY_HASH`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_ACCESS_EXPIRATION`
- `JWT_REFRESH_EXPIRATION`
- `GOOGLE_CLOUD_PROJECT_ID`
- `GOOGLE_APPLICATION_CREDENTIALS`
- `GEMINI_API_KEY`
- `STORAGE_PROVIDER`
- `STORAGE_LOCAL_DIR`
- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `REDIS_HOST`
- `REDIS_PORT`

## 13. Deployment
- **Frontend**: Vercel / Netlify / Static Hosting
- **Backend / Database**: Render / Direct Node.js on Hostinger KVM with Hostinger VPS PostgreSQL
- **Proxy**: Nginx + Cloudflare HTTPS SSL

## 14. Testing Performed
- Unit & Integration Test suite (`apps/backend/test/business-rules.test.ts`) covering:
  1. Layer 1 Site Access Key Hash check.
  2. Max 2 embryos per straw enforcement.
  3. Same-date embryo grouping logic.
  4. Non-unique straw color handling.
  5. Non-sequential thaw freeing physical space while retaining history.

## 15. Known Bugs
- None identified in core business logic.

## 16. Potential Risks
- Server disk space depletion if 8,000+ uncompressed images are uploaded locally without offloading to Cloudflare R2 (Mitigation: Image compression engine caps images $\le 2\text{ MB}$ and storage abstraction allows seamless switch to R2).

## 17. Assumptions
- "DE Date" interpreted as Donor Egg / Diagnostic Evaluation Date.
- Physical storage layout seeded with 9 Cans $\times$ 10 Canisters $\times$ 2 Levels $\times$ 1 Goblet $\times$ 11 Viso Tubes.

## 18. Recommended Next Steps
- Connect production Google Cloud Vision service account key and Gemini API key in production `.env`.
- Deploy Node backend service to Render or Hostinger KVM and configure Cloudflare DNS.
