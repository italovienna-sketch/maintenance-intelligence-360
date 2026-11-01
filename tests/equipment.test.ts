import { describe, expect, it } from 'vitest';
import { setup, SUPERVISOR } from './helpers.ts';

const newEquipment = {
  tag: 'BC-900', name: 'Bomba de teste', category: 'BOMBA_CENTRIFUGA', manufacturer: 'HidroDemo',
  model: 'HD-T', location: 'Planta Demonstração — Teste', status: 'EM_OPERACAO',
};

describe('equipamentos', () => {
  it('lista o seed e filtra por categoria, situação e local', async () => {
    const { request } = setup();
    expect(await (await request('GET', '/equipment')).json()).toHaveLength(8);
    expect(await (await request('GET', '/equipment?category=MOTOR_ELETRICO')).json()).toHaveLength(2);
    const waiting = await (await request('GET', '/equipment?status=AGUARDANDO_PECA')).json() as { tag: string }[];
    expect(waiting.map((e) => e.tag)).toEqual(['BC-102']);
    const facets = await (await request('GET', '/equipment/facets')).json() as { locations: string[] };
    expect(facets.locations.length).toBeGreaterThan(1);
  });

  it('recusa filtro inválido', async () => {
    const res = await setup().request('GET', '/equipment?status=QUEBRADO');
    expect(res.status).toBe(400);
  });

  it('busca sem acento e por componente', async () => {
    const { request } = setup();
    const a = await (await request('GET', '/equipment?q=centrifuga')).json() as { tag: string }[];
    expect(a.map((e) => e.tag)).toContain('BC-101');
    const b = await (await request('GET', '/equipment?q=acoplamento')).json() as { tag: string }[];
    expect(b.map((e) => e.tag)).toContain('CM-401');
    const none = await (await request('GET', '/equipment?q=xyzinexistente')).json();
    expect(none).toEqual([]);
  });

  it('entrega o perfil completo', async () => {
    const res = await setup().request('GET', '/equipment/bc-101');
    const p = await res.json() as Record<string, unknown[]> & { maintenanceCount: number };
    expect(p.components!.length).toBeGreaterThan(5);
    expect(p.recentOccurrences!.length).toBe(5);
    expect(p.documents!.length).toBeGreaterThan(0);
    expect(p.maintenanceCount).toBe(6);
  });

  it('só o supervisor cria, altera e exclui', async () => {
    const { request } = setup();
    expect((await request('POST', '/equipment', newEquipment)).status).toBe(403);
    expect((await request('POST', '/equipment', newEquipment, SUPERVISOR)).status).toBe(201);
    expect((await request('POST', '/equipment', newEquipment, SUPERVISOR)).status).toBe(409);
    const patched = await request('PATCH', '/equipment/bc-900', { status: 'FORA_DE_OPERACAO' }, SUPERVISOR);
    expect((await patched.json() as { status: string }).status).toBe('FORA_DE_OPERACAO');
    expect((await request('DELETE', '/equipment/bc-900', undefined, SUPERVISOR)).status).toBe(204);
    expect((await request('GET', '/equipment/bc-900')).status).toBe(404);
  });

  it('não exclui equipamento com histórico', async () => {
    const res = await setup().request('DELETE', '/equipment/bc-101', undefined, SUPERVISOR);
    expect(res.status).toBe(409);
  });

  it('valida campos com mensagens por campo', async () => {
    const res = await setup().request('POST', '/equipment', { ...newEquipment, tag: 'errado', name: '' }, SUPERVISOR);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: { details: { field: string }[] } };
    expect(body.error.details.map((d) => d.field)).toEqual(expect.arrayContaining(['tag', 'name']));
  });

  it('faz CRUD de componentes e atualiza a busca', async () => {
    const { request } = setup();
    const created = await request('POST', '/equipment/bc-101/components',
      { name: 'Manômetro especial', category: 'INSTRUMENTO' }, SUPERVISOR);
    expect(created.status).toBe(201);
    const { id } = await created.json() as { id: string };
    expect(await (await request('GET', '/equipment?q=manometro')).json()).toHaveLength(1);
    await request('PATCH', `/components/${id}`, { name: 'Sensor especial' }, SUPERVISOR);
    expect(await (await request('GET', '/equipment?q=manometro')).json()).toHaveLength(0);
    expect((await request('DELETE', `/components/${id}`, undefined, SUPERVISOR)).status).toBe(204);
    expect(await (await request('GET', '/equipment?q=sensor')).json()).toHaveLength(0);
  });
});
