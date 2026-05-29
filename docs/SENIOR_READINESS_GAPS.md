# Lacunas de Senioridade P0-P1

Data: 2026-05-25
Escopo: lacunas restantes apos execucao dos gates P0 reais e configuracao P1 de tooling.

## P0 atual

Resolvido nesta rodada:

- Prisma valida.
- Lint passa.
- Typecheck passa.
- Testes unitarios passam.
- Build passa.
- E2E mobile principal passa.
- Gitleaks passa sem leaks.
- MCP foi reindexado apos detectar mudancas no worktree.
- `docs/PROJECT_STATE.md` foi atualizado com evidencias reais.

P0 pendente documentado:

- `npm audit` ainda falha com 5 vulnerabilidades moderadas em dependencias transitivas de `prisma` e `next`.
- Nao ha fix automatico seguro via `npm audit fix --force`, porque a sugestao troca para versoes potencialmente quebraveis.
- `docs/CODEX_SHORTCUTS_STANDARD.md` esta ausente no checkout atual, apesar de ter sido solicitado como leitura obrigatoria.

## P1 recomendado para a proxima etapa

Configurado nesta rodada:

- Coverage com Vitest/V8.
- Acessibilidade basica com Playwright + axe.
- Lighthouse mobile local.
- Bundle analyzer local.
- Gitleaks config minima.
- Workflow GitHub Actions preparado, embora o checkout esteja sem remote.

Ainda pendente antes de seguir para mais P1/P2:

- Politica formal para `npm audit`: acompanhar upstream de `next` e `prisma`, registrar excecoes temporarias e testar atualizacoes controladas.
- Recriar ou consolidar a documentacao de atalhos Codex se ela continuar sendo obrigatoria para operacao.
- Semgrep ou equivalente.
- Ativar CI em remote GitHub real quando houver remote.

## Riscos pendentes

- Worktree contem varias mudancas anteriores nao relacionadas a esta rodada.
- `npm audit` depende de correcao upstream ou decisao controlada de versao.
- `.env` e `.env.local` foram carregados pelo Next durante o build, mas nao foram abertos nem impressos.
- Memorias e skills de outros projetos seguem como risco operacional; agentes devem ancorar em `AGENTS.md` e `docs/PROJECT_STATE.md`.

## Atualizacao P0.5 em 2026-05-25

Resolvido nesta rodada:

- `npm run test` voltou a passar com 26 arquivos e 167 testes.
- `npm run test:coverage` passou com coverage V8 configurado.
- `npm run verify:e2e` passou com 4 testes mobile Chromium.
- O full-flow de venda agora prova POST OK, persistencia no SQLite temporario, `SaleItem`, `StockMovement SALE`, estoque final e lista renderizada apos reload.
- `npm run test:a11y`, `npm run performance:mobile`, `npm run analyze`, `gitleaks` e `git diff --check` passaram.

Ainda pendente:

- `npm audit` continua com 5 vulnerabilidades moderadas sem fix automatico seguro.
- Checkout sem remote Git configurado.
- `docs/CODEX_SHORTCUTS_STANDARD.md` ausente.
