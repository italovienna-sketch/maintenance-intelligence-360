import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import {
  askSchema,
  confirmationSchema,
  type AiAnswer,
  type AiBlock,
  type AiCitation,
  type Ask,
  type ConfirmationInput,
} from '../../../shared/schemas.ts';
import type { Db } from '../../db/connection.ts';
import { notFound, parseBody, readJson } from '../../http.ts';
import { searchIndex, tokenize, type SearchHit } from '../search/search.ts';
import { requirePermission, type Env } from '../users/users.ts';
import { DIAGNOSTIC_RULES, type DiagnosticRule } from './rules.ts';

export const DEMO_NOTICE = 'Modo demonstração: sem IA ao vivo. As respostas vêm de regras escritas à mão '
  + 'e de buscas nos dados fictícios deste protótipo.';

const SAFETY_NOTE = 'Este assistente não autoriza troca de componentes nem operação do equipamento. '
  + 'A decisão cabe à pessoa responsável, seguindo os procedimentos e o bloqueio de energias.';

export interface AiProvider {
  ask(input: Ask): AiAnswer;
}

const clean = (s: string) => s.replaceAll('[[', '').replaceAll(']]', '');
const date = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');

interface RecordFact {
  id: string;
  occurredAt: string;
  reportedProblem: string;
  identifiedCause: string | null;
  tag: string;
}

export class DemoProvider implements AiProvider {
  constructor(private readonly db: Db) {}

  ask({ equipmentId, question }: Ask): AiAnswer {
    const category = equipmentId ? this.category(equipmentId) : undefined;
    const rules = this.matchRules(question, category);
    const facts: AiBlock[] = [];
    const hypotheses: AiBlock[] = [];
    const inspections: AiBlock[] = [];

    for (const rule of rules) {
      const records = this.records(rule, equipmentId);
      const docs = this.documents(rule, equipmentId);
      const docCitations = docs.map((d) => this.docCitation(d));
      if (records.length > 0) facts.push(this.factBlock(rule, records, equipmentId));
      if (records.length === 0 && docs.length === 0) continue;
      const support = records.slice(0, 3).map(recordCitation).concat(docCitations.slice(0, 2));
      for (const h of rule.hypotheses) {
        hypotheses.push({ type: 'HIPOTESE_IA', ruleId: rule.id, text: h.text, why: h.why, citations: support });
      }
      inspections.push(...rule.inspections.map((text): AiBlock => ({
        type: 'INSPECAO_RECOMENDADA',
        ruleId: rule.id,
        text,
        why: `Verificação associada a: ${rule.symptom.toLowerCase()}.`,
        citations: docCitations.slice(0, 2),
      })));
    }

    if (rules.length === 0) facts.push(...this.freeSearch(question, equipmentId));
    const blocks = [...facts, ...hypotheses, ...inspections, ...this.confirmations(rules, equipmentId)];
    return {
      mode: 'DEMONSTRACAO',
      notice: `${DEMO_NOTICE} ${SAFETY_NOTE}`,
      insufficientData: blocks.length === 0,
      blocks,
    };
  }

  private category(equipmentId: string): string {
    const row = this.db.prepare('SELECT category FROM equipment WHERE id = ?').get(equipmentId) as
      | { category: string } | undefined;
    if (!row) throw notFound('Equipamento');
    return row.category;
  }

  private matchRules(question: string, category?: string): DiagnosticRule[] {
    const tokens = tokenize(question);
    return DIAGNOSTIC_RULES.filter((r) =>
      (!category || r.appliesTo.includes(category))
      && r.symptomTerms.some((term) => tokens.some((t) => t.startsWith(term))));
  }

  private records(rule: DiagnosticRule, equipmentId?: string): RecordFact[] {
    const hits = searchIndex(this.db, rule.evidenceTerms, {
      types: ['MAINTENANCE'],
      anyTerm: true,
      parentIds: equipmentId ? [equipmentId] : undefined,
      limit: 50,
    });
    if (hits.length === 0) return [];
    const rows = this.db.prepare(
      `SELECT r.id, r.occurred_at AS occurredAt, r.reported_problem AS reportedProblem,
        r.identified_cause AS identifiedCause, e.tag
       FROM maintenance_records r JOIN equipment e ON e.id = r.equipment_id
       WHERE r.id IN (${hits.map(() => '?').join(',')}) ORDER BY r.occurred_at DESC`,
    ).all(...hits.map((h) => h.entityId));
    return rows as unknown as RecordFact[];
  }

  private documents(rule: DiagnosticRule, equipmentId?: string): SearchHit[] {
    const hits = searchIndex(this.db, rule.evidenceTerms, { types: ['DOCUMENT_SECTION'], anyTerm: true, limit: 20 });
    if (!equipmentId) return hits.slice(0, 3);
    const linked = this.db.prepare('SELECT 1 FROM document_equipment WHERE document_id = ? AND equipment_id = ?');
    return hits.filter((h) => linked.get(h.parentId, equipmentId)).slice(0, 3);
  }

  private docCitation(hit: SearchHit): AiCitation {
    const doc = this.db.prepare('SELECT title FROM documents WHERE id = ?').get(hit.parentId) as { title: string };
    return {
      kind: 'DOCUMENTO',
      id: hit.parentId!,
      label: `${doc.title} — ${hit.title}`,
      excerpt: clean(hit.excerpt),
    };
  }

  private factBlock(rule: DiagnosticRule, records: RecordFact[], equipmentId?: string): AiBlock {
    const scope = equipmentId ? 'neste equipamento' : 'na planta';
    const dates = records.slice(0, 5).map((r) => date(r.occurredAt)).join(', ');
    const recurrent = records.length >= 2 ? ' Sintoma recorrente.' : '';
    return {
      type: 'FATO_HISTORICO',
      ruleId: rule.id,
      text: `${rule.symptom}: ${records.length} registro(s) ${scope}. Mais recentes: ${dates}.${recurrent}`,
      citations: records.slice(0, 5).map(recordCitation),
    };
  }

  private freeSearch(question: string, equipmentId?: string): AiBlock[] {
    const hits = searchIndex(this.db, question, {
      types: ['MAINTENANCE', 'DOCUMENT_SECTION'],
      parentIds: undefined,
      limit: 20,
    }).filter((h) => h.entityType === 'DOCUMENT_SECTION' || !equipmentId || h.parentId === equipmentId);
    return hits.slice(0, 5).map((h): AiBlock => {
      if (h.entityType === 'DOCUMENT_SECTION') {
        const citation = this.docCitation(h);
        return { type: 'FATO_HISTORICO', text: `Trecho encontrado: ${citation.label}.`, citations: [citation] };
      }
      const r = this.db.prepare(
        `SELECT r.id, r.occurred_at AS occurredAt, r.reported_problem AS reportedProblem, e.tag
         FROM maintenance_records r JOIN equipment e ON e.id = r.equipment_id WHERE r.id = ?`,
      ).get(h.entityId) as unknown as RecordFact;
      return {
        type: 'FATO_HISTORICO',
        text: `Registro de ${date(r.occurredAt)} em ${r.tag}: ${r.reportedProblem}`,
        citations: [recordCitation(r)],
      };
    });
  }

  private confirmations(rules: DiagnosticRule[], equipmentId?: string): AiBlock[] {
    if (!equipmentId || rules.length === 0) return [];
    const rows = this.db.prepare(
      `SELECT c.rule_id AS ruleId, c.conclusion, c.record_id AS recordId, c.confirmed_at AS confirmedAt,
        u.name AS confirmedBy FROM ai_confirmations c JOIN users u ON u.id = c.confirmed_by
       WHERE c.equipment_id = ? ORDER BY c.confirmed_at DESC`,
    ).all(equipmentId) as unknown as { ruleId: string; conclusion: string; recordId: string | null;
      confirmedAt: string; confirmedBy: string }[];
    const ruleIds = new Set(rules.map((r) => r.id));
    return rows.filter((r) => ruleIds.has(r.ruleId)).map((r) => ({
      type: 'CONCLUSAO_HUMANA' as const,
      ruleId: r.ruleId,
      text: `${r.conclusion} (confirmado por ${r.confirmedBy} em ${date(r.confirmedAt)})`,
      citations: r.recordId
        ? [{ kind: 'MANUTENCAO' as const, id: r.recordId, label: 'Registro relacionado' }]
        : [],
    }));
  }
}

const recordCitation = (r: RecordFact): AiCitation => ({
  kind: 'MANUTENCAO',
  id: r.id,
  label: `${r.tag} — ${date(r.occurredAt)}`,
  excerpt: r.identifiedCause ?? r.reportedProblem,
});

export class AiService {
  constructor(private readonly db: Db, private readonly provider: AiProvider) {}

  ask(input: Ask) {
    return this.provider.ask(input);
  }

  // Contagem real: nada aqui é estimado.
  recurringSymptoms(equipmentId: string) {
    const row = this.db.prepare('SELECT category FROM equipment WHERE id = ?').get(equipmentId) as
      | { category: string } | undefined;
    if (!row) throw notFound('Equipamento');
    return DIAGNOSTIC_RULES.filter((r) => r.appliesTo.includes(row.category)).flatMap((rule) => {
      const hits = searchIndex(this.db, rule.evidenceTerms, {
        types: ['MAINTENANCE'], anyTerm: true, parentIds: [equipmentId], limit: 100,
      });
      return hits.length > 0
        ? [{ ruleId: rule.id, symptom: rule.symptom, occurrences: hits.length, recordIds: hits.map((h) => h.entityId) }]
        : [];
    }).sort((a, b) => b.occurrences - a.occurrences);
  }

  confirm(input: ConfirmationInput, userId: string) {
    if (!this.db.prepare('SELECT 1 FROM equipment WHERE id = ?').get(input.equipmentId)) throw notFound('Equipamento');
    if (!DIAGNOSTIC_RULES.some((r) => r.id === input.ruleId)) throw notFound('Regra');
    if (input.recordId && !this.db.prepare('SELECT 1 FROM maintenance_records WHERE id = ?').get(input.recordId)) {
      throw notFound('Registro de manutenção');
    }
    const id = randomUUID();
    const confirmedAt = new Date().toISOString();
    this.db.prepare(
      `INSERT INTO ai_confirmations (id, equipment_id, rule_id, conclusion, record_id, confirmed_by, confirmed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, input.equipmentId, input.ruleId, input.conclusion, input.recordId ?? null, userId, confirmedAt);
    return { id, ...input, confirmedBy: userId, confirmedAt };
  }
}

export function aiRoutes(service: AiService) {
  return new Hono<Env>()
    .post('/ask', async (c) => c.json(service.ask(parseBody(askSchema, await readJson(c)))))
    .get('/recurring/:equipmentId', (c) => c.json(service.recurringSymptoms(c.req.param('equipmentId'))))
    .post('/confirmations', async (c) => {
      requirePermission(c.get('user'), 'ai:confirm');
      const body = parseBody(confirmationSchema, await readJson(c));
      return c.json(service.confirm(body, c.get('user').id), 201);
    });
}
