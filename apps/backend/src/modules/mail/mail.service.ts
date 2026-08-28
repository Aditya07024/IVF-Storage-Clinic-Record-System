import nodemailer from 'nodemailer';
import { CONFIG } from '../../common/config.js';

export interface SendReportEmailInput {
  recipientEmail: string;
  patientName: string;
  patientId: string;
  pdfBuffer: Buffer;
  customSubject?: string;
  customMessage?: string;
}

export class MailService {
  private createTransporter(useSsl: boolean = true) {
    const user = (process.env.SMTP_USER || CONFIG.SMTP_USER || 'srghivfcryo@gmail.com').trim();
    const rawPass = process.env.SMTP_PASS || CONFIG.SMTP_PASS || 'vzba dnde aubt akas';
    const pass = rawPass.replace(/["'\s]/g, '').trim();

    if (!user || !pass) {
      throw new Error(`Email configuration error: Missing SMTP authentication credentials (SMTP_PASS). Please verify environment variables.`);
    }

    if (useSsl) {
      return nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 12000,
        socketTimeout: 15000,
      });
    }

    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || CONFIG.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || String(CONFIG.SMTP_PORT) || '587', 10),
      secure: false,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 12000,
      socketTimeout: 15000,
    });
  }

  async sendPatientReportEmail(input: SendReportEmailInput): Promise<{ success: boolean; messageId: string }> {
    const { recipientEmail, patientName, patientId, pdfBuffer, customSubject, customMessage } = input;

    if (!recipientEmail || !recipientEmail.trim()) {
      throw new Error('Recipient email address is required.');
    }

    const subject = customSubject || `Official IVF Specimen & Cryo Storage Summary - ${patientName} (${patientId})`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .header { text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 16px; margin-bottom: 24px; }
          .logo-title { font-size: 22px; font-weight: 800; color: #065f46; letter-spacing: -0.5px; }
          .subtitle { font-size: 12px; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 1px; }
          .body-text { font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 20px; }
          .custom-msg { background: #ecfdf5; border-left: 4px solid #10b981; padding: 12px 16px; border-radius: 8px; font-size: 13px; color: #064e3b; margin: 16px 0; font-style: italic; }
          .patient-box { background: #f1f5f9; padding: 16px; border-radius: 12px; margin: 20px 0; font-size: 13px; }
          .patient-box div { margin-bottom: 6px; }
          .patient-box strong { color: #0f172a; }
          .footer { text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 32px; font-size: 11px; color: #94a3b8; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo-title">SRGH IVF CRYO BANK</div>
            <div class="subtitle">Official Clinical Specimen & Storage Record</div>
          </div>

          <div class="body-text">
            Dear <strong>${patientName}</strong>,
          </div>

          <div class="body-text">
            Please find attached your official <strong>IVF Embryo / Oocyte Storage Summary Report</strong> issued by <strong>SRGH IVF Cryo Bank</strong>.
          </div>

          ${customMessage ? `<div class="custom-msg">"${customMessage}"</div>` : ''}

          <div class="patient-box">
            <div><strong>Patient Name:</strong> ${patientName}</div>
            <div><strong>Patient Record ID:</strong> ${patientId}</div>
            <div><strong>Report Issue Date:</strong> ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
          </div>

          <div class="body-text">
            The attached PDF document contains complete verification details including specimen count, embryo stage, straw color tags, and laboratory clinical notes.
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: CONFIG.SMTP_FROM,
      to: recipientEmail.trim(),
      subject: subject,
      html: htmlContent,
      attachments: [
        {
          filename: `IVF_Patient_Cryo_Report_${patientId}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    };

    // Try Gmail service (Port 465) first, then fallback to Port 587
    try {
      const transporter = this.createTransporter(true);
      const info = await transporter.sendMail(mailOptions);
      console.log(`[MailService] Email sent successfully via Gmail SSL service to ${recipientEmail}. Message ID: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (sslErr: any) {
      console.warn('[MailService] Gmail SSL transport failed, attempting Port 587...', sslErr?.message);
      try {
        const transporter = this.createTransporter(false);
        const info = await transporter.sendMail(mailOptions);
        console.log(`[MailService] Email sent successfully via Port 587 to ${recipientEmail}. Message ID: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
      } catch (tlsErr: any) {
        console.error('[MailService] Both Gmail SSL and Port 587 transports failed:', tlsErr?.message);
        throw new Error(`SMTP Error: ${tlsErr?.message || sslErr?.message || 'Failed to connect to email server.'}`);
      }
    }
  }
}

export const mailService = new MailService();
