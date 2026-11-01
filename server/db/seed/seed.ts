import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { WORK_AREAS } from '../../../shared/schemas.ts';
import { tx, type Db } from '../connection.ts';
import { EquipmentRepository, EquipmentService } from '../../modules/equipment/equipment.ts';
import { MaintenanceRepository, MaintenanceService } from '../../modules/maintenance/maintenance.ts';
import { indexEntity } from '../../modules/search/search.ts';
import { FileStore } from '../../storage/photos.ts';
import { EQUIPMENT, INVENTORY, USERS } from './catalog.ts';
import { loadDocuments } from './documents.ts';
import { RECORDS, RECORD_PHOTOS } from './records.ts';

const SEED_DATE = '2026-11-01T12:00:00.000Z';

export function seed(db: Db, opts: { publicDir: string; contentDir: string }): void {
  const inPublic = (path: string) => (existsSync(join(opts.publicDir, path)) ? `/${path}` : null);
  const equipmentService = new EquipmentService(db);
  const equipmentRepo = new EquipmentRepository(db);
  const maintenanceService = new MaintenanceService(db, new FileStore('data/uploads'));
  const maintenanceRepo = new MaintenanceRepository(db);

  tx(db, () => {
    for (const u of USERS) db.prepare('INSERT INTO users (id, name, role) VALUES (?, ?, ?)').run(u.id, u.name, u.role);
    for (const i of INVENTORY) {
      db.prepare('INSERT INTO inventory_items (sku, name, unit, quantity_on_hand, storage_location) VALUES (?, ?, ?, ?, ?)')
        .run(...i);
    }

    const componentIds = new Map<string, string>();
    for (const e of EQUIPMENT) {
      const id = e.tag.toLowerCase();
      equipmentRepo.insert(id, e, SEED_DATE);
      db.prepare('UPDATE equipment SET image_path = ?, model_path = ? WHERE id = ?').run(
        inPublic(`images/equipment/${id}.webp`),
        e.modelFile ? inPublic(`models/${e.modelFile}`) : null,
        id,
      );
      equipmentService.reindex(id);
      e.components.forEach((c, i) => {
        const componentId = `${id}-c${String(i + 1).padStart(2, '0')}`;
        equipmentRepo.insertComponent(componentId, id, {
          name: c.name,
          category: c.category,
          partCode: c.partCode,
          quantity: c.quantity ?? 1,
          modelNode: c.modelNode,
          inventorySku: c.inventorySku,
          description: c.description,
        });
        equipmentService.reindexComponent(componentId);
        componentIds.set(`${id}/${c.name}`, componentId);
      });
    }

    const docs = loadDocuments(opts.contentDir);
    for (const d of docs) {
      db.prepare(
        `INSERT INTO documents (id, title, doc_type, summary, file_path, is_illustrative, created_at)
         VALUES (?, ?, ?, ?, ?, 1, ?)`,
      ).run(d.id, d.title, d.type, d.summary, inPublic(`docs/${d.id}.pdf`), SEED_DATE);
      for (const tag of d.equipment) {
        db.prepare('INSERT INTO document_equipment (document_id, equipment_id) VALUES (?, ?)').run(d.id, tag.toLowerCase());
      }
      indexEntity(db, 'DOCUMENT', d.id, null, d.title, d.summary);
      d.sections.forEach((s, i) => {
        const sectionId = `${d.id}-s${i + 1}`;
        db.prepare('INSERT INTO document_sections (id, document_id, position, heading, body) VALUES (?, ?, ?, ?, ?)')
          .run(sectionId, d.id, i + 1, s.heading, s.body);
        indexEntity(db, 'DOCUMENT_SECTION', sectionId, d.id, s.heading, s.body);
      });
    }

    // Por padrão o serviço foi feito onde a máquina fica.
    const locationArea = new Map(EQUIPMENT.map((e) => [e.tag, e.location.split(' — ')[1]]));
    for (const r of RECORDS) {
      const equipmentId = r.tag.toLowerCase();
      const parts = (r.parts ?? []).map((p) => {
        const componentId = p.component ? componentIds.get(`${equipmentId}/${p.component}`) : undefined;
        if (p.component && !componentId) throw new Error(`Componente desconhecido em ${r.key}: ${p.component}`);
        return { direction: p.dir, componentId, inventorySku: p.sku, description: p.desc, quantity: p.qty };
      });
      maintenanceRepo.insert(r.key, {
        equipmentId,
        occurredAt: r.at,
        reportedProblem: r.problem,
        inspection: r.inspection,
        identifiedCause: r.cause,
        workPerformed: r.work,
        observations: r.notes,
        technicianId: `u-mecanico-${r.tech}`,
        workArea: r.area ?? (locationArea.get(r.tag) as (typeof WORK_AREAS)[number]),
        resultingStatus: r.result,
        parts,
        documentIds: r.docs ?? [],
      }, SEED_DATE);
      maintenanceRepo.replaceParts(r.key, parts);
      maintenanceRepo.replaceDocuments(r.key, r.docs ?? []);
      for (const p of RECORD_PHOTOS[r.key] ?? []) {
        const path = inPublic(`images/maintenance/${p.file}`);
        if (path) maintenanceRepo.insertPhoto(r.key, { path, stage: p.stage, caption: p.caption, isIllustrative: true });
      }
      maintenanceService.reindex(r.key);
    }

    db.prepare(
      `INSERT INTO ai_confirmations (id, equipment_id, rule_id, conclusion, record_id, confirmed_by, confirmed_at)
       VALUES ('conf-1', 'bc-101', 'vibracao-mancal', ?, 'bc101-2', 'u-supervisor-1', '2024-11-06T09:00:00-03:00')`,
    ).run('Causa confirmada em campo: desalinhamento entre motor e bomba.');
  });
}
