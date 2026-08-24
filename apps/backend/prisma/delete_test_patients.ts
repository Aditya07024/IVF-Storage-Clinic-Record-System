import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const targetIds = [
    'IVF-2026-23631744',
    'IVF-2026-6957635',
    'IVF-2026-3851069',
    'IVF-2026-478206',
    'IVF-2026-590165',
    'IVF-2026-844399',
    'IVF-2026-299923',
    'IVF-2026-73381',
  ];

  console.log('Finding target test patients to delete...');

  const patientsToDelete = await prisma.patient.findMany({
    where: {
      OR: [
        { patientId: { in: targetIds } },
        { fullName: { contains: 'Sunita', mode: 'insensitive' } },
        { fullName: { contains: 'Sunia', mode: 'insensitive' } },
        { fullName: { contains: 'Sunfita', mode: 'insensitive' } },
        { fullName: { contains: 'Sunitfa', mode: 'insensitive' } },
      ],
    },
    include: {
      batches: {
        include: {
          straws: true,
        },
      },
    },
  });

  console.log(`Found ${patientsToDelete.length} matching test patients.`);

  for (const patient of patientsToDelete) {
    console.log(`Deleting patient: ${patient.fullName} (ID: ${patient.patientId}, Database ID: ${patient.id})`);

    await prisma.thawRecord.deleteMany({ where: { patientId: patient.id } });
    for (const batch of patient.batches) {
      await prisma.straw.deleteMany({ where: { batchId: batch.id } });
    }
    await prisma.storageBatch.deleteMany({ where: { patientId: patient.id } });
    await prisma.patientNote.deleteMany({ where: { patientId: patient.id } });
    await prisma.ocrRecord.deleteMany({ where: { patientId: patient.id } });
    await prisma.auditLog.deleteMany({ where: { entityId: patient.patientId } });
    await prisma.patient.delete({ where: { id: patient.id } });
  }

  console.log('Successfully deleted all requested test patient records!');
}

main()
  .catch((e) => {
    console.error('Error deleting test patients:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
