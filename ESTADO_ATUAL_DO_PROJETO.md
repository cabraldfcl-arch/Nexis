# Estado Atual do Projeto

Ultima atualizacao: 2026-05-28

## Resumo

O NEXIS sera um gestor financeiro mobile-first com IA para microempreendedores e
pequenos comerciantes. A interface principal sera um app proprio para celular,
nao Telegram, n8n ou planilha.

O objetivo do MVP e permitir que uma pessoa simples consiga, pelo celular:

- cadastrar produto;
- registrar compra/entrada de estoque;
- registrar venda;
- registrar despesa;
- ver vendas do dia e do mes;
- ver lucro bruto e lucro liquido;
- ver produtos acabando;
- perguntar por texto;
- mandar audio curto;
- confirmar antes de gravar qualquer dado critico.

## Raiz ativa do projeto

Arquivos que continuam ativos na raiz:

- `REGRAS_INVARIANTES.md`: regras que nao podem ser quebradas por agentes, IA, parser, banco ou UX critica.
- `AGENTS.md`: regras obrigatorias para agentes.
- `README.md`: visao completa do produto, MVP, arquitetura e referencias.
- `ESTADO_ATUAL_DO_PROJETO.md`: resumo operacional atual.
- `docs/`: documentacao viva do projeto.
- `.cbmignore`: escopo de indexacao do Codebase Memory MCP.

## Arquivo morto

Os materiais historicos foram movidos para:

```text
ARQUIVOS_MORTOS/
```

Essa pasta guarda referencias antigas de apresentacao, Telegram, n8n, artigo,
zip, fotos e ferramentas empacotadas. Esses arquivos nao devem ser usados como
base da implementacao do MVP sem decisao explicita.

O que foi arquivado:

- fotos da apresentacao antiga;
- arquivos de apresentacao/feira;
- artigo e PDFs antigos;
- fluxos Telegram/n8n;
- zip antigo do projeto;
- scripts e materiais de estudo;
- ferramentas empacotadas antigas em `.tools/`.

## Estado tecnico real

Ja existe uma base inicial do app neste diretorio.

Existem agora:

- repositorio Git local inicializado;
- `package.json`;
- `package-lock.json`;
- `tsconfig.json`;
- `next.config.ts`;
- `postcss.config.mjs`;
- `eslint.config.mjs`;
- `vitest.config.ts`;
- `prisma.config.ts`;
- `playwright.config.ts`;
- `.env.example`;
- `app/`;
- `components/`;
- `lib/`;
- `prisma/schema.prisma`;
- `prisma/migrations/`;
- `prisma/seed.mjs`;
- `tests/`;
- banco SQLite local de desenvolvimento, ignorado no Git;
- comandos reais `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run e2e`, `npm run db:validate`, `npm run db:generate`, `npm run db:migrate` e `npm run db:seed`.

Ja existem:

- CRUD mobile-first de produto;
- compras em `/purchases`;
- vendas em `/sales`;
- despesas em `/expenses`;
- dashboard dinamico em `/`;
- chat texto em `/assistant`;
- rascunhos estruturados com Zod para venda, compra e despesa;
- confirmacao explicita antes de gravar lancamento critico;
- smoke E2E mobile em Playwright para home e rotas principais.
- E2E full-flow em Playwright com SQLite temporario para produto, compra, venda, despesa confirmada e dashboard.
- assistant texto com bateria humanizada para cadastro, compra, venda, despesa, embalagem comercial, kg/grama/litro, produto ambiguo, produto inexistente, estoque e resumo de lucro.

Ainda nao existem:

- IA externa ligada por padrao;
- STT real;
- TTS;
- autenticacao;
- multiempresa;
- banco em nuvem.

Stack alvo:

- Next.js App Router;
- TypeScript;
- Tailwind CSS;
- Prisma;
- SQLite local no MVP;
- Zod;
- Vitest;
- Playwright;
- Vercel.

## Regra central da IA

A IA pode interpretar texto/audio, explicar dados e gerar rascunhos.

A IA nao pode ser fonte de verdade para:

- lucro;
- faturamento;
- custo;
- estoque;
- despesas;
- gravacao de venda, compra, despesa ou configuracao critica.

Esses dados devem ser calculados e gravados por codigo deterministico, sempre
com confirmacao explicita do usuario quando houver mudanca critica.

## Proximo passo recomendado

Criar a base real do MVP:

1. Manter `npx prisma validate`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` e `npm run e2e` passando.
2. Validar manualmente em celular o fluxo principal com dados ficticios.
3. Implementar audio curto usando o mesmo fluxo do chat texto somente na proxima etapa.
