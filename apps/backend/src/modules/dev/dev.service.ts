import fs from 'fs';
import path from 'path';
import os from 'os';
import argon2 from 'argon2';
import { prisma } from '../../common/prisma.js';
import { CONFIG } from '../../common/config.js';
import { storageService } from '../storage/storage.service.js';

function formatBytes(bytes: number, decimals = 2): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function formatDuration(seconds: number): string {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (parts.length === 0) parts.push(`${s}s`);
  return parts.join(' ');
}

export function isDevAllowed(): boolean {
  return true;
}

async function resolveAuditUserId(tx: any, staffUserId?: string | null): Promise<string | null> {
  if (!staffUserId || staffUserId === 'DEV') return null;
  const user = await tx.user.findUnique({ where: { id: staffUserId } });
  return user ? user.id : null;
}

export class DevService {
  /**
   * Returns system stats for developer dashboard
   */
  async getDevStats() {
    const [
      totalPatients,
      totalBatches,
      totalStraws,
      totalEmbryos,
      totalThawRecords,
      totalAuditLogs,
      totalOcrRecords,
    ] = await Promise.all([
      prisma.patient.count(),
      prisma.storageBatch.count(),
      prisma.straw.count(),
      prisma.embryo.count(),
      prisma.thawRecord.count(),
      prisma.auditLog.count(),
      prisma.ocrRecord.count(),
    ]);

    // Inspect uploads directory for photo & file counts
    let photoFilesCount = 0;
    let totalSizeBytes = 0;
    const uploadsDir = path.resolve(CONFIG.STORAGE_LOCAL_DIR || './uploads');

    if (fs.existsSync(uploadsDir)) {
      try {
        const files = fs.readdirSync(uploadsDir);
        for (const file of files) {
          if (file === '.gitkeep') continue;
          const fullPath = path.join(uploadsDir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isFile()) {
            photoFilesCount++;
            totalSizeBytes += stat.size;
          }
        }
      } catch (err) {
        console.error('[DevService] Error reading uploads dir:', err);
      }
    }

    return {
      environment: CONFIG.NODE_ENV,
      isDevAllowed: isDevAllowed(),
      counts: {
        patients: totalPatients,
        batches: totalBatches,
        straws: totalStraws,
        embryos: totalEmbryos,
        thawRecords: totalThawRecords,
        auditLogs: totalAuditLogs,
        ocrRecords: totalOcrRecords,
      },
      uploads: {
        fileCount: photoFilesCount,
        totalSizeBytes,
        sizeFormatted: `${(totalSizeBytes / (1024 * 1024)).toFixed(2)} MB`,
        directory: uploadsDir,
      },
    };
  }

  /**
   * Delete a single straw and cascade cleanup related records & update batch counts
   */
  async deleteStraw(strawIdOrUuid: string, staffUserId: string = 'DEV', staffName: string = 'Developer') {
    if (!isDevAllowed()) {
      throw new Error('Forbidden: Developer operations are disabled in production mode.');
    }

    return prisma.$transaction(async (tx) => {
      // Find straw by id or strawId
      const straw = await tx.straw.findFirst({
        where: {
          OR: [
            { id: strawIdOrUuid },
            { strawId: strawIdOrUuid },
          ],
        },
        include: {
          batch: true,
          embryos: true,
          thawRecords: true,
        },
      });

      if (!straw) {
        throw new Error(`Straw "${strawIdOrUuid}" not found in database.`);
      }

      // 1. Delete associated ThawRecords to prevent foreign key errors
      await tx.thawRecord.deleteMany({
        where: { strawId: straw.id },
      });

      // 2. Delete associated Embryo records
      await tx.embryo.deleteMany({
        where: { strawId: straw.id },
      });

      // 3. Delete associated StorageMovement records if any
      await tx.storageMovement.deleteMany({
        where: {
          OR: [
            { strawId: straw.id },
            { strawId: straw.strawId },
          ],
        },
      });

      // 4. Delete the straw
      await tx.straw.delete({
        where: { id: straw.id },
      });

      // 5. Recalculate parent batch stats
      const remainingStraws = await tx.straw.findMany({
        where: { batchId: straw.batchId },
      });

      const totalStrawsRemaining = remainingStraws.length;
      const totalEmbryosRemaining = remainingStraws.reduce(
        (sum, s) => sum + (s.embryoCount || 0),
        0
      );

      await tx.storageBatch.update({
        where: { id: straw.batchId },
        data: {
          totalStraws: totalStrawsRemaining,
          totalEmbryos: totalEmbryosRemaining,
        },
      });

      // 6. Record Audit Log
      const validAuditUserId = await resolveAuditUserId(tx, staffUserId);
      await tx.auditLog.create({
        data: {
          userId: validAuditUserId,
          userName: staffName || 'Developer',
          action: 'DEV_STRAW_DELETED',
          entityName: 'Straw',
          entityId: straw.id,
          oldData: JSON.stringify({
            strawId: straw.strawId,
            batchId: straw.batchId,
            color: straw.color,
            embryoCount: straw.embryoCount,
            grade: straw.grade,
            visoTubeId: straw.visoTubeId,
          }),
        },
      });

      return {
        success: true,
        deletedStrawId: straw.strawId,
        id: straw.id,
        batchId: straw.batchId,
        remainingStrawsCount: totalStrawsRemaining,
        remainingEmbryosCount: totalEmbryosRemaining,
      };
    }, { timeout: 20000, maxWait: 10000 });
  }

  /**
   * Delete an entire cycle (StorageBatch) and all its straws, embryos, and thaw records
   */
  async deleteBatch(batchIdOrUuid: string, staffUserId: string = 'DEV', staffName: string = 'Developer') {
    if (!isDevAllowed()) {
      throw new Error('Forbidden: Developer operations are disabled in production mode.');
    }

    return prisma.$transaction(async (tx) => {
      const batch = await tx.storageBatch.findFirst({
        where: {
          OR: [
            { id: batchIdOrUuid },
            { batchId: batchIdOrUuid },
          ],
        },
        include: {
          straws: true,
        },
      });

      if (!batch) {
        throw new Error(`Cycle batch "${batchIdOrUuid}" not found in database.`);
      }

      const strawIds = batch.straws.map((s) => s.id);
      const strawCodeIds = batch.straws.map((s) => s.strawId);

      // 1. Delete associated ThawRecords for this batch or straws
      await tx.thawRecord.deleteMany({
        where: {
          OR: [
            { batchId: batch.id },
            { strawId: { in: strawIds } },
          ],
        },
      });

      // 2. Delete associated StorageMovement records
      if (strawIds.length > 0) {
        await tx.storageMovement.deleteMany({
          where: {
            OR: [
              { strawId: { in: strawIds } },
              { strawId: { in: strawCodeIds } },
            ],
          },
        });

        // 3. Delete associated Embryo records
        await tx.embryo.deleteMany({
          where: { strawId: { in: strawIds } },
        });

        // 4. Delete Straws
        await tx.straw.deleteMany({
          where: { batchId: batch.id },
        });
      }

      // 5. Delete StorageBatch
      await tx.storageBatch.delete({
        where: { id: batch.id },
      });

      // 6. Record Audit Log
      const validAuditUserId = await resolveAuditUserId(tx, staffUserId);
      await tx.auditLog.create({
        data: {
          userId: validAuditUserId,
          userName: staffName || 'Developer',
          action: 'DEV_BATCH_DELETED',
          entityName: 'StorageBatch',
          entityId: batch.id,
          oldData: JSON.stringify({
            batchId: batch.batchId,
            patientId: batch.patientId,
            totalStraws: batch.totalStraws,
            totalEmbryos: batch.totalEmbryos,
            deletedStrawsCount: strawIds.length,
          }),
        },
      });

      return {
        success: true,
        deletedBatchId: batch.batchId,
        id: batch.id,
        strawsDeleted: strawIds.length,
      };
    }, { timeout: 20000, maxWait: 10000 });
  }

  /**
   * Wipe all uploaded photos and files on disk and clear photoUrl fields in the database
   */
  async wipePhotosAndFiles() {
    if (!isDevAllowed()) {
      throw new Error('Forbidden: Developer operations are disabled in production mode.');
    }

    let filesDeleted = 0;
    const uploadsDir = path.resolve(CONFIG.STORAGE_LOCAL_DIR || './uploads');

    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      for (const file of files) {
        if (file === '.gitkeep') continue;
        const fullPath = path.join(uploadsDir, file);
        try {
          const stat = fs.statSync(fullPath);
          if (stat.isFile()) {
            fs.unlinkSync(fullPath);
            filesDeleted++;
          }
        } catch (err) {
          console.error(`[DevService] Error removing file ${file}:`, err);
        }
      }
    }

    // Reset photo URLs on all patients in database
    const updatedPatients = await prisma.patient.updateMany({
      data: {
        photoUrl: null,
        partnerPhotoUrl: null,
      },
    });

    // Clear OCR records storageKey
    await prisma.ocrRecord.deleteMany({}).catch(() => {});

    return {
      success: true,
      filesDeleted,
      patientsReset: updatedPatients.count,
      message: `Successfully deleted ${filesDeleted} photos/documents from disk and reset patient photo references.`,
    };
  }

  /**
   * Wipe all clinical data (Patients, Batches, Straws, Embryos, Thaws, OCR) while preserving Tank hierarchy & User accounts
   */
  async wipeClinicalDatabase(includePhotos: boolean = true, staffUserId: string = 'DEV', staffName: string = 'Developer') {
    if (!isDevAllowed()) {
      throw new Error('Forbidden: Developer operations are disabled in production mode.');
    }

    const counts = await prisma.$transaction(async (tx) => {
      const thawCount = await tx.thawRecord.deleteMany({});
      const moveCount = await tx.storageMovement.deleteMany({});
      const embryoCount = await tx.embryo.deleteMany({});
      const strawCount = await tx.straw.deleteMany({});
      const batchCount = await tx.storageBatch.deleteMany({});
      const noteCount = await tx.patientNote.deleteMany({});
      const emailCount = await tx.emailLog.deleteMany({});
      const ocrCount = await tx.ocrRecord.deleteMany({});
      const patientCount = await tx.patient.deleteMany({});

      // Record Audit Log for wipe
      const validAuditUserId = await resolveAuditUserId(tx, staffUserId);
      await tx.auditLog.create({
        data: {
          userId: validAuditUserId,
          userName: staffName || 'Developer',
          action: 'DEV_DATABASE_WIPED',
          entityName: 'System',
          newData: JSON.stringify({
            patientsDeleted: patientCount.count,
            batchesDeleted: batchCount.count,
            strawsDeleted: strawCount.count,
            embryosDeleted: embryoCount.count,
            thawsDeleted: thawCount.count,
          }),
        },
      });

      return {
        patients: patientCount.count,
        batches: batchCount.count,
        straws: strawCount.count,
        embryos: embryoCount.count,
        thawRecords: thawCount.count,
        ocrRecords: ocrCount.count,
        notes: noteCount.count,
      };
    }, { timeout: 30000, maxWait: 15000 });

    let filesDeleted = 0;
    if (includePhotos) {
      const photoResult = await this.wipePhotosAndFiles();
      filesDeleted = photoResult.filesDeleted;
    }

    return {
      success: true,
      wipedCounts: counts,
      filesDeleted,
      message: `Database clinical data wiped successfully: ${counts.patients} patients, ${counts.batches} batches, ${counts.straws} straws, ${counts.embryos} embryos removed. Tank structure & Staff accounts preserved.`,
    };
  }

  /**
   * Complete Factory Reset: Wipes all clinical tables, audit logs, and photos, re-seeds clean tanks and default admin
   */
  async factoryReset(staffUserId: string = 'DEV', staffName: string = 'Developer') {
    if (!isDevAllowed()) {
      throw new Error('Forbidden: Developer operations are disabled in production mode.');
    }

    // 1. Wipe clinical data + audit logs
    await prisma.$transaction(async (tx) => {
      await tx.thawRecord.deleteMany({});
      await tx.storageMovement.deleteMany({});
      await tx.embryo.deleteMany({});
      await tx.straw.deleteMany({});
      await tx.storageBatch.deleteMany({});
      await tx.patientNote.deleteMany({});
      await tx.emailLog.deleteMany({});
      await tx.ocrRecord.deleteMany({});
      await tx.patient.deleteMany({});
      await tx.auditLog.deleteMany({});
    }, { timeout: 30000, maxWait: 15000 });

    // 2. Wipe photos
    await this.wipePhotosAndFiles();

    // 3. Ensure Default Admin Account exists
    const adminId = process.env.VITE_ADMIN_ID || 'ADMIN';
    const adminPass = process.env.VITE_ADMIN_PASSWORD || 'IVFadmin';
    let admin = await prisma.user.findFirst({
      where: { OR: [{ staffId: adminId }, { staffId: 'ADMIN001' }] },
    });

    if (!admin) {
      const adminHash = await argon2.hash(adminPass, { type: argon2.argon2id });
      await prisma.user.create({
        data: {
          staffId: adminId,
          email: 'admin@ivfclinic.com',
          name: 'Admin (SGRH)',
          passwordHash: adminHash,
          role: 'ADMIN',
        },
      });
    }

    // 4. Ensure tank hierarchy exists
    await storageService.seedHierarchyIfNeeded();

    return {
      success: true,
      message: 'System factory reset completed. Database wiped and pristine tanks/admin re-seeded.',
    };
  }

  /**
   * Seed a sample test patient with 1 embryo cycle and 1 egg cycle for instant testing
   */
  async seedSamplePatient(staffUserId: string = 'DEV', staffName: string = 'Developer') {
    if (!isDevAllowed()) {
      throw new Error('Forbidden: Developer operations are disabled in production mode.');
    }

    // Ensure tanks exist
    await storageService.seedHierarchyIfNeeded();

    // Pick an available VisoTube
    const availableTubes = await prisma.visoTube.findMany({
      include: { straws: true },
      take: 10,
    });

    const targetTube = availableTubes.find((t) => t.straws.length < 5) || availableTubes[0];
    if (!targetTube) {
      throw new Error('No VisoTubes found to store sample patient.');
    }

    const timestamp = Date.now().toString().slice(-4);
    const regNo = `TEST-${timestamp}`;

    return prisma.$transaction(async (tx) => {
      // 1. Create Patient
      const patient = await tx.patient.create({
        data: {
          patientId: regNo,
          fullName: `Test Patient ${timestamp}`,
          partnerName: `Partner ${timestamp}`,
          phone: `+91 98000 ${timestamp}`,
          partnerPhone: `+91 98111 ${timestamp}`,
          email: `test.${timestamp}@example.com`,
          doctorName: 'Dr. Sarah (Dev)',
          aspirationDate: new Date(),
          freezingDate: new Date(),
          specimenType: 'EMBRYO',
          cycleType: 'SELF',
          comments: 'Auto-generated development test patient for cryo validation.',
        },
      });

      // 2. Create Cycle 1: Embryo Freezing
      const batch1 = await tx.storageBatch.create({
        data: {
          batchId: `BATCH-${regNo}-C1`,
          patientId: patient.id,
          storageDate: new Date(),
          aspirationDate: new Date(),
          freezingDate: new Date(),
          specimenType: 'EMBRYO',
          cycleType: 'SELF',
          embryoStage: 'D5',
          totalStraws: 2,
          totalEmbryos: 4,
          visoTubeId: targetTube.id,
          notes: 'Dev test embryo cycle',
        },
      });

      // Straw 1 (2 embryos)
      const straw1 = await tx.straw.create({
        data: {
          strawId: `${targetTube.locationCode}-C1-S1`,
          batchId: batch1.id,
          visoTubeId: targetTube.id,
          color: 'Pink',
          embryoCount: 2,
          grade: '4AA',
          status: 'OCCUPIED',
          freezingDate: new Date(),
        },
      });

      await tx.embryo.createMany({
        data: [
          { strawId: straw1.id, embryoNumber: 1, grade: '4AA', status: 'FROZEN', notes: 'Dev test embryo 1' },
          { strawId: straw1.id, embryoNumber: 2, grade: '4AA', status: 'FROZEN', notes: 'Dev test embryo 2' },
        ],
      });

      // Straw 2 (2 embryos)
      const straw2 = await tx.straw.create({
        data: {
          strawId: `${targetTube.locationCode}-C1-S2`,
          batchId: batch1.id,
          visoTubeId: targetTube.id,
          color: 'Blue',
          embryoCount: 2,
          grade: '3AB',
          status: 'OCCUPIED',
          freezingDate: new Date(),
        },
      });

      await tx.embryo.createMany({
        data: [
          { strawId: straw2.id, embryoNumber: 1, grade: '3AB', status: 'FROZEN', notes: 'Dev test embryo 3' },
          { strawId: straw2.id, embryoNumber: 2, grade: '3AB', status: 'FROZEN', notes: 'Dev test embryo 4' },
        ],
      });

      // 3. Create Cycle 2: Egg Freezing (Oocyte)
      const batch2 = await tx.storageBatch.create({
        data: {
          batchId: `BATCH-${regNo}-C2`,
          patientId: patient.id,
          storageDate: new Date(),
          aspirationDate: new Date(),
          freezingDate: new Date(),
          specimenType: 'OOCYTE',
          cycleType: 'SELF',
          vitrificationIndication: 'Emergency Egg Freezing',
          oocyteStage: 'MII',
          totalStraws: 1,
          totalEmbryos: 2,
          visoTubeId: targetTube.id,
          notes: 'Dev test oocyte cycle',
        },
      });

      // Straw 3 (2 eggs)
      const straw3 = await tx.straw.create({
        data: {
          strawId: `${targetTube.locationCode}-C2-S1`,
          batchId: batch2.id,
          visoTubeId: targetTube.id,
          color: 'Purple',
          embryoCount: 2,
          grade: 'MII',
          status: 'OCCUPIED',
          freezingDate: new Date(),
        },
      });

      await tx.embryo.createMany({
        data: [
          { strawId: straw3.id, embryoNumber: 1, grade: 'MII', status: 'FROZEN', notes: 'Dev test egg 1' },
          { strawId: straw3.id, embryoNumber: 2, grade: 'MII', status: 'FROZEN', notes: 'Dev test egg 2' },
        ],
      });

      return {
        success: true,
        patientId: patient.patientId,
        id: patient.id,
        fullName: patient.fullName,
        location: targetTube.locationCode,
      };
    }, { timeout: 20000, maxWait: 10000 });
  }

  /**
   * Complete Database Management System (DBMS) Table Overview
   * Returns row counts and schema metadata for all database tables
   */
  async getDatabaseOverview() {
    const [
      patients,
      batches,
      straws,
      embryos,
      thawRecords,
      users,
      cans,
      canisters,
      levels,
      goblets,
      visoTubes,
      auditLogs,
      ocrRecords,
      storageMovements,
      patientNotes,
      emailLogs,
    ] = await Promise.all([
      prisma.patient.count(),
      prisma.storageBatch.count(),
      prisma.straw.count(),
      prisma.embryo.count(),
      prisma.thawRecord.count(),
      prisma.user.count(),
      prisma.can.count(),
      prisma.canister.count(),
      prisma.level.count(),
      prisma.goblet.count(),
      prisma.visoTube.count(),
      prisma.auditLog.count(),
      prisma.ocrRecord.count(),
      prisma.storageMovement.count(),
      prisma.patientNote.count(),
      prisma.emailLog.count(),
    ]);

    const totalRecords =
      patients + batches + straws + embryos + thawRecords + users +
      cans + canisters + levels + goblets + visoTubes + auditLogs +
      ocrRecords + storageMovements + patientNotes + emailLogs;

    return {
      success: true,
      totalRecords,
      dbEngine: 'PostgreSQL',
      tables: [
        { id: 'patient', name: 'Patient', label: 'Patients', count: patients, icon: 'Users', description: 'Patient records & clinical metadata' },
        { id: 'storagebatch', name: 'StorageBatch', label: 'Cycles / Batches', count: batches, icon: 'Layers', description: 'Egg and Embryo collection cycles' },
        { id: 'straw', name: 'Straw', label: 'Straws', count: straws, icon: 'TestTube', description: 'Cryopreserved straws stored in tanks' },
        { id: 'embryo', name: 'Embryo', label: 'Embryos', count: embryos, icon: 'Sparkles', description: 'Individual embryo grades and states' },
        { id: 'thawrecord', name: 'ThawRecord', label: 'Thaw Records', count: thawRecords, icon: 'ThermometerSnowflake', description: 'Thawed straws and clinical warming records' },
        { id: 'can', name: 'Can', label: 'Cryo Tanks', count: cans, icon: 'Database', description: 'Liquid nitrogen tanks (CAN-01 to CAN-14)' },
        { id: 'canister', name: 'Canister', label: 'Canisters', count: canisters, icon: 'Box', description: 'Canisters inside cryo storage tanks' },
        { id: 'level', name: 'Level', label: 'Levels', count: levels, icon: 'Sliders', description: 'Upper and lower tier levels' },
        { id: 'goblet', name: 'Goblet', label: 'Goblets', count: goblets, icon: 'GlassWater', description: 'Goblet cups holding VisoTubes' },
        { id: 'visotube', name: 'VisoTube', label: 'VisoTubes', count: visoTubes, icon: 'Pipette', description: 'Location-coded VisoTubes (e.g. CAN-01-C1-L1-G1-T1)' },
        { id: 'user', name: 'User', label: 'Staff Accounts', count: users, icon: 'Shield', description: 'Clinic doctors, embryologists, and admins' },
        { id: 'auditlog', name: 'AuditLog', label: 'Audit Logs', count: auditLogs, icon: 'FileText', description: 'Security audit trail of all clinic actions' },
        { id: 'ocrrecord', name: 'OcrRecord', label: 'OCR Scans', count: ocrRecords, icon: 'FileSpreadsheet', description: 'AI scanned cryo sheet extractions' },
        { id: 'storagemovement', name: 'StorageMovement', label: 'Straw Movements', count: storageMovements, description: 'Audit history of straw location transfers' },
        { id: 'patientnote', name: 'PatientNote', label: 'Patient Notes', count: patientNotes, description: 'Clinical doctor notes on patient profiles' },
        { id: 'emaillog', name: 'EmailLog', label: 'Email Logs', count: emailLogs, icon: 'Mail', description: 'PDF email delivery history' },
      ],
    };
  }

  /**
   * Fetch paginated raw records for any database table with search & filtering
   */
  async getTableRecords(tableId: string, page = 1, limit = 25, search = '') {
    const tableMapping: Record<string, any> = {
      patient: prisma.patient,
      storagebatch: prisma.storageBatch,
      straw: prisma.straw,
      embryo: prisma.embryo,
      thawrecord: prisma.thawRecord,
      user: prisma.user,
      can: prisma.can,
      canister: prisma.canister,
      level: prisma.level,
      goblet: prisma.goblet,
      visotube: prisma.visoTube,
      auditlog: prisma.auditLog,
      ocrrecord: prisma.ocrRecord,
      storagemovement: prisma.storageMovement,
      patientnote: prisma.patientNote,
      emaillog: prisma.emailLog,
    };

    const key = (tableId || '').toLowerCase().trim();
    const model = tableMapping[key];
    if (!model) {
      throw new Error(`Table "${tableId}" not recognized in database schema.`);
    }

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    let where: any = {};
    if (search && search.trim()) {
      const q = search.trim();
      if (key === 'patient') {
        where = {
          OR: [
            { patientId: { contains: q, mode: 'insensitive' } },
            { fullName: { contains: q, mode: 'insensitive' } },
            { partnerName: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        };
      } else if (key === 'storagebatch') {
        where = {
          OR: [
            { batchId: { contains: q, mode: 'insensitive' } },
            { patientId: { contains: q, mode: 'insensitive' } },
            { donorName: { contains: q, mode: 'insensitive' } },
          ],
        };
      } else if (key === 'straw') {
        where = {
          OR: [
            { strawId: { contains: q, mode: 'insensitive' } },
            { color: { contains: q, mode: 'insensitive' } },
            { status: { contains: q, mode: 'insensitive' } },
          ],
        };
      } else if (key === 'embryo') {
        where = {
          OR: [
            { grade: { contains: q, mode: 'insensitive' } },
            { status: { contains: q, mode: 'insensitive' } },
            { notes: { contains: q, mode: 'insensitive' } },
          ],
        };
      } else if (key === 'thawrecord') {
        where = {
          OR: [
            { doctorName: { contains: q, mode: 'insensitive' } },
            { status: { contains: q, mode: 'insensitive' } },
            { originalLocationCode: { contains: q, mode: 'insensitive' } },
          ],
        };
      } else if (key === 'user') {
        where = {
          OR: [
            { staffId: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { role: { contains: q, mode: 'insensitive' } },
          ],
        };
      } else if (key === 'can') {
        where = {
          OR: [
            { code: { contains: q, mode: 'insensitive' } },
            { name: { contains: q, mode: 'insensitive' } },
          ],
        };
      } else if (key === 'visotube') {
        where = {
          OR: [
            { locationCode: { contains: q, mode: 'insensitive' } },
          ],
        };
      } else if (key === 'auditlog') {
        where = {
          OR: [
            { action: { contains: q, mode: 'insensitive' } },
            { userName: { contains: q, mode: 'insensitive' } },
            { entityName: { contains: q, mode: 'insensitive' } },
          ],
        };
      } else if (key === 'ocrrecord') {
        where = {
          OR: [
            { originalFilename: { contains: q, mode: 'insensitive' } },
            { status: { contains: q, mode: 'insensitive' } },
          ],
        };
      } else if (key === 'storagemovement') {
        where = {
          OR: [
            { oldLocationCode: { contains: q, mode: 'insensitive' } },
            { newLocationCode: { contains: q, mode: 'insensitive' } },
            { staffName: { contains: q, mode: 'insensitive' } },
          ],
        };
      } else if (key === 'patientnote') {
        where = {
          OR: [
            { noteText: { contains: q, mode: 'insensitive' } },
            { authorName: { contains: q, mode: 'insensitive' } },
          ],
        };
      } else if (key === 'emaillog') {
        where = {
          OR: [
            { recipientEmail: { contains: q, mode: 'insensitive' } },
            { subject: { contains: q, mode: 'insensitive' } },
            { status: { contains: q, mode: 'insensitive' } },
          ],
        };
      }
    }

    const total = await model.count({ where });

    let orderBy: any = undefined;
    if (['patient', 'straw', 'auditlog', 'ocrrecord', 'emaillog', 'patientnote', 'user'].includes(key)) {
      orderBy = { createdAt: 'desc' };
    } else if (key === 'storagebatch') {
      orderBy = { createdAt: 'desc' };
    } else if (key === 'thawrecord') {
      orderBy = { thawDate: 'desc' };
    } else if (key === 'can') {
      orderBy = { code: 'asc' };
    } else if (key === 'visotube') {
      orderBy = { locationCode: 'asc' };
    }

    const records = await model.findMany({
      where,
      take: safeLimit,
      skip,
      orderBy,
    });

    // Sanitize sensitive user credentials
    const sanitized = records.map((rec: any) => {
      if (rec.passwordHash) {
        return { ...rec, passwordHash: '•••••••• (encrypted)' };
      }
      return rec;
    });

    return {
      success: true,
      table: key,
      total,
      page: safePage,
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
      records: sanitized,
    };
  }

  /**
   * Comprehensive Server, Storage, RAM & PostgreSQL Health Status
   */
  async getServerStatus() {
    // 1. System Memory (RAM)
    const totalMemBytes = os.totalmem();
    const freeMemBytes = os.freemem();
    const usedMemBytes = totalMemBytes - freeMemBytes;
    const memUsagePercent = Math.round((usedMemBytes / totalMemBytes) * 100);

    // 2. Node.js Process Memory
    const mem = process.memoryUsage();
    const heapUsedBytes = mem.heapUsed;
    const heapTotalBytes = mem.heapTotal;
    const rssBytes = mem.rss;
    const heapPercent = Math.round((heapUsedBytes / heapTotalBytes) * 100);

    // 3. Storage & Disk Usage (Checks active volume directory first, then root)
    let diskStats: any = null;
    const uploadsDir = path.resolve(CONFIG.STORAGE_LOCAL_DIR || './uploads');
    try {
      const checkPath = fs.existsSync(uploadsDir) ? uploadsDir : process.cwd();
      const stat = (fs as any).statfsSync ? ((fs as any).statfsSync(checkPath) || (fs as any).statfsSync('/')) : null;
      if (stat) {
        const totalDiskBytes = Number(stat.blocks) * Number(stat.bsize);
        const freeDiskBytes = Number(stat.bavail) * Number(stat.bsize);
        const usedDiskBytes = totalDiskBytes - freeDiskBytes;
        const diskPercentUsed = totalDiskBytes > 0 ? Math.round((usedDiskBytes / totalDiskBytes) * 100) : 0;

        diskStats = {
          totalDiskBytes,
          totalDiskFormatted: formatBytes(totalDiskBytes),
          freeDiskBytes,
          freeDiskFormatted: formatBytes(freeDiskBytes),
          usedDiskBytes,
          usedDiskFormatted: formatBytes(usedDiskBytes),
          diskPercentUsed,
          mountPath: checkPath,
        };
      }
    } catch (err: any) {
      console.warn('[DevService] Error reading disk statfs:', err.message);
    }

    // 4. Uploads Directory Categorization & Breakdown
    let photoFilesCount = 0;
    let uploadsSizeBytes = 0;
    const fileTypeBreakdown: Record<string, { count: number; bytes: number; formatted: string }> = {
      images: { count: 0, bytes: 0, formatted: '0 B' },
      documents: { count: 0, bytes: 0, formatted: '0 B' },
      other: { count: 0, bytes: 0, formatted: '0 B' },
    };
    const recentUploads: Array<{ filename: string; sizeFormatted: string; modified: string }> = [];

    if (fs.existsSync(uploadsDir)) {
      try {
        const files = fs.readdirSync(uploadsDir);
        const fileStatList: Array<{ name: string; size: number; mtime: Date }> = [];
        for (const file of files) {
          if (file === '.gitkeep') continue;
          const fullPath = path.join(uploadsDir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isFile()) {
            photoFilesCount++;
            uploadsSizeBytes += stat.size;
            fileStatList.push({ name: file, size: stat.size, mtime: stat.mtime });

            const ext = path.extname(file).toLowerCase();
            if (['.jpg', '.jpeg', '.png', '.webp', '.heic', '.svg', '.bmp'].includes(ext)) {
              fileTypeBreakdown.images.count++;
              fileTypeBreakdown.images.bytes += stat.size;
            } else if (['.pdf', '.doc', '.docx', '.txt', '.csv', '.xlsx'].includes(ext)) {
              fileTypeBreakdown.documents.count++;
              fileTypeBreakdown.documents.bytes += stat.size;
            } else {
              fileTypeBreakdown.other.count++;
              fileTypeBreakdown.other.bytes += stat.size;
            }
          }
        }

        fileTypeBreakdown.images.formatted = formatBytes(fileTypeBreakdown.images.bytes);
        fileTypeBreakdown.documents.formatted = formatBytes(fileTypeBreakdown.documents.bytes);
        fileTypeBreakdown.other.formatted = formatBytes(fileTypeBreakdown.other.bytes);

        // Sort by most recently modified top 5
        fileStatList.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
        for (let i = 0; i < Math.min(5, fileStatList.length); i++) {
          recentUploads.push({
            filename: fileStatList[i].name,
            sizeFormatted: formatBytes(fileStatList[i].size),
            modified: fileStatList[i].mtime.toISOString(),
          });
        }
      } catch (err: any) {
        console.warn('[DevService] Error scanning uploads dir:', err.message);
      }
    }

    // 5. PostgreSQL Database Health, Size, Latency & Deep Telemetry
    let dbStatus = 'CONNECTED';
    let dbLatencyMs = 0;
    let dbVersion = 'PostgreSQL';
    let dbStartTime: string | null = null;
    let dbUptimeFormatted = 'N/A';
    let dbSizeFormatted = 'N/A';
    let dbSizeBytes = 0;
    let activeConnections = 1;
    let cacheHitRatio = '100.00';
    let transactions = { commit: '0', rollback: '0' };
    let tuples = { inserted: '0', updated: '0', deleted: '0' };
    let connectionStates: Array<{ state: string; count: number }> = [];
    let largestTables: Array<{ tableName: string; rowCount: number; deadRows: number; totalSize: string; bytes: number }> = [];

    try {
      const pingStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - pingStart;

      // Version
      const versionRes: any = await prisma.$queryRaw`SELECT version()`;
      if (versionRes && versionRes[0]) {
        dbVersion = versionRes[0].version || 'PostgreSQL';
      }

      // Start Time & DB Uptime
      const startTimeRes: any = await prisma.$queryRaw`SELECT pg_postmaster_start_time()::text as start_time`;
      if (startTimeRes && startTimeRes[0]?.start_time) {
        dbStartTime = startTimeRes[0].start_time as string;
        const uptimeSeconds = Math.max(0, Math.floor((Date.now() - new Date(dbStartTime).getTime()) / 1000));
        dbUptimeFormatted = formatDuration(uptimeSeconds);
      }

      // Total Database Size
      const sizeRes: any = await prisma.$queryRaw`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size, 
               pg_database_size(current_database())::text as bytes
      `;
      if (sizeRes && sizeRes[0]) {
        dbSizeFormatted = sizeRes[0].size || 'N/A';
        dbSizeBytes = parseInt(sizeRes[0].bytes, 10) || 0;
      }

      // Buffer Cache Hit Ratio
      const cacheRes: any = await prisma.$queryRaw`
        SELECT 
          CASE WHEN (sum(heap_blks_hit) + sum(heap_blks_read)) > 0 
            THEN ROUND((sum(heap_blks_hit)::numeric / (sum(heap_blks_hit) + sum(heap_blks_read))::numeric) * 100, 2)::text
            ELSE '100.00' 
          END as cache_hit_ratio
        FROM pg_statio_user_tables
      `;
      if (cacheRes && cacheRes[0]?.cache_hit_ratio) {
        cacheHitRatio = cacheRes[0].cache_hit_ratio;
      }

      // Database Transaction & Row Metrics
      const dbStatsRes: any = await prisma.$queryRaw`
        SELECT 
          xact_commit::text as xact_commit, 
          xact_rollback::text as xact_rollback, 
          tup_inserted::text as tup_inserted, 
          tup_updated::text as tup_updated, 
          tup_deleted::text as tup_deleted
        FROM pg_stat_database 
        WHERE datname = current_database()
      `;
      if (dbStatsRes && dbStatsRes[0]) {
        transactions = {
          commit: dbStatsRes[0].xact_commit || '0',
          rollback: dbStatsRes[0].xact_rollback || '0',
        };
        tuples = {
          inserted: dbStatsRes[0].tup_inserted || '0',
          updated: dbStatsRes[0].tup_updated || '0',
          deleted: dbStatsRes[0].tup_deleted || '0',
        };
      }

      // Active Connections & Connection States
      const connStatesRes: any = await prisma.$queryRaw`
        SELECT COALESCE(state, 'unknown') as state, count(*)::int as count 
        FROM pg_stat_activity 
        WHERE datname = current_database() 
        GROUP BY state
      `;
      if (Array.isArray(connStatesRes)) {
        connectionStates = connStatesRes.map((c: any) => ({
          state: c.state || 'unknown',
          count: c.count || 0,
        }));
        activeConnections = connectionStates.reduce((acc, curr) => acc + curr.count, 0) || 1;
      }

      // Top Tables with Row Counts and Dead Tuples
      const tableSizeRes: any = await prisma.$queryRaw`
        SELECT 
          relname as table_name,
          n_live_tup::int as row_count,
          n_dead_tup::int as dead_rows,
          pg_size_pretty(pg_total_relation_size(relid)) as total_size,
          pg_total_relation_size(relid)::text as bytes
        FROM pg_stat_user_tables
        ORDER BY pg_total_relation_size(relid) DESC
        LIMIT 10
      `;
      if (Array.isArray(tableSizeRes)) {
        largestTables = tableSizeRes.map((t: any) => ({
          tableName: t.table_name,
          rowCount: t.row_count || 0,
          deadRows: t.dead_rows || 0,
          totalSize: t.total_size,
          bytes: parseInt(t.bytes, 10) || 0,
        }));
      }
    } catch (err: any) {
      dbStatus = `ERROR: ${err.message}`;
      console.error('[DevService] Error querying Postgres stats:', err.message);
    }

    // 6. CPUs & Host details
    const cpus = os.cpus() || [];
    const cpuModel = cpus[0]?.model || 'Standard CPU';
    const cpuCores = cpus.length;

    // 7. Network Interfaces (IPv4 addresses)
    const networkInterfaces: Array<{ interface: string; address: string; internal: boolean }> = [];
    try {
      const nets = os.networkInterfaces();
      for (const name of Object.keys(nets)) {
        for (const net of (nets[name] || [])) {
          if (net.family === 'IPv4' || (net as any).family === 4) {
            networkInterfaces.push({
              interface: name,
              address: net.address,
              internal: net.internal,
            });
          }
        }
      }
    } catch (err: any) {
      console.warn('[DevService] Error listing network interfaces:', err.message);
    }

    // 8. Process CPU usage
    const cpuUsage = process.cpuUsage();

    return {
      success: true,
      timestamp: new Date().toISOString(),
      host: {
        platform: os.platform(),
        type: os.type(),
        release: os.release(),
        arch: os.arch(),
        hostname: os.hostname(),
        cpuModel,
        cpuCores,
        systemUptimeSeconds: Math.floor(os.uptime()),
        systemUptimeFormatted: formatDuration(os.uptime()),
        loadAvg: os.loadavg(),
        networkInterfaces,
      },
      process: {
        nodeVersion: process.version,
        v8Version: process.versions.v8,
        pid: process.pid,
        processUptimeSeconds: Math.floor(process.uptime()),
        processUptimeFormatted: formatDuration(process.uptime()),
        environment: CONFIG.NODE_ENV,
        port: CONFIG.PORT,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        serverTime: new Date().toISOString(),
        cpuUsageMs: {
          user: Math.round(cpuUsage.user / 1000),
          system: Math.round(cpuUsage.system / 1000),
        },
      },
      memory: {
        systemTotalMemFormatted: formatBytes(totalMemBytes),
        systemFreeMemFormatted: formatBytes(freeMemBytes),
        systemUsedMemFormatted: formatBytes(usedMemBytes),
        systemTotalMemBytes: totalMemBytes,
        systemFreeMemBytes: freeMemBytes,
        systemUsedMemBytes: usedMemBytes,
        systemMemUsagePercent: memUsagePercent,
        processHeapUsedFormatted: formatBytes(heapUsedBytes),
        processHeapTotalFormatted: formatBytes(heapTotalBytes),
        processRssFormatted: formatBytes(rssBytes),
        processExternalFormatted: formatBytes(mem.external),
        processArrayBuffersFormatted: formatBytes((mem as any).arrayBuffers || 0),
        processHeapUsedBytes: heapUsedBytes,
        processHeapTotalBytes: heapTotalBytes,
        processRssBytes: rssBytes,
        processHeapPercent: heapPercent,
      },
      storage: {
        disk: diskStats,
        uploads: {
          directory: uploadsDir,
          fileCount: photoFilesCount,
          totalSizeBytes: uploadsSizeBytes,
          totalSizeFormatted: formatBytes(uploadsSizeBytes),
          breakdown: fileTypeBreakdown,
          recent: recentUploads,
        },
      },
      database: {
        engine: 'PostgreSQL',
        version: dbVersion,
        status: dbStatus,
        latencyMs: dbLatencyMs,
        startTime: dbStartTime,
        uptimeFormatted: dbUptimeFormatted,
        dbSizeFormatted,
        dbSizeBytes,
        activeConnections,
        cacheHitRatio,
        transactions,
        tuples,
        connectionStates,
        largestTables,
      },
    };
  }
}

export const devService = new DevService();
