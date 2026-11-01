import type { Context } from 'hono';
import type { z } from 'zod';

export class AppError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409 | 413 | 415 | 500,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new AppError(404, 'NOT_FOUND', `${what} não encontrado.`);

export function parseBody<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
  throw new AppError(400, 'VALIDATION_ERROR', 'Verifique os campos informados.', details);
}

export async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new AppError(400, 'INVALID_JSON', 'Corpo da requisição inválido.');
  }
}

export function intParam(value: string | undefined, fallback: number, max: number): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return fallback;
  return Math.min(n, max);
}
