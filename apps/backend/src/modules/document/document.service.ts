import PDFDocument from 'pdfkit';
import { prisma } from '../../common/prisma.js';

export class DocumentService {
  async generatePatientPdf(patientId: string): Promise<Buffer> {
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
        thawRecords: true,
      },
    });

    if (!patient) {
      throw new Error('Patient not found.');
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
      doc.on('error', reject);

      // PDF Header
      doc
        .fillColor('#1e293b')
        .fontSize(22)
        .text('IVF CLINIC EMBRYO STORAGE SUMMARY', { align: 'center' })
        .moveDown(0.5);

      doc
        .fontSize(10)
        .fillColor('#64748b')
        .text(`Generated Date: ${new Date().toLocaleDateString()}`, { align: 'center' })
        .moveDown(1.5);

      doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke().moveDown(1);

      // Patient Details Section
      doc.fontSize(14).fillColor('#0f172a').text('Patient Information').moveDown(0.5);
      doc.fontSize(10).fillColor('#334155');
      doc.text(`Patient ID: ${patient.patientId}`);
      doc.text(`Full Name: ${patient.fullName}`);
      doc.text(`Partner Name: ${patient.partnerName || 'N/A'}`);
      doc.text(`Visit Date: ${patient.visitDate ? new Date(patient.visitDate).toLocaleDateString() : 'N/A'}`);
      doc.text(`DE Date: ${patient.deDate ? new Date(patient.deDate).toLocaleDateString() : 'N/A'}`);
      doc.text(`Freezing Date: ${patient.freezingDate ? new Date(patient.freezingDate).toLocaleDateString() : 'N/A'}`);
      doc.text(`Thaw Date: ${patient.thawDate ? new Date(patient.thawDate).toLocaleDateString() : 'N/A'}`);
      doc.moveDown(1.5);

      // Storage Batches & Physical Locations
      doc.fontSize(14).fillColor('#0f172a').text('Embryo Storage Batches & Locations').moveDown(0.5);

      if (patient.batches.length === 0) {
        doc.fontSize(10).fillColor('#64748b').text('No active storage batches recorded.').moveDown(1);
      } else {
        patient.batches.forEach((batch, idx) => {
          doc.fontSize(11).fillColor('#1e293b').text(`Batch #${idx + 1}: ${batch.batchId} (Date: ${new Date(batch.storageDate).toLocaleDateString()})`);
          doc.fontSize(10).fillColor('#475569').text(`Location Code: ${batch.visoTube.locationCode}`);
          doc.text(`Total Embryos: ${batch.totalEmbryos}`);

          batch.straws.forEach((straw) => {
            doc.text(`  - Straw ID: ${straw.strawId} | Color: ${straw.color} | Embryos: ${straw.embryos.length} | Status: ${straw.status}`);
          });
          doc.moveDown(0.8);
        });
      }

      // Notes Section
      if (patient.comments || patient.notes.length > 0) {
        doc.fontSize(14).fillColor('#0f172a').text('Clinical Notes').moveDown(0.5);
        if (patient.comments) {
          doc.fontSize(10).fillColor('#334155').text(`Main Comments: ${patient.comments}`).moveDown(0.5);
        }
        patient.notes.forEach(note => {
          doc.fontSize(9).fillColor('#475569').text(`[${new Date(note.createdAt).toLocaleString()}] ${note.authorName}: ${note.noteText}`);
        });
        doc.moveDown(1.5);
      }

      // Signatures
      doc.moveDown(2);
      doc.fontSize(10).fillColor('#0f172a');
      doc.text('Authorized Embryologist Signature: _______________________', 50, doc.y);
      doc.text('Date: _______________', 380, doc.y - 12);

      doc.end();
    });
  }
}

export const documentService = new DocumentService();
