import { describe, expect, it } from 'vitest';
import { setup, validRecord } from './helpers.ts';

interface Report {
  total: number;
  partsInstalled: number;
  byTechnician: { label: string; count: number }[];
  byArea: { label: string; count: number }[];
  byResult: { label: string; count: number }[];
  services: { workArea: string | null; technicianName: string }[];
}

describe('relatório do dia', () => {
  it('conta os serviços do dia com mecânico, local e resultado', async () => {
    const { request } = setup();
    const r = await (await request('GET', '/reports/daily?date=2026-10-29')).json() as Report;
    expect(r.total).toBe(6);
    expect(r.partsInstalled).toBe(1);
    expect(r.byTechnician).toContainEqual({ label: 'Rafael Moura', count: 3 });
    expect(r.byArea).toContainEqual({ label: 'Fabricação', count: 1 });
    expect(r.byResult).toContainEqual({ label: 'EM_OPERACAO', count: 3 });
  });

  it('grava o local e o resultado do registro e separa o dia pelo fuso da planta', async () => {
    const { request } = setup();
    const res = await request('POST', '/maintenance', {
      ...validRecord(), occurredAt: '2026-10-31T01:30:00.000Z', workArea: 'ETA', resultingStatus: 'EM_OPERACAO',
    });
    expect(res.status).toBe(201);
    const r = await (await request('GET', '/reports/daily?date=2026-10-30')).json() as Report;
    expect(r.services.at(-1)?.workArea).toBe('ETA');
    expect(r.byResult).toContainEqual({ label: 'EM_OPERACAO', count: 1 });
  });

  it('recusa local fora da lista e data inválida', async () => {
    const { request } = setup();
    expect((await request('POST', '/maintenance', { ...validRecord(), workArea: 'Marte' })).status).toBe(400);
    expect((await request('GET', '/reports/daily?date=ontem')).status).toBe(400);
  });

  it('lista os dias com serviço e gera o PDF', async () => {
    const { request } = setup();
    const days = await (await request('GET', '/reports/days')).json() as { date: string; services: number }[];
    expect(days).toContainEqual({ date: '2026-10-29', services: 6 });
    const pdf = await request('GET', '/reports/daily.pdf?date=2026-10-29');
    expect(pdf.headers.get('content-type')).toBe('application/pdf');
    expect(new TextDecoder().decode((await pdf.arrayBuffer()).slice(0, 5))).toBe('%PDF-');
  });
});
