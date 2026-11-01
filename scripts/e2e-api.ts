// Fim a fim contra o servidor real: registra uma manutenção e confere a linha do tempo.
const base = process.env.API_URL ?? 'http://localhost:8787/api';

const call = async (path: string, init?: RequestInit) => {
  const res = await fetch(`${base}${path}`, init);
  return { status: res.status, body: await res.json() as any };
};

const before = await call('/equipment/bs-202');
const created = await call('/maintenance', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    equipmentId: 'bs-202',
    occurredAt: new Date().toISOString(),
    reportedProblem: 'Teste fim a fim: vazamento de óleo',
    inspection: 'Inspeção de teste',
    workPerformed: 'Serviço de teste',
    technicianId: 'u-mecanico-1',
  }),
});
const after = await call('/equipment/bs-202');
const answer = await call('/ai/ask', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ equipmentId: 'bs-202', question: 'vazamento no selo' }),
});
const pdf = await fetch(base.replace('/api', '/docs/proc-correias.pdf'));

const ok = created.status === 201
  && after.body.maintenanceCount === before.body.maintenanceCount + 1
  && after.body.recentOccurrences[0].id === created.body.id
  && answer.body.blocks.length > 0
  && pdf.status === 200;

console.log({ created: created.status, count: [before.body.maintenanceCount, after.body.maintenanceCount],
  blocks: answer.body.blocks.length, pdf: pdf.status });
process.exitCode = ok ? 0 : 1;
