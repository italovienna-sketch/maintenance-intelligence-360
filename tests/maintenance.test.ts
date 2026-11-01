import { describe, expect, it } from 'vitest';
import { PNG, setup, SUPERVISOR, validRecord } from './helpers.ts';

interface Page { total: number; items: { id: string; occurredAt: string }[] }

describe('manutenção', () => {
  it('lista em ordem cronológica decrescente e pagina', async () => {
    const page = await (await setup().request('GET', '/maintenance?pageSize=5')).json() as Page;
    expect(page.total).toBe(36);
    expect(page.items).toHaveLength(5);
    const dates = page.items.map((r) => new Date(r.occurredAt).getTime());
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it('filtra por equipamento, período e texto sem acento', async () => {
    const { request } = setup();
    expect((await (await request('GET', '/maintenance?equipmentId=bs-201')).json() as Page).total).toBe(6);
    const dated = await (await request('GET', '/maintenance?from=2026-10-01&to=2026-10-31')).json() as Page;
    expect(dated.total).toBeGreaterThan(0);
    expect((await (await request('GET', '/maintenance?q=vibracao')).json() as Page).total).toBeGreaterThan(2);
  });

  it('registra a manutenção e atualiza a linha do tempo e a situação', async () => {
    const { request } = setup();
    const res = await request('POST', '/maintenance', { ...validRecord(), resultingStatus: 'EM_MANUTENCAO' });
    expect(res.status).toBe(201);
    const created = await res.json() as { id: string; parts: unknown[] };
    expect(created.parts).toHaveLength(2);
    const profile = await (await request('GET', '/equipment/bc-101')).json() as {
      status: string; maintenanceCount: number; recentOccurrences: { id: string }[];
    };
    expect(profile.recentOccurrences[0]!.id).toBe(created.id);
    expect(profile.maintenanceCount).toBe(7);
    expect(profile.status).toBe('EM_MANUTENCAO');
    const found = await (await request('GET', '/maintenance?q=ruido+novo')).json() as Page;
    expect(found.items.map((r) => r.id)).toContain(created.id);
  });

  it('valida campos obrigatórios e data futura', async () => {
    const { request } = setup();
    const missing = await request('POST', '/maintenance', { ...validRecord(), reportedProblem: '  ' });
    expect(missing.status).toBe(400);
    const future = await request('POST', '/maintenance', { ...validRecord(), occurredAt: '2099-01-01T00:00:00Z' });
    expect(future.status).toBe(400);
  });

  it('recusa peça de outro equipamento', async () => {
    const res = await setup().request('POST', '/maintenance', {
      ...validRecord(),
      parts: [{ direction: 'REMOVED', componentId: 'bs-201-c01', description: 'x', quantity: 1 }],
    });
    expect(res.status).toBe(400);
  });

  it('desfaz tudo se a gravação falhar no meio', async () => {
    const { db, form, uploadedFiles, request } = setup();
    db.exec(`CREATE TRIGGER fail_photo BEFORE INSERT ON maintenance_photos
      BEGIN SELECT RAISE(ABORT, 'falha simulada'); END`);
    const data = new FormData();
    data.set('data', JSON.stringify({ ...validRecord(), resultingStatus: 'FORA_DE_OPERACAO' }));
    data.set('photoMeta', JSON.stringify([{ stage: 'BEFORE' }]));
    data.append('photos', new File([PNG], 'a.png', { type: 'image/png' }));
    expect((await form('/maintenance', data)).status).toBe(500);
    expect((await (await request('GET', '/maintenance')).json() as Page).total).toBe(36);
    const e = await (await request('GET', '/equipment/bc-101')).json() as { status: string };
    expect(e.status).toBe('EM_OPERACAO');
    expect(uploadedFiles()).toEqual([]);
  });

  it('salva fotos com o registro', async () => {
    const { form, uploadedFiles } = setup();
    const data = new FormData();
    data.set('data', JSON.stringify(validRecord()));
    data.set('photoMeta', JSON.stringify([{ stage: 'BEFORE', caption: 'Antes' }, { stage: 'AFTER' }]));
    data.append('photos', new File([PNG], 'a.png'));
    data.append('photos', new File([PNG], 'b.png'));
    const res = await form('/maintenance', data);
    expect(res.status).toBe(201);
    const body = await res.json() as { photos: { stage: string; path: string; isIllustrative: boolean }[] };
    expect(body.photos.map((p) => p.stage).sort()).toEqual(['AFTER', 'BEFORE']);
    expect(body.photos[0]!.isIllustrative).toBe(false);
    expect(uploadedFiles()).toHaveLength(2);
  });

  it('recusa arquivo que não é imagem, mesmo com nome .png', async () => {
    const { form, uploadedFiles } = setup();
    const data = new FormData();
    data.set('data', JSON.stringify(validRecord()));
    data.set('photoMeta', JSON.stringify([{ stage: 'BEFORE' }]));
    data.append('photos', new File(['<script>'], 'falso.png', { type: 'image/png' }));
    expect((await form('/maintenance', data)).status).toBe(415);
    expect(uploadedFiles()).toEqual([]);
  });

  it('adiciona e remove foto de um registro existente', async () => {
    const { form, request, uploadedFiles } = setup();
    const data = new FormData();
    data.set('photo', new File([PNG], 'a.png'));
    data.set('stage', 'AFTER');
    const res = await form('/maintenance/bc101-5/photos', data);
    expect(res.status).toBe(201);
    const { photos } = await res.json() as { photos: { id: string }[] };
    expect((await request('DELETE', `/maintenance/bc101-5/photos/${photos[0]!.id}`)).status).toBe(204);
    expect(uploadedFiles()).toEqual([]);
  });

  it('edita registro e reindexa', async () => {
    const { request } = setup();
    const res = await request('PATCH', '/maintenance/bc101-5', { workPerformed: 'Serviço zumbificado' });
    expect(res.status).toBe(200);
    expect((await (await request('GET', '/maintenance?q=zumbificado')).json() as Page).total).toBe(1);
  });

  it('só o supervisor exclui registro', async () => {
    const { request } = setup();
    expect((await request('DELETE', '/maintenance/bc101-5')).status).toBe(403);
    expect((await request('DELETE', '/maintenance/bc101-5', undefined, SUPERVISOR)).status).toBe(204);
    expect((await request('GET', '/maintenance/bc101-5')).status).toBe(404);
    expect((await (await request('GET', '/maintenance')).json() as Page).total).toBe(35);
  });
});
