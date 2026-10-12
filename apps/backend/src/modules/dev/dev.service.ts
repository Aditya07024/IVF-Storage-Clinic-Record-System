import fs from 'fs';
import path from 'path';
import argon2 from 'argon2';
import { prisma } from '../../common/prisma.js';
import { CONFIG } from '../../common/config.js';
import { storageService } from '../storage/storage.service.js';

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
}

export const devService = new DevService();
