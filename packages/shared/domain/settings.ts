import type { LeadSize } from '../types/index.js';

export interface SizeRange {
  size: LeadSize;
  /** Faturamento mensal máximo (inclusivo). null = sem teto. */
  max: number | null;
}

export interface CadenceStep {
  key: string;
  offset_days: number;
  title: string;
  goal: string;
}

export interface AppSettings {
  size_ranges: SizeRange[];
  stagnation: { warning_hours: number; cold_hours: number };
  cadence: { anchor: 'call' | 'proposal' | 'manual'; steps: CadenceStep[] };
  closer_sees_all_leads: boolean;
  proposal_expiry_warning_days: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  size_ranges: [
    { size: 'micro', max: 50_000 },
    { size: 'small', max: 100_000 },
    { size: 'medium', max: 300_000 },
    { size: 'large', max: 500_000 },
    { size: 'enterprise', max: null },
  ],
  stagnation: { warning_hours: 24, cold_hours: 48 },
  cadence: {
    anchor: 'call',
    steps: [
      { key: 'd1', offset_days: 1, title: 'D+1 · Pós-call', goal: 'Retomar diagnóstico e próximos passos' },
      { key: 'd3', offset_days: 3, title: 'D+3 · Reforço de valor', goal: 'Demonstrar o impacto do problema identificado' },
      { key: 'd5', offset_days: 5, title: 'D+5 · Objeções', goal: 'Esclarecer dúvidas e dificuldades' },
      { key: 'd8', offset_days: 8, title: 'D+8 · Decisão de agenda', goal: 'Confirmar interesse e possível cronograma' },
    ],
  },
  closer_sees_all_leads: true,
  proposal_expiry_warning_days: 3,
};

export function withDefaults(partial: Partial<AppSettings> | null | undefined): AppSettings {
  return { ...DEFAULT_SETTINGS, ...(partial ?? {}) };
}
