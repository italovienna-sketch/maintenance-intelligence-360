import { describe, expect, it } from 'vitest';
import { setup, SUPERVISOR } from './helpers.ts';

const pdf = () => new File(['%PDF-1.7 teste'], 'doc.pdf', { type: 'application/pdf' });

describe('documentos', () => {
  it('lista os documentos marcados como ilustrativos', async () => {
    const res = await setup().request('GET', '/documents');
    const { items } = await res.json() as { items: { isIllustrative: boolean; filePath: string | null }[] };
    expect(items).toHaveLength(10);
    expect(items.every((d) => d.isIllustrative)).toBe(true);
  });

  it('filtra por tipo e equipamento', async () => {
    const { request } = setup();
    const a = await (await request('GET', '/documents?type=PROCEDIMENTO')).json() as { items: unknown[] };
    expect(a.items).toHaveLength(6);
    const b = await (await request('GET', '/documents?equipmentId=tr-501')).json() as { items: unknown[] };
    expect(b.items).toHaveLength(1);
  });

  it('busca por trecho sem acento, respeitando filtros', async () => {
    const { request } = setup();
    const res = await request('GET', '/documents?q=lubrificacao&equipmentId=bc-101');
    const body = await res.json() as { kind: string; items: { documentId: string; heading: string }[] };
    expect(body.kind).toBe('excerpts');
    expect(body.items).toContainEqual(expect.objectContaining({ documentId: 'spec-hd-c100', heading: 'Lubrificação' }));
    const excerpt = await (await request('GET', '/documents?q=gradeamento')).json() as { items: { excerpt: string }[] };
    expect(excerpt.items[0]!.excerpt).toContain('[[gradeamento]]');
  });

  it('entrega as seções do documento', async () => {
    const doc = await (await setup().request('GET', '/documents/proc-correias')).json() as { sections: unknown[] };
    expect(doc.sections).toHaveLength(4);
  });

  it('supervisor envia PDF e ele aparece como não ilustrativo; arquivo inválido é recusado', async () => {
    const { form, request } = setup();
    const data = new FormData();
    data.set('title', 'Nota técnica interna');
    data.set('docType', 'COMPONENTE');
    data.set('equipmentIds', 'bc-101');
    data.set('file', pdf());
    expect((await form('/documents', data)).status).toBe(403);
    const created = await form('/documents', data, SUPERVISOR);
    expect(created.status).toBe(201);
    const { id, isIllustrative } = await created.json() as { id: string; isIllustrative: boolean };
    expect(isIllustrative).toBe(false);
    expect(await (await request('GET', '/documents?q=nota+tecnica')).json()).toMatchObject({ items: [{ documentId: id }] });

    const bad = new FormData();
    bad.set('title', 'x');
    bad.set('docType', 'MANUAL');
    bad.set('file', new File(['oi'], 'x.pdf'));
    expect((await form('/documents', bad, SUPERVISOR)).status).toBe(415);

    expect((await request('DELETE', `/documents/${id}`, undefined, SUPERVISOR)).status).toBe(204);
    expect((await request('GET', `/documents/${id}`)).status).toBe(404);
  });
});
