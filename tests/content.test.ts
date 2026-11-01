import { existsSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { describe, expect, it } from 'vitest';
import { EQUIPMENT } from '../server/db/seed/catalog.ts';
import { loadDocuments } from '../server/db/seed/documents.ts';
import { RECORDS } from '../server/db/seed/records.ts';

describe('conteúdo de demonstração', () => {
  it('cada componente com nó 3D existe no GLB da bomba', async () => {
    await MeshoptDecoder.ready;
    const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
    const doc = await io.read('public/models/bc-101.glb');
    const nodes = new Set(doc.getRoot().listNodes().map((n) => n.getName()));
    const wanted = EQUIPMENT.find((e) => e.tag === 'BC-101')!.components.flatMap((c) => c.modelNode ?? []);
    expect(wanted.length).toBeGreaterThan(5);
    expect(wanted.filter((n) => !nodes.has(n))).toEqual([]);
  });

  it('todo documento tem PDF gerado e aponta para equipamentos existentes', () => {
    const tags = new Set(EQUIPMENT.map((e) => e.tag));
    for (const d of loadDocuments('content/documents')) {
      expect(existsSync(`public/docs/${d.id}.pdf`), d.id).toBe(true);
      expect(d.equipment.filter((t) => !tags.has(t)), d.id).toEqual([]);
    }
  });

  it('o histórico tem datas passadas e chaves únicas', () => {
    expect(new Set(RECORDS.map((r) => r.key)).size).toBe(RECORDS.length);
    expect(RECORDS.filter((r) => new Date(r.at) > new Date('2026-11-01'))).toEqual([]);
  });
});
