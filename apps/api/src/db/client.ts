import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";

type SqlClient = ReturnType<typeof postgres>;
type Database = ReturnType<typeof drizzle>;
export type ModelKv = { get(key: string, type: "json"): Promise<unknown> };
type RequestDatabase = { sql: SqlClient; db: Database; modelKv?: ModelKv };

const inBun = typeof Bun !== "undefined";
const requestDatabase = new AsyncLocalStorage<RequestDatabase>();

function createClient(): SqlClient {
  return postgres(env.DATABASE_URL, {
    prepare: false,
    max: inBun ? 10 : 5,
    idle_timeout: inBun ? 15 : 1,
    connect_timeout: 15,
    max_lifetime: inBun ? 60 * 5 : 30,
    keep_alive: inBun ? 30 : 0,
  });
}

const bunSql = inBun ? createClient() : null;
const bunDb = bunSql ? drizzle(bunSql) : null;

function current(): RequestDatabase {
  const scoped = requestDatabase.getStore();
  if (scoped) return scoped;
  if (bunSql && bunDb) return { sql: bunSql, db: bunDb };
  throw new Error("Database Worker harus dipakai dalam konteks permintaan");
}

export function currentModelKv(): ModelKv | undefined {
  return requestDatabase.getStore()?.modelKv;
}

export async function withRequestDatabase<T>(run: () => Promise<T>, modelKv?: ModelKv): Promise<T> {
  const client = createClient();
  return requestDatabase.run({ sql: client, db: drizzle(client), modelKv }, run);
}

export const sql = new Proxy((() => undefined) as unknown as SqlClient, {
  apply(_target, _thisArg, args) {
    const client = current().sql;
    return Reflect.apply(client, client, args);
  },
  get(_target, property) {
    const client = current().sql;
    const value = Reflect.get(client, property);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export const db = new Proxy({} as Database, {
  get(_target, property) {
    const database = current().db;
    const value = Reflect.get(database, property);
    return typeof value === "function" ? value.bind(database) : value;
  },
});
