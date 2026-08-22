# Database Schema & Entity Relationships

## Primary Entities
- `User`: Staff accounts with roles (`ADMIN`, `STAFF`, `VIEWER`) and Argon2id password hashes.
- `Patient`: Patient records identified by system-generated unique `patientId` (`IVF-2026-000001`). Fields include `fullName`, `partnerName`, `visitDate`, `deDate`, `freezingDate`, `thawDate`, `comments`.
- `PatientNote`: Multiline staff notes associated with patient records, preserving author ID, author name, and timestamp.
- `Can`: Physical storage chamber (`CAN-01` .. `CAN-09`).
- `Canister`: Physical canister inside Can (1 .. 10).
- `Level`: Level 1 (Bottom) and Level 2 (Top) per canister.
- `Goblet`: Goblet holding Viso Tubes.
- `VisoTube`: Viso Tube identified by unique location code (`CAN01-CANISTER05-L2-G01-V07`).
- `StorageBatch`: Represents embryos stored for a patient during a specific storage event/date.
- `Straw`: Storage straw identified by system-generated unique `strawId` (`STR-000001`). Color is physical visual metadata. Enforces max 2 embryos. Statuses: `OCCUPIED`, `VACANT`, `THAWED`.
- `Embryo`: Individual embryo entity (1 or 2 per straw).
- `ThawRecord`: Immutable record created upon thawing/withdrawal.
- `StorageMovement`: Immutable history created when straws are moved between physical locations.
- `OcrRecord`: Metadata and OCR/Gemini output for scanned paper records.
- `AuditLog`: Append-only audit table.
