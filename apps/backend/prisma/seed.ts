import argon2 from 'argon2';
import { prisma } from '../src/common/prisma.js';
import { storageService } from '../src/modules/storage/storage.service.js';
import { thawService } from '../src/modules/thaw/thaw.service.js';

const DEMO_PATIENTS = [
  { name: 'Eleanor Vance', partner: 'Thomas Vance', phone: '+91 98201 12345', comments: 'High egg yield. Grade A embryos.' },
  { name: 'Priya Sharma', partner: 'Rohan Sharma', phone: '+91 98210 23456', comments: 'ICSI procedure completed successfully.' },
  { name: 'Ananya Deshmukh', partner: 'Aditya Deshmukh', phone: '+91 98220 34567', comments: 'Donor egg cycle. Excellent blastocyst formation.' },
  { name: 'Sneha Patel', partner: 'Vikram Patel', phone: '+91 98230 45678', comments: 'Blastocyst Stage D5 freezing.' },
  { name: 'Meera Iyer', partner: 'Karthik Iyer', phone: '+91 98240 56789', comments: 'FET planned for next quarter.' },
  { name: 'Fatima Khan', partner: 'Tariq Khan', phone: '+91 98250 67890', comments: 'Twin embryo freezing batch.' },
  { name: 'Sunita Verma', partner: 'Deepak Verma', phone: '+91 98260 78901', comments: 'Grade 4AA embryos stored in Can 01.' },
  { name: 'Pooja Reddi', partner: 'Srinivas Reddi', phone: '+91 98270 89012', comments: 'PGT-A tested euploid embryos.' },
  { name: 'Kavita Joshi', partner: 'Amit Joshi', phone: '+91 98280 90123', comments: 'Second freezing cycle. 4 embryos frozen.' },
  { name: 'Ritu Sen', partner: 'Arindam Sen', phone: '+91 98290 01234', comments: 'High quality Grade 5AA blastocysts.' },
  { name: 'Ayesha Siddiqui', partner: 'Zaid Siddiqui', phone: '+91 98190 11223', comments: 'Single embryo transfer scheduled.' },
  { name: 'Lakshmi Nair', partner: 'Suresh Nair', phone: '+91 98180 22334', comments: 'Good quality day 3 cleavage embryos.' },
  { name: 'Deepika Padukone', partner: 'Ranveer Singh', phone: '+91 98170 33445', comments: 'Vitrified on 2026-08-10.' },
  { name: 'Alia Bhatt', partner: 'Ranbir Kapoor', phone: '+91 98160 44556', comments: 'Cryopreserved with Pink & Blue tags.' },
  { name: 'Kritika Roy', partner: 'Debashish Roy', phone: '+91 98150 55667', comments: 'Morphology evaluation score 9/10.' },
  { name: 'Sonali Kulkarni', partner: 'Makarand Kulkarni', phone: '+91 98140 66778', comments: 'Stored in Viso Tube 02 Level 1.' },
  { name: 'Shruti Gupta', partner: 'Manish Gupta', phone: '+91 98130 77889', comments: 'Max 2 embryos per straw strict compliance.' },
  { name: 'Tanya Malhotra', partner: 'Gaurav Malhotra', phone: '+91 98120 88990', comments: 'First IVF attempt. 3 embryos frozen.' },
  { name: 'Divya Agarwal', partner: 'Nikhil Agarwal', phone: '+91 98110 99001', comments: 'Donor sperm cycle. Grade 3AB.' },
  { name: 'Bhakti Mehta', partner: 'Chirag Mehta', phone: '+91 98100 10102', comments: 'Frozen under Dr. Sarah supervision.' },
  { name: 'Geeta Rao', partner: 'Venkatesh Rao', phone: '+91 98090 20203', comments: 'Viso Tube assigned in Can 02.' },
  { name: 'Nisha Bhasin', partner: 'Varun Bhasin', phone: '+91 98080 30304', comments: 'Vitrification complete.' },
  { name: 'Radhika Merchant', partner: 'Anant Ambani', phone: '+91 98070 40405', comments: 'Premium storage tracking enabled.' },
  { name: 'Suki Waterhouse', partner: 'Robert Pattinson', phone: '+91 98060 50506', comments: 'Cryo straw registered.' },
  { name: 'Clara Oswald', partner: 'Danny Pink', phone: '+91 98050 60607', comments: 'Viso Tube 04 occupied.' },
  { name: 'Sarah Connor', partner: 'Kyle Reese', phone: '+91 98040 70708', comments: 'Day 5 Blastocysts.' },
  { name: 'Elena Gilbert', partner: 'Damon Salvatore', phone: '+91 98030 80809', comments: 'Grade A Vitrified.' },
  { name: 'Hermione Granger', partner: 'Ron Weasley', phone: '+91 98020 90910', comments: 'Stored in Can 03.' },
  { name: 'Padma Patil', partner: 'Dean Thomas', phone: '+91 98010 01011', comments: '2 Embryos per straw.' },
  { name: 'Parvati Patil', partner: 'Seamus Finnigan', phone: '+91 98000 11112', comments: 'Cryo tag Green.' },
  { name: 'Cho Chang', partner: 'Harry Potter', phone: '+91 97990 22223', comments: 'Grade B Blastocysts.' },
  { name: 'Ginny Weasley', partner: 'Harry Potter', phone: '+91 97980 33334', comments: 'Stored in Can 04.' },
  { name: 'Luna Lovegood', partner: 'Rolf Scamander', phone: '+91 97970 44445', comments: 'Day 6 Blastocyst.' },
  { name: 'Fleur Delacour', partner: 'Bill Weasley', phone: '+91 97960 55556', comments: 'Grade 5AA Euploid.' },
  { name: 'Nymphadora Tonks', partner: 'Remus Lupin', phone: '+91 97950 66667', comments: 'Vitrified on 2026-08-18.' },
  { name: 'Molly Weasley', partner: 'Arthur Weasley', phone: '+91 97940 77778', comments: 'Viso Tube 06 assigned.' },
  { name: 'Minerva McGonagall', partner: 'Elphinstone Urquat', phone: '+91 97930 88889', comments: 'Stored in Can 05.' },
  { name: 'Sybill Trelawney', partner: 'John Doe', phone: '+91 97920 99990', comments: 'Day 3 embryos.' },
  { name: 'Pomona Sprout', partner: 'Jane Doe', phone: '+91 97910 10001', comments: 'Stored in Can 08.' },
  { name: 'Rolanda Hooch', partner: 'Richard Roe', phone: '+91 97900 20002', comments: 'Vitrification complete.' },
  { name: 'Irina Shayk', partner: 'Bradley Cooper', phone: '+91 97890 30003', comments: 'Grade 4BB Embryos.' },
  { name: 'Gisele Bündchen', partner: 'Tom Brady', phone: '+91 97880 40004', comments: 'Stored in Can 10.' },
  { name: 'Adriana Lima', partner: 'Marko Jarić', phone: '+91 97870 50005', comments: 'Vitrified in Can 14.' },
  { name: 'Alessandra Ambrosio', partner: 'Jamie Mazur', phone: '+91 97860 60006', comments: 'Grade A Blastocysts.' },
  { name: 'Miranda Kerr', partner: 'Evan Spiegel', phone: '+91 97850 70007', comments: 'Day 5 embryo freezing.' },
  { name: 'Candice Swanepoel', partner: 'Hermann Nicoli', phone: '+91 97840 80808', comments: 'Pink straw color tag.' },
  { name: 'Behati Prinsloo', partner: 'Adam Levine', phone: '+91 97830 90909', comments: 'Blue straw color tag.' },
  { name: 'Lily Aldridge', partner: 'Caleb Followill', phone: '+91 97820 01010', comments: 'Stored in Viso Tube 08.' },
  { name: 'Karlie Kloss', partner: 'Joshua Kushner', phone: '+91 97810 12121', comments: 'Vitrified on 2026-08-21.' },
  { name: 'Taylor Swift', partner: 'Travis Kelce', phone: '+91 97800 23232', comments: 'Grade 5AA Vitrified. High yield.' },
];

async function seed() {
  console.log('[Seed Script] Seeding database...');

  // 1. Storage hierarchy
  await storageService.seedHierarchyIfNeeded();

  // 2. Admin & Staff accounts
  let admin = await prisma.user.findUnique({ where: { staffId: 'ADMIN001' } });
  if (!admin) {
    const adminHash = await argon2.hash('AdminPassword123!', { type: argon2.argon2id });
    admin = await prisma.user.create({
      data: {
        staffId: 'ADMIN001',
        email: 'admin@ivfclinic.com',
        name: 'Dr. Sarah Jenkins (Admin)',
        passwordHash: adminHash,
        role: 'ADMIN',
      },
    });
  }

  let staff = await prisma.user.findUnique({ where: { staffId: 'STAFF001' } });
  if (!staff) {
    const staffHash = await argon2.hash('StaffPassword123!', { type: argon2.argon2id });
    staff = await prisma.user.create({
      data: {
        staffId: 'STAFF001',
        email: 'staff@ivfclinic.com',
        name: 'Alex Vance (Embryologist)',
        passwordHash: staffHash,
        role: 'STAFF',
      },
    });
  }

  const staffUserId = admin.id;
  const staffName = admin.name;

  // 3. Seed 50 Demo Patients
  const currentCount = await prisma.patient.count();
  console.log(`[Seed Script] Current patient count in DB: ${currentCount}`);

  const colors = ['Pink', 'Green', 'Blue', 'Red', 'Rust', 'Skyblue', 'Purple', 'Yellow', 'Black', 'Grey'];

  let seededCount = 0;
  for (let i = 0; i < DEMO_PATIENTS.length; i++) {
    const demo = DEMO_PATIENTS[i];
    const targetPatientId = `IVF-2026-${(i + 1).toString().padStart(6, '0')}`;

    const existing = await prisma.patient.findUnique({ where: { patientId: targetPatientId } });
    if (existing) continue;

    const freezingDaysAgo = Math.floor(Math.random() * 30);
    const freezingDate = new Date();
    freezingDate.setDate(freezingDate.getDate() - freezingDaysAgo);

    const patient = await prisma.patient.create({
      data: {
        patientId: targetPatientId,
        fullName: demo.name,
        partnerName: demo.partner,
        phone: demo.phone,
        visitDate: new Date('2026-08-01'),
        freezingDate,
        comments: demo.comments,
      },
    });

    seededCount++;

    // Assign Cryo Physical Storage
    try {
      const embryoCount = (i % 3) + 1; // 1, 2, or 3 embryos
      const requiredStraws = Math.ceil(embryoCount / 2);
      const rec = await storageService.findAvailableStorage(patient.id, freezingDate.toISOString().split('T')[0], embryoCount);

      if (rec.success && rec.primaryRecommendation) {
        const strawColors = Array.from({ length: requiredStraws }, (_, idx) => colors[(i + idx) % colors.length]);

        const assignRes = await storageService.assignStorage({
          patientId: patient.id,
          storageDate: freezingDate.toISOString().split('T')[0],
          embryoCount,
          visoTubeId: rec.primaryRecommendation.visoTubeId,
          strawColors,
          notes: `Seeded demo batch for ${patient.fullName}`,
        }, staffUserId, staffName);

        // Perform 5 thaw operations to populate Thaw records & audit trail
        if (i % 10 === 0 && assignRes.straws && assignRes.straws.length > 0) {
          await thawService.thawStraws({
            strawIds: [assignRes.straws[0].id],
            doctorId: staffUserId,
            doctorName: staffName,
            doctorNotes: `Seeded thaw operation for ${patient.fullName}`,
          });
        }
      }
    } catch (err: any) {
      console.error(`[Seed Warning] Storage allocation skipped for ${targetPatientId}:`, err.message);
    }
  }

  const finalCount = await prisma.patient.count();
  console.log(`[Seed Script] Successfully populated database! Total Patients in Database: ${finalCount} (${seededCount} newly added)`);
}

seed()
  .catch(err => {
    console.error('[Seed Error]', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
