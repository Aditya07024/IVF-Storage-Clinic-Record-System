import fs from 'fs';
import path from 'path';
import { prisma, withDbRetry } from '../../common/prisma.js';
import { CONFIG } from '../../common/config.js';

function parseFlexibleDate(d?: Date | string | null): Date | null {
  if (!d) return null;
  if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
  const str = String(d).trim();
  if (!str || str === 'N/A' || str === 'null' || str === 'undefined') return null;

  const isoMatch = str.match(/^(\d{4})[\/\.\-](\d{1,2})[\/\.\-](\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    const parsed = new Date(Date.UTC(year, month, day, 12, 0, 0));
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  const ddmmyyyyMatch = str.match(/^(\d{1,2})[\/\.\-\s](\d{1,2})[\/\.\-\s](\d{2,4})$/);
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1], 10);
    const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
    let year = parseInt(ddmmyyyyMatch[3], 10);
    if (year < 100) {
      year = year >= 50 ? 1900 + year : 2000 + year;
    }
    const parsed = new Date(Date.UTC(year, month, day, 12, 0, 0));
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

async function getValidUserId(staffUserId?: string): Promise<string | null> {
  try {
    if (staffUserId) {
      const existing = await prisma.user.findUnique({ where: { id: staffUserId } });
      if (existing) return existing.id;
    }
    const anyUser = await prisma.user.findFirst();
    return anyUser ? anyUser.id : null;
  } catch {
    return null;
  }
}

export interface CreatePatientInput {
  patientId?: string;
  fullName: string;
  partnerName?: string;
  phone?: string;
  partnerPhone?: string;
  email?: string;
  partnerEmail?: string;
  dob?: string;
  partnerDob?: string;
  patientAge?: string;
  partnerAge?: string;
  doctorName?: string;
  aspirationDate?: Date | string;
  freezingDate?: Date | string;
  thawDate?: Date | string;
  comments?: string;
  photoUrl?: string;
  partnerPhotoUrl?: string;
  isEmailVerified?: boolean;
  specimenType?: string;
  cycleType?: string;
  donorName?: string;
  donorRegNo?: string;
  donorAge?: string;
  donorPhone?: string;
  vitrificationIndication?: string;
  oocyteStage?: string;
}

export class PatientService {
  // Generate unique Patient ID: IVF-2026-000001 (Numeric Max Safe)
  async generateNextPatientId(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `IVF-${year}-`;

    const patients = await prisma.patient.findMany({
      where: {
        patientId: { startsWith: prefix },
      },
      select: { patientId: true },
    });

    let maxNum = 0;
    for (const p of patients) {
      const parts = p.patientId.split('-');
      if (parts.length >= 3) {
        const num = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }

    const nextNumber = Math.max(maxNum + 1, patients.length + 1);
    let candidate = `${prefix}${nextNumber.toString().padStart(6, '0')}`;

    let attempts = 0;
    while (await prisma.patient.findUnique({ where: { patientId: candidate } })) {
      attempts++;
      candidate = `${prefix}${(nextNumber + attempts).toString().padStart(6, '0')}`;
      if (attempts > 100) break;
    }

    return candidate;
  }

  async createPatient(input: CreatePatientInput, staffUserId: string, staffName: string) {
    const isCustomId = Boolean(input.patientId && input.patientId.trim());
    let patientId = isCustomId ? input.patientId!.trim() : '';

    if (!input.fullName || !input.fullName.trim()) {
      throw new Error('Patient Full Name is required.');
    }
    if (!input.dob || !input.dob.trim()) {
      throw new Error('Patient Date of Birth (DOB) is required.');
    }
    if (!input.email || !input.email.trim()) {
      throw new Error('Patient Email Address is required.');
    }

    if (isCustomId) {
      const existing = await prisma.patient.findUnique({ where: { patientId } });
      if (existing) {
        throw new Error(`Patient Registration No / ID "${patientId}" already exists in system. Please enter a unique ID or search existing records.`);
      }
    } else {
      patientId = await this.generateNextPatientId();
    }

    let patient: any = null;
    let createAttempts = 0;

    while (!patient && createAttempts < 20) {
      try {
        patient = await prisma.patient.create({
          data: {
            patientId,
            fullName: input.fullName.trim(),
            partnerName: input.partnerName ? input.partnerName.trim() : null,
            phone: input.phone ? input.phone.trim() : null,
            partnerPhone: input.partnerPhone ? input.partnerPhone.trim() : null,
            email: input.email ? input.email.trim() : null,
            partnerEmail: input.partnerEmail ? input.partnerEmail.trim() : null,
            dob: input.dob ? input.dob.trim() : null,
            partnerDob: input.partnerDob ? input.partnerDob.trim() : null,
            patientAge: input.patientAge ? input.patientAge.trim() : null,
            partnerAge: input.partnerAge ? input.partnerAge.trim() : null,
            doctorName: input.doctorName ? input.doctorName.trim() : null,
            aspirationDate: input.aspirationDate ? parseFlexibleDate(input.aspirationDate) : null,
            freezingDate: input.freezingDate ? parseFlexibleDate(input.freezingDate) : null,
            thawDate: input.thawDate ? parseFlexibleDate(input.thawDate) : null,
            comments: input.comments ? input.comments.trim() : null,
            photoUrl: input.photoUrl ? input.photoUrl.trim() : null,
            partnerPhotoUrl: input.partnerPhotoUrl ? input.partnerPhotoUrl.trim() : null,
            isEmailVerified: Boolean(input.isEmailVerified),
            specimenType: input.specimenType ? input.specimenType.trim() : 'EMBRYO',
            cycleType: input.cycleType ? input.cycleType.trim() : 'SELF',
            donorName: input.donorName ? input.donorName.trim() : null,
            donorRegNo: input.donorRegNo ? input.donorRegNo.trim() : null,
            donorAge: input.donorAge ? input.donorAge.trim() : null,
            donorPhone: input.donorPhone ? input.donorPhone.trim() : null,
            vitrificationIndication: input.vitrificationIndication ? input.vitrificationIndication.trim() : null,
            oocyteStage: input.oocyteStage ? input.oocyteStage.trim() : null,
          },
        });
      } catch (err: any) {
        if (!isCustomId && (err.code === 'P2002' || err.message?.includes('Unique constraint'))) {
          createAttempts++;
          patientId = await this.generateNextPatientId();
        } else {
          throw err;
        }
      }
    }

    if (!patient) {
      throw new Error('Failed to create patient after retry attempts.');
    }

    // If initial comments exist, save as initial PatientNote
    if (input.comments && input.comments.trim().length > 0) {
      await prisma.patientNote.create({
        data: {
          patientId: patient.id,
          authorId: staffUserId,
          authorName: staffName,
          noteText: input.comments.trim(),
        },
      });
    }

    // Safe Audit Log
    try {
      const validUserId = await getValidUserId(staffUserId);
      if (validUserId) {
        await prisma.auditLog.create({
          data: {
            userId: validUserId,
            userName: staffName,
            action: 'PATIENT_CREATED',
            entityName: 'Patient',
            entityId: patient.id,
            newData: JSON.stringify({ patientId: patient.patientId, fullName: patient.fullName }),
          },
        });
      }
    } catch (auditErr) {
      console.warn('AuditLog creation skipped:', auditErr);
    }

    return patient;
  }

  async updatePatient(id: string, input: Partial<CreatePatientInput>, staffUserId: string, staffName: string) {
    const existing = await prisma.patient.findFirst({
      where: {
        OR: [{ id }, { patientId: id }],
      },
    });

    if (!existing) {
      throw new Error('Patient record not found.');
    }

    const updated = await prisma.patient.update({
      where: { id: existing.id },
      data: {
        fullName: input.fullName !== undefined ? input.fullName.trim() : existing.fullName,
        partnerName: input.partnerName !== undefined ? input.partnerName.trim() : existing.partnerName,
        phone: input.phone !== undefined ? (input.phone ? input.phone.trim() : null) : existing.phone,
        partnerPhone: input.partnerPhone !== undefined ? (input.partnerPhone ? input.partnerPhone.trim() : null) : existing.partnerPhone,
        email: input.email !== undefined ? (input.email ? input.email.trim() : null) : existing.email,
        partnerEmail: input.partnerEmail !== undefined ? (input.partnerEmail ? input.partnerEmail.trim() : null) : existing.partnerEmail,
        dob: input.dob !== undefined ? (input.dob ? input.dob.trim() : null) : existing.dob,
        partnerDob: input.partnerDob !== undefined ? (input.partnerDob ? input.partnerDob.trim() : null) : existing.partnerDob,
        patientAge: input.patientAge !== undefined ? (input.patientAge ? input.patientAge.trim() : null) : existing.patientAge,
        partnerAge: input.partnerAge !== undefined ? (input.partnerAge ? input.partnerAge.trim() : null) : existing.partnerAge,
        doctorName: input.doctorName !== undefined ? (input.doctorName ? input.doctorName.trim() : null) : existing.doctorName,
        aspirationDate: input.aspirationDate !== undefined ? (input.aspirationDate ? new Date(input.aspirationDate) : null) : existing.aspirationDate,
        freezingDate: input.freezingDate !== undefined ? (input.freezingDate ? new Date(input.freezingDate) : null) : existing.freezingDate,
        thawDate: input.thawDate !== undefined ? (input.thawDate ? new Date(input.thawDate) : null) : existing.thawDate,
        comments: input.comments !== undefined ? input.comments.trim() : existing.comments,
        photoUrl: input.photoUrl !== undefined ? (input.photoUrl ? input.photoUrl.trim() : null) : existing.photoUrl,
        partnerPhotoUrl: input.partnerPhotoUrl !== undefined ? (input.partnerPhotoUrl ? input.partnerPhotoUrl.trim() : null) : existing.partnerPhotoUrl,
        isEmailVerified: input.isEmailVerified !== undefined ? Boolean(input.isEmailVerified) : existing.isEmailVerified,
        specimenType: input.specimenType !== undefined ? (input.specimenType ? input.specimenType.trim() : null) : existing.specimenType,
        cycleType: input.cycleType !== undefined ? (input.cycleType ? input.cycleType.trim() : null) : existing.cycleType,
        donorName: input.donorName !== undefined ? (input.donorName ? input.donorName.trim() : null) : existing.donorName,
        donorRegNo: input.donorRegNo !== undefined ? (input.donorRegNo ? input.donorRegNo.trim() : null) : existing.donorRegNo,
        donorAge: input.donorAge !== undefined ? (input.donorAge ? input.donorAge.trim() : null) : existing.donorAge,
        donorPhone: input.donorPhone !== undefined ? (input.donorPhone ? input.donorPhone.trim() : null) : existing.donorPhone,
        vitrificationIndication: input.vitrificationIndication !== undefined ? (input.vitrificationIndication ? input.vitrificationIndication.trim() : null) : existing.vitrificationIndication,
        oocyteStage: input.oocyteStage !== undefined ? (input.oocyteStage ? input.oocyteStage.trim() : null) : existing.oocyteStage,
      },
    });

    // Safe Audit Log
    try {
      const validUserId = await getValidUserId(staffUserId);
      if (validUserId) {
        await prisma.auditLog.create({
          data: {
            userId: validUserId,
            userName: staffName,
            action: 'PATIENT_UPDATED',
            entityName: 'Patient',
            entityId: updated.id,
            oldData: JSON.stringify({ fullName: existing.fullName, comments: existing.comments }),
            newData: JSON.stringify({ fullName: updated.fullName, comments: updated.comments }),
          },
        });
      }
    } catch (auditErr) {
      console.warn('AuditLog update skipped:', auditErr);
    }

    return updated;
  }

  async deletePatient(id: string, staffUserId: string, staffName: string) {
    return withDbRetry(async () => {
      const patient = await prisma.patient.findUnique({
        where: { id },
        include: {
          batches: {
            include: {
              straws: {
                include: { embryos: true },
              },
            },
          },
          notes: true,
          thawRecords: true,
          ocrRecords: true,
          emailLogs: true,
        },
      });
      if (!patient) throw new Error('Patient record not found.');

      const patientUuid = patient.id;
      const patientRegId = patient.patientId;
      const fullName = patient.fullName;
      const partnerName = patient.partnerName;
      const email = patient.email;
      const partnerEmail = patient.partnerEmail;

      const batchIds = patient.batches.map((b) => b.id);
      const strawIds = patient.batches.flatMap((b) => b.straws.map((s) => s.id));

      // 1. Delete Embryos
      if (strawIds.length > 0) {
        await prisma.embryo.deleteMany({
          where: { strawId: { in: strawIds } },
        });
      }

      // 2. Delete Thaw Records
      const thawConditions: any[] = [{ patientId: patientUuid }];
      if (strawIds.length > 0) thawConditions.push({ strawId: { in: strawIds } });
      if (batchIds.length > 0) thawConditions.push({ batchId: { in: batchIds } });
      await prisma.thawRecord.deleteMany({
        where: { OR: thawConditions },
      });

      // 3. Delete Storage Movements
      const movementConditions: any[] = [{ patientId: patientUuid }];
      if (strawIds.length > 0) movementConditions.push({ strawId: { in: strawIds } });
      await prisma.storageMovement.deleteMany({
        where: { OR: movementConditions },
      });

      // 4. Delete Straws
      if (batchIds.length > 0) {
        await prisma.straw.deleteMany({
          where: { batchId: { in: batchIds } },
        });
      }

      // 5. Delete Batches
      await prisma.storageBatch.deleteMany({
        where: { patientId: patientUuid },
      });

      // 6. Delete Patient Notes
      await prisma.patientNote.deleteMany({
        where: { patientId: patientUuid },
      });

      // 7. Delete OCR Records
      const ocrConditions: any[] = [
        { patientId: patientUuid },
        { extractedJson: { contains: patientUuid } },
        { extractedJson: { contains: patientRegId } },
      ];
      if (fullName) ocrConditions.push({ extractedJson: { contains: fullName } });
      await prisma.ocrRecord.deleteMany({
        where: { OR: ocrConditions },
      });

      // 8. Delete Email Logs
      const emailConditions: any[] = [{ patientId: patientUuid }];
      if (email) emailConditions.push({ recipientEmail: email });
      if (partnerEmail) emailConditions.push({ recipientEmail: partnerEmail });
      await prisma.emailLog.deleteMany({
        where: { OR: emailConditions },
      });

      // 9. Wipe ALL related Audit Logs (past creation, updates, thaws, document prints)
      const auditConditions: any[] = [
        { entityId: patientUuid },
        { entityId: patientRegId },
        { oldData: { contains: patientUuid } },
        { newData: { contains: patientUuid } },
        { oldData: { contains: patientRegId } },
        { newData: { contains: patientRegId } },
      ];
      if (fullName) {
        auditConditions.push({ oldData: { contains: fullName } });
        auditConditions.push({ newData: { contains: fullName } });
      }
      if (partnerName) {
        auditConditions.push({ oldData: { contains: partnerName } });
        auditConditions.push({ newData: { contains: partnerName } });
      }

      for (const bId of batchIds) {
        auditConditions.push({ entityId: bId });
        auditConditions.push({ oldData: { contains: bId } });
        auditConditions.push({ newData: { contains: bId } });
      }
      for (const sId of strawIds) {
        auditConditions.push({ entityId: sId });
        auditConditions.push({ oldData: { contains: sId } });
        auditConditions.push({ newData: { contains: sId } });
      }

      await prisma.auditLog.deleteMany({
        where: { OR: auditConditions },
      });

      // 10. Clean up uploaded disk image files
      const filesToDelete = new Set<string>();
      const collectFile = (urlOrKey?: string | null) => {
        if (!urlOrKey || urlOrKey.startsWith('data:')) return;
        const basename = path.basename(urlOrKey);
        const candidatePaths = [
          path.join(path.resolve(CONFIG.STORAGE_LOCAL_DIR || './uploads'), basename),
          path.join(process.cwd(), 'uploads', basename),
        ];
        for (const p of candidatePaths) {
          if (fs.existsSync(p)) {
            filesToDelete.add(p);
          }
        }
      };

      collectFile(patient.photoUrl);
      collectFile(patient.partnerPhotoUrl);
      for (const ocr of patient.ocrRecords) {
        collectFile(ocr.storageKey);
      }

      for (const filePath of filesToDelete) {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (err) {
          console.warn('Failed to delete file on patient delete:', filePath, err);
        }
      }

      // 11. Delete the Patient record itself
      await prisma.patient.delete({ where: { id: patientUuid } });

      return {
        success: true,
        message: `Patient ${fullName} (${patientRegId}) and all associated records have been completely erased.`,
      };
    });
  }

  async getPatientById(id: string) {
    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        notes: { orderBy: { createdAt: 'desc' } },
        batches: {
          include: {
            straws: {
              include: { embryos: true, visoTube: true },
            },
          },
        },
        thawRecords: {
          orderBy: { thawDate: 'desc' },
          include: {
            straw: {
              include: { embryos: true, visoTube: true },
            },
          },
        },
        ocrRecords: { orderBy: { createdAt: 'desc' } },
        emailLogs: { orderBy: { sentAt: 'desc' } },
      },
    });

    if (!patient) return null;

    // Fetch Audit Logs relevant to this patient
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entityId: patient.id },
          { newData: { contains: patient.id } },
          { newData: { contains: patient.patientId } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      ...patient,
      auditLogs,
    };
  }

  async searchPatients(
    query: string = '',
    page: number = 1,
    limit: number = 10,
    freezingDateFilter?: string,
    sortBy: string = 'freezingDate',
    sortOrder: 'asc' | 'desc' = 'desc'
  ) {
    const skip = (page - 1) * limit;
    const whereConditions: any[] = [];

    const trimmedQuery = query.trim();

    if (trimmedQuery) {
      const orConditions: any[] = [
        { patientId: { contains: trimmedQuery, mode: 'insensitive' } },
        { fullName: { contains: trimmedQuery, mode: 'insensitive' } },
        { partnerName: { contains: trimmedQuery, mode: 'insensitive' } },
        { phone: { contains: trimmedQuery, mode: 'insensitive' } },
        { comments: { contains: trimmedQuery, mode: 'insensitive' } },
      ];

      // Check if text query itself is a valid date (e.g. 2026-08-20 or 2026/08/20)
      const parsedQueryDate = new Date(trimmedQuery);
      if (!isNaN(parsedQueryDate.getTime()) && trimmedQuery.length >= 8) {
        const nextDay = new Date(parsedQueryDate);
        nextDay.setDate(nextDay.getDate() + 1);
        orConditions.push(
          { freezingDate: { gte: parsedQueryDate, lt: nextDay } },
          { batches: { some: { storageDate: { gte: parsedQueryDate, lt: nextDay } } } }
        );
      }

      whereConditions.push({ OR: orConditions });
    }

    // Explicit Freezing Date Filter from date picker
    if (freezingDateFilter && freezingDateFilter.trim()) {
      const targetDate = new Date(freezingDateFilter.trim());
      if (!isNaN(targetDate.getTime())) {
        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);
        whereConditions.push({
          OR: [
            { freezingDate: { gte: targetDate, lt: nextDay } },
            { batches: { some: { storageDate: { gte: targetDate, lt: nextDay } } } },
          ],
        });
      }
    }

    const searchFilter = whereConditions.length > 0 ? { AND: whereConditions } : {};

    const orderByClause = sortBy === 'freezingDate'
      ? [{ freezingDate: sortOrder }, { createdAt: 'desc' }]
      : [{ createdAt: sortOrder }];

    const [total, patients] = await Promise.all([
      prisma.patient.count({ where: searchFilter }),
      prisma.patient.findMany({
        where: searchFilter,
        orderBy: orderByClause as any,
        skip,
        take: limit,
        select: {
          id: true,
          patientId: true,
          fullName: true,
          partnerName: true,
          phone: true,
          partnerPhone: true,
          email: true,
          partnerEmail: true,
          dob: true,
          partnerDob: true,
          patientAge: true,
          partnerAge: true,
          doctorName: true,
          aspirationDate: true,
          freezingDate: true,
          comments: true,
          photoUrl: true,
          partnerPhotoUrl: true,
          specimenType: true,
          cycleType: true,
          donorName: true,
          donorRegNo: true,
          donorAge: true,
          donorPhone: true,
          vitrificationIndication: true,
          oocyteStage: true,
          createdAt: true,
          updatedAt: true,
          batches: {
            orderBy: { storageDate: 'desc' },
            select: {
              id: true,
              batchId: true,
              storageDate: true,
              aspirationDate: true,
              freezingDate: true,
              embryoStage: true,
              oocyteStage: true,
              straws: {
                select: {
                  id: true,
                  strawId: true,
                  status: true,
                  embryoCount: true,
                  grade: true,
                  color: true,
                  isPgt: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      patients,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async addNote(patientId: string, noteText: string, staffUserId: string, staffName: string) {
    const note = await prisma.patientNote.create({
      data: {
        patientId,
        authorId: staffUserId,
        authorName: staffName,
        noteText: noteText.trim(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: staffUserId,
        userName: staffName,
        action: 'PATIENT_NOTE_ADDED',
        entityName: 'PatientNote',
        entityId: note.id,
        newData: JSON.stringify({ patientId, noteText }),
      },
    });

    return note;
  }
}

export const patientService = new PatientService();
