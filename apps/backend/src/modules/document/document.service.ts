import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { prisma } from '../../common/prisma.js';
import { CONFIG } from '../../common/config.js';

export type ReportType = 'AUTO' | 'OOCYTE' | 'DAY3' | 'DAY5' | 'GENERAL' | 'THAW';

function formatDateDots(d: string | Date | null | undefined): string {
  if (!d) return 'N/A';
  const date = new Date(d);
  if (isNaN(date.getTime())) return 'N/A';
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = String(date.getFullYear()).slice(-2);
  return `${day}.${month}.${year}`;
}

function formatDateDDMMYYYY(d: string | Date | null | undefined): string {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatPhoneNumber(phoneStr?: string | null): string {
  if (!phoneStr) return '—';
  const clean = phoneStr.trim();
  if (!clean) return '—';
  return clean.startsWith('+') ? clean : `+${clean}`;
}

function formatAgeWithY(ageStr?: string | number | null): string {
  if (!ageStr) return '';
  const clean = String(ageStr).replace(/\s*yrs?/gi, '').trim();
  return clean ? `${clean} Yrs` : '';
}

export class DocumentService {
  async generatePatientPdf(patientId: string, reportType: ReportType = 'AUTO'): Promise<Buffer> {
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        notes: { orderBy: { createdAt: 'desc' } },
        batches: {
          include: {
            visoTube: true,
            straws: { include: { embryos: true } },
          },
        },
        thawRecords: { orderBy: { thawDate: 'desc' } },
      },
    });

    if (!patient) {
      throw new Error('Patient not found.');
    }

    // Auto-detect stage from patient batches if AUTO or unspecified
    let activeReportType: ReportType = reportType;
    if (activeReportType === 'AUTO' || !activeReportType) {
      if (patient.thawRecords && patient.thawRecords.length > 0) {
        activeReportType = 'THAW';
      } else {
        activeReportType = patient.specimenType === 'OOCYTE' ? 'OOCYTE' : 'DAY5'; // Default fallback based on specimenType
        for (const b of patient.batches) {
          const stage = (b.embryoStage || '').toUpperCase();
          if (stage.includes('DAY 5') || stage.includes('DAY 6') || stage.includes('DAY5') || stage.includes('DAY6') || stage.includes('BLAST')) {
            activeReportType = 'DAY5';
            break;
          } else if (stage.includes('DAY 3') || stage.includes('DAY3') || stage.includes('DAY 2') || stage.includes('DAY2') || stage.includes('CLEAVAGE')) {
            activeReportType = 'DAY3';
            break;
          } else if (stage.includes('DAY 0') || stage.includes('DAY0') || stage.includes('OOCYTE') || stage.includes('EGG') || stage.includes('MII')) {
            activeReportType = 'OOCYTE';
          }
        }
      }
    }

    const isThaw = activeReportType === 'THAW';
    const isOocyteDoc = patient.specimenType === 'OOCYTE';

    return new Promise(async (resolve, reject) => {
      // Full A4 page (595 x 842 points) with 30pt margin & buffered pages for perfect multi-page layout
      const doc = new PDFDocument({ margin: 30, size: 'A4', bufferPages: true });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
      doc.on('error', reject);

      // ==========================================
      // 0. REPORT GRAPHICS BACKGROUND IMAGE
      // ==========================================
      const potentialBgPaths = [
        path.join(process.cwd(), 'assets/reportgraphics.jpg'),
        path.join(process.cwd(), 'assets/reportgraphics.png'),
        path.join(process.cwd(), '../frontend/public/reportgraphics.jpg'),
        path.join(process.cwd(), '../frontend/public/reportgraphics.png'),
        '/var/www/ivf/apps/backend/assets/reportgraphics.jpg',
        '/var/www/ivf/apps/backend/assets/reportgraphics.png',
        '/var/www/ivf/apps/frontend/public/reportgraphics.jpg',
      ];

      let foundBgPath: string | null = null;
      for (const p of potentialBgPaths) {
        if (fs.existsSync(p)) {
          foundBgPath = p;
          break;
        }
      }

      const drawBg = () => {
        if (foundBgPath) {
          try {
            doc.save();
            doc.opacity(0.14);
            doc.image(foundBgPath, 0, 0, { width: 595.28, height: 841.89 });
            doc.restore();
          } catch (err) {
            console.error('Error embedding report background graphic:', err);
          }
        }
      };

      // Draw background on Page 1 & auto-draw on subsequent pages
      drawBg();
      doc.on('pageAdded', drawBg);

      // ==========================================
      // 1. HOSPITAL BRANDING HEADER
      // ==========================================
      const potentialLogoPaths = [
        path.join(process.cwd(), 'assets/logo.png'),
        path.join(process.cwd(), '../frontend/public/images.png'),
        '/var/www/ivf/apps/backend/assets/logo.png',
        '/var/www/ivf/apps/frontend/public/images.png',
        '/var/www/ivf/apps/frontend/public/images/logo.png',
      ];

      let foundLogoPath: string | null = null;
      for (const p of potentialLogoPaths) {
        if (fs.existsSync(p)) {
          foundLogoPath = p;
          break;
        }
      }

      if (foundLogoPath) {
        try {
          doc.image(foundLogoPath, 30, 14, { fit: [48, 48] });
        } catch (err) {
          console.error('Error embedding hospital logo in PDF:', err);
        }
      }

      // Center Hospital Title - RED COLOR
      doc
        .fillColor('#dc2626')
        .fontSize(15)
        .font('Helvetica-Bold')
        .text('Center of IVF and Human Reproduction', 30, 14, { align: 'center' });

      doc
        .fillColor('#b45309')
        .fontSize(10.5)
        .font('Helvetica-Bold')
        .text('Sir Ganga Ram Hospital, New Delhi', 30, 34, { align: 'center' });

      // Title Badge Element
      const summaryBadgeY = 56;
      const badgeTitleText = isThaw
        ? 'THAWING & EMBRYO RECOVERY REPORT'
        : 'CRYO-PRESERVATION SUMMARY REPORT';

      const badgeBg = isThaw ? '#fef2f2' : '#f0fdf4';
      const badgeBorder = isThaw ? '#dc2626' : '#047857';
      const badgeText = isThaw ? '#dc2626' : '#047857';

      doc.roundedRect(130, summaryBadgeY, 335, 22, 4).lineWidth(1).fillAndStroke(badgeBg, badgeBorder);

      doc
        .fillColor(badgeText)
        .fontSize(10)
        .font('Helvetica-Bold')
        .text(badgeTitleText, 130, summaryBadgeY + 5, { width: 335, align: 'center' });

      // ==========================================
      // 2. PATIENT HEADER BANNER & BADGES (MATCHING DRAWER POPUP HEADER)
      // ==========================================
      const headerBannerY = 86;
      
      // Parse photos for top header right side
      const parsePhotoBuffer = async (urlStr?: string | null): Promise<Buffer | null> => {
        if (!urlStr) return null;
        try {
          if (urlStr.startsWith('data:image/')) {
            return Buffer.from(urlStr.split(',')[1], 'base64');
          }
          const basename = path.basename(urlStr);
          const checkPaths = [
            path.join(path.resolve(CONFIG.STORAGE_LOCAL_DIR), basename),
            path.join(process.cwd(), 'uploads', basename),
            `/var/www/ivf/uploads/${basename}`,
          ];
          for (const p of checkPaths) {
            if (fs.existsSync(p)) {
              return fs.readFileSync(p);
            }
          }
        } catch {
          return null;
        }
        return null;
      };

      const wifePhotoRaw = await parsePhotoBuffer(patient.photoUrl);
      const husbandPhotoRaw = await parsePhotoBuffer((patient as any).partnerPhotoUrl);

      // Patient ID & Full Name
      doc.fillColor('#047857').fontSize(9).font('Helvetica-Bold').text(patient.patientId || 'N/A', 30, headerBannerY);
      doc.fillColor('#0f172a').fontSize(14).font('Helvetica-Bold').text(patient.fullName || 'N/A', 30, headerBannerY + 12);

      // Photos layout top right
      const pWidth = 42;
      const pHeight = 50;
      const pY = headerBannerY - 2;

      if (wifePhotoRaw && husbandPhotoRaw) {
        try {
          const wJpeg = await sharp(wifePhotoRaw).resize(160, 200, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer();
          doc.rect(438, pY, pWidth, pHeight).lineWidth(1).stroke('#047857');
          doc.image(wJpeg, 439, pY + 1, { fit: [pWidth - 2, pHeight - 2], align: 'center', valign: 'center' });
          doc.fillColor('#047857').fontSize(6.5).font('Helvetica-Bold').text('WIFE', 438, pY - 8, { width: pWidth, align: 'center' });
        } catch (err) {}

        try {
          const hJpeg = await sharp(husbandPhotoRaw).resize(160, 200, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer();
          doc.rect(494, pY, pWidth, pHeight).lineWidth(1).stroke('#0284c7');
          doc.image(hJpeg, 495, pY + 1, { fit: [pWidth - 2, pHeight - 2], align: 'center', valign: 'center' });
          doc.fillColor('#0284c7').fontSize(6.5).font('Helvetica-Bold').text('HUSBAND', 494, pY - 8, { width: pWidth, align: 'center' });
        } catch (err) {}
      } else if (wifePhotoRaw) {
        try {
          const wJpeg = await sharp(wifePhotoRaw).resize(160, 200, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer();
          doc.rect(494, pY, pWidth, pHeight).lineWidth(1).stroke('#047857');
          doc.image(wJpeg, 495, pY + 1, { fit: [pWidth - 2, pHeight - 2], align: 'center', valign: 'center' });
          doc.fillColor('#047857').fontSize(6.5).font('Helvetica-Bold').text('PATIENT', 494, pY - 8, { width: pWidth, align: 'center' });
        } catch (err) {}
      } else if (husbandPhotoRaw) {
        try {
          const hJpeg = await sharp(husbandPhotoRaw).resize(160, 200, { fit: 'cover' }).jpeg({ quality: 90 }).toBuffer();
          doc.rect(494, pY, pWidth, pHeight).lineWidth(1).stroke('#0284c7');
          doc.image(hJpeg, 495, pY + 1, { fit: [pWidth - 2, pHeight - 2], align: 'center', valign: 'center' });
          doc.fillColor('#0284c7').fontSize(6.5).font('Helvetica-Bold').text('HUSBAND', 494, pY - 8, { width: pWidth, align: 'center' });
        } catch (err) {}
      }

      // Badges Row under Name
      const badgesY = headerBannerY + 31;
      let badgeX = 30;

      // Helper to draw pill badges
      const drawPillBadge = (text: string, bg: string, border: string, textColor: string) => {
        const tw = doc.fontSize(7.5).font('Helvetica-Bold').widthOfString(text);
        const bw = tw + 10;
        doc.roundedRect(badgeX, badgesY, bw, 15, 3.5).lineWidth(0.5).fillAndStroke(bg, border);
        doc.fillColor(textColor).fontSize(7.5).font('Helvetica-Bold').text(text, badgeX, badgesY + 3.5, { width: bw, align: 'center' });
        badgeX += bw + 5;
      };

      const aspDateStr = formatDateDDMMYYYY(patient.aspirationDate || patient.batches?.[0]?.aspirationDate || patient.freezingDate);

      // 1. Specimen Type Badge
      const specLabel = isOocyteDoc ? 'Egg (Oocyte)' : patient.specimenType === 'SPERM' ? 'Sperm' : 'Embryo';
      drawPillBadge(specLabel, '#d1fae5', '#10b981', '#065f46');

      // 2. Cycle Classification Badge
      if (patient.cycleType === 'DONOR_RECIPIENT' || patient.donorName || (patient as any).donorRegNo) {
        const dName = patient.donorName || 'N/A';
        const dAge = (patient as any).donorAge ? ` (${formatAgeWithY((patient as any).donorAge)})` : '';
        drawPillBadge(`Donor: ${dName}${dAge}`, '#f3e8ff', '#a855f7', '#6b21a8');
      } else {
        drawPillBadge('Self Cycle (Autologous)', '#dbeafe', '#3b82f6', '#1e40af');
      }

      // 3. Oocyte Stage Badge (if Oocyte)
      if (isOocyteDoc) {
        const allEmbryos = patient.batches?.flatMap((b: any) => b.straws?.flatMap((s: any) => s.embryos || []) || []) || [];
        let oocyteStageText = (patient as any).oocyteStage || 'MII';
        if (allEmbryos.length > 0) {
          const sortedStages = allEmbryos
            .sort((a: any, b: any) => a.embryoNumber - b.embryoNumber)
            .map((emb: any) => (emb.grade || 'MII').trim().toUpperCase())
            .filter(Boolean);
          const uniqueStages: string[] = [];
          sortedStages.forEach((stg: string) => {
            if (!uniqueStages.includes(stg)) uniqueStages.push(stg);
          });
          if (uniqueStages.length > 0) oocyteStageText = uniqueStages.join(', ');
        }
        drawPillBadge(`Oocyte Stage: ${oocyteStageText}`, '#e0e7ff', '#6366f1', '#3730a3');
      }

      // Egg pickup dates string across all batches
      const allAspirationDatesStr = (() => {
        const dates: { time: number; str: string }[] = [];
        if (patient.batches && patient.batches.length > 0) {
          patient.batches.forEach((b: any) => {
            const d = b.aspirationDate;
            if (d) {
              const dt = new Date(d);
              if (!isNaN(dt.getTime())) {
                dates.push({ time: dt.getTime(), str: formatDateDDMMYYYY(d) });
              }
            }
          });
        }
        if (dates.length === 0 && patient.aspirationDate) {
          const dt = new Date(patient.aspirationDate);
          if (!isNaN(dt.getTime())) {
            dates.push({ time: dt.getTime(), str: formatDateDDMMYYYY(patient.aspirationDate) });
          }
        }
        dates.sort((a, b) => a.time - b.time);
        const unique: string[] = [];
        dates.forEach((item) => {
          if (!unique.includes(item.str)) unique.push(item.str);
        });
        return unique.length > 0 ? unique.join(', ') : 'N/A';
      })();

      // Freezing dates string across all batches
      const allFreezingDatesStr = (() => {
        const dates: { time: number; str: string }[] = [];
        if (patient.batches && patient.batches.length > 0) {
          patient.batches.forEach((b: any) => {
            const d = b.freezingDate || b.storageDate;
            if (d) {
              const dt = new Date(d);
              if (!isNaN(dt.getTime())) {
                dates.push({ time: dt.getTime(), str: formatDateDDMMYYYY(d) });
              }
            }
          });
        }
        if (dates.length === 0 && patient.freezingDate) {
          const dt = new Date(patient.freezingDate);
          if (!isNaN(dt.getTime())) {
            dates.push({ time: dt.getTime(), str: formatDateDDMMYYYY(patient.freezingDate) });
          }
        }
        dates.sort((a, b) => a.time - b.time);
        const unique: string[] = [];
        dates.forEach((item) => {
          if (!unique.includes(item.str)) unique.push(item.str);
        });
        return unique.length > 0 ? unique.join(', ') : 'N/A';
      })();

      // ==========================================
      // 3. PATIENT & PARTNER PROFILE CARDS (SIDE-BY-SIDE MATCHING POPUP)
      // ==========================================
      const profilesY = 138;
      const profW = 262;
      const profH = 82;

      // Female DOB & Age
      const femaleAge = patient.patientAge ? formatAgeWithY(patient.patientAge) : '';
      const femaleDob = patient.dob ? formatDateDDMMYYYY(patient.dob) : '';
      const femaleDobAge = femaleDob ? (femaleAge ? `${femaleDob} (${femaleAge})` : femaleDob) : (femaleAge || 'N/A');

      // Male DOB & Age
      const maleAge = (patient as any).partnerAge ? formatAgeWithY((patient as any).partnerAge) : '';
      const maleDob = (patient as any).partnerDob ? formatDateDDMMYYYY((patient as any).partnerDob) : '';
      const maleDobAge = maleDob ? (maleAge ? `${maleDob} (${maleAge})` : maleDob) : (maleAge || 'N/A');

      // --- FEMALE PATIENT PROFILE CARD ---
      doc.roundedRect(30, profilesY, profW, profH, 6).lineWidth(0.75).fillAndStroke('#ffffff', '#cbd5e1');
      // Top header bar strip
      doc.roundedRect(30, profilesY, profW, 18, 5).fill('#f0fdf4');
      doc.rect(30, profilesY + 12, profW, 6).fill('#f0fdf4');
      doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(30, profilesY + 18).lineTo(30 + profW, profilesY + 18).stroke();

      doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text('Patient Profile (Recipient)', 36, profilesY + 4);
      // Badge Female
      doc.roundedRect(228, profilesY + 3, 58, 12, 3).lineWidth(0.5).fillAndStroke('#d1fae5', '#a7f3d0');
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#065f46').text('Female', 228, profilesY + 4.5, { width: 58, align: 'center' });

      // Row 1: Full Name & DOB
      doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#64748b').text('FULL NAME', 36, profilesY + 23);
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a').text(patient.fullName || 'N/A', 36, profilesY + 32, { width: 120 });

      doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#64748b').text('DATE OF BIRTH & AGE', 156, profilesY + 23);
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#334155').text(femaleDobAge, 156, profilesY + 32, { width: 130 });

      // Divider line inside card
      doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(36, profilesY + 49).lineTo(30 + profW - 6, profilesY + 49).stroke();

      // Row 2: Phone & Email
      doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#64748b').text('MOBILE PHONE', 36, profilesY + 53);
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text(formatPhoneNumber(patient.phone), 36, profilesY + 63, { width: 120 });

      doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#64748b').text('EMAIL ADDRESS', 156, profilesY + 53);
      doc.fontSize(8).font('Helvetica').fillColor('#334155').text(patient.email || '—', 156, profilesY + 63, { width: 130 });

      // --- MALE PARTNER PROFILE CARD ---
      const maleX = 303;
      doc.roundedRect(maleX, profilesY, profW, profH, 6).lineWidth(0.75).fillAndStroke('#ffffff', '#cbd5e1');
      // Top header bar strip
      doc.roundedRect(maleX, profilesY, profW, 18, 5).fill('#eff6ff');
      doc.rect(maleX, profilesY + 12, profW, 6).fill('#eff6ff');
      doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(maleX, profilesY + 18).lineTo(maleX + profW, profilesY + 18).stroke();

      doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text('Partner Profile (Recipient)', maleX + 6, profilesY + 4);
      // Badge Male
      doc.roundedRect(maleX + 198, profilesY + 3, 58, 12, 3).lineWidth(0.5).fillAndStroke('#dbeafe', '#bfdbfe');
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#1e40af').text('Male', maleX + 198, profilesY + 4.5, { width: 58, align: 'center' });

      // Row 1: Partner Name & DOB
      doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#64748b').text('PARTNER NAME', maleX + 6, profilesY + 23);
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a').text((patient as any).partnerName || 'N/A', maleX + 6, profilesY + 32, { width: 120 });

      doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#64748b').text('DATE OF BIRTH & AGE', maleX + 126, profilesY + 23);
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#334155').text(maleDobAge, maleX + 126, profilesY + 32, { width: 130 });

      // Divider line inside card
      doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(maleX + 6, profilesY + 49).lineTo(maleX + profW - 6, profilesY + 49).stroke();

      // Row 2: Phone & Email
      doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#64748b').text('MOBILE PHONE', maleX + 6, profilesY + 53);
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text(formatPhoneNumber((patient as any).partnerPhone), maleX + 6, profilesY + 63, { width: 120 });

      doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#64748b').text('EMAIL ADDRESS', maleX + 126, profilesY + 53);
      doc.fontSize(8).font('Helvetica').fillColor('#334155').text((patient as any).partnerEmail || '—', maleX + 126, profilesY + 63, { width: 130 });

      let currentSectionY = profilesY + profH + 10;

      // Donor Profile Card (if D-R Cycle)
      if (patient.cycleType === 'DONOR_RECIPIENT' || patient.donorName || (patient as any).donorRegNo) {
        const donorH = 38;
        doc.roundedRect(30, currentSectionY, 535, donorH, 6).lineWidth(0.75).fillAndStroke('#fffbeb', '#fde68a');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#92400e').text('Egg / Oocyte Donor Profile (D-R Cycle)', 36, currentSectionY + 5);

        doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#b45309').text('DONOR REG NO.', 36, currentSectionY + 17);
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#78350f').text((patient as any).donorRegNo || 'N/A', 36, currentSectionY + 25, { width: 110 });

        doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#b45309').text('DONOR FULL NAME', 156, currentSectionY + 17);
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#78350f').text(patient.donorName || 'N/A', 156, currentSectionY + 25, { width: 140 });

        doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#b45309').text('DONOR AGE', 306, currentSectionY + 17);
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#78350f').text((patient as any).donorAge ? formatAgeWithY((patient as any).donorAge) : 'N/A', 306, currentSectionY + 25, { width: 90 });

        doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#b45309').text('DONOR PHONE', 406, currentSectionY + 17);
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#78350f').text(formatPhoneNumber((patient as any).donorPhone), 406, currentSectionY + 25, { width: 115 });

        currentSectionY += donorH + 10;
      }

      // ==========================================
      // 4. CLINICAL & STORAGE QUICK BAR (4 GRID CARDS NOW UNDER PATIENT DETAILS)
      // ==========================================
      const quickBarY = currentSectionY;
      const cardW = 128.5;
      const cardH = 34;

      // Quick Card 1: Registration ID (Emerald)
      doc.roundedRect(30, quickBarY, cardW, cardH, 5).lineWidth(0.75).fillAndStroke('#ecfdf5', '#a7f3d0');
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#065f46').text('REGISTRATION ID', 36, quickBarY + 6);
      doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0f172a').text(patient.patientId || 'N/A', 36, quickBarY + 17, { width: cardW - 12, lineBreak: false });

      // Quick Card 2: Egg Pick Up Date (Amber)
      doc.roundedRect(165.6, quickBarY, cardW, cardH, 5).lineWidth(0.75).fillAndStroke('#fffbeb', '#fde68a');
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#92400e').text('EGG PICK UP DATE', 171.6, quickBarY + 6);
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#78350f').text(allAspirationDatesStr, 171.6, quickBarY + 17, { width: cardW - 12, lineBreak: false });

      // Quick Card 3: Freezing Date(s) (Blue)
      doc.roundedRect(301.2, quickBarY, cardW, cardH, 5).lineWidth(0.75).fillAndStroke('#eff6ff', '#bfdbfe');
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#1e40af').text('FREEZING DATE(S)', 307.2, quickBarY + 6);
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#1e3a8a').text(allFreezingDatesStr, 307.2, quickBarY + 17, { width: cardW - 12, lineBreak: false });

      // Quick Card 4: Attending Doctor (Slate)
      doc.roundedRect(436.8, quickBarY, cardW, cardH, 5).lineWidth(0.75).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#475569').text('ATTENDING DOCTOR', 442.8, quickBarY + 6);
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a').text(patient.doctorName || 'N/A', 442.8, quickBarY + 17, { width: cardW - 12, lineBreak: false });

      currentSectionY = quickBarY + cardH + 10;

      // Clinical Comments / Doctor Remarks Card
      if (patient.comments && patient.comments.trim().length > 0) {
        const commentText = patient.comments.trim();
        const textH = doc.fontSize(8).font('Helvetica').heightOfString(commentText, { width: 515 });
        const boxH = Math.max( textH + 20, 34 );

        doc.roundedRect(30, currentSectionY, 535, boxH, 6).lineWidth(0.75).fillAndStroke('#fffbeb', '#fde68a');
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#92400e').text('CLINICAL COMMENTS & DOCTOR REMARKS:', 36, currentSectionY + 6);
        doc.fontSize(8).font('Helvetica').fillColor('#78350f').text(commentText, 36, currentSectionY + 17, { width: 515 });

        currentSectionY += boxH + 10;
      }

      // Helper function for multi-page layout flow
      const ensureSpace = (neededHeight: number) => {
        if (currentSectionY + neededHeight > 745) {
          doc.addPage();
          currentSectionY = 34;
          doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#065f46')
            .text(`SRGH IVF CRYO BANK  |  Patient: ${patient.fullName} (${patient.patientId})`, 30, currentSectionY);
          currentSectionY += 14;
          doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(30, currentSectionY).lineTo(565, currentSectionY).stroke();
          currentSectionY += 12;
        }
      };

      // ==========================================
      // 5. ACTIVE CRYO STORAGE SPECIMEN BATCHES & STRAW CARDS
      // ==========================================
      const batchesToRender: any[] = patient.batches || [];

      if (batchesToRender.length > 0) {
        ensureSpace(30);
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text(`Active Cryo Storage Specimen Straws`, 30, currentSectionY);
        currentSectionY += 16;

        batchesToRender.forEach((batch: any) => {
          const batchStraws = (batch.straws || []).filter((s: any) => s.status === 'OCCUPIED' || isThaw);
          const strawsToDisplay = batchStraws.length > 0 ? batchStraws : (batch.straws || []);

          const batchFreezingDateStr = formatDateDDMMYYYY(batch.freezingDate || batch.storageDate || patient.freezingDate);
          const rawStage = batch.embryoStage || (isOocyteDoc ? 'MII' : 'day5');
          const formattedStage = isOocyteDoc ? rawStage : (rawStage.toLowerCase().startsWith('day') ? rawStage.toLowerCase() : `day${rawStage}`);

          let batchHeaderParts = [];
          batchHeaderParts.push(`Frozen: ${batchFreezingDateStr}`);
          batchHeaderParts.push(`Stage: ${formattedStage}`);
          const batchHeaderLine = batchHeaderParts.join('  |  ');

          // Render Straw Rows inside Batch as self-contained boxes
          strawsToDisplay.forEach((straw: any, sIdx: number) => {
            ensureSpace(36);

            const strawBoxY = currentSectionY;
            const embryoCount = straw.embryoCount || (straw.embryos ? straw.embryos.length : 1);
            const strawLabel = (straw.strawId || `#${sIdx + 1}`).replace(/^Straw\s*/i, '').split(' (')[0];
            const displayLabel = strawLabel.startsWith('#') ? strawLabel : `Straw #${sIdx + 1}`;

            const strawColor = straw.color || 'Pink';
            let colorBg = '#fce7f3';
            let colorBorder = '#db2777';
            let colorText = '#831843';
            if (strawColor.toLowerCase() === 'green') {
              colorBg = '#dcfce7'; colorBorder = '#16a34a'; colorText = '#14532d';
            } else if (strawColor.toLowerCase() === 'blue') {
              colorBg = '#dbeafe'; colorBorder = '#2563eb'; colorText = '#1e3a8a';
            } else if (strawColor.toLowerCase() === 'yellow') {
              colorBg = '#fef9c3'; colorBorder = '#ca8a04'; colorText = '#713f12';
            } else if (strawColor.toLowerCase() === 'white') {
              colorBg = '#f1f5f9'; colorBorder = '#64748b'; colorText = '#0f172a';
            }

            // Outer unified card box per straw (Height: 33pt)
            doc.roundedRect(30, strawBoxY, 535, 33, 5).lineWidth(0.75).fillAndStroke('#ffffff', '#cbd5e1');
            doc.roundedRect(30, strawBoxY, 4, 33, 2).fill('#047857');

            // Line 1 inside box: Batch metadata header strip (Egg Retrieval | Frozen | Stage)
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#475569').text(batchHeaderLine, 40, strawBoxY + 4);

            // Divider line between batch dates and straw details
            doc.strokeColor('#f1f5f9').lineWidth(0.5).moveTo(40, strawBoxY + 16).lineTo(560, strawBoxY + 16).stroke();

            // Line 2 inside box: Straw ID Badge, Count, Grade/Stage, Tag color & PGT
            // Straw ID Badge
            doc.roundedRect(40, strawBoxY + 18, 28, 12, 3).lineWidth(0.5).fillAndStroke('#0f172a', '#0f172a');
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#ffffff').text(displayLabel, 40, strawBoxY + 20, { width: 28, align: 'center' });

            // Quantity Label
            const itemQtyLabel = isOocyteDoc
              ? `(${embryoCount} ${embryoCount === 1 ? 'oocyte' : 'oocytes'})`
              : `(${embryoCount} ${embryoCount === 1 ? 'embryo' : 'embryos'})`;

            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#334155').text(itemQtyLabel, 74, strawBoxY + 20);

            // Grade / Stage & Comments
            const eGrade = (straw.grade || '').trim().toUpperCase();
            const eComment = (straw.comments || '').trim();
            const gradeStr = eGrade ? eGrade : 'N/A';

            let gradeFormatted = gradeStr;
            if (straw.embryos && straw.embryos.length > 0) {
              gradeFormatted = straw.embryos
                .sort((a: any, b: any) => a.embryoNumber - b.embryoNumber)
                .map((emb: any) => (emb.grade || gradeStr || (isOocyteDoc ? 'MII' : 'N/A')).trim().toUpperCase())
                .join(', ');
            }

            let commentFormatted = '';
            if (straw.embryos && straw.embryos.length >= 1) {
              const sortedNotes = straw.embryos
                .sort((a: any, b: any) => a.embryoNumber - b.embryoNumber)
                .map((emb: any) => {
                  const note = (emb.notes || emb.comments || '').trim();
                  return note.replace(/\[Fragmentation:\s*([^\]]+)\]/gi, '$1').trim();
                })
                .filter(Boolean);
              if (sortedNotes.length > 0) {
                commentFormatted = ` - (${sortedNotes.join(', ')})`;
              }
            } else if (eComment) {
              const cleanC = eComment.replace(/\[Fragmentation:\s*([^\]]+)\]/gi, '$1').trim();
              if (cleanC) commentFormatted = ` - (${cleanC})`;
            }

            const mainSpecText = `${isOocyteDoc ? 'Stage' : 'Grade'}: ${gradeFormatted}${commentFormatted}`;
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#0f172a').text(mainSpecText, 160, strawBoxY + 20, { width: 250, lineBreak: false });

            // Straw Color Badge
            doc.roundedRect(420, strawBoxY + 18, 54, 12, 3).lineWidth(0.5).fillAndStroke(colorBg, colorBorder);
            doc.fontSize(7).font('Helvetica-Bold').fillColor(colorText).text(`${strawColor} Tag`, 420, strawBoxY + 20, { width: 54, align: 'center' });

            // PGT Badge
            if (straw.isPgt && !isOocyteDoc) {
              doc.roundedRect(480, strawBoxY + 18, 76, 12, 3).lineWidth(0.5).fillAndStroke('#f3e8ff', '#9333ea');
              doc.fontSize(7).font('Helvetica-Bold').fillColor('#581c87').text('PGT TESTED', 480, strawBoxY + 20, { width: 76, align: 'center' });
            }

            currentSectionY += 38;
          });
        });
      }

      // ==========================================
      // 6. CONTRACT & EXPIRY NOTICE CARD
      // ==========================================
      const noticeBoxHeight = 44;
      ensureSpace(noticeBoxHeight + 8);
      const noticeBoxY = currentSectionY;
      const isSixMonths = activeReportType === 'DAY3' || activeReportType === 'DAY5';
      const contractNoticeText = isThaw
        ? 'Following the thawing procedure, viable embryos are prepared for immediate clinical transfer (FET) or ICSI. All post-thaw recovery parameters are documented in the patient medical record.'
        : isSixMonths
        ? 'Embryos/Eggs will be normally kept frozen for a period of six months from date of freezing. If you wish to extend this period, you will need to renew the freezing contract before the expiry date. If we do not hear from you before that time, then your eggs/embryos will be disposed off.'
        : 'Embryos/Eggs will be normally kept frozen for a period of one year from date of freezing. If you wish to extend this period, you will need to renew the freezing contract before the expiry date. If we do not hear from you before that time, then your eggs/embryos will be disposed off.';

      const advisoryBg = isThaw ? '#fff1f2' : '#fefce8';
      const advisoryBorder = isThaw ? '#fca5a5' : '#fef08a';
      const advisoryAccent = isThaw ? '#dc2626' : '#eab308';
      const advisoryText = isThaw ? '#881337' : '#713f12';

      doc
        .roundedRect(30, noticeBoxY, 535, noticeBoxHeight, 5)
        .lineWidth(0.75)
        .fillAndStroke(advisoryBg, advisoryBorder);

      doc.roundedRect(30, noticeBoxY, 4, noticeBoxHeight, 2).fill(advisoryAccent);

      doc
        .fillColor(advisoryText)
        .fontSize(8.5)
        .font('Helvetica')
        .text(
          contractNoticeText,
          42,
          noticeBoxY + 6,
          { width: 512, align: 'left', lineGap: 2 }
        );

      currentSectionY = noticeBoxY + noticeBoxHeight + 10;

      // ==========================================
      // 8. CLINICAL DISCLAIMER NOTE & GRADING FOOTNOTE
      // ==========================================
      const disclaimerNeededHeight = isThaw ? 55 : (activeReportType === 'DAY3' ? 120 : activeReportType === 'DAY5' ? 95 : 55);
      ensureSpace(disclaimerNeededHeight);

      const disclaimerStartY = currentSectionY;
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a').text('Note:', 30, disclaimerStartY);

      let disclaimerTextY = disclaimerStartY + 13;

      if (isThaw) {
        doc
          .font('Helvetica')
          .fillColor('#475569')
          .fontSize(8)
          .text(
            'Only those embryos/oocytes which survive the thawing procedure and are confirmed to be of viable, good quality are selected for embryo transfer (FET) or ICSI.',
            30,
            disclaimerTextY,
            { width: 535, align: 'left', lineGap: 2 }
          );

        doc
          .text(
            'Arrested, degenerate, or non-viable specimens following thaw are documented and discarded in accordance with standard laboratory clinical protocols.',
            30,
            disclaimerTextY + 18,
            { width: 535, align: 'left', lineGap: 2 }
          );

        currentSectionY = disclaimerTextY + 38;
      } else if (activeReportType === 'DAY5') {
        doc
          .font('Helvetica')
          .fillColor('#475569')
          .fontSize(8)
          .text(
            'Embryos may not survive the freezing thawing procedure, which means upon thawing you may not have any viable embryos left for transfer.',
            30,
            disclaimerTextY,
            { width: 535, align: 'left', lineGap: 2 }
          );

        doc
          .text(
            'Only those embryos, which survive and will be considered to be of good quality, shall be transferred. The remaining poor quality, arrested, or damaged embryos will be discarded.',
            30,
            disclaimerTextY + 18,
            { width: 535, align: 'left', lineGap: 2 }
          );

        // Day 5 Blastocyst Grading Key Container
        const gradeBoxY = disclaimerTextY + 42;
        doc.roundedRect(30, gradeBoxY, 535, 38, 5).lineWidth(1).fillAndStroke('#f8fafc', '#047857');
        doc.roundedRect(30, gradeBoxY, 4, 38, 2).fill('#047857');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text('Blastocyst Grading Key (*):', 40, gradeBoxY + 6);
        doc.fontSize(7.5).font('Helvetica').fillColor('#334155');
        doc.text('Expansion: 3 - Blastocyst  |  4 - Expanding Blastocyst  |  5 - Hatching Blastocyst', 160, gradeBoxY + 6, { width: 390 });
        doc.text('ICM (Inner Cell Mass): A - Good, B - Average, C - Poor   |   TE (Trophectoderm): A - Good, B - Average, C - Poor', 40, gradeBoxY + 21, { width: 510 });

        currentSectionY = gradeBoxY + 46;
      } else if (activeReportType === 'DAY3') {
        doc
          .font('Helvetica')
          .fillColor('#475569')
          .fontSize(8)
          .text(
            'Embryos may not survive the freezing thawing procedure, which means upon thawing you may not have any viable embryos left for transfer.',
            30,
            disclaimerTextY,
            { width: 535, align: 'left', lineGap: 2 }
          );

        doc
          .text(
            'Only those embryos, which survive and will be considered to be of good quality, shall be transferred. The remaining poor quality, arrested, or damaged embryos will be discarded.',
            30,
            disclaimerTextY + 18,
            { width: 535, align: 'left', lineGap: 2 }
          );

        // Day 3 Cleavage Grading Key Container
        const gradeBoxY = disclaimerTextY + 42;
        doc.roundedRect(30, gradeBoxY, 535, 56, 5).lineWidth(1).fillAndStroke('#f8fafc', '#047857');
        doc.roundedRect(30, gradeBoxY, 4, 56, 2).fill('#047857');
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text('Day 3 Grading Key (*):', 40, gradeBoxY + 6);
        doc.fontSize(7.5).font('Helvetica').fillColor('#334155');
        doc.text('Grade 4 (good): >= 8C with equal blastomeres & no fragmentation', 145, gradeBoxY + 6, { width: 410 });
        doc.text('Grade 4: >= 6C with slightly unequal blastomeres or <= 10% fragmentation', 145, gradeBoxY + 17, { width: 410 });
        doc.text('Grade 3: >= 6C with unequal blastomeres or 10-30% fragmentation', 145, gradeBoxY + 28, { width: 410 });
        doc.text('Grade 2: >= 5C with unequal blastomeres and >30% fragmentation', 145, gradeBoxY + 39, { width: 410 });

        currentSectionY = gradeBoxY + 64;
      } else {
        doc
          .font('Helvetica')
          .fillColor('#475569')
          .fontSize(8)
          .text(
            'Embryos/ Oocytes may not survive the freezing thawing procedure, which means upon thawing you may not have any viable embryos/ oocytes left for transfer/ICSI.',
            30,
            disclaimerTextY,
            { width: 535, align: 'left', lineGap: 2 }
          );

        doc
          .text(
            'Only those embryos/Oocytes, which survive and will be considered to be of good quality, shall be transferred. The remaining poor quality, arrested, or damaged embryos/oocytes will be discarded.',
            30,
            disclaimerTextY + 18,
            { width: 535, align: 'left', lineGap: 2 }
          );

        currentSectionY = disclaimerTextY + 38;
      }

      // ==========================================
      // 9. CLINICAL REPORT FOOTER & VERIFICATION BADGE ON EVERY PAGE
      // ==========================================
      const range = doc.bufferedPageRange();
      const totalPageCount = range.count;

      for (let i = range.start; i < range.start + totalPageCount; i++) {
        doc.switchToPage(i);

        const oldBottomMargin = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;

        const footerY = 760;
        // Divider Rule
        doc.strokeColor('#cbd5e1').lineWidth(0.75).moveTo(30, footerY).lineTo(565, footerY).stroke();

        doc.fontSize(8).font('Helvetica').fillColor('#64748b');
        doc.text('Center of IVF and Human Reproduction, Sir Ganga Ram Hospital, New Delhi', 30, footerY + 6, { lineBreak: false });
        doc.text(`Report Generated: ${new Date().toLocaleDateString('en-GB')}`, 30, footerY + 18, { lineBreak: false });

        // Verified Clinical Report Badge Bottom Right
        const verBorderColor = isThaw ? '#dc2626' : '#047857';
        const verTextColor = isThaw ? '#dc2626' : '#047857';
        const verBgColor = isThaw ? '#fef2f2' : '#f0fdf4';

        doc.roundedRect(425, footerY + 4, 140, 20, 4).lineWidth(1).fillAndStroke(verBgColor, verBorderColor);
        doc.fillColor(verTextColor).fontSize(7.5).font('Helvetica-Bold').text('VERIFIED CLINICAL REPORT', 425, footerY + 10, { width: 140, align: 'center', lineBreak: false });

        // Page X of Y page numbering
        doc.fontSize(8).font('Helvetica').fillColor('#64748b').text(`Page ${i + 1} of ${totalPageCount}`, 30, footerY + 30, { align: 'center', lineBreak: false });

        doc.page.margins.bottom = oldBottomMargin;
      }

      doc.end();
    });
  }
}

export const documentService = new DocumentService();
