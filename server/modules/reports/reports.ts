import { Hono } from 'hono';
import { reportDateSchema } from '../../../shared/schemas.ts';
import type { Db } from '../../db/connection.ts';
import { parseBody } from '../../http.ts';
import { MaintenanceRepository } from '../maintenance/maintenance.ts';
import type { Env } from '../users/users.ts';
import { reportPdf } from './pdf.ts';

const NOT_INFORMED = 'Não informado';

function tally(values: string[]) {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'pt-BR'));
}

// O relatório é calculado dos registros gravados, então todo dia com serviço continua disponível.
export class ReportService {
  private readonly repo: MaintenanceRepository;

  constructor(db: Db) {
    this.repo = new MaintenanceRepository(db);
  }

  days() {
    return this.repo.days(60);
  }

  daily(date: string) {
    const services = this.repo.byDay(date).map((r) => {
      const parts = this.repo.parts(r.id) as unknown as { direction: string; description: string }[];
      return {
        id: r.id,
        occurredAt: r.occurredAt,
        technicianName: r.technicianName,
        workArea: r.workArea,
        equipmentTag: r.equipmentTag,
        equipmentName: r.equipmentName,
        reportedProblem: r.reportedProblem,
        workPerformed: r.workPerformed,
        resultingStatus: r.resultingStatus,
        installed: parts.filter((p) => p.direction === 'INSTALLED').map((p) => p.description),
      };
    });
    return {
      date,
      total: services.length,
      partsInstalled: services.reduce((sum, s) => sum + s.installed.length, 0),
      byTechnician: tally(services.map((s) => s.technicianName)),
      byArea: tally(services.map((s) => s.workArea ?? NOT_INFORMED)),
      byEquipment: tally(services.map((s) => s.equipmentTag)),
      byResult: tally(services.map((s) => s.resultingStatus ?? NOT_INFORMED)),
      services,
    };
  }
}

export type DailyReport = ReturnType<ReportService['daily']>;

export function reportRoutes(service: ReportService) {
  return new Hono<Env>()
    .get('/days', (c) => c.json(service.days()))
    .get('/daily', (c) => c.json(service.daily(parseBody(reportDateSchema, c.req.query('date')))))
    .get('/daily.pdf', async (c) => {
      const date = parseBody(reportDateSchema, c.req.query('date'));
      const bytes = await reportPdf(service.daily(date));
      return new Response(bytes.slice(), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="relatorio-${date}.pdf"`,
        },
      });
    });
}
