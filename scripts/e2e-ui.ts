// Percorre a interface no Chrome instalado. Com o servidor no ar: npm run e2e:ui
// O fluxo grava um registro no banco; rode npm run db:seed depois.
import { readFileSync } from 'node:fs';
import { chromium, type Page } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:8787';
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const axeSource = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');
const ROUTES = ['#/', '#/equipamentos', '#/equipamentos/bc-101', '#/equipamentos/mt-301', '#/manutencao', '#/relatorios/2026-10-29', '#/assistente', '#/manuais', '#/busca/rolamento'];
const SIZES = [['desktop', 1366, 800], ['tablet', 820, 1100], ['celular', 375, 812]] as const;

const failures: string[] = [];
const check = (ok: unknown, label: string) => {
  console.log(`${ok ? 'ok  ' : 'FALHA'} ${label}`);
  if (!ok) failures.push(label);
};
const settle = (page: Page) => page.waitForFunction(() => !document.querySelector('#viewport > .state-box .spinner'));

async function audit(page: Page, name: string) {
  for (const route of ROUTES) {
    await page.goto(`${BASE}/${route}`);
    await settle(page);
    await page.waitForTimeout(150);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(overflow <= 0, `${name} ${route}: sem rolagem lateral (${overflow}px)`);
    const broken = await page.evaluate(() => [...document.querySelectorAll('button:not([data-act]):not([type=submit])')].map((b) => b.textContent?.trim()));
    check(broken.length === 0, `${name} ${route}: todo botão tem ação ${broken.join(', ')}`);
    await page.addScriptTag({ content: axeSource });
    const issues = await page.evaluate(async () => {
      // @ts-expect-error axe é injetado na página
      const r = await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] });
      return r.violations.map((v: { id: string; nodes: { target: string[] }[] }) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
    });
    check(issues.length === 0, `${name} ${route}: axe ${issues.join('; ')}`);
  }
}

async function wizardFlow(page: Page) {
  await page.goto(`${BASE}/#/equipamentos/tr-501`);
  await page.locator('.tag-plate-lg', { hasText: 'TR-501' }).waitFor();
  await page.locator('[data-act="openWizard"]:visible').first().click();
  await page.getByRole('dialog').waitFor();
  const save = page.getByRole('button', { name: 'Salvar' });
  check(await save.isDisabled(), 'registro: salvar bloqueado até responder');
  check(await page.locator('.modal-body textarea, .modal-body input[type=text]').count() === 0, 'registro: nenhum campo de escrita obrigatório');
  check(await page.getByRole('button', { name: '✓ Linha 5' }).isVisible(), 'registro: local vem da máquina');
  check(await page.getByText(/Rafael Moura · \d\d:\d\d/).isVisible(), 'registro: mecânico e horário já preenchidos');
  await page.getByRole('dialog').getByRole('button', { name: 'Correia patinando' }).click();
  await page.getByRole('button', { name: 'Troquei peça' }).click();
  await page.locator('.quick-subtitle + .quick-grid .quick-chip').first().click();
  await page.getByRole('button', { name: 'Funcionando' }).click();
  await page.locator('[data-photo="BEFORE"]').setInputFiles('public/images/maintenance/correia-gasta.webp');
  await save.click();
  await page.getByRole('dialog').waitFor({ state: 'detached' });
  await settle(page);
  await page.getByText('Correia patinando').first().waitFor();
  check(true, 'registro: quatro toques salvam e aparecem na linha do tempo');
  const photo = page.locator('.timeline-card.expanded .photo-frame img').first();
  await photo.waitFor({ timeout: 5000 }).catch(() => undefined);
  await photo.scrollIntoViewIfNeeded().catch(() => undefined);
  check(await photo.evaluate((img: HTMLImageElement) => img.decode().then(() => img.naturalWidth > 0)).catch(() => false), 'registro: foto enviada aparece');
  await page.goto(`${BASE}/#/manutencao`);
  await page.reload();
  await page.locator('.timeline-card').first().waitFor();
  check(await page.locator('.timeline-card').first().getByText('Correia patinando').isVisible(), 'registro: continua salvo depois de recarregar');
}

async function reportFlow(page: Page) {
  await page.goto(`${BASE}/#/`);
  await settle(page);
  await page.getByRole('link', { name: /Relatório do dia/ }).first().click();
  await page.locator('.report-metric').first().waitFor();
  check(true, 'relatório: abre pela visão geral com o dia do registro novo');
  check(await page.locator('.recent-row', { hasText: 'Correia patinando' }).getByText('Rafael Moura').isVisible(), 'relatório: mostra mecânico do serviço');
  await page.goto(`${BASE}/#/relatorios/2026-10-29`);
  await page.locator('.recent-row').first().waitFor();
  check(await page.locator('.recent-row').count() === 6, 'relatório: dia cheio lista seis serviços');
  check(await page.locator('.report-metric strong').first().textContent() === '6', 'relatório: total confere');
  const pdf = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar PDF' }).click();
  check((await pdf).suggestedFilename() === 'relatorio-2026-10-29.pdf', 'relatório: PDF baixa com o nome do dia');
  await page.goto(`${BASE}/#/relatorios/2020-01-01`);
  await page.getByText('Nenhum serviço neste dia').waitFor();
  check(true, 'relatório: dia sem serviço mostra aviso');
}

async function mobileFlow(page: Page) {
  await page.goto(`${BASE}/#/`);
  await settle(page);
  check(await page.locator('.topbar').isHidden(), 'celular: busca e perfil não ocupam a tela');
  await page.getByRole('button', { name: 'Mais' }).click();
  await page.getByRole('dialog', { name: 'Mais opções' }).getByRole('link', { name: 'Relatório do dia' }).click();
  await page.locator('.report-metric, .state-box').first().waitFor();
  check(await page.locator('#more-sheet').isHidden() && page.url().includes('#/relatorios'), 'celular: menu Mais abre o relatório');
  await page.getByRole('button', { name: 'Buscar' }).click();
  await page.getByLabel('Busca geral').fill('vibracao');
  await page.getByLabel('Busca geral').press('Enter');
  await page.getByRole('heading', { name: /Resultados/ }).waitFor();
  check(true, 'celular: busca abre pelo ícone');
  await page.getByRole('button', { name: 'Nova manutenção' }).click();
  await page.getByRole('dialog').waitFor();
  check(await page.locator('.wizard-eq').count() === 8, 'celular: botão central abre o registro');
  await page.getByRole('button', { name: '✕ Fechar' }).click();
}

async function assistantFlow(page: Page) {
  const ask = async () => {
    await page.selectOption('#ai-eq', 'bc-101');
    await page.getByRole('button', { name: 'Vibração no mancal' }).click();
    await page.locator('.ai-block-FATO_HISTORICO').first().waitFor();
  };
  await page.goto(`${BASE}/#/assistente`);
  await settle(page);
  await ask();
  check(await page.locator('.ai-block-HIPOTESE_IA').count() > 0, 'IA: traz hipóteses rotuladas');
  check(await page.getByText('Modo demonstração, sem IA ao vivo.').isVisible(), 'IA: aviso de demonstração visível');
  check(await page.getByRole('button', { name: 'Confirmar em campo' }).count() === 0, 'IA: mecânico não confirma');
  await page.locator('.ai-block-card .citation-chip').first().click();
  await settle(page);
  check(/#\/(manutencao|manuais)\//.test(page.url()), 'IA: citação abre a fonte');
  await page.goto(`${BASE}/#/assistente`);
  await page.selectOption('#demo-user', { label: 'Helena Vasconcelos' });
  await settle(page);
  await ask();
  await page.getByRole('button', { name: 'Confirmar em campo' }).first().click();
  await page.getByRole('button', { name: 'Sim, confirmar' }).click();
  await page.locator('.ai-block-CONCLUSAO_HUMANA').first().waitFor();
  check(true, 'IA: supervisor confirma em dois toques');
}

async function searchFlow(page: Page) {
  await page.goto(`${BASE}/#/equipamentos`);
  await settle(page);
  await page.getByLabel('Filtrar equipamentos').pressSequentially('submersivel');
  await page.waitForTimeout(400);
  check(await page.locator('.equipment-card').count() === 2, 'equipamentos: busca sem acento mantém o foco');
  await page.reload();
  await settle(page);
  check(await page.locator('.equipment-card img').count() === 8, 'equipamentos: cards usam os renders');
  await page.getByLabel('Busca geral').fill('vibracao');
  await page.getByLabel('Busca geral').press('Enter');
  await page.getByRole('heading', { name: /Resultados/ }).waitFor();
  check(await page.locator('.doc-card').count() > 0, 'busca geral: encontra resultados');
  await page.goto(`${BASE}/#/rota-inexistente`);
  await page.getByText('Página não encontrada').first().waitFor();
  check(true, 'rota desconhecida: mostra aviso');
  await page.goBack();
  check(page.url().endsWith('#/busca/vibracao'), 'botão voltar do navegador funciona');
}

async function viewerFlow(page: Page) {
  await page.goto(`${BASE}/#/equipamentos/bc-101`);
  await page.locator('#three-stage-container canvas').waitFor({ timeout: 20_000 });
  await page.locator('#three-loading').waitFor({ state: 'detached', timeout: 20_000 });
  check(await page.locator('[data-pin-node]').count() === 11, '3D: 11 pinos');
  await page.locator('.comp-row', { hasText: 'Selo mecânico' }).click();
  check(await page.locator('#stage-hud').getByText('Selo mecânico').isVisible(), '3D: lista seleciona componente');
  check(await page.locator('#three-stage-container canvas').count() === 1, '3D: seleção não remonta o modelo');
  await page.route('**/models/bc-101.glb', (r) => r.abort());
  await page.goto(`${BASE}/#/equipamentos/bc-102`);
  await page.getByText('O modelo 3D não abriu').waitFor({ timeout: 20_000 });
  await page.locator('.stage-photo img').waitFor();
  check(true, '3D: falha cai na imagem de reserva');
  await page.unroute('**/models/bc-101.glb');
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--enable-unsafe-swiftshader'] });
const errors: string[] = [];
const newPage = async (width: number, height: number) => {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_FAILED')) errors.push(m.text()); });
  page.on('dialog', (d) => d.accept());
  return page;
};
for (const [name, width, height] of SIZES) await audit(await newPage(width, height), name);
const page = await newPage(1366, 800);
await searchFlow(page);
await viewerFlow(page);
await wizardFlow(page);
await reportFlow(page);
await assistantFlow(page);
await mobileFlow(await newPage(375, 812));
await wizardFlow(await newPage(375, 812));
check(errors.length === 0, `console limpo ${[...new Set(errors)].slice(0, 5).join(' | ')}`);
await browser.close();
console.log(failures.length ? `\n${failures.length} falha(s)` : '\nTudo certo');
process.exitCode = failures.length ? 1 : 0;
