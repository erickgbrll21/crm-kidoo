import type { CadenceStep } from './settings.js';
import { digits } from './leads.js';

const DAY = 86_400_000;

/** Datas da cadência a partir do marco (call, proposta ou data manual), às 10h do horário local do marco. */
export function buildCadence(anchor: Date, steps: CadenceStep[]) {
  return steps.map((s) => {
    const due = new Date(anchor.getTime() + s.offset_days * DAY);
    due.setHours(10, 0, 0, 0);
    return { step: s.key, title: s.title, due_at: due.toISOString() };
  });
}

export interface MessageContext {
  contact_name?: string | null;
  company_name: string;
  sender_name?: string | null;
  specific_pain?: string | null;
  proposed_solution?: string | null;
  opening_hook?: string | null;
}

const firstName = (n?: string | null) => n?.trim().split(/\s+/)[0] ?? '';

/**
 * Gera a mensagem da etapa usando somente dados existentes do lead.
 * Quando um dado não existe, a frase correspondente é omitida em vez de inventada.
 */
export function followupMessage(step: string, ctx: MessageContext): string {
  const hi = firstName(ctx.contact_name) ? `Olá, ${firstName(ctx.contact_name)}! ` : 'Olá! ';
  const me = ctx.sender_name ? `Aqui é ${firstName(ctx.sender_name)}, da Kidoo Hub. ` : 'Aqui é da Kidoo Hub. ';
  const pain = ctx.specific_pain ? ctx.specific_pain.replace(/\.$/, '').toLowerCase() : null;
  const solution = ctx.proposed_solution?.replace(/\.$/, '') ?? null;

  const lines: Record<string, string[]> = {
    opening: [
      hi + me,
      ctx.opening_hook ?? `Gostaria de entender como a ${ctx.company_name} organiza hoje seus processos comerciais e de atendimento.`,
      'Faz sentido conversarmos 15 minutos esta semana?',
    ],
    d1: [
      hi + me,
      `Obrigado pela conversa de ontem sobre a ${ctx.company_name}.`,
      pain ? `Ficou claro que o ponto principal hoje é ${pain}.` : '',
      solution ? `Como próximo passo, sugiro detalharmos ${solution.toLowerCase()}.` : 'Posso te enviar os próximos passos que combinamos?',
    ],
    d3: [
      hi,
      pain
        ? `Fiquei pensando no impacto que ${pain} tem no dia a dia da ${ctx.company_name}: cada semana nesse cenário é tempo e receita que ficam pelo caminho.`
        : `Queria retomar nossa conversa sobre os gargalos da ${ctx.company_name}.`,
      solution ? `A proposta de ${solution.toLowerCase()} foi desenhada exatamente para isso.` : '',
      'Quer que eu te mostre como isso funcionaria na prática?',
    ],
    d5: [
      hi,
      'Muitas vezes surgem dúvidas sobre prazo, investimento ou como a implantação afeta a rotina da equipe.',
      `Tem algum ponto que esteja travando a decisão aí na ${ctx.company_name}? Posso esclarecer por aqui ou numa call rápida.`,
    ],
    d8: [
      hi,
      `Quero organizar a agenda de implantação dos próximos projetos e ver se a ${ctx.company_name} entra nesse ciclo.`,
      'Faz sentido avançarmos? Se o momento não for agora, me avise para eu não te incomodar.',
    ],
  };
  return (lines[step] ?? lines.d1!).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

/** Link wa.me com DDI 55 aplicado a números brasileiros de 10–11 dígitos. Abrir o link não confirma envio. */
export function whatsappLink(phone: string | null | undefined, text?: string): string | null {
  let d = digits(phone);
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  if (d.length < 12) return null;
  return `https://wa.me/${d}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
