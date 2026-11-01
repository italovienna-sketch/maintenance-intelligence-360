// Gera em dist/ o site publicável, sem servidor: npm run build:static
import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { openDb } from '../server/db/connection.ts';
import { seed } from '../server/db/seed/seed.ts';

const OUT = 'dist';
const shims = resolve('web/node-shims.ts');

rmSync(OUT, { recursive: true, force: true });
cpSync('public', OUT, { recursive: true });
cpSync('node_modules/@sqlite.org/sqlite-wasm/dist/sqlite3.wasm', `${OUT}/sqlite3.wasm`);

await build({
  entryPoints: ['web/demo.ts'],
  outfile: `${OUT}/demo.js`,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  alias: {
    'node:sqlite': shims,
    'node:fs': shims,
    'node:path': shims,
    'node:crypto': shims,
    '@hono/node-server/serve-static': shims,
  },
});

const db = openDb(':memory:');
seed(db, { publicDir: 'public', contentDir: 'content/documents' });
db.exec(`VACUUM INTO '${OUT}/demo.db'`);
db.close();

const html = readFileSync(`${OUT}/index.html`, 'utf8')
  .replace('<script type="module" src="/app.js">', '<script type="module" src="/demo.js"></script>\n  <script type="module" src="/app.js">')
  .replace('<meta charset="UTF-8" />', '<meta charset="UTF-8" />\n  <meta name="robots" content="noindex" />');
writeFileSync(`${OUT}/index.html`, html);
writeFileSync(`${OUT}/_headers`, '/*\n  X-Robots-Tag: noindex\n  X-Content-Type-Options: nosniff\n\n/sqlite3.wasm\n  Content-Type: application/wasm\n');
console.log(`Site gerado em ${OUT}/`);
