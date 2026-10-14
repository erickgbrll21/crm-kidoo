# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Definido no brief: React + TypeScript + Vite + Tailwind + shadcn/ui no front-end; Node.js + Express + TypeScript na API; Supabase (Postgres, Auth, Storage, Realtime). Front-end na Vercel, API no Render, banco no Supabase Cloud.

## Users

Equipe comercial interna da Kidoo Hub: Pedro (CEO & Tecnologia), Arthur (Aquisição & Tráfego) e Erick (Infraestrutura & Produto). Atuam como administradores, gestores comerciais ou closers. Uso principal em desktop/notebook durante o expediente; mobile é ocasional (consultar um lead, abrir WhatsApp, registrar um contato).

## Product Purpose

Kidoo Revenue CRM centraliza o processo comercial B2B da Kidoo Hub: Captação → Enriquecimento → Abordagem → Call → Proposta → Follow-up → Fechamento → Onboarding. Sucesso é transformar leads enriquecidos em contratos de Setup (R$ 2.000–15.000) e MRR (R$ 600–6.000) sem deixar oportunidades esfriarem.

## Positioning

CRM proprietário que recebe leads já diagnosticados pelo Antigravity Engine (dor, solução, precificação sugerida, gancho de abertura) e mede o tempo desde a última interação comercial real, alertando quando um lead esfria.

## Operating Context

- Leads chegam via webhook (Antigravity Engine, Make.com) ou cadastro manual.
- Contato com clientes acontece pelo WhatsApp (links `wa.me` na v1; abrir o link não confirma envio).
- Cadência de follow-up D+1, D+3, D+5, D+8 a partir de um marco configurável.
- Propostas em documento anexado; aceitação de proposta não é contrato assinado.
- Onboarding é separado do pipeline, mas vinculado ao negócio original.

## Capabilities and Constraints

- Seis etapas de pipeline e status separado "Perdido / Base de Reativação".
- Termômetro de estagnação: até 24h normal, 24–48h atenção, acima de 48h "Lead Esfriando"; exceções para atividades já agendadas.
- Valores potenciais nunca se misturam com valores contratados.
- Integrações não configuradas (WhatsApp Business Platform, Google Calendar) não são apresentadas como funcionais.

## Brand Commitments

- Nome: Kidoo Revenue CRM / Kidoo Hub.
- Cores obrigatórias: verde musgo #353F34, verde musgo profundo #2A3229, branco #FFFFFF. Vermelho, âmbar e verde apenas para estados semânticos. Sem roxo, índigo ou azul como cores principais.
- Tipografia Inter, ícones Lucide, componentes shadcn/ui.
- Interface em português do Brasil.

## Evidence on Hand

Nenhum cliente, depoimento ou número real foi fornecido. Os dados de demonstração do seed são fictícios e devem ser tratados como tal.

## Product Principles

1. Velocidade primeiro: cada ação comercial frequente fica a no máximo dois cliques.
2. Verdade dos dados: potencial é potencial, contratado é contratado; estimativas de IA são rotuladas.
3. Nada esfria em silêncio: a última interação real é sempre visível.
4. Permissões aplicadas no servidor e no banco, nunca só na interface.

## Accessibility & Inclusion

WCAG 2.1 AA: contraste mínimo, foco visível, navegação por teclado, áreas de toque adequadas no mobile.
