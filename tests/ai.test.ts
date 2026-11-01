import { describe, expect, it } from 'vitest';
import type { AiAnswer, AiBlock } from '../shared/schemas.ts';
import { setup, SUPERVISOR } from './helpers.ts';

const QUESTIONS: [string, string | undefined][] = [
  ['A bomba está com vibração no mancal', 'bc-101'],
  ['desarmou por sobrecorrente', 'bs-201'],
  ['motor aquecendo', 'mt-301'],
  ['correia chiando e patinando', 'tr-501'],
  ['vazamento no selo', undefined],
];

const ask = async (ctx: ReturnType<typeof setup>, question: string, equipmentId?: string) =>
  await (await ctx.request('POST', '/ai/ask', { question, equipmentId })).json() as AiAnswer;

describe('assistente em modo demonstração', () => {
  it('cita apenas registros e documentos que existem', async () => {
    const ctx = setup();
    for (const [q, eq] of QUESTIONS) {
      const answer = await ask(ctx, q, eq);
      expect(answer.blocks.length).toBeGreaterThan(0);
      for (const c of answer.blocks.flatMap((b) => b.citations)) {
        const path = c.kind === 'MANUTENCAO' ? `/maintenance/${c.id}` : `/documents/${c.id}`;
        expect((await ctx.request('GET', path)).status, c.label).toBe(200);
      }
    }
  });

  it('separa fatos, hipóteses e inspeções, com justificativa', async () => {
    const answer = await ask(setup(), 'vibração no mancal', 'bc-101');
    const of = (type: AiBlock['type']) => answer.blocks.filter((b) => b.type === type);
    expect(answer.mode).toBe('DEMONSTRACAO');
    expect(of('FATO_HISTORICO')[0]!.text).toMatch(/recorrente/i);
    expect(of('HIPOTESE_IA').length).toBeGreaterThan(0);
    expect(of('HIPOTESE_IA').every((b) => b.why && b.citations.length > 0)).toBe(true);
    expect(of('INSPECAO_RECOMENDADA').length).toBeGreaterThan(0);
  });

  it('mostra conclusão humana somente quando há confirmação gravada', async () => {
    const ctx = setup();
    const human = (a: AiAnswer) => a.blocks.filter((b) => b.type === 'CONCLUSAO_HUMANA');
    expect(human(await ask(ctx, 'vibração no mancal', 'bc-101'))).toHaveLength(1);
    expect(human(await ask(ctx, 'vibração no mancal', 'cm-401'))).toHaveLength(0);
  });

  it('diz que faltam dados quando não há base', async () => {
    const answer = await ask(setup(), 'qual a previsão do tempo em Marte');
    expect(answer.insufficientData).toBe(true);
    expect(answer.blocks).toEqual([]);
  });

  it('nunca autoriza troca de peça nem operação', async () => {
    const ctx = setup();
    const forbidden = /(pode operar|liberad[oa] para|autorizad[oa]|troque |substitua |pode trocar)/i;
    for (const [q, eq] of QUESTIONS) {
      const answer = await ask(ctx, q, eq);
      for (const b of answer.blocks) expect(`${b.text} ${b.why ?? ''}`).not.toMatch(forbidden);
      expect(answer.notice).toMatch(/não autoriza/i);
    }
  });

  it('conta sintomas recorrentes a partir do histórico real', async () => {
    const { request } = setup();
    const list = await (await request('GET', '/ai/recurring/bs-201')).json() as { ruleId: string; occurrences: number }[];
    expect(list[0]!.ruleId).toBe('sobrecorrente-entupimento');
    expect(list[0]!.occurrences).toBeGreaterThanOrEqual(4);
  });

  it('só o supervisor registra confirmação, e ela passa a aparecer', async () => {
    const ctx = setup();
    const body = { equipmentId: 'bs-201', ruleId: 'sobrecorrente-entupimento', conclusion: 'Fibras no rotor confirmadas.' };
    expect((await ctx.request('POST', '/ai/confirmations', body)).status).toBe(403);
    expect((await ctx.request('POST', '/ai/confirmations', body, SUPERVISOR)).status).toBe(201);
    const answer = await ask(ctx, 'sobrecorrente', 'bs-201');
    expect(answer.blocks.some((b) => b.type === 'CONCLUSAO_HUMANA' && b.text.includes('Fibras'))).toBe(true);
  });
});
