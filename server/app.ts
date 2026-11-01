import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import type { Db } from './db/connection.ts';
import { AppError } from './http.ts';
import { AiService, DemoProvider, aiRoutes } from './modules/ai/ai.ts';
import { DocumentService, documentRoutes } from './modules/documents/documents.ts';
import { EquipmentService, componentRoutes, equipmentRoutes } from './modules/equipment/equipment.ts';
import { LocalInventoryProvider, inventoryRoutes } from './modules/inventory/inventory.ts';
import { MaintenanceService, maintenanceRoutes } from './modules/maintenance/maintenance.ts';
import { ReportService, reportRoutes } from './modules/reports/reports.ts';
import { searchIndex } from './modules/search/search.ts';
import { demoUser, userRoutes, type Env } from './modules/users/users.ts';
import { FileStore } from './storage/photos.ts';

export function createApp(db: Db, opts: { uploadDir: string; files?: FileStore }) {
  const files = opts.files ?? new FileStore(opts.uploadDir);
  const equipment = new EquipmentService(db);
  const maintenance = new MaintenanceService(db, files);
  const documents = new DocumentService(db, files);
  const ai = new AiService(db, new DemoProvider(db));

  const count = (sql: string) => (db.prepare(sql).get() as { n: number }).n;

  const api = new Hono<Env>()
    .use('*', demoUser(db))
    .route('/', userRoutes(db))
    .route('/equipment', equipmentRoutes(equipment))
    .route('/components', componentRoutes(equipment))
    .route('/maintenance', maintenanceRoutes(maintenance, files))
    .route('/documents', documentRoutes(documents, files))
    .route('/reports', reportRoutes(new ReportService(db)))
    .route('/inventory', inventoryRoutes(new LocalInventoryProvider(db)))
    .route('/ai', aiRoutes(ai))
    .get('/search', (c) => c.json(searchIndex(db, c.req.query('q') ?? '', { limit: 30 })))
    // Apenas contagens reais do banco, sem métricas estimadas.
    .get('/overview', (c) => c.json({
      equipmentByStatus: db.prepare('SELECT status, COUNT(*) AS count FROM equipment GROUP BY status').all(),
      equipmentTotal: count('SELECT COUNT(*) AS n FROM equipment'),
      maintenanceTotal: count('SELECT COUNT(*) AS n FROM maintenance_records'),
      documentTotal: count('SELECT COUNT(*) AS n FROM documents'),
      recentMaintenance: maintenance.list({ page: 1, pageSize: 5 }).items,
    }));

  const app = new Hono();
  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: { code: err.code, message: err.message, details: err.details } }, err.status);
    }
    console.error(err);
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Erro interno. Tente novamente.' } }, 500);
  });
  app.notFound((c) => c.json({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' } }, 404));
  app.route('/api', api);
  app.use('/uploads/*', serveStatic({
    root: opts.uploadDir,
    rewriteRequestPath: (p) => p.replace(/^\/uploads/, ''),
  }));
  app.use('/*', serveStatic({ root: './public' }));
  return app;
}
