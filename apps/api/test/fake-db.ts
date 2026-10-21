import { vi } from 'vitest';

type Op = [string, unknown[]];
type Result = { data: unknown; error: unknown; count?: number };
type Handler = (ops: Op[]) => Result | Promise<Result>;

/**
 * Substituto do cliente Supabase: cada `from(tabela)` grava a cadeia de chamadas
 * e resolve com o handler registrado para a tabela.
 */
export function createFakeDb() {
  const calls: { table: string; ops: Op[] }[] = [];
  const handlers: Record<string, Handler> = {};

  const from = (table: string) => {
    const entry = { table, ops: [] as Op[] };
    calls.push(entry);
    const builder: unknown = new Proxy(
      {},
      {
        get(_t, prop: string) {
          if (prop === 'then') {
            const h = handlers[table] ?? (() => ({ data: null, error: null }));
            return (res: (v: Result) => unknown, rej: (e: unknown) => unknown) =>
              Promise.resolve(h(entry.ops)).then(res, rej);
          }
          return (...args: unknown[]) => {
            entry.ops.push([prop, args]);
            return builder;
          };
        },
      },
    );
    return builder;
  };

  const db = {
    from: vi.fn(from),
    rpc: vi.fn(async (_fn: string, _args: Record<string, unknown>): Promise<Result> => ({ data: null, error: null })),
    auth: {
      getUser: vi.fn(async (_token: string): Promise<{ data: { user: { id: string } | null }; error: unknown }> => ({
        data: { user: null },
        error: { message: 'invalid' },
      })),
      admin: { createUser: vi.fn() },
    },
    storage: { from: vi.fn() },
  };

  const reset = () => {
    calls.length = 0;
    for (const k of Object.keys(handlers)) delete handlers[k];
    db.rpc.mockReset();
    db.rpc.mockImplementation(async () => ({ data: null, error: null }));
  };

  const has = (ops: Op[], method: string) => ops.some(([m]) => m === method);
  const arg = (ops: Op[], method: string) => ops.find(([m]) => m === method)?.[1];

  return { db, calls, handlers, reset, has, arg };
}

export const PROFILES = {
  admin: { id: '00000000-0000-4000-8000-000000000001', full_name: 'Pedro', email: 'pedro@example.com', role: 'admin', is_active: true },
  manager: { id: '00000000-0000-4000-8000-000000000002', full_name: 'Arthur', email: 'arthur@example.com', role: 'manager', is_active: true },
  closer: { id: '00000000-0000-4000-8000-000000000003', full_name: 'Closer Teste', email: 'closer@example.com', role: 'closer', is_active: true },
  inactive: { id: '00000000-0000-4000-8000-000000000004', full_name: 'Inativo', email: 'x@example.com', role: 'closer', is_active: false },
} as const;
