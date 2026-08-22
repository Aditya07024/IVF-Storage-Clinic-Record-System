import argon2 from 'argon2';
import { prisma } from '../src/common/prisma.js';
import { storageService } from '../src/modules/storage/storage.service.js';

async function seed() {
  console.log('[Seed] Seeding database...');

  // Seed storage hierarchy
  await storageService.seedHierarchyIfNeeded();

  // Seed default admin user
  const adminExists = await prisma.user.findUnique({ where: { staffId: 'ADMIN001' } });
  if (!adminExists) {
    const adminHash = await argon2.hash('AdminPassword123!', { type: argon2.argon2id });
    await prisma.user.create({
      data: {
        staffId: 'ADMIN001',
        email: 'admin@ivfclinic.com',
        name: 'Dr. Sarah Jenkins (Admin)',
        passwordHash: adminHash,
        role: 'ADMIN',
      },
    });
    console.log('[Seed] Created default Admin user (ADMIN001 / AdminPassword123!)');
  }

  // Seed default staff user
  const staffExists = await prisma.user.findUnique({ where: { staffId: 'STAFF001' } });
  if (!staffExists) {
    const staffHash = await argon2.hash('StaffPassword123!', { type: argon2.argon2id });
    await prisma.user.create({
      data: {
        staffId: 'STAFF001',
        email: 'staff@ivfclinic.com',
        name: 'Alex Vance (Embryologist)',
        passwordHash: staffHash,
        role: 'STAFF',
      },
    });
    console.log('[Seed] Created default Staff user (STAFF001 / StaffPassword123!)');
  }

  // Seed sample patient record
  const patientExists = await prisma.patient.findFirst({ where: { patientId: 'IVF-2026-000001' } });
  if (!patientExists) {
    const patient = await prisma.patient.create({
      data: {
        patientId: 'IVF-2026-000001',
        fullName: 'Eleanor Vance',
        partnerName: 'Thomas Vance',
        visitDate: new Date('2026-08-15'),
        deDate: new Date('2026-08-18'),
        freezingDate: new Date('2026-08-20'),
        comments: 'Initial patient consultation completed. High egg yield.',
      },
    });

    console.log(`[Seed] Created sample patient ${patient.patientId}`);
  }

  console.log('[Seed] Database seeding completed successfully.');
}

seed()
  .catch(err => {
    console.error('[Seed Error]', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
