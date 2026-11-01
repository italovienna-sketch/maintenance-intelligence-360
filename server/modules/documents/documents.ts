import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { documentType, documentUploadSchema, type DocumentUpload } from '../../../shared/schemas.ts';
import { tx, type Db } from '../../db/connection.ts';
import { AppError, notFound, parseBody } from '../../http.ts';
import type { FileStore } from '../../storage/photos.ts';
import { indexEntity, removeFromIndex, searchIndex } from '../search/search.ts';
import { requirePermission, type Env } from '../users/users.ts';

const DOC_SELECT = `SELECT d.id, d.title, d.doc_type AS docType, d.summary, d.file_path AS filePath,
  d.is_illustrative AS isIllustrative, d.created_at AS createdAt FROM documents d`;

interface DocRow {
  id: string;
  title: string;
  docType: string;
  summary: string;
  filePath: string | null;
  isIllustrative: number;
  createdAt: string;
}

export class DocumentService {
  constructor(private readonly db: Db, private readonly files: FileStore) {}

  private present(row: DocRow) {
    const equipment = this.db.prepare(
      `SELECT e.id, e.tag, e.name FROM equipment e JOIN document_equipment de ON de.equipment_id = e.id
       WHERE de.document_id = ? ORDER BY e.tag`,
    ).all(row.id);
    return { ...row, isIllustrative: row.isIllustrative === 1, equipment };
  }

  list(f: { docType?: string; equipmentId?: string }) {
    const where: string[] = [];
    const params: string[] = [];
    if (f.docType) { where.push('d.doc_type = ?'); params.push(f.docType); }
    if (f.equipmentId) {
      where.push('EXISTS (SELECT 1 FROM document_equipment de WHERE de.document_id = d.id AND de.equipment_id = ?)');
      params.push(f.equipmentId);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = this.db.prepare(`${DOC_SELECT} ${clause} ORDER BY d.title`).all(...params);
    return (rows as unknown as DocRow[]).map((r) => this.present(r));
  }

  get(id: string) {
    const row = this.db.prepare(`${DOC_SELECT} WHERE d.id = ?`).get(id) as DocRow | undefined;
    if (!row) throw notFound('Documento');
    const sections = this.db.prepare(
      'SELECT id, position, heading, body FROM document_sections WHERE document_id = ? ORDER BY position',
    ).all(id);
    return { ...this.present(row), sections };
  }

  // Resultado por trecho: mostra em qual seção de qual documento o termo aparece.
  search(query: string, f: { docType?: string; equipmentId?: string }) {
    const allowed = new Map(this.list(f).map((d) => [d.id, d]));
    const hits = searchIndex(this.db, query, { types: ['DOCUMENT', 'DOCUMENT_SECTION'], limit: 60 });
    return hits.flatMap((h) => {
      const documentId = h.parentId ?? h.entityId;
      const doc = allowed.get(documentId);
      if (!doc) return [];
      return [{
        documentId,
        documentTitle: doc.title,
        docType: doc.docType,
        filePath: doc.filePath,
        sectionId: h.entityType === 'DOCUMENT_SECTION' ? h.entityId : null,
        heading: h.title,
        excerpt: h.excerpt,
      }];
    });
  }

  create(input: DocumentUpload, filePath: string) {
    for (const id of input.equipmentIds) {
      if (!this.db.prepare('SELECT 1 FROM equipment WHERE id = ?').get(id)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Equipamento não encontrado.');
      }
    }
    const id = randomUUID();
    tx(this.db, () => {
      this.db.prepare(
        `INSERT INTO documents (id, title, doc_type, summary, file_path, is_illustrative, created_at)
         VALUES (?, ?, ?, ?, ?, 0, ?)`,
      ).run(id, input.title, input.docType, input.summary, filePath, new Date().toISOString());
      const link = this.db.prepare('INSERT INTO document_equipment (document_id, equipment_id) VALUES (?, ?)');
      for (const eq of new Set(input.equipmentIds)) link.run(id, eq);
      indexEntity(this.db, 'DOCUMENT', id, null, input.title, input.summary);
    });
    return this.get(id);
  }

  delete(id: string) {
    const doc = this.get(id);
    tx(this.db, () => {
      for (const s of doc.sections as unknown as { id: string }[]) {
        removeFromIndex(this.db, 'DOCUMENT_SECTION', s.id);
      }
      removeFromIndex(this.db, 'DOCUMENT', id);
      this.db.prepare('DELETE FROM documents WHERE id = ?').run(id);
    });
    if (doc.filePath) this.files.remove(doc.filePath);
  }
}

export function documentRoutes(service: DocumentService, files: FileStore) {
  return new Hono<Env>()
    .get('/', (c) => {
      const { q, type, equipmentId } = c.req.query();
      if (type && !documentType.safeParse(type).success) {
        throw new AppError(400, 'INVALID_FILTER', 'Filtro inválido: tipo.');
      }
      const filters = { docType: type || undefined, equipmentId: equipmentId || undefined };
      if (q?.trim()) return c.json({ kind: 'excerpts', items: service.search(q, filters) });
      return c.json({ kind: 'documents', items: service.list(filters) });
    })
    .get('/:id', (c) => c.json(service.get(c.req.param('id'))))
    .post('/', async (c) => {
      requirePermission(c.get('user'), 'document:write');
      const form = await c.req.parseBody({ all: true });
      if (!(form.file instanceof File)) throw new AppError(400, 'VALIDATION_ERROR', 'Selecione um PDF.');
      const ids = form.equipmentIds;
      const input = parseBody(documentUploadSchema, {
        title: form.title,
        docType: form.docType,
        summary: form.summary ?? '',
        equipmentIds: Array.isArray(ids) ? ids : ids ? [ids] : [],
      });
      const path = await files.savePdf(form.file);
      try {
        return c.json(service.create(input, path), 201);
      } catch (err) {
        files.remove(path);
        throw err;
      }
    })
    .delete('/:id', (c) => {
      requirePermission(c.get('user'), 'document:write');
      service.delete(c.req.param('id'));
      return c.body(null, 204);
    });
}
