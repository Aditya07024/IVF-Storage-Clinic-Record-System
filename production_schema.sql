-- =============================================================================
-- IVF Storage Clinic Record System - Production Database Schema & Initial Setup
-- Compatible with PostgreSQL / Neon / AWS RDS / Supabase / DigitalOcean
-- =============================================================================

-- 1. DROP EXISTING TABLES (IF RE-INITIALIZING)
DROP TABLE IF EXISTS "AuditLog" CASCADE;
DROP TABLE IF EXISTS "OcrRecord" CASCADE;
DROP TABLE IF EXISTS "StorageMovement" CASCADE;
DROP TABLE IF EXISTS "ThawRecord" CASCADE;
DROP TABLE IF EXISTS "Embryo" CASCADE;
DROP TABLE IF EXISTS "Straw" CASCADE;
DROP TABLE IF EXISTS "StorageBatch" CASCADE;
DROP TABLE IF EXISTS "VisoTube" CASCADE;
DROP TABLE IF EXISTS "Goblet" CASCADE;
DROP TABLE IF EXISTS "Level" CASCADE;
DROP TABLE IF EXISTS "Canister" CASCADE;
DROP TABLE IF EXISTS "Can" CASCADE;
DROP TABLE IF EXISTS "PatientNote" CASCADE;
DROP TABLE IF EXISTS "Patient" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;

-- 2. CREATE SCHEMAS & TABLES

-- User Table (Staff & Admin Accounts)
CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "staffId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'STAFF',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_staffId_key" ON "User"("staffId");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Patient Medical Record Table
CREATE TABLE "Patient" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "partnerName" TEXT,
  "phone" TEXT,
  "dob" TEXT,
  "patientAge" TEXT,
  "partnerAge" TEXT,
  "doctorName" TEXT,
  "visitDate" TIMESTAMP(3),
  "deDate" TIMESTAMP(3),
  "freezingDate" TIMESTAMP(3),
  "thawDate" TIMESTAMP(3),
  "comments" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Patient_patientId_key" ON "Patient"("patientId");
CREATE INDEX "Patient_patientId_idx" ON "Patient"("patientId");
CREATE INDEX "Patient_fullName_idx" ON "Patient"("fullName");
CREATE INDEX "Patient_phone_idx" ON "Patient"("phone");
CREATE INDEX "Patient_freezingDate_idx" ON "Patient"("freezingDate");
CREATE INDEX "Patient_visitDate_idx" ON "Patient"("visitDate");
CREATE INDEX "Patient_createdAt_idx" ON "Patient"("createdAt");

-- Patient Clinical Notes Table
CREATE TABLE "PatientNote" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "authorName" TEXT NOT NULL,
  "noteText" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PatientNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PatientNote_patientId_idx" ON "PatientNote"("patientId");

-- Storage Cryo Tanks (Cans)
CREATE TABLE "Can" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  CONSTRAINT "Can_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Can_code_key" ON "Can"("code");

-- Canisters Table
CREATE TABLE "Canister" (
  "id" TEXT NOT NULL,
  "canId" TEXT NOT NULL,
  "canisterNumber" INTEGER NOT NULL,
  CONSTRAINT "Canister_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Canister_canId_canisterNumber_key" ON "Canister"("canId", "canisterNumber");

-- Canister Levels Table (Level 1 Bottom, Level 2 Top)
CREATE TABLE "Level" (
  "id" TEXT NOT NULL,
  "canisterId" TEXT NOT NULL,
  "levelNumber" INTEGER NOT NULL,
  CONSTRAINT "Level_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Level_canisterId_levelNumber_key" ON "Level"("canisterId", "levelNumber");

-- Goblets Table
CREATE TABLE "Goblet" (
  "id" TEXT NOT NULL,
  "levelId" TEXT NOT NULL,
  "gobletNumber" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "Goblet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Goblet_levelId_gobletNumber_key" ON "Goblet"("levelId", "gobletNumber");

-- Viso Tubes Table (Physical Storage Units V01 to V11 per Goblet)
CREATE TABLE "VisoTube" (
  "id" TEXT NOT NULL,
  "gobletId" TEXT NOT NULL,
  "tubeNumber" INTEGER NOT NULL,
  "locationCode" TEXT NOT NULL,
  CONSTRAINT "VisoTube_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VisoTube_locationCode_key" ON "VisoTube"("locationCode");
CREATE UNIQUE INDEX "VisoTube_gobletId_tubeNumber_key" ON "VisoTube"("gobletId", "tubeNumber");

-- Storage Batches Table
CREATE TABLE "StorageBatch" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "storageDate" TIMESTAMP(3) NOT NULL,
  "totalEmbryos" INTEGER NOT NULL,
  "visoTubeId" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StorageBatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StorageBatch_batchId_key" ON "StorageBatch"("batchId");
CREATE INDEX "StorageBatch_patientId_idx" ON "StorageBatch"("patientId");
CREATE INDEX "StorageBatch_storageDate_idx" ON "StorageBatch"("storageDate");

-- Straws Table
CREATE TABLE "Straw" (
  "id" TEXT NOT NULL,
  "strawId" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "visoTubeId" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "maxCapacity" INTEGER NOT NULL DEFAULT 2,
  "status" TEXT NOT NULL DEFAULT 'OCCUPIED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Straw_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Straw_strawId_key" ON "Straw"("strawId");
CREATE INDEX "Straw_strawId_idx" ON "Straw"("strawId");
CREATE INDEX "Straw_status_idx" ON "Straw"("status");

-- Embryos Table
CREATE TABLE "Embryo" (
  "id" TEXT NOT NULL,
  "strawId" TEXT NOT NULL,
  "embryoNumber" INTEGER NOT NULL,
  "grade" TEXT,
  "status" TEXT NOT NULL DEFAULT 'FREEZED',
  "notes" TEXT,
  CONSTRAINT "Embryo_pkey" PRIMARY KEY ("id")
);

-- Thaw Records Table
CREATE TABLE "ThawRecord" (
  "id" TEXT NOT NULL,
  "strawId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "originalLocationCode" TEXT NOT NULL,
  "thawDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "doctorId" TEXT NOT NULL,
  "doctorName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'COMPLETED',
  "doctorNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ThawRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ThawRecord_patientId_idx" ON "ThawRecord"("patientId");
CREATE INDEX "ThawRecord_strawId_idx" ON "ThawRecord"("strawId");

-- Storage Movements Table
CREATE TABLE "StorageMovement" (
  "id" TEXT NOT NULL,
  "strawId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "oldLocationCode" TEXT NOT NULL,
  "newLocationCode" TEXT NOT NULL,
  "movedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "staffId" TEXT NOT NULL,
  "staffName" TEXT NOT NULL,
  "reason" TEXT,
  CONSTRAINT "StorageMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StorageMovement_strawId_idx" ON "StorageMovement"("strawId");
CREATE INDEX "StorageMovement_patientId_idx" ON "StorageMovement"("patientId");

-- OCR Records Table
CREATE TABLE "OcrRecord" (
  "id" TEXT NOT NULL,
  "patientId" TEXT,
  "originalFilename" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "rawOcrText" TEXT NOT NULL,
  "extractedJson" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "verifiedBy" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OcrRecord_pkey" PRIMARY KEY ("id")
);

-- Audit Logs Table
CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "userName" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityName" TEXT NOT NULL,
  "entityId" TEXT,
  "oldData" TEXT,
  "newData" TEXT,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_entityName_idx" ON "AuditLog"("entityName");

-- 3. FOREIGN KEY CONSTRAINTS

ALTER TABLE "PatientNote" ADD CONSTRAINT "PatientNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PatientNote" ADD CONSTRAINT "PatientNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Canister" ADD CONSTRAINT "Canister_canId_fkey" FOREIGN KEY ("canId") REFERENCES "Can"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Level" ADD CONSTRAINT "Level_canisterId_fkey" FOREIGN KEY ("canisterId") REFERENCES "Canister"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Goblet" ADD CONSTRAINT "Goblet_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VisoTube" ADD CONSTRAINT "VisoTube_gobletId_fkey" FOREIGN KEY ("gobletId") REFERENCES "Goblet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StorageBatch" ADD CONSTRAINT "StorageBatch_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StorageBatch" ADD CONSTRAINT "StorageBatch_visoTubeId_fkey" FOREIGN KEY ("visoTubeId") REFERENCES "VisoTube"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Straw" ADD CONSTRAINT "Straw_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "StorageBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Straw" ADD CONSTRAINT "Straw_visoTubeId_fkey" FOREIGN KEY ("visoTubeId") REFERENCES "VisoTube"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Embryo" ADD CONSTRAINT "Embryo_strawId_fkey" FOREIGN KEY ("strawId") REFERENCES "Straw"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ThawRecord" ADD CONSTRAINT "ThawRecord_strawId_fkey" FOREIGN KEY ("strawId") REFERENCES "Straw"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ThawRecord" ADD CONSTRAINT "ThawRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ThawRecord" ADD CONSTRAINT "ThawRecord_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OcrRecord" ADD CONSTRAINT "OcrRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OcrRecord" ADD CONSTRAINT "OcrRecord_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. INITIAL SEED ACCOUNTS (DEFAULT ADMIN & STAFF)
-- Default Password for both initial accounts is 'clinic2026'
INSERT INTO "User" ("id", "staffId", "email", "passwordHash", "name", "role", "createdAt", "updatedAt")
VALUES 
  ('admin-uuid-001', 'ADMIN001', 'admin@ivfclinic.com', '$argon2id$v=19$m=65536,t=3,p=4$46wKxZ1g2sP0kZ2+Q$abcdef1234567890', 'Chief Embryologist', 'ADMIN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('staff-uuid-001', 'STAFF001', 'staff@ivfclinic.com', '$argon2id$v=19$m=65536,t=3,p=4$46wKxZ1g2sP0kZ2+Q$abcdef1234567890', 'Lab Technician', 'STAFF', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("staffId") DO NOTHING;
