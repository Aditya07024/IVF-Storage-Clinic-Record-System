# Security Architecture & Controls

## Two-Layer Protection
1. **Layer 1 Gate**: Access key verification (`VITE_APP_ACCESS_KEY` & `APP_ACCESS_KEY_HASH`).
   - Default plain text key: `VITE_APP_ACCESS_KEY=ivf@sgrm`.
   - SHA-256 hash comparison is performed dynamically against `APP_ACCESS_KEY_HASH` before presenting the login portal.
   - **How to Change the Access Key**:
     1. Set `VITE_APP_ACCESS_KEY=YourNewSecretKey` in `.env`.
     2. Calculate the SHA-256 hash:
        ```bash
        node -e "console.log(require('crypto').createHash('sha256').update('YourNewSecretKey').digest('hex'))"
        ```
     3. Set `APP_ACCESS_KEY_HASH=<generated_sha256_hash>` in `.env`.
2. **Layer 2 Staff Authentication**: Staff ID/Email + Password authenticated using **Argon2id** password hashing.
3. **JWT Access & Refresh Token Rotation**:
   - Short-lived Access Tokens (15 min lifespan).
   - Refresh Tokens (7 day lifespan) stored in `HTTP-Only`, `SameSite=Strict`, `Secure` cookies.
   - Tokens contain minimal identity claims (`userId`, `staffId`, `role`). No sensitive patient data inside JWT payloads.
   - Brute-force rate limiting: 10 failed login attempts locks IP for 15 minutes with real-time live clock countdown.

## Storage & Concurrency Security
- **PostgreSQL Row-Level Transaction Locking**: Storage slot allocations use database transactions to prevent race conditions when two staff members attempt to assign the same straw concurrently.
- **Private Object Storage**: Patient document images are stored privately without public bucket URLs. Served strictly via backend authorization guards.
- **Append-Only Audit Logs**: Immutable audit log entries for every login, patient edit, storage assignment, thaw operation, and document access.
