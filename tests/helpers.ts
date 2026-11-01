import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach } from 'vitest';
import { createApp } from '../server/app.ts';
import { openDb } from '../server/db/connection.ts';
import { seed } from '../server/db/seed/seed.ts';

const cleanups: (() => void)[] = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()!();
});

export const SUPERVISOR = 'u-supervisor-1';
export const MECHANIC = 'u-mecanico-1';

export function setup() {
  const uploadDir = mkdtempSync(join(tmpdir(), 'mi360-'));
  const db = openDb(':memory:');
  seed(db, { publicDir: 'public', contentDir: 'content/documents' });
  const app = createApp(db, { uploadDir });
  cleanups.push(() => {
    db.close();
    rmSync(uploadDir, { recursive: true, force: true });
  });

  const request = (method: string, path: string, body?: unknown, user = MECHANIC) =>
    app.request(`/api${path}`, {
      method,
      headers: { 'X-Demo-User': user, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  const form = (path: string, data: FormData, user = MECHANIC) =>
    app.request(`/api${path}`, { method: 'POST', headers: { 'X-Demo-User': user }, body: data });
  const uploadedFiles = () => {
    try {
      return readdirSync(join(uploadDir, 'photos'));
    } catch {
      return [];
    }
  };

  return { db, app, request, form, uploadedFiles };
}

export const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

export const validRecord = () => ({
  equipmentId: 'bc-101',
  occurredAt: '2026-10-30T09:00:00-03:00',
  reportedProblem: 'Ruído novo no mancal',
  inspection: 'Óleo normal, ruído no rolamento',
  workPerformed: 'Troca do rolamento traseiro',
  technicianId: MECHANIC,
  parts: [
    { direction: 'REMOVED', componentId: 'bc-101-c10', description: 'Rolamento traseiro', quantity: 1 },
    { direction: 'INSTALLED', inventorySku: 'RL-6310', description: 'Rolamento 6310-2Z', quantity: 1 },
  ],
});
