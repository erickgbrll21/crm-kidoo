import type { LeadSize } from '../types/index.js';
import type { SizeRange } from './settings.js';

export type StagnationLevel = 'normal' | 'warning' | 'cold';

const HOUR = 3_600_000;

/**
 * Termômetro de estagnação. Conta a partir da última interação comercial real
 * (ou da criação do lead, se nunca houve contato). Uma atividade futura já
 * agendada suspende o alerta.
 */
export function stagnationLevel(
  input: { last_interaction_at: string | null; created_at: string; next_activity_at?: string | null; status?: string },
  thresholds: { warning_hours: number; cold_hours: number },
  now = new Date(),
): { level: StagnationLevel; hours: number } {
  const base = new Date(input.last_interaction_at ?? input.created_at).getTime();
  const hours = Math.max(0, (now.getTime() - base) / HOUR);
  if (input.status && input.status !== 'open') return { level: 'normal', hours };
  if (input.next_activity_at && new Date(input.next_activity_at).getTime() > now.getTime()) {
    return { level: 'normal', hours };
  }
  if (hours > thresholds.cold_hours) return { level: 'cold', hours };
  if (hours > thresholds.warning_hours) return { level: 'warning', hours };
  return { level: 'normal', hours };
}

export function classifySize(monthlyRevenue: number | null | undefined, ranges: SizeRange[]): LeadSize | null {
  if (monthlyRevenue == null) return null;
  const sorted = [...ranges].sort((a, b) => (a.max ?? Infinity) - (b.max ?? Infinity));
  return sorted.find((r) => r.max === null || monthlyRevenue <= r.max)?.size ?? null;
}

export const digits = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '');

export function normalizeCompany(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(ltda|me|epp|eireli|s\/?a)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Compara telefones ignorando o DDI 55 quando presente em só um dos lados. */
export function samePhone(a: string | null | undefined, b: string | null | undefined) {
  const x = digits(a).replace(/^55(?=\d{10,11}$)/, '');
  const y = digits(b).replace(/^55(?=\d{10,11}$)/, '');
  return x.length >= 10 && x === y;
}

export interface DedupeCandidate {
  id: string;
  company_name: string;
  cnpj: string | null;
  contact_email: string | null;
  contact_phone: string | null;
}

export interface DedupeInput {
  company_name: string;
  cnpj?: string | null;
  email?: string | null;
  phone?: string | null;
}

/**
 * Identifica lead duplicado por CNPJ, e-mail, telefone ou nome normalizado,
 * nessa ordem de confiança.
 */
export function findDuplicate(input: DedupeInput, candidates: DedupeCandidate[]): { id: string; by: string } | null {
  const cnpj = digits(input.cnpj);
  const email = input.email?.trim().toLowerCase();
  const company = normalizeCompany(input.company_name);
  for (const c of candidates) if (cnpj.length === 14 && digits(c.cnpj) === cnpj) return { id: c.id, by: 'cnpj' };
  for (const c of candidates) if (email && c.contact_email?.toLowerCase() === email) return { id: c.id, by: 'email' };
  for (const c of candidates) if (samePhone(input.phone, c.contact_phone)) return { id: c.id, by: 'phone' };
  for (const c of candidates) if (company && normalizeCompany(c.company_name) === company) return { id: c.id, by: 'company' };
  return null;
}
