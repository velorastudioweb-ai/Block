import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { createHash } from 'node:crypto';

export const documentHash = bytes => createHash('sha256').update(bytes).digest('hex');

export async function createCertificatePdf(certificate, baseUrl) {
  const verificationUrl = new URL('/', baseUrl);
  verificationUrl.searchParams.set('id', certificate.id);
  const qr = await QRCode.toBuffer(verificationUrl.toString(), { errorCorrectionLevel: 'M', margin: 1, width: 180 });
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 55, info: { Title: 'Academic certificate', Author: certificate.universityName } });
    const parts = [];
    pdf.on('data', chunk => parts.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(parts)));
    pdf.on('error', reject);
    pdf.rect(18, 18, 806, 559).lineWidth(1).stroke('#9dbab2');
    pdf.rect(25, 25, 792, 545).lineWidth(0.5).stroke('#c4d8d0');
    pdf.fillColor('#175b56').font('Helvetica-Bold').fontSize(12).text('ACADEMIC CREDENTIAL', 60, 65, { align: 'center', characterSpacing: 3 });
    pdf.fillColor('#163a45').font('Helvetica-Bold').fontSize(24).text(certificate.universityName, 65, 105, { align: 'center' });
    pdf.fillColor('#68827d').font('Helvetica').fontSize(13).text('This certificate is presented to', 65, 165, { align: 'center' });
    pdf.fillColor('#153b42').font('Helvetica-Bold').fontSize(30).text(certificate.studentName, 65, 198, { align: 'center' });
    pdf.fillColor('#68827d').font('Helvetica').fontSize(13).text('for completing the academic requirements of', 65, 251, { align: 'center' });
    pdf.fillColor('#175b56').font('Helvetica-Bold').fontSize(20).text(certificate.course, 65, 280, { align: 'center' });
    pdf.fillColor('#566f6c').font('Helvetica').fontSize(11).text(`${certificate.department}  |  ${certificate.academicYear}  |  Completed ${certificate.completionDate}${certificate.grade ? `  |  Grade: ${certificate.grade}` : ''}`, 65, 324, { align: 'center' });
    pdf.image(qr, 670, 410, { width: 95 });
    pdf.fillColor('#647a77').fontSize(9).text('CERTIFICATE ID', 70, 438).font('Helvetica-Bold').fillColor('#234943').text(certificate.id, 70, 455);
    pdf.font('Helvetica').fillColor('#647a77').text(`Issued ${certificate.issueDate.slice(0, 10)}  •  Verify using the QR code`, 70, 475);
    pdf.end();
  });
}
