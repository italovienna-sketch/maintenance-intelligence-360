import { Hono } from 'hono';
import type { Db } from '../../db/connection.ts';
import { notFound } from '../../http.ts';
import type { Env } from '../users/users.ts';

export interface InventoryItem {
  sku: string;
  name: string;
  unit: string;
  quantityOnHand: number;
  storageLocation: string;
}

// Ponto de integração futura. Um sistema real de estoque implementaria esta interface.
export interface InventoryProvider {
  list(query?: string): InventoryItem[];
  get(sku: string): InventoryItem | undefined;
}

const SELECT = `SELECT sku, name, unit, quantity_on_hand AS quantityOnHand,
  storage_location AS storageLocation FROM inventory_items`;

export class LocalInventoryProvider implements InventoryProvider {
  constructor(private readonly db: Db) {}

  list(query?: string): InventoryItem[] {
    if (!query?.trim()) return this.db.prepare(`${SELECT} ORDER BY name`).all() as unknown as InventoryItem[];
    const like = `%${query.trim().replace(/[%_]/g, '')}%`;
    return this.db
      .prepare(`${SELECT} WHERE name LIKE ? OR sku LIKE ? ORDER BY name`)
      .all(like, like) as unknown as InventoryItem[];
  }

  get(sku: string): InventoryItem | undefined {
    return this.db.prepare(`${SELECT} WHERE sku = ?`).get(sku) as InventoryItem | undefined;
  }
}

export function inventoryRoutes(provider: InventoryProvider) {
  return new Hono<Env>()
    .get('/', (c) => c.json(provider.list(c.req.query('q'))))
    .get('/:sku', (c) => {
      const item = provider.get(c.req.param('sku'));
      if (!item) throw notFound('Item de estoque');
      return c.json(item);
    });
}
