import { prisma } from '../../common/prisma.js';

export interface CreatePatientInput {
  patientId?: string;
  fullName: string;
  partnerName?: string;
  phone?: string;
  dob?: string;
  visitDate?: Date | string;
  deDate?: Date | string;
  freezingDate?: Date | string;
  thawDate?: Date | string;
  comments?: string;
}

export class PatientService {
  // Generate unique Patient ID: IVF-2026-000001
  async generateNextPatientId(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `IVF-${year}-`;

    const lastPatient = await prisma.patient.findFirst({
      where: {
        patientId: { startsWith: prefix },
      },
      orderBy: { patientId: 'desc' },
    });

    let nextNumber = 1;
    if (lastPatient) {
      const parts = lastPatient.patientId.split('-');
      if (parts.length === 3) {
        const lastNum = parseInt(parts[2], 10);
        if (!isNaN(lastNum)) {
          nextNumber = lastNum + 1;
        }
      }
    }

    return `${prefix}${nextNumber.toString().padStart(6, '0')}`;
  }

  async createPatient(input: CreatePatientInput, staffUserId: string, staffName: string) {
    let patientId = input.patientId && input.patientId.trim() ? input.patientId.trim() : '';

    if (patientId) {
      const existing = await prisma.patient.findUnique({ where: { patientId } });
      if (existing) {
        throw new Error(`Patient Registration No / ID "${patientId}" already exists in system. Please enter a unique ID or search existing records.`);
      }
    } else {
      patientId = await this.generateNextPatientId();
    }

    const patient = await prisma.patient.create({
      data: {
        patientId,
        fullName: input.fullName.trim(),
        partnerName: input.partnerName ? input.partnerName.trim() : null,
        phone: input.phone ? input.phone.trim() : null,
        dob: input.dob ? input.dob.trim() : null,
        visitDate: input.visitDate ? new Date(input.visitDate) : null,
        deDate: input.deDate ? new Date(input.deDate) : null,
        freezingDate: input.freezingDate ? new Date(input.freezingDate) : null,
        thawDate: input.thawDate ? new Date(input.thawDate) : null,
        comments: input.comments ? input.comments.trim() : null,
      },
    });

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
    return prisma.patient.findUnique({
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
        thawRecords: { orderBy: { thawDate: 'desc' } },
      },
    });
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
        { patientId: { contains: trimmedQuery } },
        { fullName: { contains: trimmedQuery } },
        { partnerName: { contains: trimmedQuery } },
        { phone: { contains: trimmedQuery } },
        { comments: { contains: trimmedQuery } },
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
        include: {
          batches: {
            orderBy: { storageDate: 'desc' },
            include: {
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

  async seed50DemoPatientsIfNeeded() {
    const count = await prisma.patient.count();
    if (count >= 50) return;

    console.log(`[Seed] Current patient count is ${count}. Seeding 50 demo patient records with physical storage allocations...`);

    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    const staffId = admin ? admin.id : 'ADMIN001';
    const staffName = admin ? admin.name : 'Dr. Sarah Jenkins';

    const colors = ['Pink', 'Green', 'Blue', 'Red', 'Rust', 'Skyblue', 'Purple', 'Yellow', 'Black', 'Grey'];

    for (let i = count + 1; i <= 50; i++) {
      const demo = DEMO_PATIENTS[(i - 1) % DEMO_PATIENTS.length];
      const patientId = `IVF-2026-${i.toString().padStart(6, '0')}`;

      // Check if patient already exists
      const existing = await prisma.patient.findUnique({ where: { patientId } });
      if (existing) continue;

      const freezingDaysAgo = Math.floor(Math.random() * 30);
      const freezingDate = new Date();
      freezingDate.setDate(freezingDate.getDate() - freezingDaysAgo);

      const patient = await prisma.patient.create({
        data: {
          patientId,
          fullName: demo.name,
          partnerName: demo.partner,
          phone: demo.phone,
          visitDate: new Date('2026-08-01'),
          freezingDate,
          comments: demo.comments,
        },
      });

      // Allocate Cryo Storage Slot
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
            notes: `Auto-allocated demo batch for ${patient.fullName}`,
          }, staffId, staffName);

          // For 5 patients, trigger a thaw execution to test thaw records
          if (i % 10 === 0 && assignRes.straws && assignRes.straws.length > 0) {
            await thawService.thawStraws({
              strawIds: [assignRes.straws[0].id],
              doctorId: staffId,
              doctorName: staffName,
              doctorNotes: `Routine thaw test for ${patient.fullName}`,
            });
          }
        }
      } catch (err: any) {
        console.error(`[Seed Warning] Failed storage allocation for ${patient.patientId}:`, err.message);
      }
    }

    console.log('[Seed] Successfully seeded 50 demo patients with cryo storage layout and thaw records.');
  }
}

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

export const patientService = new PatientService();
