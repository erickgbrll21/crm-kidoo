# Design

<!-- impeccable:design-system -->

## World

SaaS B2B interno da Kidoo Hub. Operação comercial em desktop, consulta rápida no telefone. Identidade herdada do brief: verde musgo profundo na navegação, branco no trabalho, Inter, Lucide. Sem roxo, índigo ou azul de marca.

## Palette

| Token | Hex | Papel |
| --- | --- | --- |
| moss-800 | #353F34 | Ação primária, texto de ênfase, sidebar ativa invertida |
| moss-900 | #2A3229 | Sidebar, hover de botão, fundo do login |
| white | #FFFFFF | Superfície de trabalho e cards |
| moss-50/100 | #f5f7f4 / #ebeee9 | Muted, skeletons |
| destructive | #b42318 | Perda, lead esfriando |
| warning | #a14a07 | Atenção 24–48h, vencimento |
| success | #2f7a4b | Ganho, proposta aceita, cliente ativo |

## Type

Inter Variable. Escala de produto: 11px meta, 13px UI, 14px corpo, 22px título de página. Tracking de títulos −0.02em. Numerais tabulares em dinheiro.

## Layout

Sidebar 248px (68px recolhida) em `#2A3229`, conteúdo branco. Header 56px com busca, novo lead, notificações, perfil. Dossiê: gaveta ~46vw no desktop, tela cheia no mobile. Kanban em colunas de 300px com scroll horizontal.

## Components

Botões musgo, radius 8px, focus ring 2px `#353F34`. Cards: borda `#e3e7e0`, radius 12px, sem sombra+borda juntas. Empty states com ícone em círculo musgo-100. Skeletons musgo-100.

## Motion

160–220ms ease. Sidebar width, entrada da gaveta, toasts. Sem coreografia de page load.

## Do not

Gradientes de marca, glass, kicker acima do H1, cards de ícone+texto como estrutura de página, integração desenhada como se estivesse ligada.
