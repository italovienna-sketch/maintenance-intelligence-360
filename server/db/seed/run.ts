import { rmSync } from 'node:fs';
import { openDb } from '../connection.ts';
import { seed } from './seed.ts';

const path = process.env.DB_PATH ?? 'data/mi360.db';
for (const suffix of ['', '-wal', '-shm']) rmSync(`${path}${suffix}`, { force: true });

const db = openDb(path);
seed(db, { publicDir: 'public', contentDir: 'content/documents' });
db.close();
console.log(`Banco recriado em ${path}`);
