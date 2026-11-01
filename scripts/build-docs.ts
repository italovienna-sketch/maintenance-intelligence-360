import { createWriteStream, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';
import { DOCUMENT_TYPES } from '../shared/schemas.ts';
import { loadDocuments, type ContentDocument } from '../server/db/seed/documents.ts';

const NOTICE = 'Documento ilustrativo — não é manual de fabricante. Dados fictícios de demonstração.';
const OUT_DIR = 'public/docs';

const typeLabel: Record<(typeof DOCUMENT_TYPES)[number], string> = {
  MANUAL: 'Manual',
  ESPECIFICACAO: 'Especificação técnica',
  PROCEDIMENTO: 'Procedimento de manutenção',
  COMPONENTE: 'Documentação de componente',
};

function build(doc: ContentDocument): Promise<void> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({
      size: 'A4',
      margin: 56,
      bufferPages: true,
      info: { Title: doc.title, Subject: NOTICE, Author: 'Maintenance Intelligence 360 (demo)' },
    });
    const out = createWriteStream(join(OUT_DIR, `${doc.id}.pdf`));
    out.on('finish', resolve).on('error', reject);
    pdf.pipe(out);

    pdf.font('Helvetica').fontSize(10).fillColor('#555555')
      .text(typeLabel[doc.type as keyof typeof typeLabel].toUpperCase());
    pdf.moveDown(0.3).font('Helvetica-Bold').fontSize(22).fillColor('#111111').text(doc.title);
    pdf.moveDown(0.5).font('Helvetica').fontSize(11).fillColor('#333333').text(doc.summary);
    pdf.moveDown(0.3).fontSize(10).fillColor('#555555').text(`Aplicável a: ${doc.equipment.join(', ')}`);
    pdf.moveDown(1);
    for (const s of doc.sections) {
      pdf.font('Helvetica-Bold').fontSize(13).fillColor('#111111').text(s.heading);
      pdf.moveDown(0.3).font('Helvetica').fontSize(11).fillColor('#222222')
        .text(s.body, { lineGap: 3 });
      pdf.moveDown(1);
    }

    const { start, count } = pdf.bufferedPageRange();
    for (let i = start; i < start + count; i++) {
      pdf.switchToPage(i);
      pdf.page.margins.bottom = 0;
      pdf.font('Helvetica').fontSize(8).fillColor('#a33')
        .text(NOTICE, 56, 800, { width: 483, align: 'center', lineBreak: false });
    }
    pdf.end();
  });
}

mkdirSync(OUT_DIR, { recursive: true });
const docs = loadDocuments('content/documents');
await Promise.all(docs.map(build));
console.log(`${docs.length} PDFs gerados em ${OUT_DIR}`);
