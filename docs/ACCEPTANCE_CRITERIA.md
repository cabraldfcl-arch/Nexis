# Criterios de Aceite do NEXIS

Ultima atualizacao: 2026-05-30

## MVP Demonstravel Atual

Base tecnica:

- [x] Next.js App Router.
- [x] TypeScript.
- [x] Tailwind CSS.
- [x] Prisma.
- [x] SQLite local.
- [x] Zod.
- [x] Vitest.
- [x] Playwright.
- [x] Manifest PWA basico.
- [x] Icones NEXIS locais para instalacao/adicao a tela inicial.
- [x] Metadata mobile com viewport, `theme_color` e modo standalone.
- [x] `.env.example` com placeholders.
- [x] Sem chave real versionada.

Fluxos manuais:

- [x] Produto fisico cadastra com nome, categoria opcional, unidade, custo, preco, estoque atual e estoque minimo.
- [x] Produto fisico pode ser cadastrado manualmente a partir de embalagem, convertendo caixas com unidades internas para estoque/custo da unidade vendida.
- [x] Produto pode ser editado, ativado e desativado.
- [x] Compra de produto existente aumenta estoque.
- [x] Compra manual por embalagem converte caixas/fardos/pacotes para quantidade e custo da unidade vendida.
- [x] Venda de produto existente reduz estoque.
- [x] Venda bloqueia estoque insuficiente.
- [x] Despesa confirmada entra no lucro liquido.
- [x] Despesa pendente nao entra no lucro liquido.
- [x] Dashboard mostra vendas, despesas, lucro bruto, lucro liquido e produtos acabando.
- [x] Rotas principais abrem em viewport mobile sem scroll horizontal indevido.
- [x] Botoes principais do dashboard e fluxos criticos ficam confortaveis para toque.

Assistant texto:

- [x] Responde perguntas de vendas, lucro bruto, lucro liquido, despesas, estoque atual, compras, produtos mais vendidos, resumo diario e produtos acabando com dados reais.
- [x] Cumprimentos e perguntas sociais simples recebem resposta util sem gerar relatorio.
- [x] Gera rascunho de venda, compra e despesa; cadastro de produto abre `/products` pre-preenchido para revisao.
- [x] Cadastro de produto por texto preenche apenas os campos entendidos e deixa campos faltantes em branco, sem inventar valores.
- [x] Frases de acao como `quero cadastrar a compra que fiz` nao viram relatorio por conterem `compra`.
- [x] Produto com variante, como `Coca Cola lata 350 ml`, preserva detalhes no formulario de cadastro.
- [x] Compra/cadastro por texto com embalagem, como `2 caixas com 12 unidades cada`, vira estoque por unidade antes de salvar.
- [x] Compra/cadastro por texto de produto novo salva a primeira entrada como `Purchase` e movimento `PURCHASE`, nao como ajuste generico.
- [x] Cadastro/compra por texto entende caixa, fardo, bandeja, cartela e pacote quando a embalagem operacional esta clara.
- [x] Cadastro/compra por texto preserva `350 ml`, `500 ml` e medidas similares como variante do nome quando o produto e vendido por unidade.
- [x] Cadastro/compra por texto entende kg, grama e litro sem tratar medida como quantidade de unidades.
- [x] Pacote ambiguo pergunta se o usuario vende o pacote fechado ou cada item separado.
- [x] Produto ambiguo em venda/compra nao e escolhido automaticamente.
- [x] Venda de produto inexistente nao e registrada nem cria produto automaticamente.
- [x] Perda/quebra/desperdicio por texto gera rascunho, exige confirmacao e registra `StockLoss`, movimento `LOSS` e despesa `LOSS_WASTE`.
- [x] Cancelamento/estorno/correcao por texto gera rascunho, exige confirmacao, cria `CancellationEvent` e nunca apaga dados fisicamente.
- [x] Cancelamento/estorno/correcao por texto nao escolhe sozinho quando ha mais de um alvo parecido.
- [x] Resumo de estoque, vendas e lucro vem de banco/backend deterministico.
- [x] Venda por texto em gramas baixa fracao correta de produto cadastrado em kg.
- [x] Valor ambiguo entre total e unitario pede esclarecimento; `total` e convertido por codigo deterministico.
- [x] Cadastro de produto por texto bloqueia duplicado por nome normalizado ao salvar.
- [x] Nao salva produto, venda, compra, despesa, perda ou cancelamento sem clique em botao de confirmacao.
- [x] Revalida no servidor antes de persistir.
- [x] Bloqueia produto inexistente/ambiguo.
- [x] Bloqueia estoque insuficiente.
- [x] Bloqueia valores zero/negativos em rascunhos criticos.
- [x] Bloqueia comandos destrutivos sem fluxo seguro; cancelamento seguro usa rascunho rastreavel.

Qualidade:

- [x] Testes unitarios para regras financeiras.
- [x] Testes de validacao Zod.
- [x] Testes de parser/assistant.
- [x] E2E mobile para smoke, fluxo completo e demo texto-only.
- [x] E2E mobile valida manifest PWA e ausencia de overflow horizontal nas rotas principais.
- [x] Seed demo ficticia.
- [x] Reset demo local.

Deploy demonstrativo (validado em 2026-05-30):

- [x] Repositorio GitHub publicado: https://github.com/thiagocfaria/NEXT
- [x] Deploy Railway ativo: https://next-production-d7d8.up.railway.app
- [x] App abre pelo link publico sem necessidade de mesma rede Wi-Fi.
- [x] Chat `Falar com NEXIS` testado e funcionando na URL publica.
- [x] PWA instalavel pelo Chrome (botao "Instalar" confirmado na URL publica).
- [x] SQLite persistente em volume `/data` no Railway.
- [x] IA externa Groq configurada via painel Railway sem versionar chave.
- [x] Fallback rule-based ativo caso IA externa falhe.
- [ ] Icones PWA PNG 192x192 e 512x512 para iOS (pendente — somente SVG disponivel).
- [ ] Validacao de instalacao no iOS/Safari (pendente).

## MVP Operacional Real

O projeto so deve ser considerado pronto para piloto real quando os itens abaixo estiverem implementados e testados.

IA e linguagem natural:

- [x] Assistant responde estoque atual usando `Product.currentStock`.
- [x] Assistant responde compras do dia usando `Purchase`.
- [x] Assistant responde produtos mais vendidos usando `SaleItem`.
- [x] Assistant responde resumo diario completo usando funcoes deterministicas.
- [x] Assistant entende lucro bruto e lucro liquido separadamente.
- [x] Assistant cadastra produto abrindo `/products` com prefill revisavel e campos faltantes em branco.
- [x] Assistant nao classifica cadastro, cancelamento, estorno, desfazer, exclusao ou remocao como pergunta financeira.

Planejamento financeiro:

- [ ] Usuario pode cadastrar pro-labore mensal opcional.
- [ ] Usuario pode cadastrar despesas fixas mensais opcionais.
- [ ] Usuario pode cadastrar meta de margem/lucro mensal.
- [ ] Dashboard separa lucro bruto, resultado operacional e saldo apos pro-labore.
- [ ] Recorrencia planejada nao vira despesa paga sem confirmacao.
- [ ] Sistema calcula ponto de equilibrio simples.

Operacao real:

- [ ] Receita de servico sem estoque.
- [x] Perda/quebra/desperdicio de estoque com confirmacao.
- [x] Cancelamento/estorno/correcao com rastreabilidade.
- [ ] Historico mostra origem do lancamento: manual, texto, voz ou IA externa.
- [ ] Usuario consegue corrigir erro comum sem apagar fisicamente dados criticos.

Voz:

- [ ] STT real conectado por provider seguro.
- [ ] Audio vira texto revisavel.
- [ ] Voz usa o mesmo fluxo de rascunho/confirmacao do texto.
- [ ] Transcricao incerta pede revisao.
- [ ] Nenhum audio confirma lancamento sozinho.

Producao:

- [ ] Postgres/Supabase ou banco persistente equivalente.
- [ ] Autenticacao.
- [ ] Separacao por usuario/empresa.
- [ ] Backup/exportacao.
- [ ] Ambiente de demo separado de producao.
- [ ] Logs sem dados sensiveis.
- [ ] Deploy validado.

Performance e UX:

- [x] Botoes principais dao feedback imediato.
- [x] Rotas principais tem `loading.tsx` ou estado de carregamento equivalente.
- [x] Tempo de abertura local em producao e medido.
- [x] Listas grandes tem limite/paginacao simples.
- [x] E2E mobile cobre fluxos principais.
- [x] README e Runbook explicam teste no celular, modo producao local, preview na Vercel e instalacao PWA.
- [x] Runbook contem roteiro curto de demonstracao mobile.

## Gates Obrigatorios

Antes de considerar uma etapa pronta:

```bash
npx prisma validate
npx prisma generate
npm run lint
npm run typecheck
npm run test
npm run build
git diff --check
```

Quando houver mudanca de UI/fluxo:

```bash
npm run e2e
npm run verify:e2e
```

Quando houver mudanca grande ou entrega para equipe:

```bash
npm run db:reset-demo
npm run verify
npm run verify:e2e
```

Se um comando falhar, documente o erro real em `docs/PROJECT_STATE.md`. Nunca registre resultado nao executado como se tivesse passado.

## Gates P1 De Apoio

Estes comandos existem para medir senioridade, mas nao devem esconder falha P0:

```bash
npm run test:coverage
npm run test:a11y
npm run performance:mobile
npm run analyze
gitleaks detect --redact --source .
npm audit
```

Estado em 2026-05-25:

- Apos a rodada P0.5 de recuperacao, `npm run test:coverage`, `npm run test:a11y`, `npm run performance:mobile`, `npm run analyze`, `gitleaks detect --redact --source .` e `git diff --check` passaram.
- `npm run verify:e2e` tambem passou; o full-flow de venda prova POST OK, persistencia no SQLite temporario, movimento de estoque e dashboard atualizado.
- `npm audit` segue falhando com 5 vulnerabilidades moderadas sem fix automatico seguro; nao usar `npm audit fix --force` sem decisao explicita.
