import type { Db } from '../../db/connection.ts';

export type EntityType = 'EQUIPMENT' | 'COMPONENT' | 'MAINTENANCE' | 'DOCUMENT_SECTION' | 'DOCUMENT';

export interface SearchHit {
  entityType: EntityType;
  entityId: string;
  parentId: string | null;
  title: string;
  excerpt: string;
}

const STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'e', 'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas',
  'um', 'uma', 'uns', 'umas', 'para', 'por', 'com', 'sem', 'que', 'qual', 'quais', 'como',
  'ao', 'aos', 'se', 'ser', 'esta', 'este', 'essa', 'esse', 'isso', 'tem', 'ter', 'foi',
  'ja', 'mais', 'muito', 'sobre', 'quando', 'onde', 'porque', 'pode', 'sao', 'estou',
]);

const stripAccents = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '');

export function tokenize(query: string): string[] {
  const words = stripAccents(query.toLowerCase()).match(/[\p{L}\p{N}]+/gu) ?? [];
  return [...new Set(words.filter((w) => w.length > 1 && !STOPWORDS.has(w)))];
}

// Transforma texto livre em consulta FTS5 segura: cada termo vira prefixo entre aspas.
function toMatch(tokens: string[], joiner: 'AND' | 'OR'): string {
  return tokens.map((t) => `"${t}"*`).join(` ${joiner} `);
}

export function searchIndex(
  db: Db,
  query: string,
  opts: { types?: EntityType[]; limit?: number; anyTerm?: boolean; parentIds?: string[] } = {},
): SearchHit[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const params: (string | number)[] = [toMatch(tokens, opts.anyTerm ? 'OR' : 'AND')];
  let filter = '';
  if (opts.types?.length) {
    filter += ` AND entity_type IN (${opts.types.map(() => '?').join(',')})`;
    params.push(...opts.types);
  }
  if (opts.parentIds?.length) {
    filter += ` AND parent_id IN (${opts.parentIds.map(() => '?').join(',')})`;
    params.push(...opts.parentIds);
  }
  params.push(opts.limit ?? 30);
  return db
    .prepare(
      `SELECT entity_type AS entityType, entity_id AS entityId, parent_id AS parentId, title,
              snippet(search_index, 4, '[[', ']]', ' … ', 24) AS excerpt
       FROM search_index WHERE search_index MATCH ?${filter}
       ORDER BY bm25(search_index, 0, 0, 0, 4, 1) LIMIT ?`,
    )
    .all(...params) as unknown as SearchHit[];
}

export function indexEntity(
  db: Db,
  type: EntityType,
  id: string,
  parentId: string | null,
  title: string,
  body: string,
): void {
  removeFromIndex(db, type, id);
  db.prepare(
    'INSERT INTO search_index (entity_type, entity_id, parent_id, title, body) VALUES (?, ?, ?, ?, ?)',
  ).run(type, id, parentId, title, body);
}

export function removeFromIndex(db: Db, type: EntityType, id: string): void {
  db.prepare('DELETE FROM search_index WHERE entity_type = ? AND entity_id = ?').run(type, id);
}
