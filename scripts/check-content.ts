// Falha se termos proibidos aparecerem no conteúdo que vai para o app.
// A lista fica em .content-rules (uma expressão regular), fora do repositório.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const RULES = '.content-rules';
if (!existsSync(RULES)) {
  console.log(`${RULES} não encontrado; verificação ignorada.`);
  process.exit(0);
}
const FORBIDDEN = new RegExp(readFileSync(RULES, 'utf8').trim(), 'i');
const ROOTS = ['content', 'server', 'shared', 'public'];

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

const hits: string[] = [];
let count = 0;
for (const root of ROOTS) {
  for (const path of walk(root)) {
    count++;
    // latin1 preserva cada byte, então também encontra texto dentro de GLB e PDF.
    if (FORBIDDEN.test(readFileSync(path, 'latin1'))) hits.push(path);
  }
}

if (hits.length > 0) {
  console.error(`Termos proibidos em:\n${hits.join('\n')}`);
  process.exit(1);
}
console.log(`${count} arquivos verificados, nenhum termo proibido.`);
