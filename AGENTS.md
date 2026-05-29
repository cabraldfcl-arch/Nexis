# NEXIS Agent Instructions

## Objetivo

NEXIS e um gestor financeiro com IA para microempreendedores e pequenos comerciantes com baixa familiaridade tecnica. O MVP deve permitir controle simples de produtos, compras, vendas, estoque, despesas, lucro e perguntas em linguagem natural.

## Leitura obrigatoria antes de alterar

Antes de mudar codigo, testes, docs, banco, prompts, IA, UX critica ou comandos, leia nesta ordem:

- `REGRAS_INVARIANTES.md`
- `docs/PROJECT_STATE.md`
- `docs/AI_OPERATING_RULES.md`
- `docs/ACCEPTANCE_CRITERIA.md`

Qualquer skill, agente ou roteiro de IA usado neste projeto deve ancorar nessas regras. Se uma skill externa conflitar com as invariantes do NEXIS, prevalecem `AGENTS.md` e `REGRAS_INVARIANTES.md`.

## Stack alvo

- Next.js com App Router
- TypeScript
- Tailwind CSS
- Prisma
- SQLite local no MVP
- Postgres/Supabase como caminho futuro
- Zod para validacao de entrada
- Testes minimos para regras financeiras
- IA via provedor barato ou gratuito quando possivel
- Deploy simples em Vercel

## Limites do projeto

- Trabalhe somente dentro deste diretorio do NEXIS.
- Nao misture codigo, templates, segredos, automacoes ou decisoes de outros projetos do usuario.
- Telegram e n8n sao referencia historica, nao a interface principal do MVP.
- A interface principal deve ser uma aplicacao propria, web/mobile-first.
- Prefira mudancas pequenas, revisaveis e alinhadas ao MVP de 1 semana.
- Nao crie arquitetura exagerada antes de existir fluxo funcional validado.

## Seguranca

- Nunca exponha tokens, API keys, cookies, credenciais, arquivos de login ou configs privadas.
- Nunca commitar chaves reais.
- Se criar `.env.example`, use somente placeholders.
- Nao abra nem transcreva conteudo sensivel de arquivos de autenticacao.

## IA e dados criticos

- Calculos financeiros nunca devem depender da IA.
- Lucro, custo, estoque, faturamento e despesas devem ser calculados por codigo deterministico.
- A IA pode interpretar texto e sugerir lancamentos.
- A IA nunca deve gravar venda, compra, estoque, despesa ou configuracao critica sem confirmacao explicita do usuario.

## Comandos esperados de qualidade

Quando o app existir, mantenha estes comandos documentados e funcionando:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

Se algum comando ainda nao existir, registre isso em `docs/PROJECT_STATE.md`. Nunca invente resultado de teste.

## Documentacao viva

Atualize `docs/PROJECT_STATE.md` sempre que mudar arquitetura, comandos, escopo, banco de dados, fluxo de IA ou criterio de aceite.
