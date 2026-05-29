# Plano de Cadastro de Produtos com IA

Data: 2026-05-28

## Objetivo

Melhorar o cadastro, busca e consumo de produtos pelo assistant do NEXIS sem deixar a IA ser fonte de verdade. A IA pode interpretar a fala do usuario e sugerir rascunhos, mas produto, venda, compra, estoque e custo devem ser resolvidos por codigo e banco.

## Estado atual verificado

O produto ja tem chave primaria tecnica:

- `Product.id`: `String @id @default(cuid())`
- `Purchase.productId`: referencia `Product.id`
- `SaleItem.productId`: referencia `Product.id`
- `StockMovement.productId`: referencia `Product.id`

Isso e correto para o MVP. O ID nao depende do nome do produto, nao muda se o usuario renomear o produto e permite que venda, compra e movimento de estoque continuem apontando para o item certo.

O fluxo atual tambem ja faz pontos importantes:

- cadastro manual e cadastro por IA usam `createProductRecord`;
- produto criado com estoque inicial gera `StockMovement` de ajuste inicial;
- compra por IA gera rascunho com `productId`;
- venda por IA gera rascunho com `productId`;
- confirmacao de compra/venda reconsulta o produto pelo ID antes de salvar;
- produtos ambiguos guardam opcoes com `id` e `name` no contexto pendente;
- o usuario confirma por botao antes de salvar.

## Problema principal

O problema nao e a falta de chave primaria. O problema esta antes dela: a IA recebe uma frase humana e precisa decidir qual produto do banco aquela frase representa.

Exemplo:

```text
gostaria de cadastrar um produto comprei uma caixa de coca cola de 12 unidades coca lata de 350 ml ficou 37 reais a caixa dela
```

O sistema precisa entender:

- intencao: cadastro/entrada inicial de produto;
- produto comercial: Coca Cola lata 350 ml;
- embalagem comprada: 1 caixa;
- unidades internas: 12 latas;
- custo da caixa: R$ 37,00;
- unidade vendida: unidade/lata;
- custo unitario: precisa regra de arredondamento, porque 37 / 12 nao fecha em centavos exatos;
- campos faltantes: preco de venda e estoque minimo.

Sem uma camada forte de resolucao de produto, o assistant pode pedir dados que ja estavam na frase ou perder contexto na proxima resposta do usuario.

## Decisao recomendada sobre ID

Manter `Product.id` como chave primaria principal.

Nao usar nome do produto como chave primaria.
Nao usar nome interpretado pela IA como identificador final.
Nao deixar a IA inventar `productId`.

A regra recomendada e:

1. IA extrai nome provavel e entidades.
2. Backend consulta produtos reais.
3. Backend resolve produto existente por `Product.id`.
4. Se houver ambiguidade, usuario escolhe uma opcao.
5. Rascunho de venda/compra guarda `productId`.
6. Confirmacao reconsulta o produto pelo `productId`.
7. Servidor recalcula estoque, custo e totais antes de persistir.

## Melhorias recomendadas no cadastro

### 1. Adicionar nome normalizado persistido

Hoje a duplicidade e resolvida em codigo normalizando nomes em memoria. Para crescer com IA, vale persistir um campo:

```text
Product.normalizedName
```

Uso:

- bloquear duplicidade no banco;
- acelerar busca;
- comparar nomes sem acento, caixa alta/baixa e espacos extras;
- facilitar migracao futura para Postgres/Supabase.

No MVP atual, a chave poderia ser unica por produto:

```text
@@unique([normalizedName])
```

No futuro com multiempresa:

```text
@@unique([businessId, normalizedName])
```

### 2. Criar aliases de produto

Para linguagem natural, um produto pode ter varios nomes:

- `Coca Cola lata 350 ml`
- `coca lata`
- `coca 350`
- `latinha coca`
- `refrigerante coca lata`

Recomendacao futura:

```text
ProductAlias
- id
- productId
- alias
- normalizedAlias
- source: manual | ai_confirmed | import
```

Regra segura: alias sugerido pela IA so deve ser salvo depois de confirmacao ou quando vier de um fluxo revisado.

### 3. Separar produto de embalagem de compra

O produto vendido deve continuar sendo a unidade comercial que o lojista vende.

Exemplo:

- Produto: `Coca Cola lata 350 ml`
- Unidade de venda: `UNIT`
- Compra: `1 caixa`
- Unidades por caixa: `12`
- Custo da caixa: `3700` centavos
- Estoque inicial: `12`

O sistema atual ja converte embalagem quando a divisao fecha em centavos. Falta decidir a regra quando nao fecha.

Regra aplicada para `R$ 37 / 12`:

1. Calcular `preco da embalagem / unidades de venda`.
2. Arredondar o resultado para duas casas decimais.
3. Usar o valor em centavos como custo unitario do produto vendido.

Exemplo: `R$ 37,00 / 12 = R$ 3,0833...`, entao o custo unitario gravado no rascunho e `R$ 3,08`.

### 4. Criar resolvedor unico de produtos para IA

Hoje a resolucao existe, mas esta espalhada entre parser, conversation engine, assistant action e desambiguacao.

Recomendacao:

```text
lib/products/resolve-product-for-ai.ts
```

Entrada:

- texto original;
- nome extraido;
- operacao: venda, compra, cadastro, consulta;
- produtos ativos;
- aliases futuros;

Saida:

- `status: unique | ambiguous | not_found | new_product_candidate`
- `productId` quando houver produto unico;
- `candidates` com `id`, `name`, unidade, estoque e score;
- `reason`;
- `nextQuestion` quando faltar seguranca.

Isso deixa a IA com um contrato claro: ela sugere; o resolvedor decide com dados reais.

### 5. Reanalise critica da IA antes do rascunho

Adicionar uma etapa opcional de revisao:

1. Primeira chamada: extrai intencao e entidades.
2. Backend busca produtos, estoque, aliases e regras.
3. Segunda chamada: revisa a propria interpretacao usando o contexto real.
4. Backend valida com Zod e regras deterministicas.
5. Usuario ve rascunho e confirma por botao.

A segunda chamada nao pode salvar nem decidir sozinha. Ela deve responder apenas:

- pode montar rascunho;
- precisa perguntar campo faltante;
- produto ambiguo;
- custo/quantidade ambiguos;
- operacao insegura;
- nao entendi com seguranca.

## Fluxo ideal para venda por IA

```text
Usuario: vendi 2 coca lata

1. IA extrai: venda, produto "coca lata", quantidade 2.
2. Backend busca produtos ativos e aliases.
3. Se encontrar um produto unico:
   - usa Product.id real;
   - calcula estoque apos venda;
   - usa preco cadastrado se o usuario nao informou preco;
   - gera rascunho.
4. Se encontrar mais de um:
   - pergunta qual produto;
   - guarda opcoes com Product.id no pendingContext;
   - proxima resposta escolhe por numero ou texto.
5. Confirmacao por botao:
   - servidor reconsulta Product.id;
   - valida estoque;
   - grava Sale, SaleItem e StockMovement.
```

## Fluxo ideal para cadastro por IA

```text
Usuario: comprei uma caixa de coca lata 350 ml com 12 unidades por 37 reais

1. IA extrai cadastro/entrada inicial.
2. Backend normaliza nome e procura duplicidade.
3. Se produto parecido existir, pergunta se e o mesmo.
4. Se nao existir, pede dados faltantes:
   - preco de venda;
   - estoque minimo;
   - confirmacao de custo unitario quando divisao nao fecha.
5. Gera rascunho visual.
6. Confirmacao por botao cria Product.id.
7. Produto criado recebe estoque inicial e StockMovement de ajuste inicial.
```

## O que falta implementar

Prioridade alta:

- corrigir parser para frases humanas longas de embalagem e cadastro;
- manter contexto pendente quando a primeira mensagem foi parcialmente entendida;
- manter testes para custo de embalagem que nao divide em centavos, usando arredondamento para duas casas decimais;
- reforcar teste com o caso real da Coca Cola caixa de 12 por R$ 37;
- garantir que venda/compra por IA sempre termine em `productId` antes do rascunho.

Prioridade media:

- adicionar `normalizedName` persistido no `Product`;
- criar indice unico para nome normalizado;
- centralizar resolucao de produto para IA em modulo proprio;
- adicionar auditoria simples de origem: manual, assistant_text, assistant_ai, voice_future.

Prioridade futura:

- adicionar `ProductAlias`;
- adicionar multiempresa com `businessId`;
- migrar regra de unicidade para `businessId + normalizedName`;
- guardar metadados de embalagem de compra quando for util para historico;
- registrar revisao da IA externa como diagnostico, sem expor prompt nem chave.

## Recomendacao final

Para o NEXIS, o melhor caminho e manter a chave primaria tecnica atual (`Product.id`) e fortalecer a camada de resolucao por linguagem natural.

O banco deve confiar em IDs. A IA deve trabalhar com nomes, candidatos e explicacoes. A ponte entre os dois deve ser codigo deterministico que transforma texto em um `productId` real ou pede esclarecimento.

Essa separacao reduz erro em venda por IA, evita duplicidade de cadastro e protege o estoque.

## Implementacao executada

Data: 2026-05-28.

O plano foi implementado no MVP com estas decisoes:

- `Product.id` continua sendo a chave primaria tecnica usada por venda, compra e estoque.
- `Product.normalizedName` foi adicionado ao Prisma com indice unico para bloquear duplicidade de cadastro.
- `ProductAlias` foi adicionado para nomes alternativos confirmados, com `normalizedAlias` unico e origem `MANUAL`, `AI_CONFIRMED` ou `IMPORT`.
- `EntryOrigin` foi adicionado para auditar origem de `Product`, `Purchase`, `Sale`, `Expense` e `StockMovement`.
- A migracao `prisma/migrations/20260528220500_product_ai_identity/migration.sql` cria os novos campos, backfill de produtos existentes e alias inicial por nome.
- `createProductRecord` agora grava `normalizedName`, alias confirmado e origem, e tambem aplica origem no movimento de estoque inicial.
- A validacao de duplicidade passou a consultar `normalizedName` e tambem comparar o nome normalizado em codigo para proteger dados antigos com acentos.
- Edicao manual de produto atualiza `normalizedName` e reusa a mesma regra de duplicidade.
- `lib/products/resolve-product-for-ai.ts` centraliza a resolucao da IA com `unique`, `ambiguous`, `not_found` e `new_product_candidate`.
- O assistant passou a buscar `aliases` dos produtos ativos e usar o resolvedor central antes de montar rascunhos de venda ou compra.
- Venda, compra, despesa e cadastro salvos a partir do assistant gravam `origin: ASSISTANT_TEXT`.
- Cadastro de produto confirmado pelo assistant grava alias com `source: AI_CONFIRMED`.
- A frase real da Coca Cola em caixa agora e interpretada como compra/cadastro inicial: 1 caixa, 12 unidades, custo da caixa R$ 37,00, custo unitario R$ 3,08.
- A conversao `preco da caixa / unidade de venda` usa `calculateRoundedUnitAmountCents` e arredonda para centavos.
- Foi adicionada a reanalise opcional da IA externa por segunda chamada com `AI_ASSISTANT_REVIEW_PASS_ENABLED=true`; por padrao fica desligada para nao dobrar custo.
- `.env.example` documenta `AI_ASSISTANT_REVIEW_PASS_ENABLED="false"`.
- O teste de reset vazio teve timeout ajustado para 45s porque `prisma migrate deploy` levou cerca de 18s em ambiente frio com as migracoes atuais.

Arquivos principais alterados:

- `prisma/schema.prisma`
- `prisma/migrations/20260528220500_product_ai_identity/migration.sql`
- `lib/products/create-product.ts`
- `lib/products/resolve-product-for-ai.ts`
- `lib/ai/commercial-units.ts`
- `lib/ai/ai-config.ts`
- `lib/ai/external-assistant.ts`
- `app/assistant/actions.ts`
- `app/products/actions.ts`
- `.env.example`
- `tests/products/create-product.test.ts`
- `tests/products/resolve-product-for-ai.test.ts`
- `tests/ai/parse-message.test.ts`
- `tests/ai/ai-config.test.ts`
- `tests/ai/external-assistant.test.ts`
- `tests/prisma-schema.test.ts`
- `tests/db/reset-empty.test.ts`
- `playwright.config.ts`

Itens conscientemente deixados para fase futura:

- `businessId` e unicidade `businessId + normalizedName`, porque ainda dependem de auth/multiempresa.
- Metadados historicos de embalagem de compra, porque o MVP atual precisa primeiro validar o fluxo de produto, compra e estoque.
- Log persistente da revisao externa da IA, para evitar gravar prompt/resposta sensivel antes de definir politica de retencao.
