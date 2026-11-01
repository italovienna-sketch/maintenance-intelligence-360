import PDFDocument from 'pdfkit';
import type { DailyReport } from './reports.ts';

const NOTICE = 'Relatório de demonstração com dados fictícios.';
const STATUS_LABEL: Record<string, string> = {
  EM_OPERACAO: 'Funcionando',
  EM_MANUTENCAO: 'Ainda em manutenção',
  AGUARDANDO_PECA: 'Aguardando peça',
  FORA_DE_OPERACAO: 'Parado',
};

const time = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', {
  timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit',
});
const dateBR = (date: string) => date.split('-').reverse().join('/');

export function reportPdf(report: DailyReport): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({
      size: 'A4',
      margin: 48,
      bufferPages: true,
      info: { Title: `Relatório do dia ${dateBR(report.date)}`, Author: 'Maintenance Intelligence 360 (demo)' },
    });
    const chunks: Uint8Array[] = [];
    pdf.on('data', (c: Uint8Array) => chunks.push(c)).on('error', reject)
      .on('end', () => {
        const bytes = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
        let offset = 0;
        for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
        resolve(bytes);
      });

    pdf.font('Helvetica').fontSize(10).fillColor('#555555').text('RELATÓRIO DO DIA');
    pdf.font('Helvetica-Bold').fontSize(22).fillColor('#111111').text(dateBR(report.date));
    pdf.moveDown(0.4).font('Helvetica').fontSize(12).fillColor('#222222')
      .text(`Serviços: ${report.total}. Peças instaladas: ${report.partsInstalled}.`);
    pdf.moveDown(0.8);

    const group = (title: string, rows: { label: string; count: number }[]) => {
      pdf.font('Helvetica-Bold').fontSize(12).fillColor('#111111').text(title);
      pdf.font('Helvetica').fontSize(11).fillColor('#222222');
      for (const r of rows) pdf.text(`${STATUS_LABEL[r.label] ?? r.label}: ${r.count}`);
      pdf.moveDown(0.6);
    };
    if (report.total > 0) {
      group('Por mecânico', report.byTechnician);
      group('Por local', report.byArea);
      group('Como ficou', report.byResult);
      pdf.font('Helvetica-Bold').fontSize(12).fillColor('#111111').text('Serviços');
      for (const s of report.services) {
        pdf.moveDown(0.5).font('Helvetica-Bold').fontSize(11).fillColor('#111111')
          .text(`${time(s.occurredAt)}  ·  ${s.equipmentTag}  ·  ${s.workArea ?? 'Local não informado'}  ·  ${s.technicianName}`);
        pdf.font('Helvetica').fontSize(10.5).fillColor('#222222').text(`${s.reportedProblem}. ${s.workPerformed}`);
        if (s.resultingStatus) pdf.text(`Ficou: ${STATUS_LABEL[s.resultingStatus]}`);
      }
    } else {
      pdf.text('Nenhum serviço registrado neste dia.');
    }

    const { start, count } = pdf.bufferedPageRange();
    for (let i = start; i < start + count; i++) {
      pdf.switchToPage(i);
      pdf.page.margins.bottom = 0;
      pdf.font('Helvetica').fontSize(8).fillColor('#a33')
        .text(NOTICE, 48, 806, { width: 499, align: 'center', lineBreak: false });
    }
    pdf.end();
  });
}
