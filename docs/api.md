# API Specification

## Authentication & Security
- `POST /api/auth/access-key`: Verify Layer 1 Site Access Key against `APP_ACCESS_KEY_HASH`.
- `POST /api/auth/login`: Authenticate staff credentials via Argon2id; returns JWT cookies.
- `POST /api/auth/logout`: Revokes access & refresh token cookies.
- `GET /api/auth/me`: Returns active logged-in staff identity.

## Patient Operations
- `GET /api/patients?q=&page=&limit=`: Search indexed patient records with debounced pagination.
- `GET /api/patients/:id`: Retrieve full patient details, batches, straws, notes, and thaw history.
- `POST /api/patients`: Create new patient record with auto-generated `IVF-YYYY-XXXXXX` ID.
- `PUT /api/patients/:id`: Update patient record.
- `POST /api/patients/:id/notes`: Add multiline staff note with author and timestamp.

## Physical Storage Operations
- `GET /api/storage/hierarchy`: Retrieve storage hierarchy tree and occupancy metrics.
- `POST /api/storage/find-empty`: Find empty storage recommendations based on embryo count and same-date grouping logic.
- `POST /api/storage/assign`: Assign embryos to physical straws with row-level transaction locking.
- `POST /api/storage/move`: Move straw to new location and record movement history.

## Thaw & Withdrawal
- `POST /api/thaw`: Execute doctor-directed thaw/withdrawal operation on selected straws.
- `GET /api/thaw/history/:patientId`: Retrieve historical thaw records for a patient.

## OCR & Document Management
- `POST /api/ocr/upload`: Upload scanned image, compress ($\le 2\text{ MB}$), run OCR and Gemini structuring.
- `GET /api/ocr/pending`: Retrieve pending OCR records awaiting human verification.
- `POST /api/ocr/verify`: Human staff verification and patient database approval.
- `GET /api/documents/patient/:id/pdf`: Stream generated patient PDF summary document.

## System Metrics & Audit
- `GET /api/dashboard`: Operational clinic storage capacity & utilization statistics.
- `GET /api/audit/logs`: Filterable append-only audit trail logs.
