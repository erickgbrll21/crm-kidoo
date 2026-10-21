import { z } from 'zod';
import {
  ACTIVITY_TYPES,
  LEAD_SOURCES,
  ONBOARDING_STAGES,
  PRIORITIES,
  PROPOSAL_STATUSES,
  ROLES,
  STAGE_KEYS,
} from '../types/index.js';

const money = z.coerce.number().min(0).max(999_999_999_999.99);
const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullish();
const isoDate = z.iso.datetime({ offset: true });

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(500).default(50),
});

export const leadListQuery = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  owner_id: z.uuid().optional(),
  stage: z.enum(STAGE_KEYS).optional(),
  /** pipeline = abertos + ganhos (colunas do Kanban). */
  status: z.enum(['open', 'won', 'lost', 'pipeline', 'all']).default('open'),
  niche: z.string().max(120).optional(),
  priority: z.enum(PRIORITIES).optional(),
  sort: z.enum(['created_at', 'value', 'last_interaction']).default('created_at'),
  // Query string: Boolean("false") é true. "false" precisa continuar falso.
  archived: z.preprocess((value) => {
    if (value === 'true' || value === '1' || value === true) return true;
    if (value === 'false' || value === '0' || value === false || value == null || value === '') return false;
    return value;
  }, z.boolean()),
});

export const contactInput = z.object({
  name: z.string().trim().min(1).max(160),
  role: optionalText(120),
  phone: optionalText(30),
  email: z.email().max(200).nullish().or(z.literal('').transform(() => null)),
});

const leadFields = z.object({
  company_name: z.string().trim().min(2, 'Informe a empresa').max(200),
  cnpj: optionalText(20),
  website: optionalText(300),
  niche: optionalText(120),
  estimated_monthly_revenue: money.nullish(),
  source: z.enum(LEAD_SOURCES),
  priority: z.enum(PRIORITIES),
  estimated_setup: money.nullish(),
  estimated_mrr: money.nullish(),
});

export const leadCreate = leadFields.extend({
  source: z.enum(LEAD_SOURCES).default('manual'),
  priority: z.enum(PRIORITIES).default('medium'),
  owner_id: z.uuid().nullish(),
  contact: contactInput.optional(),
});
export type LeadCreateInput = z.infer<typeof leadCreate>;

export const leadUpdate = leadFields.partial().extend({
  contact: contactInput.partial().optional(),
  archived: z.boolean().optional(),
});
export type LeadUpdateInput = z.infer<typeof leadUpdate>;

export const stageMove = z.object({ stage: z.enum(STAGE_KEYS).exclude(['won']) });
export const ownerChange = z.object({ owner_id: z.uuid() });

export const closeLead = z.object({
  closed_setup: money,
  closed_mrr: money,
  services: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  contract_ref: optionalText(120),
  start_date: z.iso.date().nullish(),
  tech_owner_id: z.uuid().nullish(),
});
export type CloseLeadInput = z.infer<typeof closeLead>;

export const loseLead = z.object({ reason: z.string().trim().min(3, 'Informe o motivo').max(500) });
export const reactivateLead = z.object({ stage: z.enum(STAGE_KEYS).exclude(['won']).default('approach') });

export const activityCreate = z.object({
  lead_id: z.uuid().nullish(),
  owner_id: z.uuid().optional(),
  type: z.enum(ACTIVITY_TYPES),
  title: z.string().trim().min(1, 'Informe o título').max(200),
  description: optionalText(4000),
  due_at: isoDate.nullish(),
  priority: z.enum(PRIORITIES).default('medium'),
  /** Registrar como já realizada (ex.: "registrar contato"). */
  done: z.boolean().default(false),
  outcome: optionalText(2000),
});
export type ActivityCreateInput = z.infer<typeof activityCreate>;

export const activityUpdate = z.object({
  owner_id: z.uuid().optional(),
  type: z.enum(ACTIVITY_TYPES).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  description: optionalText(4000),
  due_at: isoDate.nullish(),
  priority: z.enum(PRIORITIES).optional(),
  status: z.enum(['pending', 'canceled']).optional(),
});
export const activityComplete = z.object({ outcome: optionalText(2000) });
export const activityListQuery = paginationSchema.extend({
  lead_id: z.uuid().optional(),
  owner_id: z.uuid().optional(),
  status: z.enum(['pending', 'done', 'canceled', 'all']).default('pending'),
  view: z.enum(['all', 'today', 'next7', 'overdue']).default('all'),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

export const followupCreate = z.object({
  lead_id: z.uuid(),
  step: z.string().trim().min(1).max(40).default('custom'),
  title: z.string().trim().min(1).max(200),
  message: optionalText(4000),
  due_at: isoDate,
});
export const followupCadence = z.object({
  lead_id: z.uuid(),
  anchor_at: isoDate,
});
export const followupUpdate = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  message: optionalText(4000),
  due_at: isoDate.optional(),
  status: z.enum(['pending', 'paused', 'canceled']).optional(),
});
export const followupComplete = z.object({
  channel: z.enum(['whatsapp', 'call', 'email']).default('whatsapp'),
  outcome: optionalText(2000),
  next_due_at: isoDate.nullish(),
});
export const followupListQuery = paginationSchema.extend({
  lead_id: z.uuid().optional(),
  owner_id: z.uuid().optional(),
  status: z.enum(['pending', 'done', 'paused', 'all']).default('pending'),
  view: z.enum(['all', 'today', 'overdue', 'upcoming']).default('all'),
});

const proposalFields = z.object({
  title: z.string().trim().min(2).max(200),
  description: optionalText(8000),
  services: z.array(z.string().trim().min(1).max(120)).max(30),
  setup_value: money,
  mrr_value: money,
  implementation_days: z.coerce.number().int().min(0).max(730).nullish(),
  valid_until: z.iso.date().nullish(),
  status: z.enum(PROPOSAL_STATUSES),
});
export const proposalCreate = proposalFields.extend({
  lead_id: z.uuid(),
  services: proposalFields.shape.services.default([]),
  status: z.enum(PROPOSAL_STATUSES).default('draft'),
});
export type ProposalCreateInput = z.infer<typeof proposalCreate>;
export const proposalUpdate = proposalFields.partial();
export const proposalListQuery = paginationSchema.extend({
  lead_id: z.uuid().optional(),
  owner_id: z.uuid().optional(),
  status: z.enum([...PROPOSAL_STATUSES, 'all']).default('all'),
});

export const dashboardQuery = z.object({
  from: isoDate,
  to: isoDate,
  owner_id: z.uuid().optional(),
});

export const userUpdate = z.object({
  full_name: z.string().trim().min(2).max(120).optional(),
  title: optionalText(120),
  role: z.enum(ROLES).optional(),
  is_active: z.boolean().optional(),
});
export const userInvite = z.object({
  email: z.email(),
  full_name: z.string().trim().min(2).max(120),
  role: z.enum(ROLES),
  password: z.string().min(8).max(128),
});

export const clientUpdate = z.object({
  onboarding_stage: z.enum(ONBOARDING_STAGES).optional(),
  status: z.enum(['active', 'paused', 'churned']).optional(),
  tech_owner_id: z.uuid().nullish(),
  contract_ref: optionalText(120),
  start_date: z.iso.date().nullish(),
});
export const onboardingTaskUpdate = z.object({
  status: z.enum(['todo', 'done']).optional(),
  owner_id: z.uuid().nullish(),
  due_at: isoDate.nullish(),
  title: z.string().trim().min(1).max(200).optional(),
});
export const onboardingTaskCreate = z.object({
  stage: z.enum(ONBOARDING_STAGES),
  title: z.string().trim().min(1).max(200),
  owner_id: z.uuid().nullish(),
  due_at: isoDate.nullish(),
});

const sizeRange = z.object({
  size: z.enum(['micro', 'small', 'medium', 'large', 'enterprise']),
  max: z.number().positive().nullable(),
});
export const settingsUpdate = z
  .object({
    size_ranges: z.array(sizeRange).length(5),
    stagnation: z
      .object({ warning_hours: z.number().int().min(1).max(720), cold_hours: z.number().int().min(1).max(1440) })
      .refine((s) => s.cold_hours > s.warning_hours, 'O limite de "esfriando" deve ser maior que o de atenção'),
    cadence: z.object({
      anchor: z.enum(['call', 'proposal', 'manual']),
      steps: z
        .array(
          z.object({
            key: z.string().min(1).max(20),
            offset_days: z.number().int().min(0).max(90),
            title: z.string().min(1).max(80),
            goal: z.string().max(200),
          }),
        )
        .min(1)
        .max(12),
    }),
    closer_sees_all_leads: z.boolean(),
    proposal_expiry_warning_days: z.number().int().min(1).max(60),
  })
  .partial();

export const antigravityWebhook = z.object({
  event_id: z.string().trim().min(1).max(200),
  event_type: z.enum(['lead.enriched', 'lead.created', 'lead.updated']),
  company: z.object({
    name: z.string().trim().min(2).max(200),
    cnpj: z.string().max(20).nullish(),
    website: z.string().max(300).nullish(),
    industry: z.string().max(120).nullish(),
    estimated_monthly_revenue: z.number().min(0).nullish(),
  }),
  contact: z
    .object({
      name: z.string().trim().min(1).max(160),
      role: z.string().max(120).nullish(),
      phone: z.string().max(30).nullish(),
      email: z.email().nullish(),
    })
    .optional(),
  diagnostic: z
    .object({
      deep_niche: z.string().max(2000).nullish(),
      specific_pain: z.string().max(2000).nullish(),
      proposed_solution: z.string().max(2000).nullish(),
      suggested_setup: z.number().min(0).nullish(),
      suggested_mrr: z.number().min(0).nullish(),
      opening_hook: z.string().max(4000).nullish(),
      generated_at: isoDate.nullish(),
    })
    .optional(),
  source: z.enum(['antigravity', 'make']).default('antigravity'),
});
export type AntigravityPayload = z.infer<typeof antigravityWebhook>;
