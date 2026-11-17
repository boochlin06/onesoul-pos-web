import { drizzle, DrizzleD1Database } from 'drizzle-orm/d1';
import type { D1Database } from '@cloudflare/workers-types';
import * as schema from './schema';
import * as relations from './relations';

export const fullSchema = {
  ...schema,
  ...relations,
};

export type FullSchema = typeof fullSchema;
export type OneSoulD1Database = DrizzleD1Database<FullSchema>;

/**
 * Factory to create a fully typed Drizzle D1 Client
 */
export function createD1Client(d1: D1Database): OneSoulD1Database {
  return drizzle(d1, { schema: fullSchema });
}
