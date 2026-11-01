/**
 * Maintenance Intelligence 360 — cliente da demonstração.
 * Sem build: templates escapados por h``, rotas por hash e eventos delegados em data-act.
 */
import { mountPumpViewer } from './viewer3d.js';

/* ---------- Metadados de domínio ---------- */
const STATUS = {
  EM_OPERACAO: { label: 'Em operação', icon: '●' },
  EM_MANUTENCAO: { label: 'Em manutenção', icon: '◆' },
  AGUARDANDO_PECA: { label: 'Aguardando peça', icon: '⬢' },
  FORA_DE_OPERACAO: { label: 'Fora de operação', icon: '■' },
};
const CATEGORY = {
  BOMBA_CENTRIFUGA: { label: 'Bombas centrífugas', one: 'Bomba centrífuga', symbol: 'icon-bomba-centrifuga' },
  BOMBA_SUBMERSIVEL: { label: 'Bombas submersíveis', one: 'Bomba submersível', symbol: 'icon-bomba-submersivel' },
  MOTOR_ELETRICO: { label: 'Motores elétricos', one: 'Motor elétrico', symbol: 'icon-motor-eletrico' },
  CONJUNTO_MOTOBOMBA: { label: 'Conjunto motobomba', one: 'Conjunto motobomba', symbol: 'icon-conjunto-motobomba' },
  COMPONENTE_MECANICO: { label: 'Componentes mecânicos', one: 'Componente mecânico', symbol: 'icon-componente-mecanico' },
};
const DOC_TYPE = { MANUAL: 'Manuais', PROCEDIMENTO: 'Procedimentos', ESPECIFICACAO: 'Especificações', COMPONENTE: 'Componentes' };
const ROLE = { MECANICO: 'Mecânico', SUPERVISOR: 'Supervisor' };
const AI_BLOCK = {
  FATO_HISTORICO: { section: 'Fatos históricos', badge: 'FATO HISTÓRICO REGISTRADO', color: 'var(--ai-fact-fg)' },
  CONCLUSAO_HUMANA: { section: 'Conclusões humanas confirmadas', badge: 'CAUSA CONFIRMADA EM CAMPO', color: 'var(--ai-confirmed-fg)' },
  HIPOTESE_IA: { section: 'Hipóteses da IA para verificação', badge: 'HIPÓTESE PARA VERIFICAÇÃO', color: 'var(--ai-hypothesis-fg)' },
  INSPECAO_RECOMENDADA: { section: 'Inspeções recomendadas', badge: 'INSPEÇÃO FÍSICA RECOMENDADA', color: 'var(--ai-inspection-fg)' },
};
const QUICK_SYMPTOMS = {
  BOMBA_CENTRIFUGA: ['Vibração no mancal', 'Ruído no rolamento', 'Vazamento pelo selo', 'Queda de vazão', 'Desarme do motor', 'Preventiva programada'],
  BOMBA_SUBMERSIVEL: ['Entupimento', 'Queda de vazão', 'Desarme por sobrecorrente', 'Vazamento pelo selo', 'Preventiva programada'],
  MOTOR_ELETRICO: ['Aquecimento', 'Vibração no mancal', 'Ruído no rolamento', 'Desarme do motor', 'Preventiva programada'],
  CONJUNTO_MOTOBOMBA: ['Vibração no mancal', 'Vazamento pelo selo', 'Aquecimento', 'Queda de vazão', 'Desarme do motor', 'Preventiva programada'],
  COMPONENTE_MECANICO: ['Correia patinando', 'Chiado na correia', 'Vibração', 'Preventiva programada'],
};
const QUICK_ACTIONS = [
  ['troca', 'Troquei peça', 'Troca de peça'],
  ['limpeza', 'Limpei', 'Limpeza'],
  ['lubrificacao', 'Lubrifiquei', 'Lubrificação'],
  ['reaperto', 'Reapertei', 'Reaperto'],
  ['alinhamento', 'Alinhei', 'Alinhamento'],
  ['inspecao', 'Só inspecionei', 'Inspeção'],
];
const QUICK_RESULTS = [['EM_OPERACAO', 'Funcionando'], ['EM_MANUTENCAO', 'Ainda em manutenção'], ['AGUARDANDO_PECA', 'Aguardando peça'], ['FORA_DE_OPERACAO', 'Parado']];
const WORK_AREAS = ['ETI', 'ETA', 'Fabricação', 'Linha 1', 'Linha 2', 'Linha 3', 'Linha 4', 'Linha 5', 'Linha 6'];
const QUICK_TIMES = [[0, 'Agora'], [30, '30 min atrás'], [60, '1 h atrás'], [120, '2 h atrás'], [240, '4 h atrás']];
// Pinos do corte 2D só existem para a bomba BC, cujo desenho corresponde aos componentes.
const PIN_2D = {
  BC_CASING: [28, 48], BC_INSPECTION_COVER: [16, 62], BC_WEAR_PLATE: [23, 55], BC_FLAP_VALVE: [14, 38],
  BC_IMPELLER: [33, 52], BC_MECH_SEAL_ROTATING: [46, 50], BC_SEAL_HOUSING: [49, 39], BC_BEARING_HOUSING: [68, 42],
  BC_BEARING_INBOARD: [60, 52], BC_BEARING_OUTBOARD: [78, 52], BC_SHAFT: [88, 52],
};
const NAV = [
  ['dashboard', '#/', '▣', 'Visão geral'],
  ['equipment', '#/equipamentos', '❖', 'Equipamentos'],
  ['maintenance', '#/manutencao', '⏱', 'Manutenção'],
  ['assistant', '#/assistente', '✦', 'Assistente IA'],
  ['manuals', '#/manuais', '▤', 'Manuais'],
];
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_PHOTO_SIDE = 1600;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/* ---------- Utilidades ---------- */
class Safe { constructor(s) { this.s = s; } }
const raw = (s) => new Safe(s);
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ESC[c]);
const part = (v) => {
  if (v === null || v === undefined || v === false || v === true) return '';
  if (v instanceof Safe) return v.s;
  if (Array.isArray(v)) return v.map(part).join('');
  return esc(v);
};
/** Template que escapa tudo por padrão; só raw() e outros h`` passam direto. */
function h(strings, ...values) {
  return new Safe(values.reduce((out, v, i) => out + part(v) + strings[i + 1], strings[0]));
}
const $ = (sel, root = document) => root.querySelector(sel);
const paint = (sel, content) => { const el = $(sel); if (el) el.innerHTML = part(content); };
const norm = (s) => String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const debounce = (fn, ms = 220) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const can = (perm) => state.me?.permissions?.includes(perm);
const shortLocation = (s) => String(s ?? '').replace(/^Planta Demonstração — /, '');
const eqById = (id) => state.equipment.find((e) => e.id === id);
const marked = (excerpt) => raw(esc(excerpt).replaceAll('[[', '<mark>').replaceAll(']]', '</mark>'));
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const PLANT_TZ = 'America/Sao_Paulo';
function dateBR(iso, withTime = true) {
  if (!iso) return '';
  const d = new Date(iso);
  const date = d.toLocaleDateString('pt-BR', { timeZone: PLANT_TZ });
  return withTime ? `${date} ${timeBR(iso)}` : date;
}
const timeBR = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: PLANT_TZ, hour: '2-digit', minute: '2-digit' });
const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: PLANT_TZ });
const dayLabel = (date) => date.split('-').reverse().join('/');
const monthLabel = (iso) => new Date(iso).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
const localNow = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

/* ---------- Estado ---------- */
const emptyHistory = () => ({ q: '', equipmentId: '', technicianId: '', from: '', to: '', withParts: false, withPhotos: false });
const state = {
  route: { screen: 'dashboard', id: null },
  demoUserId: 'u-mecanico-1',
  me: null,
  users: [],
  equipment: [],
  inventory: {},
  overview: null,
  attention: {},
  explorer: { category: '', status: '', location: '', q: '', locations: [] },
  detail: null,
  component: null,
  stage: { mode: 'FOTO', xray: false, pins: false, tab: 'componentes', notice: '' },
  records: {},
  expanded: new Set(),
  history: { filters: emptyHistory(), items: [], total: 0, page: 1 },
  ai: { equipmentId: '', question: '', answer: null, loading: false, error: '', recurring: [], confirming: null },
  docs: { q: '', type: '', equipmentId: '', items: [], excerpts: null, selected: null },
  searchResults: [],
  report: { days: [], date: '', data: null },
  wizard: null,
};
let viewer = null;
let routeToken = 0;

/* ---------- API ---------- */
/** No site estático a API roda no navegador (demo.js); aqui ela vem do servidor. */
const send = (url, init) => (window.mi360Demo ?? fetch)(url, init);
async function api(path, options = {}) {
  const headers = new Headers(options.headers);
  headers.set('X-Demo-User', state.demoUserId);
  let body = options.body;
  if (body && !(body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(body);
  }
  let res;
  try {
    res = await send(`/api${path}`, { ...options, body, headers });
  } catch {
    throw new Error('Não foi possível falar com o servidor. Verifique se ele está rodando.');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = data?.error?.details?.[0]?.message;
    throw new Error(detail || data?.error?.message || 'O servidor recusou a operação.');
  }
  return data;
}

async function downloadReport(date) {
  const res = await send(`/api/reports/daily.pdf?date=${date}`, { headers: { 'X-Demo-User': state.demoUserId } });
  if (!res.ok) throw new Error('Não foi possível gerar o PDF.');
  const url = URL.createObjectURL(await res.blob());
  const link = Object.assign(document.createElement('a'), { href: url, download: `relatorio-${date}.pdf` });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function toast(message) {
  const box = $('#toast-region');
  box.innerHTML = part(h`<div class="toast-banner">${message}</div>`);
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { box.innerHTML = ''; }, 4200);
}
/** Executa uma ação de botão e mostra o erro em vez de falhar em silêncio. */
const guard = async (fn) => {
  try { await fn(); } catch (err) { toast(err.message); }
};

/* ---------- Peças visuais compartilhadas ---------- */
const statusPill = (code) => {
  const meta = STATUS[code] ?? STATUS.EM_OPERACAO;
  return h`<span class="status-pill status-${code}"><span aria-hidden="true">${meta.icon}</span> ${meta.label}</span>`;
};
const silhouette = (category) => h`<svg viewBox="0 0 320 200" aria-hidden="true"><use href="#${(CATEGORY[category] ?? CATEGORY.BOMBA_CENTRIFUGA).symbol}"></use></svg>`;
const eqImage = (eq) => (eq.imagePath
  ? h`<img class="eq-render" src="${eq.imagePath}" alt="Modelo conceitual de ${eq.name}" loading="lazy" data-category="${eq.category}" />`
  : silhouette(eq.category));
const loadingBox = (text = 'Carregando…') => h`<div class="state-box" role="status"><span class="spinner" aria-hidden="true"></span>${text}</div>`;
const emptyBox = (title, hint, action) => h`<div class="state-box"><strong>${title}</strong>${hint ? h`<span>${hint}</span>` : ''}${action}</div>`;
const errorBox = (message) => h`
  <div class="state-box state-error" role="alert">
    <strong>Não foi possível carregar esta tela</strong>
    <span>${message}</span>
    <button class="btn btn-secondary btn-sm" data-act="retry">Tentar novamente</button>
  </div>`;
const pageHeader = (kicker, title, subtitle, actions) => h`
  <div class="page-header">
    <div>
      <div class="page-kicker">${kicker}</div>
      <h1 class="page-title" tabindex="-1">${title}</h1>
      ${subtitle ? h`<p class="page-subtitle">${subtitle}</p>` : ''}
    </div>
    ${actions ? h`<div class="page-actions">${actions}</div>` : ''}
  </div>`;
const newMaintenanceBtn = (eqId) => (can('maintenance:write')
  ? h`<button class="btn btn-primary" data-act="openWizard" data-id="${eqId ?? ''}">+ Nova manutenção</button>` : '');

const reportBtn = () => {
  const today = state.report.days.find((d) => d.date === todayISO());
  return h`<a class="btn btn-secondary" href="#/relatorios">Relatório do dia${today ? ` (${today.services})` : ''}</a>`;
};

/* ---------- Visão geral ---------- */
async function loadDashboard() {
  const [overview, equipment, days] = await Promise.all([api('/overview'), api('/equipment'), api('/reports/days')]);
  state.overview = overview;
  state.equipment = equipment;
  state.report.days = days;
  const attention = equipment.filter((e) => e.status !== 'EM_OPERACAO');
  const last = await Promise.all(attention.map((e) => api(`/maintenance?equipmentId=${e.id}&pageSize=1`)));
  state.attention = Object.fromEntries(attention.map((e, i) => [e.id, last[i].items[0]]));
}
function viewDashboard() {
  const ov = state.overview;
  const counts = Object.fromEntries(ov.equipmentByStatus.map((r) => [r.status, r.count]));
  const attention = state.equipment.filter((e) => e.status !== 'EM_OPERACAO');
  return h`
    ${pageHeader('SITUAÇÃO DA PLANTA', 'Visão geral', `${plural(ov.equipmentTotal, 'equipamento', 'equipamentos')}, ${plural(ov.maintenanceTotal, 'intervenção registrada', 'intervenções registradas')} e ${plural(ov.documentTotal, 'documento', 'documentos')}.`, h`${reportBtn()}${newMaintenanceBtn()}`)}
    <div class="status-strip-grid">
      ${Object.keys(STATUS).map((code) => h`
        <button class="status-metric-card" data-act="filterStatus" data-id="${code}">
          <div class="status-metric-top">${statusPill(code)}<span class="mono-tabular muted-sm">Ver máquinas →</span></div>
          <div class="status-metric-number mono-tabular">${counts[code] ?? 0}</div>
        </button>`)}
    </div>
    <div class="dashboard-split">
      <section class="panel-card" aria-labelledby="attention-title">
        <div class="panel-header"><div>
          <h2 class="panel-title" id="attention-title">Precisam de atenção (${attention.length})</h2>
          <p class="muted">Equipamentos que não estão em operação</p>
        </div></div>
        <div class="attention-list">
          ${attention.length === 0 ? emptyBox('Todos os equipamentos estão em operação') : attention.map((eq) => {
            const rec = state.attention[eq.id];
            return h`
              <div class="attention-item">
                <a class="attention-thumb industrial-grid-stage" href="#/equipamentos/${eq.id}" aria-label="Abrir ${eq.tag}">${eqImage(eq)}</a>
                <div class="stack-6">
                  <div class="row-wrap"><span class="tag-plate">${eq.tag}</span><a class="text-link strong" href="#/equipamentos/${eq.id}">${eq.name}</a>${statusPill(eq.status)}</div>
                  <div class="muted">${shortLocation(eq.location)}</div>
                  ${rec ? h`<div class="body-sm">Último registro: ${rec.reportedProblem}</div>` : ''}
                </div>
                ${can('maintenance:write') ? h`<button class="btn btn-ghost btn-sm" data-act="openWizard" data-id="${eq.id}">+ Intervenção</button>` : ''}
              </div>`;
          })}
        </div>
      </section>
      <section class="panel-card" aria-labelledby="recent-title">
        <div class="panel-header">
          <div><h2 class="panel-title" id="recent-title">Últimas intervenções</h2></div>
          <a class="btn btn-ghost btn-sm" href="#/manutencao">Ver histórico →</a>
        </div>
        ${ov.recentMaintenance.length === 0 ? emptyBox('Nenhuma intervenção registrada') : ov.recentMaintenance.map((rec) => h`
          <a class="recent-row" href="#/manutencao/${rec.id}">
            <div class="row-between">
              <div class="row-wrap"><span class="tag-plate">${rec.equipmentTag}</span><span class="mono-tabular muted-sm">${dateBR(rec.occurredAt)} · ${rec.technicianName}${rec.workArea ? ` · ${rec.workArea}` : ''}</span></div>
              <div class="row-wrap">
                ${rec.removedCount > 0 ? h`<span class="diff-pill diff-removed">−${rec.removedCount}</span>` : ''}
                ${rec.installedCount > 0 ? h`<span class="diff-pill diff-installed">+${rec.installedCount}</span>` : ''}
              </div>
            </div>
            <div class="strong body-sm">${rec.reportedProblem}</div>
          </a>`)}
      </section>
    </div>`;
}

/* ---------- Equipamentos ---------- */
async function loadExplorer() {
  const [equipment, facets] = await Promise.all([api('/equipment'), api('/equipment/facets')]);
  state.equipment = equipment;
  state.explorer.locations = facets.locations;
}
function explorerMatches() {
  const f = state.explorer;
  const q = norm(f.q).trim();
  return state.equipment.filter((eq) => (!f.category || eq.category === f.category)
    && (!f.status || eq.status === f.status)
    && (!f.location || eq.location === f.location)
    && (!q || norm(`${eq.tag} ${eq.name} ${eq.manufacturer} ${eq.model} ${eq.location} ${eq.description}`).includes(q)));
}
function equipmentCard(eq) {
  const cat = CATEGORY[eq.category] ?? CATEGORY.BOMBA_CENTRIFUGA;
  return h`
    <article class="equipment-card">
      <a class="eq-card-stage industrial-grid-stage" href="#/equipamentos/${eq.id}" aria-label="Abrir ${eq.tag}, ${eq.name}">
        <div class="eq-stage-top"><span class="tag-plate">${eq.tag}</span>${statusPill(eq.status)}</div>
        ${eqImage(eq)}
        <div class="eq-stage-bottom"><span class="badge-cat">${cat.one}</span>${eq.modelPath ? h`<span class="badge-3d">⬢ 3D</span>` : ''}</div>
      </a>
      <div class="eq-card-body">
        <div>
          <h2 class="eq-card-title">${eq.name}</h2>
          <div class="eq-card-meta"><span>${shortLocation(eq.location)}</span></div>
        </div>
      </div>
      <div class="eq-card-footer">
        <a class="btn btn-secondary btn-sm" href="#/equipamentos/${eq.id}">Abrir perfil →</a>
        ${can('maintenance:write') ? h`<button class="btn btn-ghost btn-sm" data-act="openWizard" data-id="${eq.id}">+ Manutenção</button>` : ''}
      </div>
    </article>`;
}
function explorerResults() {
  const list = explorerMatches();
  return h`
    <p class="muted" role="status">${plural(list.length, 'equipamento encontrado', 'equipamentos encontrados')}</p>
    ${list.length === 0
      ? emptyBox('Nenhum equipamento com esses filtros', 'Tente outro termo ou limpe os filtros.', h`<button class="btn btn-secondary btn-sm" data-act="clearExplorer">Limpar filtros</button>`)
      : h`<div class="equipment-grid">${list.map(equipmentCard)}</div>`}`;
}
function viewExplorer() {
  const f = state.explorer;
  return h`
    ${pageHeader('CATÁLOGO VISUAL', 'Equipamentos', 'Toque na máquina. Imagens e modelos são conceituais.')}
    <div class="category-ribbon">
      <button class="cat-tile ${!f.category ? 'active' : ''}" aria-pressed="${!f.category}" data-act="setCategory" data-id="">
        <div class="cat-tile-top"><span class="nav-count">${state.equipment.length}</span></div>
        <div class="cat-tile-name">Todos</div>
      </button>
      ${Object.entries(CATEGORY).map(([key, cat]) => h`
        <button class="cat-tile ${f.category === key ? 'active' : ''}" aria-pressed="${f.category === key}" data-act="setCategory" data-id="${key}">
          <div class="cat-tile-top">${silhouette(key)}<span class="nav-count">${state.equipment.filter((e) => e.category === key).length}</span></div>
          <div class="cat-tile-name">${cat.label}</div>
        </button>`)}
    </div>
    <div class="filter-bar">
      <div class="filter-group" role="group" aria-label="Situação">
        <button class="filter-chip ${!f.status ? 'active' : ''}" aria-pressed="${!f.status}" data-act="setStatus" data-id="">Todas</button>
        ${Object.entries(STATUS).map(([code, meta]) => h`
          <button class="filter-chip ${f.status === code ? 'active' : ''}" aria-pressed="${f.status === code}" data-act="setStatus" data-id="${code}"><span aria-hidden="true">${meta.icon}</span> ${meta.label}</button>`)}
      </div>
      <div class="filter-group">
        <input type="search" class="form-input filter-control" aria-label="Filtrar equipamentos" placeholder="TAG, nome ou local" value="${f.q}" data-input="explorerSearch" />
      </div>
    </div>
    <div id="explorer-results">${explorerResults()}</div>`;
}

/* ---------- Perfil do equipamento ---------- */
async function loadDetail(id) {
  const [profile, recurring, maintenance, inventory] = await Promise.all([
    api(`/equipment/${id}`), api(`/ai/recurring/${id}`), api(`/maintenance?equipmentId=${id}&pageSize=100`), api('/inventory'),
  ]);
  state.detail = { profile, recurring, maintenance: maintenance.items };
  state.inventory = Object.fromEntries(inventory.map((i) => [i.sku, i]));
  state.component = null;
  state.stage = { ...state.stage, mode: profile.modelPath && window.innerWidth >= 768 ? '3D' : 'FOTO', xray: false, pins: false, notice: '' };
  if (maintenance.items[0]) {
    await loadRecord(maintenance.items[0].id);
    state.expanded.add(maintenance.items[0].id);
  }
}
async function loadRecord(id) {
  state.records[id] ??= await api(`/maintenance/${id}`);
  return state.records[id];
}
const activeComponent = () => state.detail?.profile.components.find((c) => c.id === state.component) ?? null;
const hasPinMap = (eq) => eq.components.some((c) => PIN_2D[c.modelNode]);

function componentHud() {
  const c = activeComponent();
  if (!c) return '';
  const eq = state.detail.profile;
  const stock = c.inventorySku ? state.inventory[c.inventorySku] : null;
  return h`
    <div class="stack-4">
      <strong>${c.name}</strong>
      ${stock ? h`<div class="mono-tabular stock-line">${stock.quantityOnHand} ${stock.unit} no estoque · ${stock.storageLocation}</div>` : ''}
    </div>
    ${can('maintenance:write') ? h`<button class="btn btn-primary btn-sm" data-act="replaceComponent">Trocar esta peça</button>` : ''}`;
}
function stagePins(eq, mode) {
  const showable = eq.components.map((c, i) => ({ c, i })).filter(({ c }) => (mode === '3D' ? c.modelNode : PIN_2D[c.modelNode]));
  return showable.map(({ c, i }) => {
    const pos = mode === '2D' ? PIN_2D[c.modelNode] : null;
    return h`<button class="hotspot-pin ${c.id === state.component ? 'active' : ''}" ${mode === '3D' ? raw(`data-pin-node="${esc(c.modelNode)}"`) : ''}
      ${pos ? raw(`style="left:${pos[0]}%;top:${pos[1]}%"`) : ''} data-act="selectComponent" data-id="${c.id}" aria-label="${c.name}" title="${c.name}">${i + 1}</button>`;
  });
}
function stageBody() {
  const eq = state.detail.profile;
  const { mode, pins, notice } = state.stage;
  return h`
    ${notice ? h`<div class="stage-notice" role="status">${notice}</div>` : ''}
    <div class="stage-canvas industrial-grid-stage ${state.stage.xray ? 'xray-active' : ''}">
      ${mode === '3D' ? h`<div id="three-stage-container"><div class="state-box" id="three-loading" role="status"><span class="spinner" aria-hidden="true"></span>Carregando modelo 3D…</div></div>` : ''}
      ${mode === 'FOTO' ? h`<div class="stage-photo">${eqImage(eq)}</div>` : ''}
      ${mode === '2D' ? h`<div class="stage-cutaway">${silhouette(eq.category)}</div>` : ''}
      <div class="pin-layer ${pins && mode !== 'FOTO' ? '' : 'pins-hidden'}">${mode !== 'FOTO' ? stagePins(eq, mode) : ''}</div>
      <span class="concept-tag">Modelo conceitual</span>
    </div>
    <div class="stage-hud-Overlay" id="stage-hud" aria-live="polite">${componentHud()}</div>`;
}
function stageToolbar() {
  const eq = state.detail.profile;
  const { mode, xray, pins } = state.stage;
  const modeBtn = (value, label) => h`<button class="btn btn-sm ${mode === value ? 'btn-primary' : 'btn-secondary'}" aria-pressed="${mode === value}" data-act="setStage" data-id="${value}">${label}</button>`;
  return h`
    <div class="row-wrap">
      ${modeBtn('FOTO', 'Imagem')}
      ${eq.modelPath ? modeBtn('3D', 'Modelo 3D') : ''}
    </div>
    ${mode === 'FOTO' ? '' : h`<div class="row-wrap">
      ${mode === '3D' ? h`<button class="btn btn-sm ${xray ? 'btn-primary' : 'btn-secondary'}" aria-pressed="${xray}" data-act="toggleXray">Ver por dentro</button>` : ''}
      <button class="btn btn-sm btn-ghost" aria-pressed="${pins}" data-act="togglePins">${pins ? 'Ocultar números' : 'Mostrar números'}</button>
    </div>`}`;
}
function paintStage() {
  destroyViewer();
  paint('#stage-toolbar', stageToolbar());
  paint('#stage-body', stageBody());
  if (state.stage.mode === '3D') startViewer();
}
function destroyViewer() {
  viewer?.destroy();
  viewer = null;
}
async function startViewer() {
  const container = $('#three-stage-container');
  const token = routeToken;
  if (!container) return;
  try {
    const instance = await mountPumpViewer(container, state.detail.profile.modelPath, {
      onSelect: (node) => {
        const match = state.detail.profile.components.find((c) => c.modelNode === node);
        if (match) selectComponent(match.id);
      },
    });
    if (token !== routeToken || state.stage.mode !== '3D' || !container.isConnected) { instance.destroy(); return; }
    $('#three-loading')?.remove();
    viewer = instance;
    viewer.highlight(activeComponent()?.modelNode ?? null, state.stage.xray);
  } catch {
    if (token !== routeToken) return;
    state.stage.mode = 'FOTO';
    state.stage.notice = 'O modelo 3D não abriu neste aparelho. Mostrando a imagem do equipamento.';
    paintStage();
  }
}
function selectComponent(id) {
  state.component = id;
  paint('#stage-hud', componentHud());
  document.querySelectorAll('.hotspot-pin').forEach((p) => p.classList.toggle('active', p.dataset.id === id));
  document.querySelectorAll('.comp-row').forEach((row) => {
    const on = row.dataset.id === id;
    row.classList.toggle('active', on);
    row.setAttribute('aria-pressed', String(on));
    if (on) row.scrollIntoView({ block: 'nearest' });
  });
  viewer?.highlight(activeComponent()?.modelNode ?? null, state.stage.xray);
}
function viewDetail() {
  const { profile: eq, recurring, maintenance } = state.detail;
  const top = recurring[0];
  const tabs = [['componentes', 'Componentes'], ['historico', 'Histórico'], ['ficha', 'Ficha e manuais']];
  return h`
    <div class="detail-identity">
      <div class="stack-8">
        <div class="row-wrap">
          <a class="btn btn-ghost btn-sm" href="#/equipamentos">← Equipamentos</a>
          <span class="tag-plate tag-plate-lg">${eq.tag}</span>
          ${statusPill(eq.status)}
        </div>
        <h1 class="page-title" tabindex="-1">${eq.name}</h1>
        <div class="muted">${shortLocation(eq.location)}</div>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" data-act="askEquipment" data-id="${eq.id}" data-text="${top?.symptom ?? ''}">✦ Consultar IA</button>
        ${newMaintenanceBtn(eq.id)}
      </div>
    </div>
    ${top ? h`
      <div class="recurring-banner">
        <div>
          <div class="page-kicker">Sintoma recorrente</div>
          <div class="strong">${top.symptom}: ${plural(top.occurrences, 'registro', 'registros')} neste equipamento</div>
        </div>
        <button class="btn btn-secondary btn-sm" data-act="askEquipment" data-id="${eq.id}" data-text="${top.symptom}">Investigar com a IA →</button>
      </div>` : ''}
    <div class="detail-hero-grid">
      <div class="interactive-stage-card">
        <div class="stage-toolbar" id="stage-toolbar">${stageToolbar()}</div>
        <div id="stage-body">${stageBody()}</div>
      </div>
      <div class="detail-tabs" role="tablist" aria-label="Seções do equipamento">
        ${tabs.map(([key, label]) => h`<button role="tab" aria-selected="${state.stage.tab === key}" class="filter-chip ${state.stage.tab === key ? 'active' : ''}" data-act="setTab" data-id="${key}">${label}</button>`)}
      </div>
      <section class="panel-card tab-panel ${state.stage.tab === 'componentes' ? 'tab-on' : ''}" aria-labelledby="comp-title">
        <div class="panel-header"><div>
          <h2 class="panel-title" id="comp-title">Componentes (${eq.components.length})</h2>
        </div></div>
        <div class="component-inspector-list">
          ${eq.components.length === 0 ? emptyBox('Nenhum componente cadastrado') : eq.components.map((c, i) => {
            const inv = c.inventorySku ? state.inventory[c.inventorySku] : null;
            return h`
              <button class="comp-row ${c.id === state.component ? 'active' : ''}" aria-pressed="${c.id === state.component}" data-act="selectComponent" data-id="${c.id}">
                <span class="stack-4">
                  <span class="row-wrap"><span class="mono-tabular comp-index">${i + 1}</span><strong>${c.name}</strong></span>
                </span>
                <span class="comp-side">
                  ${inv ? h`<span class="mono-tabular stock-line">${inv.quantityOnHand} ${inv.unit}</span>` : ''}
                </span>
              </button>`;
          })}
        </div>
      </section>
    </div>
    <div class="detail-hero-grid">
      <section class="tab-panel stack-16 ${state.stage.tab === 'historico' ? 'tab-on' : ''}" aria-labelledby="timeline-title">
        <h2 class="panel-title" id="timeline-title">Linha do tempo (${maintenance.length})</h2>
        <div class="timeline-list">
          ${maintenance.length === 0 ? emptyBox('Sem manutenções registradas', 'A primeira intervenção aparecerá aqui.') : maintenance.map(timelineCard)}
        </div>
      </section>
      <div class="tab-panel stack-16 ${state.stage.tab === 'ficha' ? 'tab-on' : ''}">
        <details class="panel-card fold-card">
          <summary class="panel-title">Ficha técnica</summary>
          <div class="spec-grid">
            ${(eq.specs ?? []).map((s) => h`<div class="diag-box"><div class="diag-box-label">${s.label}</div><div class="mono-tabular spec-value">${s.value}${s.unit ? ` ${s.unit}` : ''}</div></div>`)}
          </div>
        </details>
        <details class="panel-card fold-card">
          <summary class="panel-title">Documentos (${eq.documents.length})</summary>
          ${eq.documents.length === 0 ? emptyBox('Nenhum documento vinculado') : eq.documents.map((doc) => h`
            <div class="doc-row">
              <div>
                <div class="strong">${doc.title}</div>
              </div>
              <div class="row-wrap">
                <a class="btn btn-secondary btn-sm" href="#/manuais/${doc.id}">Ler</a>
                ${doc.filePath ? h`<a class="btn btn-ghost btn-sm" href="${doc.filePath}" target="_blank" rel="noopener">PDF ↗</a>` : ''}
              </div>
            </div>`)}
        </details>
      </div>
    </div>`;
}

/* ---------- Linha do tempo ---------- */
function timelineCard(summary) {
  const open = state.expanded.has(summary.id);
  const full = state.records[summary.id] ?? summary;
  const parts = full.parts ?? [];
  const removed = parts.filter((p) => p.direction === 'REMOVED');
  const installed = parts.filter((p) => p.direction === 'INSTALLED');
  const photos = full.photos ?? [];
  const docs = full.documents ?? [];
  return h`
    <article class="timeline-card ${open ? 'expanded' : ''}" id="rec-${summary.id}">
      <button class="timeline-summary" aria-expanded="${open}" data-act="toggleRecord" data-id="${summary.id}">
        <span class="stack-4">
          <span class="mono-tabular strong">${dateBR(summary.occurredAt)}</span>
          <span class="muted">${summary.technicianName}</span>
          ${summary.workArea ? h`<span class="area-pill">${summary.workArea}</span>` : ''}
        </span>
        <span class="stack-6">
          <span class="row-wrap"><span class="tag-plate">${summary.equipmentTag}</span><strong>${summary.reportedProblem}</strong></span>
        </span>
        <span class="row-wrap">
          ${summary.removedCount + summary.installedCount > 0 ? h`<span class="sku-badge">Troca de peça</span>` : ''}
          ${summary.photoCount > 0 ? h`<span class="sku-badge">${plural(summary.photoCount, 'foto', 'fotos')}</span>` : ''}
          <span class="mono-tabular muted-sm">${open ? '▲ Recolher' : '▼ Detalhes'}</span>
        </span>
      </button>
      ${open ? h`
        <div class="timeline-details">
          <div class="simple-record">
            <div><span class="diag-box-label">O que foi feito</span><div>${full.workPerformed}</div></div>
            ${removed.length ? h`<div class="row-wrap">${removed.map((p) => h`<span class="diff-pill diff-removed">Saiu: ${p.description}</span>`)}</div>` : ''}
            ${installed.length ? h`<div class="row-wrap">${installed.map((p) => h`<span class="diff-pill diff-installed">Entrou: ${p.description}</span>`)}</div>` : ''}
          </div>
          ${photos.length > 0 ? h`
            <div>
              <div class="diag-box-label">Antes e depois</div>
              <div class="photo-compare-grid">
                ${photos.map((ph) => h`
                  <figure class="photo-frame">
                    <div class="photo-stage-canvas">
                      <span class="diff-pill photo-badge ${ph.stage === 'BEFORE' ? 'diff-removed' : 'diff-installed'}">${ph.stage === 'BEFORE' ? 'ANTES' : 'DEPOIS'}</span>
                      ${ph.isIllustrative ? h`<span class="sku-badge photo-illustrative">Imagem ilustrativa</span>` : ''}
                      <img src="${ph.path}" alt="${ph.caption || (ph.stage === 'BEFORE' ? 'Foto antes da intervenção' : 'Foto depois da intervenção')}" loading="lazy" />
                    </div>
                    ${ph.caption ? h`<figcaption>${ph.caption}</figcaption>` : ''}
                  </figure>`)}
              </div>
            </div>` : ''}
          <details class="more-details">
            <summary>Ver detalhes</summary>
            <div class="stack-8">
              ${full.identifiedCause ? h`<div><span class="diag-box-label">Causa</span><div>${full.identifiedCause}</div></div>` : ''}
              ${full.inspection ? h`<div><span class="diag-box-label">Inspeção</span><div>${full.inspection}</div></div>` : ''}
              ${full.observations ? h`<div><span class="diag-box-label">Observação</span><div>${full.observations}</div></div>` : ''}
              ${docs.length ? h`<div class="row-wrap">${docs.map((d) => h`<a class="citation-chip" href="#/manuais/${d.id}">${d.title}</a>`)}</div>` : ''}
            </div>
          </details>
        </div>` : ''}
    </article>`;
}
async function toggleRecord(id) {
  if (state.expanded.has(id)) state.expanded.delete(id);
  else {
    await loadRecord(id);
    state.expanded.add(id);
  }
  const list = state.detail?.maintenance ?? [];
  const summary = [...list, ...state.history.items].find((r) => r.id === id);
  const el = $(`#rec-${CSS.escape(id)}`);
  if (el && summary) {
    el.outerHTML = part(timelineCard(summary));
    $(`#rec-${CSS.escape(id)} .timeline-summary`).focus();
  }
}

/* ---------- Histórico ---------- */
async function loadHistory(page = 1) {
  const f = state.history.filters;
  const params = new URLSearchParams({ page, pageSize: 100 });
  if (f.q.trim()) params.set('q', f.q.trim());
  if (f.equipmentId) params.set('equipmentId', f.equipmentId);
  if (f.technicianId) params.set('technicianId', f.technicianId);
  if (f.from) params.set('from', new Date(`${f.from}T00:00:00`).toISOString());
  if (f.to) params.set('to', new Date(`${f.to}T23:59:59`).toISOString());
  const res = await api(`/maintenance?${params}`);
  state.history.items = page === 1 ? res.items : [...state.history.items, ...res.items];
  state.history.total = res.total;
  state.history.page = page;
}
function historyResults() {
  const { items, total, filters: f } = state.history;
  const shown = items.filter((r) => (!f.withParts || r.removedCount + r.installedCount > 0) && (!f.withPhotos || r.photoCount > 0));
  const months = new Map();
  for (const rec of shown) {
    const key = monthLabel(rec.occurredAt);
    months.set(key, [...(months.get(key) ?? []), rec]);
  }
  return h`
    <p class="muted" role="status">${plural(shown.length, 'registro', 'registros')}</p>
    ${shown.length === 0
      ? emptyBox('Nenhum registro com esses filtros', 'Tente outro termo ou limpe os filtros.', h`<button class="btn btn-secondary btn-sm" data-act="clearHistory">Limpar filtros</button>`)
      : [...months].map(([month, recs]) => h`
        <section class="stack-8">
          <h2 class="month-title">${month}</h2>
          <div class="timeline-list">${recs.map(timelineCard)}</div>
        </section>`)}
    ${items.length < total ? h`<button class="btn btn-secondary" data-act="historyMore">Carregar mais</button>` : ''}`;
}
function viewHistory() {
  const f = state.history.filters;
  return h`
    ${pageHeader('MEMÓRIA DA MÁQUINA', 'Manutenção', 'O que aconteceu e o que foi feito em cada máquina.', h`${reportBtn()}${newMaintenanceBtn()}`)}
    <div class="filter-bar history-filters">
      <input type="search" class="form-input filter-control" aria-label="Buscar no histórico" placeholder="Sintoma, causa ou peça" value="${f.q}" data-input="historySearch" />
      <select class="form-select filter-control" aria-label="Equipamento" data-input="historyEquipment">
        <option value="">Todos os equipamentos</option>
        ${state.equipment.map((e) => h`<option value="${e.id}" ${f.equipmentId === e.id ? raw('selected') : ''}>${e.tag}</option>`)}
      </select>
    </div>
    <div id="history-results" class="stack-16">${historyResults()}</div>`;
}

/* ---------- Relatório do dia ---------- */
async function loadReport(date) {
  const days = await api('/reports/days');
  const today = todayISO();
  const chosen = date ?? (days.some((d) => d.date === today) ? today : days[0]?.date ?? today);
  const data = await api(`/reports/daily?date=${encodeURIComponent(chosen)}`);
  state.report = { days, date: chosen, data };
}
const reportGroup = (title, rows, label = (x) => x) => h`
  <section class="panel-card report-group">
    <h2 class="panel-title">${title}</h2>
    <ul class="report-list">
      ${rows.map((r) => h`<li><span>${label(r.label)}</span><strong class="mono-tabular">${r.count}</strong></li>`)}
    </ul>
  </section>`;
const reportMetric = (label, value) => h`<div class="report-metric"><span class="muted">${label}</span><strong class="mono-tabular">${value}</strong></div>`;
const resultLabel = (code) => QUICK_RESULTS.find(([id]) => id === code)?.[1] ?? code;
function viewReport() {
  const { days, date, data } = state.report;
  return h`
    ${pageHeader('RELATÓRIO DO DIA', dayLabel(date), 'Calculado dos registros salvos. Todos os dias ficam guardados aqui.', h`
      <a class="btn btn-ghost" href="#/manutencao">← Manutenção</a>
      <button class="btn btn-primary" data-act="downloadReport" data-id="${date}">Baixar PDF</button>`)}
    <div class="filter-bar">
      <input type="date" class="form-input report-date" aria-label="Escolher o dia" max="${todayISO()}" value="${date}" data-input="reportDate" />
      <div class="report-days">
        ${days.slice(0, 6).map((d) => h`<a class="filter-chip ${d.date === date ? 'active' : ''}" ${d.date === date ? raw('aria-current="true"') : ''} href="#/relatorios/${d.date}">${dayLabel(d.date).slice(0, 5)} (${d.services})</a>`)}
      </div>
    </div>
    ${data.total === 0 ? emptyBox('Nenhum serviço neste dia', 'Escolha outro dia ou registre um serviço.', newMaintenanceBtn()) : h`
      <div class="report-metrics">
        ${reportMetric('Serviços', data.total)}
        ${reportMetric('Mecânicos', data.byTechnician.length)}
        ${reportMetric('Máquinas', data.byEquipment.length)}
        ${reportMetric('Peças instaladas', data.partsInstalled)}
      </div>
      <div class="report-groups">
        ${reportGroup('Por mecânico', data.byTechnician)}
        ${reportGroup('Por local', data.byArea)}
        ${reportGroup('Como ficou', data.byResult, resultLabel)}
      </div>
      <section class="panel-card">
        <div class="panel-header"><h2 class="panel-title">Serviços do dia</h2></div>
        ${data.services.map((s) => h`
          <a class="recent-row" href="#/manutencao/${s.id}">
            <div class="row-wrap">
              <span class="mono-tabular strong">${timeBR(s.occurredAt)}</span>
              <span class="tag-plate">${s.equipmentTag}</span>
              ${s.workArea ? h`<span class="area-pill">${s.workArea}</span>` : ''}
              <span class="muted">${s.technicianName}</span>
            </div>
            <div class="strong body-sm">${s.reportedProblem}</div>
            <div class="muted">${s.workPerformed}${s.resultingStatus ? ` Ficou: ${resultLabel(s.resultingStatus)}.` : ''}</div>
          </a>`)}
      </section>`}`;
}

/* ---------- Assistente ---------- */
async function askAssistant() {
  const ai = state.ai;
  if (!ai.question.trim()) { ai.error = 'Escolha um sintoma.'; paintAiResults(); return; }
  ai.loading = true;
  ai.error = '';
  ai.confirming = null;
  paintAiResults();
  try {
    ai.answer = await api('/ai/ask', { method: 'POST', body: { equipmentId: ai.equipmentId || undefined, question: ai.question } });
  } catch (err) {
    ai.answer = null;
    ai.error = err.message;
  }
  ai.loading = false;
  paintAiResults();
}
function aiBlock(block) {
  const meta = AI_BLOCK[block.type] ?? AI_BLOCK.FATO_HISTORICO;
  const confirmable = block.type === 'HIPOTESE_IA' && block.ruleId;
  const index = state.ai.answer.blocks.indexOf(block);
  const confirming = confirmable && state.ai.confirming === String(index);
  return h`
    <article class="ai-block-card ai-block-${block.type}">
      <span class="mono-tabular ai-badge" style="color:${meta.color}">${meta.badge}</span>
      ${block.type === 'INSPECAO_RECOMENDADA'
        ? h`<label class="check-line"><input type="checkbox" /><span>${block.text}</span></label>`
        : h`<div class="ai-text">${block.text}</div>`}
      ${block.why ? h`<div class="muted"><strong>Por quê:</strong> ${block.why}</div>` : ''}
      ${block.citations?.length ? h`
        <div class="row-wrap">
          <span class="muted-sm">Fontes:</span>
          ${block.citations.map((c) => h`<a class="citation-chip" title="${c.excerpt ?? ''}" href="${c.kind === 'MANUTENCAO' ? `#/manutencao/${c.id}` : `#/manuais/${c.id}`}">${c.label}</a>`)}
        </div>` : ''}
      ${confirmable && can('ai:confirm') && !confirming ? h`
        <div><button class="btn btn-secondary btn-sm" ${state.ai.equipmentId ? '' : raw('disabled')} data-act="startConfirm" data-id="${index}">Confirmar em campo</button>
        ${state.ai.equipmentId ? '' : h`<span class="muted-sm"> Selecione um equipamento para confirmar.</span>`}</div>` : ''}
      ${confirming ? h`
        <div class="row-wrap">
          <span class="body-sm strong">Isso foi verificado em campo?</span>
          <button class="btn btn-primary btn-sm" data-act="saveConfirm" data-id="${index}">Sim, confirmar</button>
          <button class="btn btn-ghost btn-sm" data-act="cancelConfirm">Cancelar</button>
        </div>` : ''}
    </article>`;
}
function aiResults() {
  const { answer, loading, error } = state.ai;
  if (loading) return loadingBox('Analisando histórico e documentos…');
  if (error) return h`<div class="state-box state-error" role="alert"><strong>${error}</strong></div>`;
  if (!answer) return emptyBox('Toque em um sintoma', 'A resposta mostra o histórico e o que inspecionar.');
  return h`
    ${answer.insufficientData ? h`<div class="state-box" role="status"><strong>Sem dados suficientes</strong><span>Não há registros ou documentos que sustentem uma resposta para esta pergunta.</span></div>` : ''}
    ${Object.entries(AI_BLOCK).map(([type, meta]) => {
      const blocks = answer.blocks.filter((b) => b.type === type);
      return blocks.length ? h`<section class="stack-8" aria-label="${meta.section}"><h2 class="month-title">${meta.section}</h2>${blocks.map(aiBlock)}</section>` : '';
    })}`;
}
const aiNotice = () => (state.ai.answer?.notice ?? 'As respostas vêm de regras escritas e do histórico da demo. Toda intervenção exige bloqueio de energias (LOTO).')
  .replace(/^Modo demonstração: sem IA ao vivo\.\s*/, '');
function paintAiResults() {
  paint('#ai-results', aiResults());
  if (state.ai.answer) paint('#ai-notice', aiNotice());
}
const aiChips = () => symptomsFor(eqById(state.ai.equipmentId)).filter((s) => s !== 'Preventiva programada')
  .map((s) => h`<button type="button" class="quick-chip" data-act="askSymptom" data-text="${s}">${s}</button>`);
function viewAssistant() {
  const ai = state.ai;
  return h`
    ${pageHeader('DIAGNÓSTICO COM FONTES', 'Assistente IA', 'Toque no sintoma. A decisão de trocar peça ou operar é sempre da equipe.')}
    <div class="safety-banner" role="note">
      <div><strong>Modo demonstração, sem IA ao vivo.</strong> <span id="ai-notice">${aiNotice()}</span></div>
    </div>
    <div class="stack-16">
      <div class="panel-card ai-form">
        <label class="form-label" for="ai-eq">Qual máquina?</label>
        <select id="ai-eq" class="form-select" data-input="aiEquipment">
          <option value="">Planta inteira</option>
          ${state.equipment.map((e) => h`<option value="${e.id}" ${ai.equipmentId === e.id ? raw('selected') : ''}>${e.tag} — ${e.name}</option>`)}
        </select>
        <span class="form-label">O que está acontecendo?</span>
        <div class="quick-grid" id="ai-chips">${aiChips()}</div>
        <details class="more-details">
          <summary>Escrever outra pergunta</summary>
          <form class="stack-8" data-form="ask">
            <label class="form-label" for="ai-q">Pergunta</label>
            <textarea id="ai-q" class="form-textarea" rows="2" maxlength="1000" data-input="aiQuestion">${ai.question}</textarea>
            <button class="btn btn-secondary btn-sm ai-send" type="submit">Perguntar</button>
          </form>
        </details>
      </div>
      <div id="ai-results" class="stack-16" aria-live="polite">${aiResults()}</div>
    </div>`;
}

/* ---------- Manuais ---------- */
async function loadDocs(selectId) {
  const d = state.docs;
  const params = new URLSearchParams();
  if (d.type) params.set('type', d.type);
  if (d.equipmentId) params.set('equipmentId', d.equipmentId);
  if (d.q.trim()) params.set('q', d.q.trim());
  const res = await api(`/documents?${params}`);
  d.excerpts = res.kind === 'excerpts' ? res.items : null;
  if (res.kind === 'documents') d.items = res.items;
  const target = selectId ?? d.selected?.id ?? d.items[0]?.id;
  d.selected = target ? await api(`/documents/${target}`) : null;
}
function docsList() {
  const d = state.docs;
  if (d.excerpts) {
    return d.excerpts.length === 0
      ? emptyBox('Nenhum trecho encontrado', 'Tente outro termo.')
      : d.excerpts.map((hit) => h`
        <a class="panel-card doc-card" href="#/manuais/${hit.documentId}">
          <span class="sku-badge">${DOC_TYPE[hit.docType] ?? hit.docType}</span>
          <h2 class="doc-card-title">${hit.documentTitle}: ${hit.heading}</h2>
          <p class="muted">${marked(hit.excerpt)}</p>
        </a>`);
  }
  return d.items.length === 0
    ? emptyBox('Nenhum documento com esses filtros')
    : d.items.map((doc) => h`
      <a class="panel-card doc-card ${d.selected?.id === doc.id ? 'doc-active' : ''}" href="#/manuais/${doc.id}">
        <div class="row-between"><span class="sku-badge">${DOC_TYPE[doc.docType] ?? doc.docType}</span><span class="row-wrap">${(doc.equipment ?? []).map((e) => h`<span class="tag-plate tag-plate-sm">${e.tag}</span>`)}</span></div>
        <h2 class="doc-card-title">${doc.title}</h2>
        <p class="muted">${doc.summary}</p>
      </a>`);
}
function docReader() {
  const doc = state.docs.selected;
  if (!doc) return '';
  return h`
    <section class="panel-card doc-reader" id="doc-reader" aria-labelledby="reader-title">
      <div class="panel-header">
        <div>
          <span class="sku-badge">Documento ilustrativo</span>
          <h2 class="panel-title" id="reader-title">${doc.title}</h2>
        </div>
        ${doc.filePath ? h`<a class="btn btn-primary btn-sm" href="${doc.filePath}" target="_blank" rel="noopener">Abrir PDF ↗</a>` : ''}
      </div>
      <div class="doc-body">
        ${doc.equipment?.length ? h`<div class="row-wrap">${doc.equipment.map((e) => h`<a class="tag-plate" href="#/equipamentos/${e.id}">${e.tag}</a>`)}</div>` : ''}
        ${(doc.sections ?? []).map((sec) => h`<div class="diag-box"><h3 class="section-title">${sec.heading}</h3><div class="section-body">${sec.body}</div></div>`)}
      </div>
    </section>`;
}
const paintDocs = () => { paint('#docs-list', docsList()); paint('#docs-reader', docReader()); };
function viewManuals() {
  const d = state.docs;
  return h`
    ${pageHeader('BIBLIOTECA TÉCNICA', 'Manuais', 'Documentos fictícios criados para a demonstração. Não são manuais de fabricante.')}
    <div class="filter-bar">
      <div class="filter-group" role="group" aria-label="Tipo de documento">
        <button class="filter-chip ${!d.type ? 'active' : ''}" aria-pressed="${!d.type}" data-act="setDocType" data-id="">Todos</button>
        ${Object.entries(DOC_TYPE).map(([key, label]) => h`<button class="filter-chip ${d.type === key ? 'active' : ''}" aria-pressed="${d.type === key}" data-act="setDocType" data-id="${key}">${label}</button>`)}
      </div>
      <div class="filter-group">
        <select class="form-select filter-control" aria-label="Equipamento" data-input="docsEquipment">
          <option value="">Todos os equipamentos</option>
          ${state.equipment.map((e) => h`<option value="${e.id}" ${d.equipmentId === e.id ? raw('selected') : ''}>${e.tag}</option>`)}
        </select>
        <input type="search" class="form-input filter-control" aria-label="Buscar nas seções" placeholder="Buscar nas seções" value="${d.q}" data-input="docsSearch" />
      </div>
    </div>
    <div class="detail-hero-grid">
      <div class="stack-12" id="docs-list">${docsList()}</div>
      <div id="docs-reader">${docReader()}</div>
    </div>`;
}

/* ---------- Busca global ---------- */
const SEARCH_GROUP = [
  ['Equipamentos', ['EQUIPMENT', 'COMPONENT'], (hit) => `#/equipamentos/${hit.entityType === 'COMPONENT' ? hit.parentId : hit.entityId}`],
  ['Manutenções', ['MAINTENANCE'], (hit) => `#/manutencao/${hit.entityId}`],
  ['Documentos', ['DOCUMENT', 'DOCUMENT_SECTION'], (hit) => `#/manuais/${hit.entityType === 'DOCUMENT_SECTION' ? hit.parentId : hit.entityId}`],
];
function viewSearch() {
  const q = state.route.id ?? '';
  const hits = state.searchResults;
  return h`
    ${pageHeader('BUSCA', `Resultados para “${q}”`, plural(hits.length, 'resultado', 'resultados'))}
    ${hits.length === 0 ? emptyBox('Nada encontrado', 'Tente a TAG, o nome da peça ou o sintoma.') : SEARCH_GROUP.map(([title, types, link]) => {
      const group = hits.filter((hit) => types.includes(hit.entityType));
      return group.length ? h`
        <section class="stack-8">
          <h2 class="month-title">${title} (${group.length})</h2>
          ${group.map((hit) => h`<a class="panel-card doc-card" href="${link(hit)}"><h3 class="doc-card-title">${hit.title}</h3><p class="muted">${marked(hit.excerpt)}</p></a>`)}
        </section>` : '';
    })}`;
}

/* ---------- Registro rápido por toques ---------- */
function newWizard(equipmentId) {
  return {
    equipmentId: equipmentId || '', pickingEquipment: !equipmentId, components: [], symptoms: [], actions: [], swapped: [],
    technicianId: state.me.role === 'MECANICO' ? state.me.id : '', area: '', minutesAgo: 0, showWho: state.me.role !== 'MECANICO',
    status: '', photos: { BEFORE: null, AFTER: null }, note: '', showNote: false, photoError: '',
    saving: false, submitError: '', dirty: false, returnFocus: document.activeElement,
  };
}
async function loadWizardEquipment(id) {
  const profile = await api(`/equipment/${id}`);
  const w = state.wizard;
  if (!w) return;
  w.components = profile.components;
  w.swapped = [];
  w.symptoms = [];
  const area = shortLocation(profile.location);
  w.area = WORK_AREAS.includes(area) ? area : '';
}
const symptomsFor = (eq) => QUICK_SYMPTOMS[eq?.category] ?? [...new Set(Object.values(QUICK_SYMPTOMS).flat())];
function wizardMissing() {
  const w = state.wizard;
  const missing = [];
  if (!w.equipmentId) missing.push('máquina');
  if (!w.technicianId) missing.push('quem fez');
  if (w.equipmentId && !w.area) missing.push('onde foi feito');
  if (w.symptoms.length === 0) missing.push('o que aconteceu');
  if (w.actions.length === 0) missing.push('o que você fez');
  else if (w.actions.includes('troca') && w.swapped.length === 0) missing.push('qual peça');
  if (!w.status) missing.push('como ficou');
  return missing;
}
const quickChip = (list, id, label) => {
  const on = state.wizard[list].includes(id);
  return h`<button type="button" class="quick-chip ${on ? 'active' : ''}" aria-pressed="${on}" data-act="wizardToggle" data-list="${list}" data-id="${id}">${on ? '✓ ' : ''}${label}</button>`;
};
const singleChip = (field, id, label) => {
  const on = String(state.wizard[field]) === id;
  return h`<button type="button" class="quick-chip ${on ? 'active' : ''}" aria-pressed="${on}" data-act="wizardSet" data-field="${field}" data-id="${id}">${on ? '✓ ' : ''}${label}</button>`;
};
const wizardWhen = (w) => timeBR(Date.now() - w.minutesAgo * 60000);
function photoButton(stage, label) {
  const photo = state.wizard.photos[stage];
  if (photo) {
    return h`<div class="quick-photo"><img src="${photo.url}" alt="Prévia da foto: ${label}" /><button type="button" class="btn btn-ghost btn-sm" aria-label="Remover foto: ${label}" data-act="wizardRemovePhoto" data-id="${stage}">✕</button></div>`;
  }
  const capture = window.matchMedia('(max-width: 767px)').matches ? raw('capture="environment"') : '';
  return h`<label class="btn btn-secondary btn-sm file-button">Foto ${label}<input type="file" accept="image/jpeg,image/png,image/webp" ${capture} data-photo="${stage}" /></label>`;
}
function wizardBody() {
  const w = state.wizard;
  const eq = eqById(w.equipmentId);
  const swappable = w.components.filter((c) => c.inventorySku || c.partCode);
  return h`
    <section class="quick-block">
      <h3 class="quick-title">Qual máquina?</h3>
      ${w.pickingEquipment ? h`
        <div class="wizard-eq-grid">
          ${state.equipment.map((item) => h`
            <button type="button" class="wizard-eq ${w.equipmentId === item.id ? 'active' : ''}" data-act="wizardPick" data-id="${item.id}">
              <span class="wizard-eq-img industrial-grid-stage">${eqImage(item)}</span>
              <span class="stack-4"><span class="tag-plate">${item.tag}</span><span class="body-sm strong">${item.name}</span></span>
            </button>`)}
        </div>` : h`
        <div class="wizard-eq active">
          <span class="wizard-eq-img industrial-grid-stage">${eqImage(eq)}</span>
          <span class="stack-4 grow"><span class="tag-plate">${eq.tag}</span><span class="body-sm strong">${eq.name}</span></span>
          <button type="button" class="btn btn-ghost btn-sm" data-act="wizardChangeEquipment">Trocar</button>
        </div>`}
    </section>
    ${w.equipmentId ? h`
      <section class="quick-block">
        <h3 class="quick-title">Onde foi feito?</h3>
        <div class="quick-grid quick-grid-area">${WORK_AREAS.map((a) => singleChip('area', a, a))}</div>
      </section>
      <section class="quick-block">
        <div class="row-between">
          <h3 class="quick-title">Quem fez e quando?</h3>
          ${w.showWho ? '' : h`<button type="button" class="btn btn-ghost btn-sm" data-act="wizardShowWho">Trocar</button>`}
        </div>
        ${w.showWho ? h`
          <div class="quick-grid">${state.users.filter((u) => u.role === 'MECANICO').map((u) => singleChip('technicianId', u.id, u.name))}</div>
          <h4 class="quick-subtitle">Quando?</h4>
          <div class="quick-grid">${QUICK_TIMES.map(([mins, label]) => singleChip('minutesAgo', String(mins), label))}</div>`
        : h`<div class="strong">${state.users.find((u) => u.id === w.technicianId)?.name} · ${wizardWhen(w)}</div>`}
      </section>
      <section class="quick-block">
        <h3 class="quick-title">O que aconteceu?</h3>
        <div class="quick-grid">${symptomsFor(eq).map((s) => quickChip('symptoms', s, s))}</div>
      </section>
      <section class="quick-block">
        <h3 class="quick-title">O que você fez?</h3>
        <div class="quick-grid">${QUICK_ACTIONS.map(([id, label]) => quickChip('actions', id, label))}</div>
        ${w.actions.includes('troca') ? h`
          <h4 class="quick-subtitle">Qual peça?</h4>
          <div class="quick-grid">${swappable.map((c) => quickChip('swapped', c.id, c.name))}</div>` : ''}
      </section>
      <section class="quick-block">
        <h3 class="quick-title">Como ficou?</h3>
        <div class="quick-grid">
          ${QUICK_RESULTS.map(([code, label]) => h`<button type="button" class="quick-chip quick-status status-${code} ${w.status === code ? 'active' : ''}" aria-pressed="${w.status === code}" data-act="wizardResult" data-id="${code}"><span aria-hidden="true">${STATUS[code].icon}</span> ${label}</button>`)}
        </div>
      </section>
      <section class="quick-extras">
        ${photoButton('BEFORE', 'antes')}
        ${photoButton('AFTER', 'depois')}
        ${w.showNote ? '' : h`<button type="button" class="btn btn-ghost btn-sm" data-act="wizardShowNote">+ Observação</button>`}
      </section>
      ${w.photoError ? h`<div class="field-error" role="alert">${w.photoError}</div>` : ''}
      ${w.showNote ? h`
        <div class="form-field">
          <label class="form-label" for="wiz-note">Observação (opcional)</label>
          <textarea id="wiz-note" class="form-textarea" rows="2" maxlength="2000" data-wiz="note">${w.note}</textarea>
        </div>` : ''}
      ${w.submitError ? h`<div class="state-box state-error" role="alert"><strong>Registro não salvo</strong><span>${w.submitError}</span></div>` : ''}` : ''}`;
}
function paintWizard() {
  const w = state.wizard;
  const root = $('#modal-root');
  if (!w) { root.innerHTML = ''; return; }
  const scroll = $('.modal-body', root)?.scrollTop ?? 0;
  const active = document.activeElement?.dataset;
  const key = active?.act ? `[data-act="${active.act}"][data-id="${CSS.escape(active.id ?? '')}"]` : null;
  const missing = wizardMissing();
  root.innerHTML = part(h`
    <div class="modal-backdrop" data-act="wizardBackdrop">
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="wizard-title">
        <div class="panel-header modal-head">
          <div>
            <h2 class="panel-title" id="wizard-title">Registrar manutenção</h2>
          </div>
          <button type="button" class="btn btn-ghost btn-sm" data-act="wizardClose">✕ Fechar</button>
        </div>
        <div class="modal-body">${wizardBody()}</div>
        <div class="panel-header modal-foot">
          <span class="muted-sm" role="status">${missing.length ? `Falta: ${missing.join(', ')}` : 'Pronto para salvar'}</span>
          <button type="button" class="btn btn-primary" ${missing.length || w.saving ? raw('disabled') : ''} data-act="wizardSubmit">${w.saving ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
    </div>`);
  $('.modal-body', root).scrollTop = scroll;
  (key ? $(key, root) : null)?.focus();
  if (!document.activeElement || document.activeElement === document.body) $('.modal-card button', root)?.focus();
}
function closeWizard(force) {
  const w = state.wizard;
  if (!w) return;
  if (!force && w.dirty && !window.confirm('Descartar este registro?')) return;
  Object.values(w.photos).forEach((p) => p && URL.revokeObjectURL(p.url));
  state.wizard = null;
  paintWizard();
  if (w.returnFocus?.isConnected) w.returnFocus.focus();
}
async function submitWizard() {
  const w = state.wizard;
  if (wizardMissing().length) return;
  w.saving = true;
  w.submitError = '';
  paintWizard();
  const swapped = w.swapped.map((id) => w.components.find((c) => c.id === id));
  const done = w.actions.map((id) => QUICK_ACTIONS.find(([key]) => key === id)[2]).join(', ');
  const parts = swapped.flatMap((c) => [
    { direction: 'REMOVED', componentId: c.id, description: c.name, quantity: 1 },
    { direction: 'INSTALLED', componentId: c.id, inventorySku: c.inventorySku ?? undefined, description: state.inventory[c.inventorySku]?.name ?? c.name, quantity: 1 },
  ]);
  const data = {
    equipmentId: w.equipmentId,
    occurredAt: new Date(Date.now() - 1000 - Number(w.minutesAgo) * 60000).toISOString(),
    reportedProblem: w.symptoms.join('; '),
    inspection: 'Registro rápido, sem detalhe de inspeção.',
    workPerformed: swapped.length ? `${done}: ${swapped.map((c) => c.name).join(', ')}.` : `${done}.`,
    observations: w.note.trim() || undefined,
    technicianId: w.technicianId,
    workArea: w.area,
    parts,
    documentIds: [],
    resultingStatus: w.status,
  };
  const form = new FormData();
  form.set('data', JSON.stringify(data));
  const photos = Object.entries(w.photos).filter(([, p]) => p);
  for (const [, p] of photos) form.append('photos', p.file);
  form.set('photoMeta', JSON.stringify(photos.map(([stage]) => ({ stage }))));
  try {
    const created = await api('/maintenance', { method: 'POST', body: form });
    const target = `#/equipamentos/${w.equipmentId}`;
    state.records[created.id] = created;
    state.expanded.add(created.id);
    state.stage.tab = 'historico';
    closeWizard(true);
    toast('Manutenção registrada.');
    if (location.hash === target) route(); else location.hash = target;
  } catch (err) {
    w.saving = false;
    w.submitError = err.message;
    paintWizard();
  }
}
async function openWizard(equipmentId, component) {
  state.wizard = newWizard(equipmentId);
  if (Object.keys(state.inventory).length === 0) {
    const inventory = await api('/inventory');
    state.inventory = Object.fromEntries(inventory.map((i) => [i.sku, i]));
  }
  if (equipmentId) await loadWizardEquipment(equipmentId);
  if (component) {
    state.wizard.actions = ['troca'];
    state.wizard.swapped = [component.id];
  }
  paintWizard();
}

/* ---------- Casca e rotas ---------- */
function paintShell() {
  const nav = (cls) => NAV.map(([key, href, icon, label]) => h`
    <li><a class="${cls}" data-nav="${key}" href="${href}" aria-label="${label}"><span class="nav-btn-left"><span class="nav-icon" aria-hidden="true">${icon}</span><span class="nav-text">${label}</span></span></a></li>`);
  $('#app-root').innerHTML = part(h`
    <a class="skip-link" href="#viewport" data-act="skip">Pular para o conteúdo</a>
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand-header">
          <div class="brand-mark">M360</div>
          <div class="brand-text"><div class="brand-title">MAINTENANCE<br />INTELLIGENCE 360</div></div>
        </div>
        <nav aria-label="Principal"><ul class="nav-list">${nav('nav-btn')}</ul></nav>
        <div class="sidebar-footer"><div class="plant-badge"><span>Demonstração · dados fictícios</span></div></div>
      </aside>
      <div class="main-area">
        <div class="m-appbar">
          <a class="m-brand" href="#/" aria-label="Início"><span class="brand-mark">M360</span><span class="m-brand-name">Maintenance 360</span></a>
          <button class="m-icon-btn" aria-label="Buscar" data-act="toggleSearch"><span aria-hidden="true">⌕</span></button>
        </div>
        <header class="topbar">
          <form class="global-search-wrap" role="search" data-form="search">
            <input type="search" class="global-search-input" name="q" aria-label="Busca geral" placeholder="Buscar equipamento, peça, sintoma ou documento" />
          </form>
          <div class="topbar-actions">
            <div class="role-switcher">
              <label class="role-label" for="demo-user">Perfil</label>
              <select id="demo-user" class="role-select" data-input="demoUser">
                ${state.users.map((u) => h`<option value="${u.id}" ${state.demoUserId === u.id ? raw('selected') : ''}>${u.name}</option>`)}
              </select>
              <span class="role-pill ${(state.me?.role ?? '').toLowerCase()}" id="role-pill">${ROLE[state.me?.role] ?? ''}</span>
            </div>
          </div>
        </header>
        <main class="viewport" id="viewport" tabindex="-1"></main>
      </div>
    </div>
    <nav class="bottom-nav" aria-label="Principal">
      <ul>
        ${mobileLink('dashboard', '#/', '▣', 'Início')}
        ${mobileLink('equipment', '#/equipamentos', '❖', 'Máquinas')}
        <li class="bottom-plus-slot"><button class="bottom-plus" id="fab" aria-label="Nova manutenção" data-act="openWizard" data-id=""><span aria-hidden="true">+</span></button></li>
        ${mobileLink('maintenance', '#/manutencao', '⏱', 'Histórico')}
        <li><button class="bottom-nav-link" id="more-btn" aria-haspopup="dialog" data-act="openMore"><span class="nav-btn-left"><span class="nav-icon" aria-hidden="true">≡</span><span class="nav-text">Mais</span></span></button></li>
      </ul>
    </nav>
    <div class="more-backdrop" id="more-sheet" hidden data-act="moreBackdrop">
      <div class="more-card" role="dialog" aria-modal="true" aria-label="Mais opções">
        <div class="more-grip" aria-hidden="true"></div>
        <a class="more-link" href="#/relatorios" data-act="closeMore"><span aria-hidden="true">▦</span>Relatório do dia</a>
        <a class="more-link" href="#/assistente" data-act="closeMore"><span aria-hidden="true">✦</span>Assistente IA</a>
        <a class="more-link" href="#/manuais" data-act="closeMore"><span aria-hidden="true">▤</span>Manuais</a>
        <label class="form-label" for="demo-user-m">Quem está usando</label>
        <select id="demo-user-m" class="form-select" data-input="demoUser">
          ${state.users.map((u) => h`<option value="${u.id}" ${state.demoUserId === u.id ? raw('selected') : ''}>${u.name} (${ROLE[u.role]})</option>`)}
        </select>
        ${window.mi360Reset ? h`
          <p class="muted-sm">Demonstração: seus registros ficam salvos só neste aparelho.</p>
          <button class="btn btn-ghost btn-sm" data-act="resetDemo">Voltar aos dados iniciais</button>` : ''}
        <button class="btn btn-secondary" data-act="closeMore">Fechar</button>
      </div>
    </div>`);
}
const mobileLink = (key, href, icon, label) => h`
  <li><a class="bottom-nav-link" data-nav="${key}" href="${href}" aria-label="${label}"><span class="nav-btn-left"><span class="nav-icon" aria-hidden="true">${icon}</span><span class="nav-text">${label}</span></span></a></li>`;
function toggleMore(open) {
  $('#more-sheet').hidden = !open;
  document.body.classList.toggle('sheet-open', open);
  (open ? $('.more-link') : $('#more-btn')).focus();
}
function parseRoute() {
  const [, first = '', second] = location.hash.replace(/^#/, '').split('/');
  const id = second ? decodeURIComponent(second) : null;
  const screens = { '': 'dashboard', equipamentos: id ? 'detail' : 'equipment', manutencao: 'maintenance', relatorios: 'report', assistente: 'assistant', manuais: 'manuals', busca: 'search' };
  return { screen: screens[first] ?? 'notfound', id };
}
const TITLES = { dashboard: 'Visão geral', equipment: 'Equipamentos', detail: 'Equipamento', maintenance: 'Manutenção', report: 'Relatório do dia', assistant: 'Assistente IA', manuals: 'Manuais', search: 'Busca', notfound: 'Página não encontrada' };
function currentView() {
  const views = { dashboard: viewDashboard, equipment: viewExplorer, detail: viewDetail, maintenance: viewHistory, report: viewReport, assistant: viewAssistant, manuals: viewManuals, search: viewSearch };
  return (views[state.route.screen] ?? (() => emptyBox('Página não encontrada', 'Use o menu para voltar a uma tela.')))();
}
/** Repinta a tela atual mantendo o foco no controle equivalente. */
function repaint() {
  const active = document.activeElement?.dataset;
  const key = active?.act ? `[data-act="${active.act}"][data-id="${active.id ?? ''}"]` : null;
  destroyViewer();
  paint('#viewport', currentView());
  if (key) $(key)?.focus();
  if (state.route.screen === 'detail' && state.stage.mode === '3D') startViewer();
}
async function route() {
  const token = ++routeToken;
  state.route = parseRoute();
  const { screen, id } = state.route;
  destroyViewer();
  const navKey = { detail: 'equipment', report: 'maintenance' }[screen] ?? screen;
  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (a.dataset.nav === navKey) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    a.classList.toggle('active', a.dataset.nav === navKey);
  });
  $('#fab').hidden = !can('maintenance:write');
  $('#more-btn').classList.toggle('active', ['assistant', 'manuals', 'report'].includes(screen));
  if (screen === 'report') document.querySelector('.bottom-nav-link.active[data-nav]')?.classList.remove('active');
  $('.topbar').classList.remove('search-open');
  document.title = `${TITLES[screen]} · Maintenance Intelligence 360`;
  paint('#viewport', loadingBox());
  try {
    if (screen === 'dashboard') await loadDashboard();
    if (screen === 'equipment') await loadExplorer();
    if (screen === 'detail') await loadDetail(id);
    if (screen === 'maintenance') {
      await loadHistory();
      if (id) { await loadRecord(id); state.expanded.add(id); }
    }
    if (screen === 'report') await loadReport(id ?? undefined);
    if (screen === 'manuals') await loadDocs(id ?? undefined);
    if (screen === 'search') state.searchResults = await api(`/search?q=${encodeURIComponent(id ?? '')}`);
    if (token !== routeToken) return;
    repaintRoute(id);
  } catch (err) {
    if (token === routeToken) paint('#viewport', errorBox(err.message));
  }
}
function repaintRoute(id) {
  const { screen } = state.route;
  paint('#viewport', currentView());
  window.scrollTo(0, 0);
  $('.page-title')?.focus({ preventScroll: true });
  if (screen === 'detail') {
    document.title = `${state.detail.profile.tag} · Maintenance Intelligence 360`;
    if (state.stage.mode === '3D') startViewer();
  }
  if (screen === 'maintenance' && id) $(`#rec-${CSS.escape(id)}`)?.scrollIntoView({ block: 'center' });
  if (screen === 'manuals' && id && window.innerWidth < 1180) $('#doc-reader')?.scrollIntoView({ block: 'start' });
  if (screen === 'assistant' && state.ai.pending) {
    state.ai.pending = false;
    askAssistant();
  }
}

/* ---------- Ações ---------- */
const actions = {
  retry: () => route(),
  skip: (d, el, e) => { e.preventDefault(); $('#viewport').focus(); },
  openWizard: (d) => guard(() => openWizard(d.id || state.route.id && state.route.screen === 'detail' && state.route.id)),
  filterStatus: (d) => {
    Object.assign(state.explorer, { status: d.id, category: '', location: '', q: '' });
    location.hash = '#/equipamentos';
  },
  setCategory: (d) => { state.explorer.category = d.id; repaint(); },
  setStatus: (d) => { state.explorer.status = d.id; repaint(); },
  clearExplorer: () => { Object.assign(state.explorer, { category: '', status: '', location: '', q: '' }); repaint(); },
  setStage: (d) => { state.stage.mode = d.id; state.stage.notice = ''; paintStage(); },
  toggleXray: () => { state.stage.xray = !state.stage.xray; viewer?.highlight(activeComponent()?.modelNode ?? null, state.stage.xray); paint('#stage-toolbar', stageToolbar()); },
  togglePins: () => { state.stage.pins = !state.stage.pins; $('.pin-layer')?.classList.toggle('pins-hidden', !state.stage.pins); paint('#stage-toolbar', stageToolbar()); },
  resetCamera: () => viewer?.resetCamera(),
  selectComponent: (d) => selectComponent(d.id),
  setTab: (d) => { state.stage.tab = d.id; repaint(); },
  replaceComponent: () => guard(() => openWizard(state.detail.profile.id, activeComponent())),
  askEquipment: (d) => {
    Object.assign(state.ai, { equipmentId: d.id, question: d.text ? `${d.text}: o que o histórico mostra e o que inspecionar?` : 'O que o histórico mostra e o que inspecionar?', pending: true, answer: null });
    location.hash = '#/assistente';
  },
  toggleRecord: (d) => guard(() => toggleRecord(d.id)),
  clearHistory: () => {
    state.history.filters = emptyHistory();
    guard(async () => { await loadHistory(); repaint(); });
  },
  historyChip: (d) => {
    state.history.filters[d.id] = !state.history.filters[d.id];
    repaint();
  },
  historyMore: () => guard(async () => { await loadHistory(state.history.page + 1); paint('#history-results', historyResults()); }),
  askSymptom: (d) => {
    const eq = eqById(state.ai.equipmentId);
    state.ai.question = eq ? `${eq.tag}: ${d.text}` : d.text;
    askAssistant();
  },
  saveConfirm: (d) => guard(async () => {
    const block = state.ai.answer.blocks[Number(d.id)];
    await api('/ai/confirmations', { method: 'POST', body: { equipmentId: state.ai.equipmentId, ruleId: block.ruleId, conclusion: `Verificado em campo: ${block.text}` } });
    toast('Conclusão registrada.');
    await askAssistant();
  }),
  startConfirm: (d) => { state.ai.confirming = d.id; paintAiResults(); },
  cancelConfirm: () => { state.ai.confirming = null; paintAiResults(); },
  setDocType: (d) => { state.docs.type = d.id; guard(async () => { await loadDocs(); repaint(); }); },
  wizardBackdrop: (d, el, e) => { if (e.target === el) closeWizard(); },
  wizardClose: () => closeWizard(),
  wizardSubmit: () => submitWizard(),
  wizardToggle: (d) => {
    const w = state.wizard;
    const list = w[d.list];
    if (list.includes(d.id)) list.splice(list.indexOf(d.id), 1); else list.push(d.id);
    if (d.list === 'actions' && !w.actions.includes('troca')) w.swapped = [];
    w.dirty = true;
    paintWizard();
  },
  downloadReport: (d) => guard(() => downloadReport(d.id)),
  openMore: () => toggleMore(true),
  closeMore: () => toggleMore(false),
  moreBackdrop: (d, el, e) => { if (e.target === el) toggleMore(false); },
  toggleSearch: () => {
    const open = $('.topbar').classList.toggle('search-open');
    if (open) $('.global-search-input').focus();
  },
  resetDemo: async () => {
    if (window.confirm('Apagar seus registros e voltar aos dados iniciais?')) await window.mi360Reset();
  },
  wizardSet: (d) => {
    const w = state.wizard;
    w[d.field] = d.field === 'minutesAgo' ? Number(d.id) : d.id;
    w.dirty = true;
    paintWizard();
  },
  wizardShowWho: () => { state.wizard.showWho = true; paintWizard(); },
  wizardResult: (d) => { state.wizard.status = d.id; state.wizard.dirty = true; paintWizard(); },
  wizardPick: (d) => guard(async () => {
    Object.assign(state.wizard, { equipmentId: d.id, pickingEquipment: false, dirty: true });
    await loadWizardEquipment(d.id);
    paintWizard();
  }),
  wizardChangeEquipment: () => { state.wizard.pickingEquipment = true; paintWizard(); },
  wizardShowNote: () => { state.wizard.showNote = true; paintWizard(); $('#wiz-note')?.focus(); },
  wizardRemovePhoto: (d) => {
    URL.revokeObjectURL(state.wizard.photos[d.id].url);
    state.wizard.photos[d.id] = null;
    paintWizard();
  },
};

const searchExplorer = debounce(() => paint('#explorer-results', explorerResults()));
const searchHistory = debounce(() => guard(async () => { await loadHistory(); paint('#history-results', historyResults()); }), 300);
const searchDocs = debounce(() => guard(async () => { await loadDocs(); paintDocs(); }), 300);
const refilterHistory = () => guard(async () => { await loadHistory(); paint('#history-results', historyResults()); });
const inputs = {
  demoUser: (el) => guard(async () => {
    state.demoUserId = el.value;
    state.me = await api('/me');
    paint('#role-pill', ROLE[state.me.role] ?? '');
    $('#role-pill').className = `role-pill ${state.me.role.toLowerCase()}`;
    $('#demo-user').value = el.value;
    $('#demo-user-m').value = el.value;
    toast(`Perfil: ${state.me.name}, ${ROLE[state.me.role]}`);
    route();
  }),
  explorerSearch: (el) => { state.explorer.q = el.value; searchExplorer(); },
  explorerLocation: (el) => { state.explorer.location = el.value; paint('#explorer-results', explorerResults()); },
  historySearch: (el) => { state.history.filters.q = el.value; searchHistory(); },
  historyEquipment: (el) => { state.history.filters.equipmentId = el.value; refilterHistory(); },
  historyTech: (el) => { state.history.filters.technicianId = el.value; refilterHistory(); },
  historyFrom: (el) => { state.history.filters.from = el.value; refilterHistory(); },
  historyTo: (el) => { state.history.filters.to = el.value; refilterHistory(); },
  reportDate: (el) => { if (el.value) location.hash = `#/relatorios/${el.value}`; },
  aiEquipment: (el) => { state.ai.equipmentId = el.value; paint('#ai-chips', aiChips()); },
  aiQuestion: (el) => { state.ai.question = el.value; },
  docsSearch: (el) => { state.docs.q = el.value; searchDocs(); },
  docsEquipment: (el) => { state.docs.equipmentId = el.value; guard(async () => { await loadDocs(); paintDocs(); }); },
};
const forms = {
  search: (form) => {
    const q = new FormData(form).get('q').trim();
    if (q) location.hash = `#/busca/${encodeURIComponent(q)}`;
  },
  ask: () => askAssistant(),
};
/** Reduz a foto da câmera antes de salvar; se não der, usa o arquivo original. */
async function shrinkPhoto(file) {
  try {
    const image = await createImageBitmap(file);
    const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(image.width, image.height));
    if (scale === 1 && file.size < 1024 * 1024) return file;
    const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(image.width * scale), height: Math.round(image.height * scale) });
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((done) => { canvas.toBlob(done, 'image/jpeg', 0.82); });
    return blob ? new File([blob], 'foto.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}
async function pickPhoto(input) {
  const w = state.wizard;
  const original = input.files[0];
  const stage = input.dataset.photo;
  w.photoError = '';
  if (!original) return;
  if (!PHOTO_TYPES.includes(original.type)) { w.photoError = 'Use uma imagem JPG, PNG ou WEBP.'; paintWizard(); return; }
  const file = await shrinkPhoto(original);
  if (state.wizard !== w) return;
  if (file.size > MAX_PHOTO_BYTES) w.photoError = 'A foto passa de 8 MB.';
  else {
    w.photos[stage] = { file, url: URL.createObjectURL(file) };
    w.dirty = true;
  }
  paintWizard();
}

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (el && !el.disabled) actions[el.dataset.act]?.(el.dataset, el, e);
});
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.wiz) {
    state.wizard[el.dataset.wiz] = el.value;
    state.wizard.dirty = true;
  } else if (el.dataset.input && el.type !== 'radio' && el.tagName !== 'SELECT' && el.type !== 'checkbox' && el.type !== 'date') {
    inputs[el.dataset.input]?.(el);
  }
});
document.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.photo) pickPhoto(el);
  else if (el.dataset.input && (el.type === 'radio' || el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'date')) inputs[el.dataset.input]?.(el);
});
document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  forms[form.dataset.form]?.(form);
});
// Imagem que falhar vira a silhueta técnica da categoria.
document.addEventListener('error', (e) => {
  const img = e.target;
  if (img.tagName === 'IMG' && img.dataset.category) img.outerHTML = part(silhouette(img.dataset.category));
}, true);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#more-sheet').hidden) { toggleMore(false); return; }
  if (state.wizard) {
    if (e.key === 'Escape') { closeWizard(); return; }
    if (e.key === 'Tab') {
      const items = [...document.querySelectorAll('.modal-card button:not([disabled]), .modal-card input, .modal-card select, .modal-card textarea')];
      const first = items[0];
      const last = items.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    return;
  }
  if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
    e.preventDefault();
    $('.global-search-input').focus();
  }
});
window.addEventListener('hashchange', route);

async function boot() {
  try {
    await window.mi360Ready;
    const [users, me, equipment, inventory] = await Promise.all([api('/users'), api('/me'), api('/equipment'), api('/inventory')]);
    Object.assign(state, { users, me, equipment, inventory: Object.fromEntries(inventory.map((i) => [i.sku, i])) });
    paintShell();
    await route();
  } catch (err) {
    $('#app-root').innerHTML = part(h`<div class="boot-error">${errorBox(err.message)}</div>`);
    $('[data-act="retry"]').addEventListener('click', () => location.reload());
  }
}
boot();
