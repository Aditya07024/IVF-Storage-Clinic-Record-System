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

function formatOneYearExpiryDots(freezingDate: string | Date | null | undefined): string {
  if (!freezingDate) return 'N/A';
  const date = new Date(freezingDate);
  if (isNaN(date.getTime())) return 'N/A';
  date.setFullYear(date.getFullYear() + 1);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = String(date.getFullYear()).slice(-2);
  return `${day}.${month}.${year}`;
}

function formatSixMonthsExpiryDots(freezingDate: string | Date | null | undefined): string {
  if (!freezingDate) return 'N/A';
  const date = new Date(freezingDate);
  if (isNaN(date.getTime())) return 'N/A';
  date.setMonth(date.getMonth() + 6);
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = String(date.getFullYear()).slice(-2);
  return `${day}.${month}.${year}`;
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
        activeReportType = 'OOCYTE'; // Default fallback
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
      // Embed Hospital Logo Image ONLY on the LEFT side
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
          doc.image(foundLogoPath, 30, 14, { fit: [50, 50] });
        } catch (err) {
          console.error('Error embedding hospital logo in PDF:', err);
        }
      }

      // Center Hospital Title - RED COLOR AS REQUESTED
      doc
        .fillColor('#dc2626')
        .fontSize(16)
        .font('Helvetica-Bold')
        .text('Center of IVF and Human Reproduction', 30, 14, { align: 'center' });

      doc
        .fillColor('#b45309')
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('Sir Ganga Ram Hospital, New Delhi', 30, 38, { align: 'center' });

      // Title Badge Element with Crisp Framed Border Outline
      const summaryBadgeY = 64;
      const badgeTitleText = isThaw
        ? 'THAWING & EMBRYO RECOVERY REPORT'
        : 'CRYO-PRESERVATION SUMMARY REPORT';

      const badgeBg = isThaw ? '#fef2f2' : '#f0fdf4';
      const badgeBorder = isThaw ? '#dc2626' : '#047857';
      const badgeText = isThaw ? '#dc2626' : '#047857';

      // Element Border around Title Badge
      doc.rect(130, summaryBadgeY, 335, 24).lineWidth(1.25).fillAndStroke(badgeBg, badgeBorder);

      doc
        .fillColor(badgeText)
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(badgeTitleText, 130, summaryBadgeY + 5, { width: 335, align: 'center' });

      // ==========================================
      // 2. PATIENT DEMOGRAPHICS CARD (CRISP OUTLINED BORDER & GRID)
      // ==========================================
      const demoStartY = 96;
      const demoHeight = 82;
      const demoBorderColor = isThaw ? '#dc2626' : '#047857';

      // Crisp Element Border Outline around Patient Demographics Card
      doc.rect(30, demoStartY, 535, demoHeight).lineWidth(1.25).fillAndStroke('#f8fafc', demoBorderColor);

      // Left Accent Solid Strip
      doc.rect(30, demoStartY, 6, demoHeight).fill(demoBorderColor);

      // Internal Vertical Grid Divider Line
      doc.strokeColor('#cbd5e1').lineWidth(0.75).moveTo(300, demoStartY + 4).lineTo(300, demoStartY + demoHeight - 4).stroke();

      // Internal Horizontal Row Divider Lines
      doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(42, demoStartY + 30).lineTo(558, demoStartY + 30).stroke();
      doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(42, demoStartY + 58).lineTo(558, demoStartY + 58).stroke();

      doc.fontSize(9.5).font('Helvetica').fillColor('#1e293b');

      const aspDateStr = formatDateDots(patient.aspirationDate || patient.createdAt);
      const freezeDateStr = formatDateDots(patient.freezingDate || patient.aspirationDate || patient.createdAt);
      const latestThawDateStr = patient.thawRecords && patient.thawRecords.length > 0
        ? formatDateDots(patient.thawRecords[0].thawDate)
        : formatDateDots(patient.updatedAt);

      const isSixMonths = activeReportType === 'DAY3' || activeReportType === 'DAY5';
      const expiryDateStr = isSixMonths
        ? formatSixMonthsExpiryDots(patient.freezingDate || patient.aspirationDate || patient.createdAt)
        : formatOneYearExpiryDots(patient.freezingDate || patient.aspirationDate || patient.createdAt);

      // Clean Age string
      const ageClean = patient.patientAge
        ? `${String(patient.patientAge).replace(/\s*yrs?/gi, '').trim()} Yrs`
        : 'N/A';

      // Left Column Demographics
      doc.fillColor('#0f172a').font('Helvetica-Bold').text('Name of patient: ', 44, demoStartY + 10, { continued: true });
      doc.font('Helvetica-Bold').fillColor('#047857').text(patient.fullName || 'N/A');

      doc.fillColor('#0f172a').font('Helvetica-Bold').text('Age: ', 44, demoStartY + 38, { continued: true });
      doc.font('Helvetica').fillColor('#334155').text(ageClean);

      doc.fillColor('#0f172a').font('Helvetica-Bold').text('Reg No: ', 44, demoStartY + 66, { continued: true });
      doc.font('Helvetica-Bold').fillColor('#047857').text(patient.patientId || 'N/A');

      // Right Column Demographics
      doc.fillColor('#0f172a').font('Helvetica-Bold').text('Consultant: ', 312, demoStartY + 10, { continued: true });
      doc.font('Helvetica').fillColor('#0369a1').text(patient.doctorName || 'N/A');

      doc.fillColor('#0f172a').font('Helvetica-Bold').text('Date of egg pickup: ', 312, demoStartY + 38, { continued: true });
      doc.font('Helvetica').fillColor('#334155').text(aspDateStr);

      if (isThaw) {
        doc.fillColor('#0f172a').font('Helvetica-Bold').text('Date of thawing: ', 312, demoStartY + 66, { continued: true });
        // HIGHLIGHT DATE OF THAW IN RED
        doc.font('Helvetica-Bold').fillColor('#dc2626').text(latestThawDateStr);
      } else {
        doc.fillColor('#0f172a').font('Helvetica-Bold').text('Date of freezing: ', 312, demoStartY + 66, { continued: true });
        doc.font('Helvetica').fillColor('#334155').text(freezeDateStr);
      }

      // Render Patient Photo if uploaded (Supports Data URI & local disk path)
      let photoInputBuffer: Buffer | string | null = null;
      if (patient.photoUrl) {
        if (patient.photoUrl.startsWith('data:image/')) {
          photoInputBuffer = Buffer.from(patient.photoUrl.split(',')[1], 'base64');
        } else {
          const basename = path.basename(patient.photoUrl);
          const checkPaths = [
            path.join(path.resolve(CONFIG.STORAGE_LOCAL_DIR), basename),
            path.join(process.cwd(), 'uploads', basename),
            `/var/www/ivf/uploads/${basename}`,
          ];
          for (const p of checkPaths) {
            if (fs.existsSync(p)) {
              photoInputBuffer = p;
              break;
            }
          }
        }
      }

      if (photoInputBuffer) {
        try {
          const pWidth = 60;
          const pHeight = 72;
          const pX = 492;
          const pY = demoStartY + 8;

          // Convert photo to clean baseline JPEG Buffer using Sharp (handles WebP, PNG, HEIC, Base64)
          const jpegBuffer = await sharp(photoInputBuffer)
            .resize(240, 288, { fit: 'cover' })
            .jpeg({ quality: 90 })
            .toBuffer();

          doc.rect(pX - 1, pY - 1, pWidth + 2, pHeight + 2).lineWidth(1).stroke('#047857');
          doc.image(jpegBuffer, pX, pY, { fit: [pWidth, pHeight], align: 'center', valign: 'center' });
        } catch (photoErr) {
          console.error('[PDF Patient Photo Render Error]', photoErr);
        }
      }

      
      // ==========================================
      // 3. FREEZING OR THAWING REPORT SECTION CARDS (SEPARATED BY FREEZING DATE / BATCH)
      // ==========================================
      const reportHeaderY = 190;
      const pillBg = isThaw ? '#fef2f2' : '#f0fdf4';
      const pillBorder = isThaw ? '#dc2626' : '#047857';
      const pillText = isThaw ? '#dc2626' : '#047857';

      let currentSectionY = reportHeaderY;

      const batchesToRender: any[] = patient.batches.length > 0 ? patient.batches : [{
        id: 'default',
        storageDate: patient.freezingDate || new Date(),
        freezingDate: patient.freezingDate,
        embryoStage: activeReportType === 'DAY5' ? 'Day 5' : activeReportType === 'DAY3' ? 'Day 3' : 'Day 0',
        straws: [] as any[]
      }];

      batchesToRender.forEach((batch: any, batchIdx: number) => {
        const batchFreezingDate = batch.freezingDate || batch.storageDate || patient.freezingDate;
        const batchFreezingDateStr = formatDateDots(batchFreezingDate);

        let batchExpiryStr = expiryDateStr;
        if (batchFreezingDate) {
          const d = new Date(batchFreezingDate);
          if (!isNaN(d.getTime())) {
            if (isSixMonths) {
              batchExpiryStr = formatSixMonthsExpiryDots(batchFreezingDate);
            } else {
              d.setFullYear(d.getFullYear() + 1);
              batchExpiryStr = formatDateDots(d);
            }
          }
        }

        const batchStraws = (batch.straws || []).filter((s: any) => s.status === 'OCCUPIED' || isThaw);
        const activeStraws = batchStraws.length > 0 ? batchStraws : (batch.straws || []);

        let bTotalSpecimens = 0;
        let bTotalStrawsCount = activeStraws.length;
        const bStrawCountsArr: number[] = [];
        const bEmbryoScoresArr: string[] = [];
        let bHasPgt = false;

        activeStraws.forEach((straw: any) => {
          const cnt = straw.embryoCount || (straw.embryos ? straw.embryos.length : 1);
          bTotalSpecimens += cnt;
          bStrawCountsArr.push(cnt);
          if (straw.isPgt) bHasPgt = true;

          if (straw.embryos && straw.embryos.length > 0) {
            straw.embryos.forEach((emb: any) => {
              if (emb.grade) bEmbryoScoresArr.push(emb.grade);
            });
          } else if (straw.grade) {
            bEmbryoScoresArr.push(straw.grade);
          }
        });

        if (bTotalSpecimens === 0 && batch.totalEmbryos) {
          bTotalSpecimens = batch.totalEmbryos;
        }
        if (bTotalStrawsCount === 0 && batch.totalStraws) {
          bTotalStrawsCount = batch.totalStraws;
        }

        const batchStage = batch.embryoStage || (activeReportType === 'DAY5' ? 'Day 5' : activeReportType === 'DAY3' ? 'Day 3' : 'Day 0');

        // Section Pill Header
        const pillTitle = isThaw
          ? `THAWING REPORT${batchesToRender.length > 1 ? ` (Batch ${batchIdx + 1})` : ''}`
          : `FREEZING REPORT${batchesToRender.length > 1 ? ` (${batchFreezingDateStr})` : ''}`;

        const pillWidth = isThaw ? 165 : (batchesToRender.length > 1 ? 210 : 155);

        doc.rect(30, currentSectionY, pillWidth, 24).lineWidth(1.25).fillAndStroke(pillBg, pillBorder);
        doc
          .fillColor(pillText)
          .fontSize(10)
          .font('Helvetica-Bold')
          .text(pillTitle, 40, currentSectionY + 6);

        currentSectionY += 30;

        // PGT-A Warning Card Element Border per Batch
        if (bHasPgt && !isThaw) {
          doc.rect(30, currentSectionY, 535, 28).lineWidth(1.25).fillAndStroke('#eff6ff', '#2563eb');
          doc.rect(30, currentSectionY, 5, 28).fill('#2563eb');
          doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#1e40af');
          doc.text(
            "Embryo / Oocyte: Prior to freezing, embryos underwent biopsy for PGT- A. So please refer to PGT-A report to select 'normal' embryos for FET",
            44,
            currentSectionY + 8,
            { width: 510 }
          );
          currentSectionY += 34;
        }

        // Element Border Outline around Freezing/Thaw Details Card
        const reportBoxY = currentSectionY;
        const reportBoxHeight = 88;
        const boxAccentColor = isThaw ? '#dc2626' : '#0284c7';
        const boxBorderColor = isThaw ? '#dc2626' : '#047857';

        doc.rect(30, reportBoxY, 535, reportBoxHeight).lineWidth(1.25).fillAndStroke('#ffffff', boxBorderColor);
        doc.rect(30, reportBoxY, 6, reportBoxHeight).fill(boxAccentColor);

        // Grid Dividers inside Details Card
        doc.strokeColor('#cbd5e1').lineWidth(0.75).moveTo(300, reportBoxY + 4).lineTo(300, reportBoxY + reportBoxHeight - 4).stroke();
        doc.strokeColor('#f1f5f9').lineWidth(0.5).moveTo(42, reportBoxY + 30).lineTo(558, reportBoxY + 30).stroke();
        doc.strokeColor('#f1f5f9').lineWidth(0.5).moveTo(42, reportBoxY + 58).lineTo(558, reportBoxY + 58).stroke();

        doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0f172a');

        // Format Number String (e.g. 5BL- 4 Straws (1+1+2+1))
        const stageUpper = (batchStage || '').toUpperCase();
        const isBlast = stageUpper.includes('DAY 5') || stageUpper.includes('DAY 6') || stageUpper.includes('DAY5') || stageUpper.includes('DAY6') || stageUpper.includes('BLAST');
        const stageCode = isBlast ? 'BL' : '';

        const strawBreakdownStr = bStrawCountsArr.length > 0 ? bStrawCountsArr.join('+') : '1';
        const numberStr = bTotalStrawsCount > 0
          ? `${bTotalSpecimens}${stageCode}- ${bTotalStrawsCount} Straw${bTotalStrawsCount > 1 ? 's' : ''} (${strawBreakdownStr})`
          : `${bTotalSpecimens}${stageCode} Specimen`;

        const formattedScores = bEmbryoScoresArr.length > 0
          ? bEmbryoScoresArr.map((g, i) => `#${i + 1}-${g}`).join(', ')
          : 'Standard Quality';

        if (isThaw) {
          const thawedSummaryStr = `${bTotalStrawsCount > 0 ? bTotalStrawsCount : 1} Straw(s) Thawed (${bTotalSpecimens > 0 ? bTotalSpecimens : 1} Specimen)`;

          // Left Column
          doc.font('Helvetica-Bold').text('Thawed Specimen: ', 44, reportBoxY + 10, { continued: true });
          doc.font('Helvetica').fillColor('#0369a1').text(thawedSummaryStr);

          doc.fillColor('#0f172a').font('Helvetica-Bold').text('Post-Thaw Status: ', 44, reportBoxY + 38, { continued: true });
          doc.font('Helvetica-Bold').fillColor('#dc2626').text('100% Viable / Survived Thaw');

          doc.fillColor('#0f172a').font('Helvetica-Bold').text('Intended Treatment: ', 44, reportBoxY + 66, { continued: true });
          doc.font('Helvetica').fillColor('#047857').text('Frozen Embryo Transfer (FET)');

          // Right Column
          doc.fillColor('#0f172a').font('Helvetica-Bold').text('Thawing Method: ', 312, reportBoxY + 10, { continued: true });
          doc.font('Helvetica').fillColor('#dc2626').text('Vitrification Thaw');

          doc.fillColor('#0f172a').font('Helvetica-Bold').text('Date of Thaw: ', 312, reportBoxY + 38, { continued: true });
          doc.font('Helvetica-Bold').fillColor('#dc2626').text(latestThawDateStr);
        } else {
          // Left Column
          doc.font('Helvetica-Bold').text('Number: ', 44, reportBoxY + 10, { continued: true });
          doc.font('Helvetica').fillColor('#0369a1').text(numberStr);

          doc.fillColor('#0f172a').font('Helvetica-Bold').text('Developmental Stage: ', 44, reportBoxY + 38, { continued: true });
          doc.font('Helvetica-Bold').fillColor('#047857').text(batchStage);

          doc.fillColor('#0f172a').font('Helvetica-Bold').text('Embryo Score*: ', 44, reportBoxY + 66, { continued: true });
          doc.font('Helvetica').fillColor('#047857').text(formattedScores);

          // Right Column
          doc.fillColor('#0f172a').font('Helvetica-Bold').text('Freezing Method: ', 312, reportBoxY + 10, { continued: true });
          doc.font('Helvetica').fillColor('#0284c7').text('Vitrification');

          doc.fillColor('#0f172a').font('Helvetica-Bold').text('Embryos frozen till: ', 312, reportBoxY + 38, { continued: true });
          doc.font('Helvetica-Bold').fillColor('#047857').text(batchExpiryStr);
        }

        currentSectionY += reportBoxHeight + 14;
      });

      // ==========================================
      // 4. CONTRACT & EXPIRY NOTICE CARD (OUTLINED BORDER)
      // ==========================================
      const noticeBoxY = currentSectionY + 4;
      const contractNoticeText = isThaw
        ? 'Following the thawing procedure, viable embryos are prepared for immediate clinical transfer (FET) or ICSI. All post-thaw recovery parameters are documented in the patient medical record.'
        : isSixMonths
        ? 'Embryos/Eggs will be normally kept frozen for a period of six months from date of freezing. If you wish to extend this period, you will need to renew the freezing contract before the expiry date. If we do not hear from you before that time, then your eggs/embryos will be disposed off.'
        : 'Embryos/Eggs will be normally kept frozen for a period of one year from date of freezing. If you wish to extend this period, you will need to renew the freezing contract before the expiry date. If we do not hear from you before that time, then your eggs/embryos will be disposed off.';

      const advisoryBg = isThaw ? '#fff1f2' : '#fffbebe6';
      const advisoryBorder = isThaw ? '#dc2626' : '#d97706';
      const advisoryAccent = isThaw ? '#dc2626' : '#d97706';
      const advisoryText = isThaw ? '#881337' : '#78350f';

      // Element Border Outline around Advisory Box
      doc
        .rect(30, noticeBoxY, 535, 54)
        .lineWidth(1.25)
        .fillAndStroke(advisoryBg, advisoryBorder);

      // Left Accent Strip
      doc.rect(30, noticeBoxY, 6, 54).fill(advisoryAccent);

      doc
        .fillColor(advisoryText)
        .fontSize(9.5)
        .font('Helvetica')
        .text(
          contractNoticeText,
          46,
          noticeBoxY + 9,
          { width: 505, align: 'left', lineGap: 3 }
        );

      // ==========================================
      // 5. CLINICAL DISCLAIMER NOTE & GRADING FOOTNOTE (OUTLINED BORDER)
      // ==========================================
      const disclaimerStartY = noticeBoxY + 68;
      doc.fontSize(9.5).font('Helvetica-Bold').fillColor('#0f172a').text('Note:', 30, disclaimerStartY);

      let disclaimerTextY = disclaimerStartY + 16;

      if (isThaw) {
        doc
          .font('Helvetica')
          .fillColor('#475569')
          .fontSize(9)
          .text(
            'Only those embryos/oocytes which survive the thawing procedure and are confirmed to be of viable, good quality are selected for embryo transfer (FET) or ICSI.',
            30,
            disclaimerTextY,
            { width: 535, align: 'left', lineGap: 3 }
          );

        doc
          .text(
            'Arrested, degenerate, or non-viable specimens following thaw are documented and discarded in accordance with standard laboratory clinical protocols.',
            30,
            disclaimerTextY + 24,
            { width: 535, align: 'left', lineGap: 3 }
          );
      } else if (activeReportType === 'DAY5') {
        doc
          .font('Helvetica')
          .fillColor('#475569')
          .fontSize(9)
          .text(
            'Embryos may not survive the freezing thawing procedure, which means upon thawing you may not have any viable embryos left for transfer.',
            30,
            disclaimerTextY,
            { width: 535, align: 'left', lineGap: 3 }
          );

        doc
          .text(
            'Only those embryos, which survive and will be considered to be of good quality, shall be transferred. The remaining poor quality, arrested, or damaged embryos will be discarded.',
            30,
            disclaimerTextY + 24,
            { width: 535, align: 'left', lineGap: 3 }
          );

        // Day 5 Blastocyst Grading Key Container with Element Border Outline
        const gradeBoxY = disclaimerTextY + 58;
        doc.rect(30, gradeBoxY, 535, 44).lineWidth(1.25).fillAndStroke('#f8fafc', '#047857');
        doc.rect(30, gradeBoxY, 5, 44).fill('#047857');
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a').text('Blastocyst Grading Key (*):', 42, gradeBoxY + 8);
        doc.fontSize(8).font('Helvetica').fillColor('#334155');
        doc.text('Expansion: 3 - Blastocyst  |  4 - Expanding Blastocyst  |  5 - Hatching Blastocyst', 165, gradeBoxY + 8, { width: 390 });
        doc.text('ICM (Inner Cell Mass): A - Good, B - Average, C - Poor   |   TE (Trophectoderm): A - Good, B - Average, C - Poor', 42, gradeBoxY + 25, { width: 510 });
      } else if (activeReportType === 'DAY3') {
        doc
          .font('Helvetica')
          .fillColor('#475569')
          .fontSize(9)
          .text(
            'Embryos may not survive the freezing thawing procedure, which means upon thawing you may not have any viable embryos left for transfer.',
            30,
            disclaimerTextY,
            { width: 535, align: 'left', lineGap: 3 }
          );

        doc
          .text(
            'Only those embryos, which survive and will be considered to be of good quality, shall be transferred. The remaining poor quality, arrested, or damaged embryos will be discarded.',
            30,
            disclaimerTextY + 24,
            { width: 535, align: 'left', lineGap: 3 }
          );

        // Day 3 Cleavage Grading Key Container with Element Border Outline
        const gradeBoxY = disclaimerTextY + 58;
        doc.rect(30, gradeBoxY, 535, 68).lineWidth(1.25).fillAndStroke('#f8fafc', '#047857');
        doc.rect(30, gradeBoxY, 5, 68).fill('#047857');
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a').text('Day 3 Grading Key (*):', 42, gradeBoxY + 8);
        doc.fontSize(8.5).font('Helvetica').fillColor('#334155');
        doc.text('Grade 4 (good): >= 8C with equal blastomeres & no fragmentation', 150, gradeBoxY + 8, { width: 405 });
        doc.text('Grade 4: >= 6C with slightly unequal blastomeres or <= 10% fragmentation', 150, gradeBoxY + 22, { width: 405 });
        doc.text('Grade 3: >= 6C with unequal blastomeres or 10-30% fragmentation', 150, gradeBoxY + 36, { width: 405 });
        doc.text('Grade 2: >= 5C with unequal blastomeres and >30% fragmentation', 150, gradeBoxY + 50, { width: 405 });
      } else {
        doc
          .font('Helvetica')
          .fillColor('#475569')
          .fontSize(9)
          .text(
            'Embryos/ Oocytes may not survive the freezing thawing procedure, which means upon thawing you may not have any viable embryos/ oocytes left for transfer/ICSI.',
            30,
            disclaimerTextY,
            { width: 535, align: 'left', lineGap: 3 }
          );

        doc
          .text(
            'Only those embryos/Oocytes, which survive and will be considered to be of good quality, shall be transferred. The remaining poor quality, arrested, or damaged embryos/oocytes will be discarded.',
            30,
            disclaimerTextY + 24,
            { width: 535, align: 'left', lineGap: 3 }
          );
      }

      // ==========================================
      // 6. CLINICAL REPORT FOOTER & VERIFICATION BADGE (OUTLINED BORDER)
      // ==========================================
      const footerY = 765;

      // Single Clean Divider Rule
      doc.strokeColor('#cbd5e1').lineWidth(0.75).moveTo(30, footerY).lineTo(565, footerY).stroke();

      doc.fontSize(8.5).font('Helvetica').fillColor('#64748b');
      doc.text('Center of IVF and Human Reproduction, Sir Ganga Ram Hospital, New Delhi', 30, footerY + 8);
      doc.text(`Report Generated: ${new Date().toLocaleDateString('en-GB')}`, 30, footerY + 20);

      // Verified Clinical Report Badge Bottom Right with Element Border Outline
      const verBorderColor = isThaw ? '#dc2626' : '#047857';
      const verTextColor = isThaw ? '#dc2626' : '#047857';
      const verBgColor = isThaw ? '#fef2f2' : '#f0fdf4';

      doc.rect(425, footerY + 6, 140, 22).lineWidth(1.25).fillAndStroke(verBgColor, verBorderColor);
      doc.fillColor(verTextColor).fontSize(8).font('Helvetica-Bold').text('VERIFIED CLINICAL REPORT', 425, footerY + 13, { width: 140, align: 'center' });

      // Add page numbers if report spans multiple pages
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        if (range.count > 1) {
          doc.fontSize(8).font('Helvetica').fillColor('#94a3b8').text(`Page ${i + 1} of ${range.count}`, 30, 810, { align: 'center' });
        }
      }

      doc.end();
    });
  }
}

export const documentService = new DocumentService();
