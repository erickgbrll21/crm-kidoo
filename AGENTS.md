# Kidoo Revenue CRM — orientações para agentes

CRM comercial B2B da Kidoo Hub. Stack: React + Next.js + TypeScript no `apps/web`, Express + TypeScript no `apps/api`, Postgres no Supabase. O browser fala com a API; a API fala com o Supabase usando `service_role`. A chave `service_role` nunca vai para o cliente.

## Skills aplicadas

- **Ponytail** — menor mudança que resolve o todo. Sem camada extra, sem LocalStorage como banco, sem integração fingida.
- **Impeccable** (modo Operate) — interface de produto, identidade musgo `#353F34` / `#2A3229` / `#FFFFFF`, Inter, Lucide. Sem roxo/índigo/azul de marca. Sem glassmorphism. Documentado em `PRODUCT.md` e `DESIGN.md`.
- **Find Skills** — consultada; as skills já no repo que agregam valor concreto foram mantidas: `supabase-postgres-best-practices` e `vercel-react-best-practices`. Não instalar skill extra só por ter o nome da tecnologia.
- **Supabase Postgres** — UUID, `numeric(14,2)` para dinheiro, RLS ligado, índices nas FKs e filtros, escritas em funções SQL transacionais, Realtime só nas tabelas necessárias.
- **Vercel React** — cada rota do App Router carrega a própria página (gráficos inclusive), queries paralelas no dashboard, imports diretos.

## Padrões

- Tipos e Zod em `packages/shared`. A API valida na borda; o front reusa os mesmos schemas.
- Papéis (`admin`, `manager`, `closer`) e permissões em `packages/shared/domain/permissions.ts`. Nunca ramificar por nome de pessoa.
- Potencial (leads abertos) não se mistura com contratado (ganhos no período). Conversão = ganhos ÷ (ganhos + perdidos) decididos no recorte.
- Estagnação conta a partir de `last_interaction_at` (contato real concluído), não de `updated_at`. Atividade futura agendada suspende o alerta.
- WhatsApp v1 = `wa.me`. Abrir o link não registra envio.
- Google Calendar só aparece como ligado se `GOOGLE_CALENDAR_CLIENT_ID` e `GOOGLE_CALENDAR_CLIENT_SECRET` existirem **e** a pessoa tiver autorizado a conta. WhatsApp Business idem nas env vars.
- Jobs de alerta rodam no processo da API (`node-cron`, 10 min) e também em `POST /api/v1/jobs/run` com `x-cron-secret` para hosts que dormem.

## Comandos

```bash
npm install
cp .env.example .env   # preencher
npm run dev            # API :4000 + web :5173
npm test
npm run db:seed
```

Migrations: `supabase/migrations`. Aplicar com `npx supabase db push` no projeto ligado.

## O que não fazer

- Não expor `SUPABASE_SERVICE_ROLE_KEY` no Next (`NEXT_PUBLIC_*` vai para o browser).
- Não inventar dados na mensagem de follow-up: omitir a frase se o diagnóstico não existir.
- Não tratar proposta aceita como contrato assinado.
- Não usar LocalStorage para leads, pipeline ou sessão de negócio (só preferência de UI: sidebar recolhida).
