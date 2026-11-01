import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { Db } from '../../db/connection.ts';
import { AppError } from '../../http.ts';

export type Role = 'MECANICO' | 'SUPERVISOR';
export interface User {
  id: string;
  name: string;
  role: Role;
}

export type Action =
  | 'equipment:write'
  | 'equipment:delete'
  | 'component:write'
  | 'maintenance:write'
  | 'maintenance:delete'
  | 'document:write'
  | 'ai:confirm';

const SUPERVISOR_ONLY: ReadonlySet<Action> = new Set([
  'equipment:write',
  'equipment:delete',
  'component:write',
  'maintenance:delete',
  'document:write',
  'ai:confirm',
]);

export const can = (user: User, action: Action) =>
  user.role === 'SUPERVISOR' || !SUPERVISOR_ONLY.has(action);

export function requirePermission(user: User, action: Action): void {
  if (!can(user, action)) {
    throw new AppError(403, 'FORBIDDEN', 'Seu perfil não permite esta ação.');
  }
}

export type Env = { Variables: { user: User } };

// Perfil de demonstração escolhido pela interface. Não é autenticação real.
export const demoUser = (db: Db) =>
  createMiddleware<Env>(async (c, next) => {
    const id = c.req.header('X-Demo-User') ?? 'u-mecanico-1';
    const user = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(id) as User | undefined;
    if (!user) throw new AppError(400, 'UNKNOWN_USER', 'Perfil de demonstração desconhecido.');
    c.set('user', user);
    await next();
  });

export function userRoutes(db: Db) {
  return new Hono<Env>()
    .get('/users', (c) => c.json(db.prepare('SELECT id, name, role FROM users ORDER BY name').all()))
    .get('/me', (c) => {
      const user = c.get('user');
      const permissions = (['equipment:write', 'equipment:delete', 'component:write', 'maintenance:write',
        'maintenance:delete', 'document:write', 'ai:confirm'] as Action[]).filter((a) => can(user, a));
      return c.json({ ...user, permissions });
    });
}
