# Relatorio de Validacao dos Fluxos de IA

Ultima atualizacao: 2026-05-25

## Escopo

Auditoria automatizada pesada dos fluxos principais do assistant antes do teste manual. A validacao principal roda em Playwright mobile com SQLite temporario e `AI_ASSISTANT_ENABLED=false`, provando o fallback rule-based sem depender de Groq ou chave externa.

Nao foram implementadas features grandes, schema Prisma, auth, Postgres, pro-labore, servico sem estoque, perda, cancelamento, voz real ou PWA novo.

## Fluxos Testados

Arquivo principal criado:

- `tests/e2e/ai-demo-flow.spec.ts`

Helper reforcado:

- `tests/e2e/helpers/e2e-database.ts`

Fluxos cobertos no E2E:

- cadastro de produto por IA com rascunho e confirmacao;
- produto inexistente antes da confirmacao;
- `StockMovement ADJUSTMENT` com razao `INITIAL_STOCK`;
- bloqueio de produto duplicado por nome normalizado;
- cadastro incompleto pedindo campos faltantes;
- compra por IA aumentando estoque;
- venda por IA reduzindo estoque;
- despesa por IA entrando no lucro liquido;
- perguntas financeiras por IA;
- dashboard e backend concordando;
- estoque final correto;
- lucro bruto e liquido corretos;
- comandos destrutivos bloqueados;
- venda acima do estoque bloqueada;
- mensagens soltas `sim`, `pode salvar` e `confirma aí` sem persistir nada;
- bug de `Confirmando...` coberto para produto, compra, venda e despesa;
- fallback rule-based funcionando com IA externa desligada.

Fluxo conversacional reforcado em 2026-05-25:

- entrada parcial de estoque com `coloca 5 coca cola que eu comprei no estoque`;
- pergunta de custo unitario sem cair em erro generico;
- continuacao com `paguei 3 reais`;
- produto inexistente conduzindo cadastro seguro, pedindo preco de venda e estoque minimo;
- rascunho de produto criado somente depois dos campos obrigatorios;
- estoque inicial de 5 unidades persistido apenas apos `Salvar produto`;
- chat limpando input, mostrando bolha do usuario, bolha/card do assistant e rolando para a ultima mensagem.

Fluxo de inteligencia operacional reforcado em 2026-05-25:

- frase real do teste manual `quero cadastrar 10 coca cola em lata que eu comprei por 4.20 cada uma`;
- parser extrai produto `Coca Cola lata`, quantidade 10 e custo unitario R$ 4,20;
- sistema pergunta preco de venda, nao pede custo novamente;
- frase real longa `quero cadastrar a compra que eu fiz de 10 coca cola em lata 350 ml, comprei por 3.5 cada unidade dela cadastra para mim por favor este produto`;
- parser classifica como entrada/cadastro seguro, nao como relatorio de compras;
- produto `Coca Cola lata 350 ml`, quantidade 10 e custo unitario R$ 3,50 sao preservados;
- sistema pergunta preco de venda, depois estoque minimo, e so entao mostra rascunho de produto;
- produto aparece em `/products` somente apos botao `Salvar produto`;
- conversa social simples responde sem rascunho e sem relatorio;
- continuacao `total` para `comprei 5 coca por 20 reais` calcula custo unitario R$ 4,00 por codigo deterministico;
- entrada de estoque com custo unitario ja informado: `coloca 5 cocas que eu comprei no estoque paguei 4 reais em cada uma delas`;
- parser extrai quantidade 5, produto `Coca Cola` e custo unitario R$ 4,00;
- produto inexistente conduz cadastro seguro pedindo preco de venda, sem pedir custo novamente;
- compra ambigua como `comprei 5 coca por 20 reais` pergunta se R$ 20,00 e total ou valor unitario;
- produto ambiguo com `vendi uma coca` e tres produtos Coca-Cola cadastrados pede escolha;
- resposta `a de 600` continua a conversa e gera rascunho de venda para `Coca-Cola 600ml`;
- estoque da Coca-Cola 600ml so baixa apos botao `Confirmar venda`.
- frase com multiplas acoes `comprei coca, vendi agua e gastei 10` pede para registrar uma coisa por vez e nao gera draft.
- lancamento `quero cadastrar a compra que fiz de 10 coca` nao vira relatorio de compras e pergunta campo faltante.

## Dados Ficticios Usados

O teste usa banco temporario vazio e cria apenas:

- produto: `Coca lata`;
- custo unitario: R$ 3,00;
- preco de venda: R$ 6,00;
- estoque inicial: 20;
- estoque minimo: 5;
- compra: 10 unidades a R$ 3,00;
- venda: 5 unidades a R$ 6,00;
- despesa confirmada: R$ 10,00 com embalagem.

Nenhum dado real foi usado.

## Resultados Esperados e Obtidos

| Fluxo | Esperado | Obtido |
| --- | --- | --- |
| Produto por IA | Rascunho aparece; nada salva antes do botao; apos salvar, produto existe | Passou |
| Estoque inicial | Produto `Coca lata` com estoque 20 e movimento `ADJUSTMENT/INITIAL_STOCK` | Passou |
| Duplicado | `COCA   lata` bloqueia duplicado silencioso | Passou |
| Cadastro incompleto | `cadastrar produto refrigerante` pede custo, preco, estoque inicial e estoque minimo | Passou |
| Compra por IA | Compra de 10 aumenta estoque de 20 para 30 | Passou |
| Venda por IA | Venda de 5 reduz estoque de 30 para 25 | Passou |
| Receita/custo/lucro bruto | Receita R$ 30,00; custo R$ 15,00; lucro bruto R$ 15,00 | Passou |
| Despesa/lucro liquido | Despesa R$ 10,00; lucro liquido R$ 5,00 | Passou |
| Perguntas financeiras | Respostas batem com banco/backend, nao com IA externa | Passou |
| Dashboard | Cards mostram vendas R$ 30,00, despesas R$ 10,00, lucro liquido R$ 5,00 e lucro bruto R$ 15,00 no mes | Passou |
| Bloqueios | Apagar, cancelar, corrigir, estornar e venda de 999 unidades nao persistem nada | Passou |
| Confirmacao obrigatoria | `sim`, `pode salvar`, `confirma aí` nao salvam nada | Passou |
| Confirmando | Produto, compra, venda e despesa saem de `Confirmando...` | Passou |
| IA externa desligada | E2E roda com `AI_ASSISTANT_ENABLED=false` | Passou |
| IA externa opcional | Diagnostico seguro nao exige chave para E2E; no ambiente atual o provider configurado passou | Passou |
| Frase longa real | Nao mostra relatorio; pergunta preco de venda; preserva `Coca Cola lata 350 ml`; salva so no botao | Passou no E2E direcionado |
| Frase real do print | Extrai quantidade 10 e custo R$ 4,20; pergunta preco de venda; nao pede custo | Passou no E2E direcionado |
| Lancamento nao vira relatorio | `quero cadastrar a compra que fiz de 10 coca` nao mostra `Compras no mes` | Passou no E2E direcionado |
| Multiplas acoes | `comprei coca, vendi agua e gastei 10` pede para escolher uma acao; nada salva | Passou no E2E direcionado |
| Valor total/unitario | `comprei 5 coca por 20 reais` pergunta total/cada; `total` vira custo unitario R$ 4,00 | Passou no E2E direcionado |
| Social | Cumprimentos respondem sem rascunho nem relatorio | Passou em teste unitario |
| Conversa com campos faltantes | `coloca 5 coca cola que eu comprei no estoque` pergunta custo, preco de venda e estoque minimo antes de rascunho | Passou |
| Chat conversacional | input limpa, mensagem do usuario aparece e resposta do assistant entra no historico | Passou |
| Produto novo por entrada parcial | apos confirmacao, `Coca Cola` fica com estoque 5 e movimento `ADJUSTMENT/INITIAL_STOCK`; nenhuma compra e criada automaticamente | Passou |
| Custo unitario em linguagem natural | `paguei 4 reais em cada uma delas` vira custo unitario R$ 4,00 e nao pede custo novamente | Passou |
| Compra ambigua | `comprei 5 coca por 20 reais` pergunta se o valor e total ou unitario | Passou |
| Produto ambiguo | `vendi uma coca` lista produtos parecidos e nao escolhe sozinho | Passou |
| Continuacao de desambiguacao | `a de 600` gera rascunho para `Coca-Cola 600ml` | Passou |
| Desambiguacao por numero | `vendi 5 coca cola para meu cliente aqui` seguido de `1` gera rascunho para `Coca Cola lata` | Passou no E2E direcionado |
| Desambiguacao por texto | `vendi 5 coca cola para meu cliente aqui` seguido de `coca lata` gera rascunho para `Coca Cola lata` | Passou no E2E direcionado |
| Protecao contra loop | escolha valida usa produto por `id` e nao repete a pergunta de ambiguidade por nome fuzzy | Passou em unitario e E2E |

Estado financeiro final validado no banco temporario:

- estoque final: 25;
- produtos criados: 1;
- compras registradas: 1;
- vendas registradas: 1;
- itens de venda: 1;
- despesas confirmadas: 1;
- faturamento: R$ 30,00;
- custo da venda: R$ 15,00;
- lucro bruto: R$ 15,00;
- despesas confirmadas: R$ 10,00;
- lucro liquido: R$ 5,00.

## Falhas Encontradas

Nenhuma falha funcional nova foi reproduzida pela auditoria automatizada desta rodada.

O bug historico de `Confirmando...` nao voltou nos fluxos cobertos: produto, compra, venda e despesa por assistant.

## Correcoes Aplicadas

Na auditoria original, nao houve correcao de regra de negocio ou componente de producao.

Correcao posterior de assistant conversacional em 2026-05-25:

- parser rule-based passou a reconhecer compra/entrada parcial de estoque;
- server action do assistant passou a manter contexto curto de campos faltantes;
- chat passou a limpar input e preservar historico visual de usuario/assistant;
- contrato/prompt de IA externa passou a aceitar `partial_purchase`;
- testes unitarios e E2E foram reforcados para a frase real observada no teste manual.

Correcao posterior de inteligencia operacional em 2026-05-25:

- parser rule-based passou a extrair custo unitario por expressoes `cada`, `cada uma`, `cada unidade`, `em cada` e `a X reais`;
- hardening posterior passou a cobrir `quero cadastrar 10 coca cola em lata que eu comprei por 4.20 cada uma`, `4,20 em cada` e `por 4.20 a unidade`;
- motor passou a expor `detectMultipleActions` e `assessConversationConfidence`;
- conversa social passou a cobrir `voce pode me ajudar?`;
- venda por linguagem natural passou a cobrir `cliente levou 2 aguas` e `saiu uma coca 600`;
- `comprei embalagem por 30` passou a ser despesa de embalagem, nao compra de estoque;
- parser passou a tratar `um/uma` como quantidade 1 em venda;
- compra com valor potencialmente total/unitario passou a gerar pergunta de esclarecimento;
- resolvedor do assistant passou a perguntar produto ambiguo com lista curta e guardar contexto para a resposta seguinte;
- produto inexistente em compra com custo conhecido conduz cadastro seguro, sem criar automaticamente;
- prompt e contrato operacional da IA externa foram atualizados sem tornar Groq obrigatorio.

Correcao posterior de desambiguacao humana em 2026-05-25:

- `pendingContext` de produto ambiguo passou a guardar as opcoes com `id` e nome;
- a resposta seguinte passa pelo resolvedor de escolha antes de nova classificacao de intencao;
- respostas como `1`, `2`, `a primeira`, `a de 600`, `350 ml`, `coca lata` e `coca cola lata eu vendi` resolvem a opcao quando houver seguranca;
- respostas genericas ou ainda ambiguas, como `essa mesmo` sem opcao destacada e `a lata` quando ha `lata` e `lata 350 ml`, pedem numero;
- apos escolher produto, venda/compra continua usando o produto ativo pelo `id`, sem nova busca aproximada por nome;
- venda humana `vendi 5 coca cola para meu cliente aqui` remove ruido de cliente e preserva produto `coca cola`.

Mudancas aplicadas:

- criado E2E de demo real por assistant;
- reforcado helper de banco E2E para ler estado financeiro deterministico;
- criado este relatorio;
- atualizado `docs/PROJECT_STATE.md` com resultados reais.

## Comandos Executados

Comandos de desenvolvimento direcionados:

- `npm run e2e -- tests/e2e/ai-demo-flow.spec.ts`: passou, 1 teste mobile.
- `npm run lint -- tests/e2e/ai-demo-flow.spec.ts tests/e2e/helpers/e2e-database.ts`: passou.
- `npm run test -- tests/ai/parse-message.test.ts tests/ai/external-assistant.test.ts tests/ai/nexis-system-prompt.test.ts`: na atualizacao conversacional, primeiro falhou antes da implementacao e depois passou com 3 arquivos e 40 testes.
- `npm run e2e -- tests/e2e/ai-demo-flow.spec.ts`: na atualizacao conversacional, primeiro falhou por expectativas globais apos historico de chat e depois passou com 2 testes mobile Chromium.
- `npm run e2e -- tests/e2e/text-only-demo.spec.ts`: passou com 2 testes mobile Chromium apos escopar expectativas antigas para a ultima resposta do assistant.
- `npm run test -- tests/ai/parse-message.test.ts`: primeiro falhou com o novo modulo ausente e depois com casos de classificacao/entidades; depois passou.
- `npx playwright test tests/e2e/ai-demo-flow.spec.ts --grep "uses unit cost|asks for product disambiguation"`: primeiro falhou nos 2 casos novos, depois passou.
- `npm run test -- tests/ai/parse-message.test.ts tests/ai/external-assistant.test.ts tests/ai/nexis-system-prompt.test.ts`: passou com 3 arquivos e 44 testes.
- `npx playwright test tests/e2e/ai-demo-flow.spec.ts`: passou com 3 testes mobile Chromium.
- `npm run test -- tests/ai/parse-message.test.ts tests/ai/external-assistant.test.ts tests/ai/nexis-system-prompt.test.ts tests/ai/provider.test.ts`: passou com 4 arquivos e 57 testes apos motor v2.
- `npx playwright test tests/e2e/ai-demo-flow.spec.ts`: passou com 5 testes mobile Chromium apos frase longa real e total/unitario.
- `npm run test -- tests/ai/parse-message.test.ts tests/ai/conversation-engine-corpus.test.ts tests/ai/external-assistant.test.ts tests/ai/nexis-system-prompt.test.ts tests/ai/provider.test.ts`: passou com 5 arquivos e 145 testes apos hardening de linguagem natural real.
- `npx playwright test tests/e2e/ai-demo-flow.spec.ts`: passou com 8 testes mobile Chromium apos frase real do print, bloqueio de relatorio indevido e multiplas acoes.
- `npm run lint`: passou na checagem intermediaria desta rodada.
- `npm run typecheck`: passou na checagem intermediaria desta rodada.
- `npx vitest run tests/ai/product-disambiguation.test.ts`: primeiro falhou por modulo ausente e depois passou com 6 testes.
- `npx vitest run tests/ai/parse-message.test.ts`: primeiro falhou na frase `vendi 5 coca cola para meu cliente aqui` e depois passou apos limpar ruido de cliente.
- `npx vitest run tests/ai/product-disambiguation.test.ts tests/ai/parse-message.test.ts tests/ai/conversation-engine-corpus.test.ts`: passou com 3 arquivos e 127 testes.
- `npx playwright test tests/e2e/ai-demo-flow.spec.ts -g "continues a human sale|asks for product disambiguation"`: passou com 3 testes mobile Chromium.
- `npx vitest run tests/ai/product-disambiguation.test.ts tests/ai/parse-message.test.ts`: passou com 2 arquivos e 40 testes apos reforcar seletores numericos/textuais de produto ambiguo.
- `npx playwright test tests/e2e/assistant-human-conversation.spec.ts`: passou com 5 testes mobile Chromium cobrindo conversas humanas A-E.

Comandos obrigatorios:

- `npx prisma validate`: passou; schema valido.
- `npx prisma generate`: passou; Prisma Client 7.8.0 gerado.
- `npm run db:reset-empty`: passou; banco local SQLite recriado sem seed.
- `npm run lint`: passou.
- `npm run typecheck`: passou.
- `npm run test`: passou; 29 arquivos, 289 testes na validacao de desambiguacao humana.
- `npm run build`: passou; Next.js 16.2.6.
- `npm run e2e`: passou; 24 testes mobile Chromium na validacao de desambiguacao humana e conversas sequenciais.
- `npm run verify`: passou; lint, typecheck, test e build.
- `npm run verify:e2e`: passou; 24 testes mobile Chromium na validacao de desambiguacao humana e conversas sequenciais.
- `npm run ai:check-provider`: passou; `status: "passed"`, smoke test executado com configuracao privada presente, sem imprimir chave.
- `git diff --check`: passou.

## Pendencias Antes do Teste Manual

Nao ha pendencia bloqueadora para o teste manual do usuario nos fluxos de assistant auditados.

Riscos fora deste escopo continuam:

- SQLite local segue apenas para demo/MVP;
- producao real ainda precisa Postgres/Supabase, auth, multiempresa e backup;
- cancelamento/correcao rastreavel, perdas, servico sem estoque, pro-labore, despesas fixas, metas e voz real continuam fora desta etapa;
- worktree ja estava sujo antes da auditoria, entao revisar o diff completo antes de commit/PR.

## Etapa 5 - Laboratorio Humano Multi-Negocio

Implementada em 2026-05-25, sem alterar schema Prisma, auth, Postgres, voz/STT, pro-labore, perdas ou cancelamento/correcao.

Escopo entregue:

- criado `tests/ai/assistant-human-fuzz-corpus.test.ts` com 122 frases parametrizadas;
- criado `tests/e2e/assistant-human-business-flow.spec.ts` com 7 cenarios mobile;
- criado `docs/ASSISTANT_HUMAN_FUZZ_REPORT.md`;
- criado `docs/ASSISTANT_BUSINESS_SCENARIOS.md`;
- `docs/ASSISTANT_INTELLIGENCE_CORPUS.md` foi expandido para mais de 120 frases documentadas;
- motor passou a normalizar typos comuns e tratar `bota no estoque`, areia/metro, cimento/saco, espetinho, agua ambigua, produto sensivel ficticio e servico sem estoque;
- contrato externo/Groq ganhou `sensitiveProductWarning` e `serviceUnsupported`, sem tornar IA externa obrigatoria.

Validacao direcionada desta etapa:

- `npx vitest run tests/ai/assistant-human-fuzz-corpus.test.ts`: passou com 132 testes.
- `npx playwright test tests/e2e/assistant-human-business-flow.spec.ts`: passou com 7 testes mobile Chromium.

## Etapa 6 - Unidades Comerciais Reais

Implementada em 2026-05-25.

Escopo entregue:

- frase observada `eu comprei hoje 2 kg de macan a 25,50 o kg` passou a extrair `purchase_entry`, quantidade 2, unidade `KG`, produto `macan`, custo 2550 e `priceBasis=por kg`;
- compras por `kg`, `quilos`, `gramas`, `litro`, `ml`, `metro`, `m2`, `m3`, `saco`, `caixa`, `fardo`, `pacote`, `dúzia`, `peça` e `unidade` entram na camada `commercial-units`;
- `grama` agora e unidade propria `GRAM` no cadastro manual e no assistant; `500 gramas ... a grama` preserva estoque 500, enquanto `500 gramas ... o kg` continua convertendo para 0,5 kg;
- venda com decimal por unidade de medida, como `vendi 1,5 kg de maçã`, preserva quantidade decimal e unidade;
- cadastro seguro de produto novo por medida pergunta preco de venda e estoque minimo na unidade correta;
- `macan` nao e trocado por `maçã` sem confirmacao; o nome informado segue para revisao no rascunho;
- estoque decimal foi auditado como suportado por `Decimal` no Prisma e por `parseBrazilianQuantity` nas validacoes;
- E2E `tests/e2e/assistant-commercial-units.spec.ts` cobre banco vazio com fluxo por kg, metro, saco e grama com venda baixando estoque.

Validacao direcionada executada nesta etapa:

- `npx vitest run tests/ai/parse-message.test.ts tests/ai/conversation-engine-corpus.test.ts tests/ai/assistant-human-fuzz-corpus.test.ts tests/validation/product.test.ts`: passou com 292 testes.
- `npm run typecheck`: passou na checagem intermediaria apos a alteracao dos tipos.
- `npx playwright test tests/e2e/assistant-commercial-units.spec.ts`: passou com 3 testes mobile Chromium.
- Atualizacao de 2026-05-26: o mesmo arquivo passou com 4 testes mobile Chromium apos incluir cadastro/venda por `GRAM`.

Validacao completa obrigatoria da etapa:

- `npx prisma validate`: passou.
- `npx prisma generate`: passou.
- `npm run db:reset-empty`: passou.
- `npm run lint`: passou.
- `npm run typecheck`: passou.
- `npm run test`: passou com 30 arquivos e 452 testes apos ajustar timeout do teste `db:reset-empty` para migracao real.
- Atualizacao de 2026-05-26: `npm run verify` passou com 454 testes unitarios e build apos incluir `GRAM`.
- `npm run build`: passou.
- Atualizacao de 2026-05-26: `npm run e2e` passou com 35 testes mobile Chromium.
- `npm run e2e`: passou com 34 testes mobile Chromium apos atualizar expectativa antiga de areia para produto + unidade.
- `npm run verify:e2e`: passou com 34 testes mobile Chromium.
- `npm run ai:check-provider`: passou com smoke test executado.
- `git diff --check`: passou.
- `npm run verify`: passou.
