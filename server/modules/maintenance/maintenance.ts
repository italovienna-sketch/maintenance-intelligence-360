import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import {
  maintenanceCreateSchema,
  maintenanceUpdateSchema,
  photoMetaSchema,
  type MaintenanceCreate,
  type MaintenancePart,
  type MaintenanceUpdate,
} from '../../../shared/schemas.ts';
import { tx, type Db } from '../../db/connection.ts';
import { AppError, intParam, notFound, parseBody, readJson } from '../../http.ts';
import type { FileStore } from '../../storage/photos.ts';
import { indexEntity, removeFromIndex, searchIndex } from '../search/search.ts';
import { requirePermission, type Env } from '../users/users.ts';

export interface PhotoInput {
  path: string;
  stage: 'BEFORE' | 'AFTER';
  caption?: string;
  isIllustrative?: boolean;
}

interface RecordRow {
  id: string;
  equipmentId: string;
  equipmentTag: string;
  equipmentName: string;
  occurredAt: string;
  reportedProblem: string;
  inspection: string;
  identifiedCause: string | null;
  workPerformed: string;
  observations: string | null;
  technicianId: string;
  technicianName: string;
  workArea: string | null;
  resultingStatus: string | null;
  createdAt: string;
}

const RECORD_SELECT = `SELECT r.id, r.equipment_id AS equipmentId, e.tag AS equipmentTag,
  e.name AS equipmentName, r.occurred_at AS occurredAt, r.reported_problem AS reportedProblem,
  r.inspection, r.identified_cause AS identifiedCause, r.work_performed AS workPerformed,
  r.observations, r.technician_id AS technicianId, u.name AS technicianName,
  r.work_area AS workArea, r.resulting_status AS resultingStatus, r.created_at AS createdAt
  FROM maintenance_records r
  JOIN equipment e ON e.id = r.equipment_id
  JOIN users u ON u.id = r.technician_id`;

export class MaintenanceRepository {
  constructor(private readonly db: Db) {}

  list(f: { equipmentId?: string; technicianId?: string; from?: string; to?: string; ids?: string[];
    limit: number; offset: number }) {
    const where: string[] = [];
    const params: string[] = [];
    if (f.ids) {
      if (f.ids.length === 0) return { total: 0, items: [] as RecordRow[] };
      where.push(`r.id IN (${f.ids.map(() => '?').join(',')})`);
      params.push(...f.ids);
    }
    if (f.equipmentId) { where.push('r.equipment_id = ?'); params.push(f.equipmentId); }
    if (f.technicianId) { where.push('r.technician_id = ?'); params.push(f.technicianId); }
    if (f.from) { where.push('r.occurred_at >= ?'); params.push(f.from); }
    if (f.to) { where.push('r.occurred_at <= ?'); params.push(f.to); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = (this.db.prepare(`SELECT COUNT(*) AS n FROM maintenance_records r ${clause}`)
      .get(...params) as { n: number }).n;
    const items = this.db
      .prepare(`${RECORD_SELECT} ${clause} ORDER BY julianday(r.occurred_at) DESC LIMIT ? OFFSET ?`)
      .all(...params, f.limit, f.offset) as unknown as RecordRow[];
    return { total, items };
  }

  /** Serviços de um dia no fuso da planta (UTC−3). */
  byDay(date: string) {
    return this.db.prepare(
      `${RECORD_SELECT} WHERE date(r.occurred_at, '-3 hours') = ? ORDER BY julianday(r.occurred_at)`,
    ).all(date) as unknown as RecordRow[];
  }

  days(limit: number) {
    return this.db.prepare(
      `SELECT date(occurred_at, '-3 hours') AS date, COUNT(*) AS services FROM maintenance_records
       GROUP BY 1 ORDER BY 1 DESC LIMIT ?`,
    ).all(limit) as unknown as { date: string; services: number }[];
  }

  get(id: string) {
    return this.db.prepare(`${RECORD_SELECT} WHERE r.id = ?`).get(id) as RecordRow | undefined;
  }

  parts(recordId: string) {
    return this.db.prepare(
      `SELECT id, direction, component_id AS componentId, inventory_sku AS inventorySku, description, quantity
       FROM maintenance_parts WHERE record_id = ? ORDER BY direction DESC, description`,
    ).all(recordId);
  }

  photos(recordId: string) {
    const rows = this.db.prepare(
      `SELECT id, stage, path, caption, is_illustrative AS isIllustrative
       FROM maintenance_photos WHERE record_id = ? ORDER BY stage DESC, id`,
    ).all(recordId) as unknown as { isIllustrative: number }[];
    return rows.map((r) => ({ ...r, isIllustrative: r.isIllustrative === 1 }));
  }

  documents(recordId: string) {
    return this.db.prepare(
      `SELECT d.id, d.title, d.doc_type AS docType, d.file_path AS filePath FROM documents d
       JOIN maintenance_documents md ON md.document_id = d.id WHERE md.record_id = ? ORDER BY d.title`,
    ).all(recordId);
  }

  insert(id: string, r: MaintenanceCreate, createdAt: string) {
    this.db.prepare(
      `INSERT INTO maintenance_records (id, equipment_id, occurred_at, reported_problem, inspection,
        identified_cause, work_performed, observations, technician_id, work_area, resulting_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, r.equipmentId, r.occurredAt, r.reportedProblem, r.inspection, r.identifiedCause ?? null,
      r.workPerformed, r.observations ?? null, r.technicianId, r.workArea ?? null, r.resultingStatus ?? null, createdAt);
  }

  update(id: string, p: MaintenanceUpdate) {
    const columns: Record<string, string | undefined> = {
      occurred_at: p.occurredAt, reported_problem: p.reportedProblem, inspection: p.inspection,
      identified_cause: p.identifiedCause, work_performed: p.workPerformed, observations: p.observations, work_area: p.workArea,
    };
    const set = Object.entries(columns).filter(([, v]) => v !== undefined) as [string, string][];
    if (set.length === 0) return;
    this.db.prepare(`UPDATE maintenance_records SET ${set.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`)
      .run(...set.map(([, v]) => v), id);
  }

  replaceParts(recordId: string, parts: MaintenancePart[]) {
    this.db.prepare('DELETE FROM maintenance_parts WHERE record_id = ?').run(recordId);
    const insert = this.db.prepare(
      `INSERT INTO maintenance_parts (id, record_id, direction, component_id, inventory_sku, description, quantity)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const p of parts) {
      insert.run(randomUUID(), recordId, p.direction, p.componentId ?? null, p.inventorySku ?? null,
        p.description, p.quantity);
    }
  }

  replaceDocuments(recordId: string, documentIds: string[]) {
    this.db.prepare('DELETE FROM maintenance_documents WHERE record_id = ?').run(recordId);
    const insert = this.db.prepare('INSERT INTO maintenance_documents (record_id, document_id) VALUES (?, ?)');
    for (const id of new Set(documentIds)) insert.run(recordId, id);
  }

  insertPhoto(recordId: string, p: PhotoInput) {
    const id = randomUUID();
    this.db.prepare(
      `INSERT INTO maintenance_photos (id, record_id, stage, path, caption, is_illustrative)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(id, recordId, p.stage, p.path, p.caption ?? null, p.isIllustrative ? 1 : 0);
    return id;
  }

  photo(id: string) {
    return this.db.prepare('SELECT id, record_id AS recordId, path FROM maintenance_photos WHERE id = ?')
      .get(id) as { id: string; recordId: string; path: string } | undefined;
  }

  deletePhoto(id: string) {
    this.db.prepare('DELETE FROM maintenance_photos WHERE id = ?').run(id);
  }

  delete(id: string) {
    this.db.prepare('DELETE FROM maintenance_records WHERE id = ?').run(id);
  }
}

export class MaintenanceService {
  private readonly repo: MaintenanceRepository;

  constructor(private readonly db: Db, private readonly files: FileStore) {
    this.repo = new MaintenanceRepository(db);
  }

  list(q: { q?: string; equipmentId?: string; technicianId?: string; from?: string; to?: string;
    page: number; pageSize: number }) {
    const ids = q.q?.trim()
      ? searchIndex(this.db, q.q, { types: ['MAINTENANCE'], limit: 200 }).map((h) => h.entityId)
      : undefined;
    const { total, items } = this.repo.list({ ...q, ids, limit: q.pageSize, offset: (q.page - 1) * q.pageSize });
    return { total, page: q.page, pageSize: q.pageSize, items: items.map((r) => this.summary(r)) };
  }

  private summary(r: RecordRow) {
    const parts = this.repo.parts(r.id) as unknown as { direction: string }[];
    const photos = this.repo.photos(r.id);
    return {
      ...r,
      removedCount: parts.filter((p) => p.direction === 'REMOVED').length,
      installedCount: parts.filter((p) => p.direction === 'INSTALLED').length,
      photoCount: photos.length,
    };
  }

  get(id: string) {
    const record = this.repo.get(id);
    if (!record) throw notFound('Registro de manutenção');
    return {
      ...record,
      parts: this.repo.parts(id),
      photos: this.repo.photos(id),
      documents: this.repo.documents(id),
    };
  }

  create(input: MaintenanceCreate, photos: PhotoInput[] = []) {
    this.checkReferences(input.equipmentId, input.parts, input.documentIds);
    if (!this.db.prepare('SELECT 1 FROM users WHERE id = ?').get(input.technicianId)) {
      throw this.invalid('technicianId', 'Técnico não encontrado.');
    }
    const id = randomUUID();
    tx(this.db, () => {
      this.repo.insert(id, input, new Date().toISOString());
      this.repo.replaceParts(id, input.parts);
      this.repo.replaceDocuments(id, input.documentIds);
      for (const photo of photos) this.repo.insertPhoto(id, photo);
      if (input.resultingStatus) {
        this.db.prepare('UPDATE equipment SET status = ? WHERE id = ?').run(input.resultingStatus, input.equipmentId);
      }
      this.reindex(id);
    });
    return this.get(id);
  }

  update(id: string, patch: MaintenanceUpdate) {
    const record = this.repo.get(id);
    if (!record) throw notFound('Registro de manutenção');
    this.checkReferences(record.equipmentId, patch.parts ?? [], patch.documentIds ?? []);
    tx(this.db, () => {
      this.repo.update(id, patch);
      if (patch.parts) this.repo.replaceParts(id, patch.parts);
      if (patch.documentIds) this.repo.replaceDocuments(id, patch.documentIds);
      this.reindex(id);
    });
    return this.get(id);
  }

  delete(id: string) {
    if (!this.repo.get(id)) throw notFound('Registro de manutenção');
    const paths = this.repo.photos(id) as unknown as { path: string }[];
    tx(this.db, () => {
      this.repo.delete(id);
      removeFromIndex(this.db, 'MAINTENANCE', id);
    });
    for (const p of paths) this.files.remove(p.path);
  }

  addPhoto(recordId: string, photo: PhotoInput) {
    if (!this.repo.get(recordId)) throw notFound('Registro de manutenção');
    this.repo.insertPhoto(recordId, photo);
    return this.get(recordId);
  }

  deletePhoto(recordId: string, photoId: string) {
    const photo = this.repo.photo(photoId);
    if (!photo || photo.recordId !== recordId) throw notFound('Foto');
    this.repo.deletePhoto(photoId);
    this.files.remove(photo.path);
  }

  reindex(id: string) {
    const r = this.repo.get(id)!;
    const parts = this.repo.parts(id) as unknown as { description: string }[];
    indexEntity(this.db, 'MAINTENANCE', id, r.equipmentId, r.reportedProblem,
      [r.inspection, r.identifiedCause, r.workPerformed, r.observations, r.workArea, r.technicianName, ...parts.map((p) => p.description)]
        .filter(Boolean).join(' '));
  }

  private invalid(field: string, message: string) {
    return new AppError(400, 'VALIDATION_ERROR', 'Verifique os campos informados.', [{ field, message }]);
  }

  private checkReferences(equipmentId: string, parts: MaintenancePart[], documentIds: string[]) {
    if (!this.db.prepare('SELECT 1 FROM equipment WHERE id = ?').get(equipmentId)) {
      throw this.invalid('equipmentId', 'Equipamento não encontrado.');
    }
    const component = this.db.prepare('SELECT 1 FROM components WHERE id = ? AND equipment_id = ?');
    const sku = this.db.prepare('SELECT 1 FROM inventory_items WHERE sku = ?');
    parts.forEach((p, i) => {
      if (p.componentId && !component.get(p.componentId, equipmentId)) {
        throw this.invalid(`parts.${i}.componentId`, 'Componente não pertence a este equipamento.');
      }
      if (p.inventorySku && !sku.get(p.inventorySku)) {
        throw this.invalid(`parts.${i}.inventorySku`, 'Item de estoque não encontrado.');
      }
    });
    const doc = this.db.prepare('SELECT 1 FROM documents WHERE id = ?');
    documentIds.forEach((id, i) => {
      if (!doc.get(id)) throw this.invalid(`documentIds.${i}`, 'Documento não encontrado.');
    });
  }
}

// Formulário multipart: campo "data" (JSON), arquivos "photos" e "photoMeta" (JSON, mesma ordem).
async function readCreateForm(c: { req: { parseBody(o: { all: true }): Promise<Record<string, unknown>> } }) {
  const form = await c.req.parseBody({ all: true });
  let data: unknown;
  let meta: unknown;
  try {
    data = JSON.parse(String(form.data ?? ''));
    meta = JSON.parse(String(form.photoMeta ?? '[]'));
  } catch {
    throw new AppError(400, 'INVALID_JSON', 'Formulário inválido.');
  }
  const raw = form.photos;
  const files = (Array.isArray(raw) ? raw : raw ? [raw] : []).filter((f): f is File => f instanceof File);
  const metas = (Array.isArray(meta) ? meta : []).map((m) => parseBody(photoMetaSchema, m));
  if (metas.length !== files.length) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Informe se cada foto é de antes ou depois.');
  }
  return { data, files, metas };
}

export function maintenanceRoutes(service: MaintenanceService, files: FileStore) {
  return new Hono<Env>()
    .get('/', (c) => {
      const { q, equipmentId, technicianId, from, to, page, pageSize } = c.req.query();
      return c.json(service.list({
        q, equipmentId, technicianId, from, to,
        page: intParam(page, 1, 10_000),
        pageSize: intParam(pageSize, 20, 100),
      }));
    })
    .get('/:id', (c) => c.json(service.get(c.req.param('id'))))
    .post('/', async (c) => {
      requirePermission(c.get('user'), 'maintenance:write');
      if (!c.req.header('content-type')?.includes('multipart/form-data')) {
        return c.json(service.create(parseBody(maintenanceCreateSchema, await readJson(c))), 201);
      }
      const form = await readCreateForm(c);
      const input = parseBody(maintenanceCreateSchema, form.data);
      const saved: string[] = [];
      try {
        const photos: PhotoInput[] = [];
        for (const [i, file] of form.files.entries()) {
          const path = await files.savePhoto(file);
          saved.push(path);
          photos.push({ path, stage: form.metas[i]!.stage, caption: form.metas[i]!.caption });
        }
        return c.json(service.create(input, photos), 201);
      } catch (err) {
        for (const path of saved) files.remove(path);
        throw err;
      }
    })
    .patch('/:id', async (c) => {
      requirePermission(c.get('user'), 'maintenance:write');
      return c.json(service.update(c.req.param('id'), parseBody(maintenanceUpdateSchema, await readJson(c))));
    })
    .delete('/:id', (c) => {
      requirePermission(c.get('user'), 'maintenance:delete');
      service.delete(c.req.param('id'));
      return c.body(null, 204);
    })
    .post('/:id/photos', async (c) => {
      requirePermission(c.get('user'), 'maintenance:write');
      const form = await c.req.parseBody();
      if (!(form.photo instanceof File)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Selecione uma foto.');
      }
      const meta = parseBody(photoMetaSchema, { stage: form.stage, caption: form.caption });
      const path = await files.savePhoto(form.photo);
      try {
        return c.json(service.addPhoto(c.req.param('id'), { path, ...meta }), 201);
      } catch (err) {
        files.remove(path);
        throw err;
      }
    })
    .delete('/:id/photos/:photoId', (c) => {
      requirePermission(c.get('user'), 'maintenance:write');
      service.deletePhoto(c.req.param('id'), c.req.param('photoId'));
      return c.body(null, 204);
    });
}
