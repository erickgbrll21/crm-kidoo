# Kidoo Revenue CRM

CRM comercial B2B da Kidoo Hub: captação → enriquecimento → abordagem → call → proposta → follow-up → fechamento → onboarding.

Front-end na **Vercel**. API Node em qualquer host que rode o processo (e o cron). Banco no **Supabase Cloud**.

## Requisitos

- Node 20+
- Projeto Supabase (Auth, Postgres, Storage, Realtime)

## Instalação local

```bash
npm install
cp .env.example .env
```

No painel do Supabase:

1. Copie URL, `anon` e `service_role` para o `.env`.
2. Authentication → URL Configuration: `http://localhost:5173` e redirect `http://localhost:5173/redefinir-senha`.
3. Aplique as migrations:

```bash
npx supabase login
npx supabase link --project-ref SEU_REF
npx supabase db push
```

4. Popule a demonstração (cria Pedro, Arthur e Erick):

```bash
npm run db:seed
```

Logins fictícios: `pedro@kidoohub.com`, `arthur@kidoohub.com`, `erick@kidoohub.com`. Senha: valor de `SEED_PASSWORD` (padrão `KidooHub!demo`). Troque em produção.

```bash
npm run dev
```

- App: http://localhost:5173
- API: http://localhost:4000/api/v1/health

## Webhook Antigravity / Make.com

`POST /api/v1/webhooks/antigravity`  
Header: `x-webhook-secret: $WEBHOOK_SECRET`

Idempotência por `source + event_id`. Duplicata de empresa (CNPJ, e-mail, telefone ou nome) atualiza o lead existente. Exemplo de payload no módulo Integrações do app.

## Deploy

### Front (Vercel)

- Root: repositório. Build: `npm run build --workspace @kidoo/web`. Output: `apps/web/dist`.
- Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_URL` (URL pública da API, sem barra no final).
- Redirect do Auth no Supabase: `https://seu-app.vercel.app/redefinir-senha`.

### API (Render, Fly, Railway ou similar)

- Build: `npm run build --workspace @kidoo/api`
- Start: `npm run start --workspace @kidoo/api`
- Env: todas as variáveis sem prefixo `VITE_` do `.env.example`, com `CORS_ORIGINS` apontando para a URL da Vercel e `ENABLE_SCHEDULER=true`.
- Se o host hiberna, agende um HTTP cron a cada 10 minutos: `POST /api/v1/jobs/run` com header `x-cron-secret`.

### Banco

`npx supabase db push` no ambiente de produção. Bucket `proposals` é criado na migration de segurança.

## Testes

```bash
npm test
```

Cobre autenticação, CRUD e movimentação de leads, webhook (idempotência e deduplicação), permissões, estagnação, cadência e métricas.

## Estrutura

```
apps/web          React + Vite
apps/api          Express + jobs
packages/shared   tipos, Zod, regras
supabase/         migrations SQL
```
