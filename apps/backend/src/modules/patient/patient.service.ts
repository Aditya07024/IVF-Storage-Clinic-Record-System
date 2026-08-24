import { prisma } from '../../common/prisma.js';

export interface CreatePatientInput {
  patientId?: string;
  fullName: string;
  partnerName?: string;
  phone?: string;
  dob?: string;
  patientAge?: string;
  partnerAge?: string;
  doctorName?: string;
  visitDate?: Date | string;
  deDate?: Date | string;
  freezingDate?: Date | string;
  thawDate?: Date | string;
  comments?: string;
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
            dob: input.dob ? input.dob.trim() : null,
            patientAge: input.patientAge ? input.patientAge.trim() : null,
            partnerAge: input.partnerAge ? input.partnerAge.trim() : null,
            doctorName: input.doctorName ? input.doctorName.trim() : null,
            visitDate: input.visitDate ? new Date(input.visitDate) : null,
            deDate: input.deDate ? new Date(input.deDate) : null,
            freezingDate: input.freezingDate ? new Date(input.freezingDate) : null,
            thawDate: input.thawDate ? new Date(input.thawDate) : null,
            comments: input.comments ? input.comments.trim() : null,
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

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: staffUserId,
        userName: staffName,
        action: 'PATIENT_CREATED',
        entityName: 'Patient',
        entityId: patient.id,
        newData: JSON.stringify({ patientId: patient.patientId, fullName: patient.fullName }),
      },
    });

    return patient;
  }

  async updatePatient(id: string, input: Partial<CreatePatientInput>, staffUserId: string, staffName: string) {
    const existing = await prisma.patient.findUnique({ where: { id } });
    if (!existing) {
      throw new Error('Patient record not found.');
    }

    const updated = await prisma.patient.update({
      where: { id },
      data: {
        fullName: input.fullName !== undefined ? input.fullName.trim() : existing.fullName,
        partnerName: input.partnerName !== undefined ? input.partnerName.trim() : existing.partnerName,
        phone: input.phone !== undefined ? (input.phone ? input.phone.trim() : null) : existing.phone,
        dob: input.dob !== undefined ? (input.dob ? input.dob.trim() : null) : existing.dob,
        patientAge: input.patientAge !== undefined ? (input.patientAge ? input.patientAge.trim() : null) : existing.patientAge,
        partnerAge: input.partnerAge !== undefined ? (input.partnerAge ? input.partnerAge.trim() : null) : existing.partnerAge,
        doctorName: input.doctorName !== undefined ? (input.doctorName ? input.doctorName.trim() : null) : existing.doctorName,
        visitDate: input.visitDate !== undefined ? (input.visitDate ? new Date(input.visitDate) : null) : existing.visitDate,
        deDate: input.deDate !== undefined ? (input.deDate ? new Date(input.deDate) : null) : existing.deDate,
        freezingDate: input.freezingDate !== undefined ? (input.freezingDate ? new Date(input.freezingDate) : null) : existing.freezingDate,
        thawDate: input.thawDate !== undefined ? (input.thawDate ? new Date(input.thawDate) : null) : existing.thawDate,
        comments: input.comments !== undefined ? input.comments.trim() : existing.comments,
      },
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: staffUserId,
        userName: staffName,
        action: 'PATIENT_UPDATED',
        entityName: 'Patient',
        entityId: updated.id,
        oldData: JSON.stringify({ fullName: existing.fullName, comments: existing.comments }),
        newData: JSON.stringify({ fullName: updated.fullName, comments: updated.comments }),
      },
    });

    return updated;
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
          partnerAge: true,
          patientAge: true,
          doctorName: true,
          phone: true,
          visitDate: true,
          freezingDate: true,
          deDate: true,
          comments: true,
          createdAt: true,
          updatedAt: true,
          batches: {
            orderBy: { storageDate: 'desc' },
            select: {
              id: true,
              batchId: true,
              storageDate: true,
              straws: { select: { id: true, status: true } },
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
