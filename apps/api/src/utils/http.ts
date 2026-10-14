import type { PostgrestError } from '@supabase/supabase-js';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Registro') => new HttpError(404, 'not_found', `${what} não encontrado`);
export const forbidden = (msg = 'Você não tem permissão para esta ação') => new HttpError(403, 'forbidden', msg);
export const conflict = (msg: string) => new HttpError(409, 'conflict', msg);

const DB_ERRORS: Record<string, [number, string, string]> = {
  P0002: [404, 'not_found', 'Registro não encontrado'],
  P0001: [409, 'conflict', 'Operação não permitida no estado atual'],
  '23505': [409, 'duplicate', 'Registro duplicado'],
  '23503': [422, 'invalid_reference', 'Referência inválida'],
  '23514': [422, 'constraint_violation', 'Dados violam uma regra do sistema'],
  '22P02': [422, 'invalid_input', 'Formato de dado inválido'],
  PGRST116: [404, 'not_found', 'Registro não encontrado'],
};

export function dbError(error: PostgrestError): HttpError {
  const mapped = DB_ERRORS[error.code];
  if (mapped) return new HttpError(mapped[0], mapped[1], error.code === 'P0001' ? messageFor(error.message) : mapped[2]);
  return new HttpError(500, 'database_error', 'Erro ao acessar o banco de dados', { code: error.code });
}

const messageFor = (raw: string) =>
  (
    {
      lead_not_open: 'Este lead não está mais em aberto',
      followup_already_done: 'Este follow-up já foi concluído',
    } as Record<string, string>
  )[raw] ?? 'Operação não permitida no estado atual';

/** Extrai `data` de uma resposta do Supabase ou lança o erro mapeado. */
export function must<T>(res: { data: T; error: PostgrestError | null }): NonNullable<T> {
  if (res.error) throw dbError(res.error);
  if (res.data === null || res.data === undefined) throw notFound();
  return res.data as NonNullable<T>;
}
