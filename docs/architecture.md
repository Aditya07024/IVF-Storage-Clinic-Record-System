# IVF System Architecture

## Overview
The **IVF Embryo Storage & Patient Record Management System** is built as a secure, high-integrity modular monolith.

## Technology Stack
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, TanStack Query, React Hook Form, Zod.
- **Backend**: Node.js, NestJS / Express, TypeScript, REST API.
- **Database**: PostgreSQL with Prisma ORM.
- **Queue / Caching**: Redis & BullMQ.
- **OCR & AI**: Google Cloud Vision OCR interface + Google Gemini AI structurer.
- **Object Storage**: Storage abstraction supporting local server disk (Hostinger KVM) and Cloudflare R2 / S3.

## System Boundaries & Modules
1. **Access Gate Layer 1**: Site Access Key Hash verification prior to presenting login.
2. **Auth Module Layer 2**: Staff login via Argon2id password hashing and HTTP-Only JWT access/refresh token cookies.
3. **Patient Module**: Patient CRUD, `IVF-YYYY-XXXXXX` ID generation, multiline notes with author/timestamp history.
4. **Storage Hierarchy Module**: 9 Cans x 10 Canisters x 2 Levels x 1 Goblet x 11 Viso Tubes hierarchy.
5. **Thaw & Withdrawal Module**: Doctor-directed non-sequential straw thawing with status transition to `VACANT` and 100% audit retention.
6. **OCR & Gemini Module**: Image validation, compression ($\le 2\text{ MB}$), OCR extraction, Gemini JSON structuring, and mandatory human staff verification.
7. **Document Module**: PDF generation for patient storage certificates & printing.
8. **Audit Log Module**: Immutable append-only audit trail logging all staff actions.
