import { prisma } from '../../common/prisma.js';

export interface ThawRequestInput {
  strawIds: string[];
  doctorId: string;
  doctorName: string;
  doctorNotes?: string;
}

export class ThawService {
  async thawStraws(input: ThawRequestInput) {
    if (!input.strawIds || input.strawIds.length === 0) {
      throw new Error('At least one straw must be selected for thawing/warming.');
    }

    return prisma.$transaction(async (tx) => {
      const thawRecords = [];

      for (const strawId of input.strawIds) {
        const straw = await tx.straw.findUnique({
          where: { id: strawId },
          include: {
            visoTube: true,
            batch: true,
            embryos: true,
          },
        });

        if (!straw) {
          throw new Error(`Straw with ID ${strawId} not found.`);
        }

        if (straw.status === 'THAWED' || straw.status === 'VACANT') {
          throw new Error(`Straw ${straw.strawId} has already been thawed/withdrawn.`);
        }

        const originalLocationCode = straw.visoTube.locationCode;

        // 1. Update Straw Status to VACANT/THAWED (frees physical capacity while keeping record)
        await tx.straw.update({
          where: { id: straw.id },
          data: {
            status: 'VACANT',
          },
        });

        // 2. Update Embryos inside straw to THAWED
        await tx.embryo.updateMany({
          where: { strawId: straw.id },
          data: { status: 'THAWED' },
        });

        // 3. Create Immutable ThawRecord
        const record = await tx.thawRecord.create({
          data: {
            strawId: straw.id,
            patientId: straw.batch.patientId,
            batchId: straw.batch.id,
            originalLocationCode,
            thawDate: new Date(),
            doctorId: input.doctorId,
            doctorName: input.doctorName,
            status: 'COMPLETED',
            doctorNotes: input.doctorNotes,
          },
        });

        // 4. Update Patient thawDate if not set
        await tx.patient.update({
          where: { id: straw.batch.patientId },
          data: { thawDate: new Date() },
        });

        // 5. Create Audit Log
        await tx.auditLog.create({
          data: {
            userId: input.doctorId,
            userName: input.doctorName,
            action: 'EMBRYO_THAWED',
            entityName: 'ThawRecord',
            entityId: record.id,
            newData: JSON.stringify({
              strawId: straw.strawId,
              patientId: straw.batch.patientId,
              originalLocation: originalLocationCode,
              thawDate: record.thawDate,
              doctorNotes: input.doctorNotes,
            }),
          },
        });

        thawRecords.push(record);
      }

      return {
        message: `Successfully thawed/warmed ${thawRecords.length} straw(s). Storage location status set to VACANT. Historical audit records preserved.`,
        thawRecords,
      };
    }, { timeout: 25000, maxWait: 10000 });
  }

  async getPatientThawHistory(patientId: string) {
    return prisma.thawRecord.findMany({
      where: { patientId },
      include: {
        straw: {
          include: {
            embryos: true,
          },
        },
        doctor: {
          select: { id: true, name: true, staffId: true },
        },
      },
      orderBy: { thawDate: 'desc' },
    });
  }
}

export const thawService = new ThawService();
