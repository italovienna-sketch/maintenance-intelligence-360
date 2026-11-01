import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export interface ContentDocument {
  id: string;
  title: string;
  type: string;
  equipment: string[];
  summary: string;
  sections: { heading: string; body: string }[];
}

// Cabeçalho "chave: valor" entre linhas ---, seguido de seções "## Título".
export function parseDocument(id: string, source: string): ContentDocument {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(source);
  if (!match) throw new Error(`Documento sem cabeçalho: ${id}`);
  const meta = Object.fromEntries(match[1]!.split(/\r?\n/).map((line) => {
    const i = line.indexOf(':');
    return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
  })) as Record<'title' | 'type' | 'equipment' | 'summary', string>;
  const sections = match[2]!.split(/^## /m).slice(1).map((block) => {
    const end = block.indexOf('\n');
    return { heading: block.slice(0, end).trim(), body: block.slice(end + 1).trim() };
  });
  return {
    id,
    title: meta.title,
    type: meta.type,
    equipment: meta.equipment.split(',').map((t: string) => t.trim()).filter(Boolean),
    summary: meta.summary,
    sections,
  };
}

export function loadDocuments(dir: string): ContentDocument[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => parseDocument(f.replace(/\.md$/, ''), readFileSync(join(dir, f), 'utf8')));
}
