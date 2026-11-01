import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import {
  componentCreateSchema,
  componentUpdateSchema,
  equipmentCategory,
  equipmentCreateSchema,
  equipmentStatus,
  equipmentUpdateSchema,
  type ComponentCreate,
  type ComponentUpdate,
  type EquipmentCreate,
  type EquipmentUpdate,
  type Spec,
} from '../../../shared/schemas.ts';
import { tx, type Db } from '../../db/connection.ts';
import { AppError, notFound, parseBody, readJson } from '../../http.ts';
import { indexEntity, removeFromIndex, searchIndex } from '../search/search.ts';
import { requirePermission, type Env } from '../users/users.ts';

interface EquipmentRow {
  id: string;
  tag: string;
  name: string;
  category: string;
  manufacturer: string;
  model: string;
  serial_number: string | null;
  location: string;
  status: string;
  description: string;
  specs_json: string;
  image_path: string | null;
  model_path: string | null;
  created_at: string;
}

const toEquipment = (r: EquipmentRow) => ({
  id: r.id,
  tag: r.tag,
  name: r.name,
  category: r.category,
  manufacturer: r.manufacturer,
  model: r.model,
  serialNumber: r.serial_number,
  location: r.location,
  status: r.status,
  description: r.description,
  specs: JSON.parse(r.specs_json) as Spec[],
  imagePath: r.image_path,
  modelPath: r.model_path,
  createdAt: r.created_at,
});

const COMPONENT_SELECT = `SELECT id, equipment_id AS equipmentId, name, category, part_code AS partCode,
  quantity, model_node AS modelNode, inventory_sku AS inventorySku, description FROM components`;

export class EquipmentRepository {
  constructor(private readonly db: Db) {}

  list(filters: { ids?: string[]; category?: string; status?: string; location?: string }) {
    const where: string[] = [];
    const params: string[] = [];
    if (filters.ids) {
      if (filters.ids.length === 0) return [];
      where.push(`id IN (${filters.ids.map(() => '?').join(',')})`);
      params.push(...filters.ids);
    }
    if (filters.category) { where.push('category = ?'); params.push(filters.category); }
    if (filters.status) { where.push('status = ?'); params.push(filters.status); }
    if (filters.location) { where.push('location = ?'); params.push(filters.location); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = this.db.prepare(`SELECT * FROM equipment ${clause} ORDER BY tag`).all(...params);
    return (rows as unknown as EquipmentRow[]).map(toEquipment);
  }

  get(id: string) {
    const row = this.db.prepare('SELECT * FROM equipment WHERE id = ?').get(id) as EquipmentRow | undefined;
    return row ? toEquipment(row) : undefined;
  }

  locations(): string[] {
    const rows = this.db.prepare('SELECT DISTINCT location FROM equipment ORDER BY location').all();
    return (rows as unknown as { location: string }[]).map((r) => r.location);
  }

  insert(id: string, e: EquipmentCreate, createdAt: string) {
    this.db.prepare(
      `INSERT INTO equipment (id, tag, name, category, manufacturer, model, serial_number, location,
        status, description, specs_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, e.tag, e.name, e.category, e.manufacturer, e.model, e.serialNumber ?? null, e.location,
      e.status, e.description, JSON.stringify(e.specs), createdAt);
  }

  update(id: string, p: EquipmentUpdate) {
    const columns: Record<string, string | null | undefined> = {
      name: p.name, category: p.category, manufacturer: p.manufacturer, model: p.model,
      serial_number: p.serialNumber, location: p.location, status: p.status, description: p.description,
      specs_json: p.specs && JSON.stringify(p.specs),
    };
    const set = Object.entries(columns).filter(([, v]) => v !== undefined) as [string, string | null][];
    if (set.length === 0) return;
    this.db.prepare(`UPDATE equipment SET ${set.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`)
      .run(...set.map(([, v]) => v), id);
  }

  setStatus(id: string, status: string) {
    this.db.prepare('UPDATE equipment SET status = ? WHERE id = ?').run(status, id);
  }

  delete(id: string) {
    this.db.prepare('DELETE FROM equipment WHERE id = ?').run(id);
  }

  countRecords(id: string): number {
    const row = this.db.prepare('SELECT COUNT(*) AS n FROM maintenance_records WHERE equipment_id = ?').get(id);
    return (row as { n: number }).n;
  }

  components(equipmentId: string) {
    return this.db.prepare(`${COMPONENT_SELECT} WHERE equipment_id = ? ORDER BY category, name`).all(equipmentId);
  }

  component(id: string) {
    return this.db.prepare(`${COMPONENT_SELECT} WHERE id = ?`).get(id) as
      | (ComponentCreate & { id: string; equipmentId: string })
      | undefined;
  }

  insertComponent(id: string, equipmentId: string, c: ComponentCreate) {
    this.db.prepare(
      `INSERT INTO components (id, equipment_id, name, category, part_code, quantity, model_node,
        inventory_sku, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, equipmentId, c.name, c.category, c.partCode ?? null, c.quantity, c.modelNode ?? null,
      c.inventorySku ?? null, c.description);
  }

  updateComponent(id: string, p: ComponentUpdate) {
    const columns: Record<string, string | number | undefined> = {
      name: p.name, category: p.category, part_code: p.partCode, quantity: p.quantity,
      model_node: p.modelNode, inventory_sku: p.inventorySku, description: p.description,
    };
    const set = Object.entries(columns).filter(([, v]) => v !== undefined) as [string, string | number][];
    if (set.length === 0) return;
    this.db.prepare(`UPDATE components SET ${set.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`)
      .run(...set.map(([, v]) => v), id);
  }

  deleteComponent(id: string) {
    this.db.prepare('DELETE FROM components WHERE id = ?').run(id);
  }
}

export class EquipmentService {
  private readonly repo: EquipmentRepository;

  constructor(private readonly db: Db) {
    this.repo = new EquipmentRepository(db);
  }

  list(filters: { q?: string; category?: string; status?: string; location?: string }) {
    const { q, ...rest } = filters;
    if (!q?.trim()) return this.repo.list(rest);
    const hits = searchIndex(this.db, q, { types: ['EQUIPMENT', 'COMPONENT'], limit: 100 });
    const ids = [...new Set(hits.map((h) => h.parentId ?? h.entityId))];
    return this.repo.list({ ...rest, ids });
  }

  facets() {
    return { locations: this.repo.locations() };
  }

  require(id: string) {
    const equipment = this.repo.get(id);
    if (!equipment) throw notFound('Equipamento');
    return equipment;
  }

  profile(id: string) {
    const equipment = this.require(id);
    const recent = this.db.prepare(
      `SELECT id, occurred_at AS occurredAt, reported_problem AS reportedProblem,
        identified_cause AS identifiedCause FROM maintenance_records
       WHERE equipment_id = ? ORDER BY occurred_at DESC LIMIT 5`,
    ).all(id);
    const documents = this.db.prepare(
      `SELECT d.id, d.title, d.doc_type AS docType, d.summary, d.file_path AS filePath
       FROM documents d JOIN document_equipment de ON de.document_id = d.id
       WHERE de.equipment_id = ? ORDER BY d.title`,
    ).all(id);
    return {
      ...equipment,
      components: this.repo.components(id),
      recentOccurrences: recent,
      maintenanceCount: this.repo.countRecords(id),
      documents,
    };
  }

  create(input: EquipmentCreate) {
    const id = input.tag.toLowerCase();
    try {
      tx(this.db, () => {
        this.repo.insert(id, input, new Date().toISOString());
        this.reindex(id);
      });
    } catch (err) {
      if (String(err).includes('UNIQUE')) {
        throw new AppError(409, 'TAG_IN_USE', `A TAG ${input.tag} já está em uso.`);
      }
      throw err;
    }
    return this.require(id);
  }

  update(id: string, patch: EquipmentUpdate) {
    this.require(id);
    tx(this.db, () => {
      this.repo.update(id, patch);
      this.reindex(id);
    });
    return this.require(id);
  }

  delete(id: string) {
    this.require(id);
    const records = this.repo.countRecords(id);
    if (records > 0) {
      throw new AppError(409, 'HAS_HISTORY',
        `Este equipamento tem ${records} registro(s) de manutenção e não pode ser excluído.`);
    }
    tx(this.db, () => {
      for (const c of this.repo.components(id) as unknown as { id: string }[]) {
        removeFromIndex(this.db, 'COMPONENT', c.id);
      }
      this.repo.delete(id);
      removeFromIndex(this.db, 'EQUIPMENT', id);
    });
  }

  components(equipmentId: string) {
    this.require(equipmentId);
    return this.repo.components(equipmentId);
  }

  createComponent(equipmentId: string, input: ComponentCreate) {
    this.require(equipmentId);
    const id = randomUUID();
    tx(this.db, () => {
      this.repo.insertComponent(id, equipmentId, input);
      this.reindexComponent(id);
    });
    return this.repo.component(id);
  }

  updateComponent(id: string, patch: ComponentUpdate) {
    if (!this.repo.component(id)) throw notFound('Componente');
    tx(this.db, () => {
      this.repo.updateComponent(id, patch);
      this.reindexComponent(id);
    });
    return this.repo.component(id);
  }

  deleteComponent(id: string) {
    if (!this.repo.component(id)) throw notFound('Componente');
    tx(this.db, () => {
      this.repo.deleteComponent(id);
      removeFromIndex(this.db, 'COMPONENT', id);
    });
  }

  reindex(id: string) {
    const e = this.repo.get(id)!;
    indexEntity(this.db, 'EQUIPMENT', id, null, `${e.tag} ${e.name}`,
      [e.manufacturer, e.model, e.location, e.description].join(' '));
  }

  reindexComponent(id: string) {
    const c = this.repo.component(id)!;
    indexEntity(this.db, 'COMPONENT', id, c.equipmentId, c.name, `${c.partCode ?? ''} ${c.description}`);
  }
}

function filter<T>(value: string | undefined, schema: { safeParse(v: unknown): { success: boolean } }, label: string) {
  if (value !== undefined && !schema.safeParse(value).success) {
    throw new AppError(400, 'INVALID_FILTER', `Filtro inválido: ${label}.`);
  }
  return value as T | undefined;
}

export function equipmentRoutes(service: EquipmentService) {
  return new Hono<Env>()
    .get('/', (c) => {
      const { q, category, status, location } = c.req.query();
      return c.json(service.list({
        q,
        category: filter(category || undefined, equipmentCategory, 'categoria'),
        status: filter(status || undefined, equipmentStatus, 'situação'),
        location: location || undefined,
      }));
    })
    .get('/facets', (c) => c.json(service.facets()))
    .get('/:id', (c) => c.json(service.profile(c.req.param('id'))))
    .post('/', async (c) => {
      requirePermission(c.get('user'), 'equipment:write');
      return c.json(service.create(parseBody(equipmentCreateSchema, await readJson(c))), 201);
    })
    .patch('/:id', async (c) => {
      requirePermission(c.get('user'), 'equipment:write');
      return c.json(service.update(c.req.param('id'), parseBody(equipmentUpdateSchema, await readJson(c))));
    })
    .delete('/:id', (c) => {
      requirePermission(c.get('user'), 'equipment:delete');
      service.delete(c.req.param('id'));
      return c.body(null, 204);
    })
    .get('/:id/components', (c) => c.json(service.components(c.req.param('id'))))
    .post('/:id/components', async (c) => {
      requirePermission(c.get('user'), 'component:write');
      const body = parseBody(componentCreateSchema, await readJson(c));
      return c.json(service.createComponent(c.req.param('id'), body), 201);
    });
}

export function componentRoutes(service: EquipmentService) {
  return new Hono<Env>()
    .patch('/:id', async (c) => {
      requirePermission(c.get('user'), 'component:write');
      const body = parseBody(componentUpdateSchema, await readJson(c));
      return c.json(service.updateComponent(c.req.param('id'), body));
    })
    .delete('/:id', (c) => {
      requirePermission(c.get('user'), 'component:write');
      service.deleteComponent(c.req.param('id'));
      return c.body(null, 204);
    });
}
