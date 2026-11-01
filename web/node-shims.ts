// Substitutos dos módulos do Node para a API rodar no navegador (só usados pelo build estático).
import type { Database, Sqlite3Static } from '@sqlite.org/sqlite-wasm';

let sqlite3: Sqlite3Static;
let pendingBytes: Uint8Array;

/** Prepara o motor e o conteúdo do banco que o próximo DatabaseSync vai abrir. */
export function prepareDatabase(engine: Sqlite3Static, bytes: Uint8Array) {
  sqlite3 = engine;
  pendingBytes = bytes;
}

export class DatabaseSync {
  private readonly db: Database;

  constructor() {
    const { capi, wasm } = sqlite3;
    this.db = new sqlite3.oo1.DB();
    const pointer = wasm.allocFromTypedArray(pendingBytes);
    const flags = capi.SQLITE_DESERIALIZE_FREEONCLOSE | capi.SQLITE_DESERIALIZE_RESIZEABLE;
    this.db.checkRc(capi.sqlite3_deserialize(this.db, 'main', pointer, pendingBytes.length, pendingBytes.length, flags));
    this.db.exec('PRAGMA foreign_keys = ON');
  }

  exec(sql: string) {
    this.db.exec(sql);
  }

  prepare(sql: string) {
    const rows = (params: unknown[]) => this.db.exec({
      sql, bind: (params.length ? params : undefined) as never, rowMode: 'object', returnValue: 'resultRows',
    }) as unknown[];
    return {
      all: (...params: unknown[]) => rows(params),
      get: (...params: unknown[]) => rows(params)[0],
      run: (...params: unknown[]) => { rows(params); return { changes: this.db.changes() }; },
    };
  }

  export() {
    return sqlite3.capi.sqlite3_js_db_export(this.db);
  }
}

export const randomUUID = () => crypto.randomUUID();
export const dirname = (p: string) => p;
export const join = (...parts: string[]) => parts.join('/');
export const mkdirSync = () => undefined;
export const rmSync = () => undefined;
export const writeFileSync = () => undefined;
export const serveStatic = () => async (_: unknown, next: () => Promise<void>) => next();
