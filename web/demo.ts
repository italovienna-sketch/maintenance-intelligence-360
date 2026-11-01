// Site publicado: a mesma API do servidor roda no navegador, e os dados ficam neste aparelho.
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
// @ts-expect-error tipos do pdfkit não trazem a API do navegador
import { registerStdFonts } from 'pdfkit';
// @ts-expect-error módulo só de dados
import Helvetica from 'pdfkit/standard-fonts/Helvetica';
// @ts-expect-error módulo só de dados
import HelveticaBold from 'pdfkit/standard-fonts/HelveticaBold';
import { createApp } from '../server/app.ts';
import type { Db } from '../server/db/connection.ts';
import { migrations } from '../server/db/migrations.ts';
import { FileStore } from '../server/storage/photos.ts';
import { DatabaseSync, prepareDatabase } from './node-shims.ts';

registerStdFonts(Helvetica, HelveticaBold);

const STORE = 'files';
const KEY = `demo-v${migrations.length}`;

// Sem disco no navegador, o arquivo vira uma data URL gravada no próprio banco.
class BrowserFileStore extends FileStore {
  protected override write(_folder: string, name: string, bytes: Uint8Array) {
    const type = name.endsWith('.pdf') ? 'application/pdf' : `image/${name.split('.').pop()!.replace('jpg', 'jpeg')}`;
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return `data:${type};base64,${btoa(binary)}`;
  }
}

function openStorage() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open('mi360', 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error);
  });
}

function storage<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>) {
  return openStorage().then((idb) => new Promise<T>((resolve, reject) => {
    const request = run(idb.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}

// Em modo privado o IndexedDB pode falhar: o app continua, só não guarda entre visitas.
const quietly = <T>(work: Promise<T>) => work.catch(() => undefined);

async function start() {
  const [engine, saved] = await Promise.all([
    sqlite3InitModule(),
    quietly(storage<Uint8Array | undefined>('readonly', (s) => s.get(KEY))),
  ]);
  const bytes = saved ?? new Uint8Array(await (await fetch('/demo.db')).arrayBuffer());
  prepareDatabase(engine, bytes);
  const db = new DatabaseSync();
  const app = createApp(db as unknown as Db, { uploadDir: '', files: new BrowserFileStore('') });

  Object.assign(window, {
    mi360Demo: async (url: string, init: RequestInit = {}) => {
      const res = await app.request(url, init);
      if (init.method && init.method !== 'GET' && res.ok) {
        await quietly(storage('readwrite', (s) => s.put(db.export(), KEY)));
      }
      return res;
    },
  });
}

Object.assign(window, {
  mi360Reset: async () => {
    await quietly(storage('readwrite', (s) => s.delete(KEY)));
    location.href = '/';
    location.reload();
  },
  mi360Ready: start(),
});
