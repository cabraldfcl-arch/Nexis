# Base Operacional do Assistant NEXIS

Ultima atualizacao: 2026-05-25

## Principio

O assistant interpreta linguagem natural e monta respostas ou rascunhos. Ele nunca salva produto, compra, venda, despesa ou estoque sem botao de confirmacao. Dinheiro, estoque e lucro continuam vindo de codigo deterministico no backend.

## Matriz de Intencoes

A prioridade do motor v2 e: perigoso, social, acao/transacao, pergunta financeira, desconhecido. Frases com verbos de acao como `cadastrar`, `cadastre`, `registrar`, `lancar`, `comprei`, `vendi`, `gastei`, `deu entrada` ou `coloca no estoque` nao devem virar relatorio so porque contem `compra`, `venda` ou `estoque`.

Funcoes centrais:

- `normalizeUserMessage`: normaliza caixa, acentos, hifen, dinheiro, numeros e tokens como `ml`, `litro`, `kg`, `lata` e `unidade`.
- `classifyIntent`: separa `social`, `dangerous`, `product_registration`, `purchase_entry`, `sale_exit`, `expense`, `financial_question` e `unknown`.
- `extractEntities`: extrai produto, quantidade, custo unitario, valor total/ambiguo, unidade, variante, categoria e periodo quando aplicavel.
- `detectMultipleActions`: identifica frases que misturam compra, venda, despesa e cadastro no mesmo texto.
- `assessConversationConfidence`: classifica a interpretacao em `HIGH`, `MEDIUM` ou `LOW` para orientar rascunho, pergunta de campo faltante ou modo seguro.
- `resolveProduct`: retorna `no_match`, `unique_match` ou `ambiguous_match`.
- `resolveProductSelectionFromOptions`: resolve a resposta a um produto ambiguo por numero, ordinal ou texto parcial usando as opcoes guardadas no contexto.
- `nextQuestionPlanner`: decide se falta custo, preco de venda, estoque minimo, escolha de produto ou esclarecimento total/unitario.

| Intencao | Frases possiveis | Campos obrigatorios | Opcionais | Extracao | Perguntar quando | Rascunho quando | Bloquear/desambiguar |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Social | ola boa tarde, tudo bem?, o que voce faz? | nao aplicavel | nao aplicavel | classificador social | nunca | nunca | nao gerar relatorio nem rascunho |
| Cadastro de produto | cadastrar produto, criar produto, adicionar produto, coloca produto no sistema | nome, custo, preco de venda, estoque inicial, estoque minimo | categoria, unidade | valores por palavras-chave `custo`, `venda/preco`, `estoque`, `minimo`; unidade por kg/litro/caixa | faltar qualquer campo obrigatorio | todos os campos estiverem presentes e sem duplicidade | duplicado por nome normalizado |
| Compra/entrada de estoque | comprei, entrou no estoque, coloca no estoque, chegou mercadoria, dei entrada, abastece estoque | produto, quantidade, custo unitario | unidade, priceBasis, fornecedor ainda nao usado no assistant | quantidade no inicio; custo por `cada`, `cada uma`, `cada unidade`, `por unidade`, `a X reais`, `a X o kg`, `paguei X em cada`, `paguei X cada metro` | faltar custo, produto nao existir ou valor `por X reais` puder ser total ou unitario | produto unico existente + custo unitario claro | produto ambiguo; valor total/unitario ambiguo |
| Venda/saida de estoque | vendi, saiu, cliente comprou, baixou, dei saida | produto, quantidade | preco informado; se ausente usa preco cadastrado | quantidade numerica ou `um/uma`; produto por nome aproximado | produto inexistente ou ambiguo | produto unico existente e estoque suficiente | estoque insuficiente; produto ambiguo; produto inexistente nao cria cadastro automatico |
| Despesa | gastei, paguei, tive despesa, custo com, conta de | descricao, valor | categoria inferida | valor monetario e descricao apos `com/de/em` | faltar valor ou descricao minima | valor positivo e descricao minima | valor zero/negativo; perda de estoque nao vira baixa |
| Pergunta financeira | quanto vendi, quanto ganhei, lucro bruto, lucro liquido, estoque atual, produto mais vendido, resumo do dia/mes | intencao e periodo inferido | produto especifico para estoque | classificador rule-based; periodo `hoje` ou mes atual | consulta nao implementada | nao gera rascunho; responde com backend/banco | IA externa nao calcula numero final |
| Produto ambiguo | vendi uma coca; comprei 5 coca quando existem Coca lata, Coca 600ml e Coca 2L | lista de candidatos ativos com `id` e nome no `pendingContext` | escolha por numero, ordinal ou trecho | a proxima mensagem e tratada primeiro como selecao pendente, antes de reclassificar como frase nova | mais de um produto compativel | apos escolha clara, usando o produto escolhido por `id` | nunca escolher sozinho; se continuar ambiguo, pedir numero |
| Produto inexistente | vendi 2 guarana; coloca 5 guarana no estoque paguei 3 cada | produto ativo existente para venda; cadastro completo para entrada nova | unidade | busca aproximada em produtos ativos | venda: informar que nao existe; entrada: pedir dados de cadastro | entrada nova vira rascunho de produto depois de preco de venda e minimo | nao cadastrar automaticamente sem botao |
| Comando perigoso | apagar, excluir, deletar, cancelar, corrigir, estornar, desfazer, remover | nao aplicavel | nao aplicavel | detectado antes de outras intencoes | sempre | nunca | bloquear ate existir fluxo rastreavel |
| Confirmacao obrigatoria | sim, pode salvar, confirma ai | botao do card | nao aplicavel | mensagem solta nao confirma | sempre que nao houver intencao completa | nunca | nao salvar por texto solto |
| Conversa pendente | resposta a pergunta anterior: `paguei 4`, `vendo por 7`, `a de 600`, `1`, `minimo 5` | contexto pendente + valor/escolha | opcoes de produto com `id` e nome quando houver desambiguacao | contexto fica no cliente e volta pela server action; escolha de produto e resolvida antes de nova classificacao | resposta incompleta ou escolha ambigua | quando o campo pendente fica completo | contexto nao persiste apos reload |
| Multiplas acoes | comprei coca, vendi agua e gastei 10 | uma acao por mensagem | nao aplicavel | detecta compra+venda+despesa juntas | sempre pedir para separar | nunca | nada e salvo |

## Normalizacao de Produto

Regras atuais:

- ignora caixa alta/baixa;
- ignora acentos;
- trata hifen e espacos extras como separadores;
- singulariza plural simples terminado em `s`;
- remove palavras de apoio como `de`, `do`, `da`, `em`, `por`, `unidade`;
- nao expande marca ou produto especifico por hardcode;
- usa qualificadores como `lata`, `350ml`, `600`, `2L` para reduzir ambiguidade quando fazem parte do nome informado.

Exemplos:

- `refrigerante lata 350 ml` preserva a variante `lata 350 ml`;
- `agua` aproxima de `Água`;
- `agua 500ml` preserva a variante como `Agua 500ml`;
- `queijo mussarela kg` preserva `mussarela kg` e usa unidade `KG` apenas porque `kg` foi informado.

## Custo Unitario

O valor e unitario quando a frase disser:

- `cada`;
- `cada uma`;
- `cada uma delas`;
- `cada unidade`;
- `por unidade`;
- `paguei X em cada`;
- `foi X cada`;
- `cada uma saiu por X`;
- `X em cada`;
- `a X reais`.
- `por X a unidade`.
- `a X o kg`;
- `por X o quilo`;
- `paguei X cada metro`;
- `a X o saco`;
- `a X cada pacote`.

Caso validado em teste manual:

- `quero cadastrar 10 coca cola em lata que eu comprei por 4.20 cada uma`
- resultado: `purchase_entry`, produto `coca cola lata`, quantidade 10 e custo unitario R$ 4,20;
- proxima pergunta: `Por quanto voce vende cada unidade?`;
- nao deve pedir custo novamente.

Quando a frase for `comprei 5 refrigerantes por 20 reais`, o assistant deve perguntar se `R$ 20,00` e o total da compra ou o valor de cada unidade.

Se a continuacao for `total`, o custo unitario e calculado por codigo deterministico: `valor total / quantidade`. Exemplo: `20 / 5 = 4`, ou seja, R$ 4,00 por unidade. Se a continuacao for `cada`, o valor informado vira custo unitario.

## Unidades Comerciais Reais

O assistant reconhece unidades de medida explicitas em compras, vendas e cadastros:

- peso: `kg`, `quilo`, `quilos`, `kilo`, `kilos`, `g`, `grama`, `gramas`;
- volume: `litro`, `litros`, `l`, `ml`, `mililitro`;
- construcao: `metro`, `metros`, `m`, `m2`, `m²`, `metro quadrado`, `m3`, `m³`, `metro cúbico`;
- embalagem: `unidade`, `un`, `peça`, `caixa`, `saco`, `fardo`, `pacote`, `dúzia`.

Regras:

- `eu comprei hoje 2 kg de macan a 25,50 o kg` extrai compra, quantidade 2, unidade `KG`, produto `macan`, custo unitario 2550 e priceBasis `por kg`;
- `500 gramas ... o kg` vira quantidade 0,5 em `KG`;
- `500 gramas ... a grama` preserva quantidade 500 em `GRAM`;
- `500 ml ... o litro` vira quantidade 0,5 em `LITER`;
- `cadastre tempero unidade grama custo 0,04 venda 0,08 estoque 500 mínimo 100` vira rascunho de produto `Tempero` com unidade `GRAM`;
- `cadastre cimento por saco ...` e `cadastre ovos por dúzia ...` removem a unidade do nome e gravam `SACK`/`DOZEN` no campo de unidade;
- `metro`, `m2` e `m3` nao devem ser confundidos com letras soltas dentro de palavras como `mínimo`;
- variantes de produto como `refrigerante lata 350 ml` continuam sendo produto por unidade, a menos que a quantidade da frase use explicitamente uma unidade comercial;
- produtos novos seguem cadastro seguro: perguntar preco de venda e estoque minimo na mesma unidade, gerar rascunho e salvar somente por botao.
- quando a unidade nao vier explicita, o assistant usa `UNIT`; ele nao infere unidade por marca ou nome especifico de produto.

Perguntas de continuacao usam a unidade extraida:

- kg: `Por quanto você vende o kg?` e `Qual estoque mínimo em kg?`;
- grama: `Por quanto você vende a grama?` e `Qual estoque mínimo em gramas?`;
- metro: `Por quanto você vende o metro?` e `Qual estoque mínimo em metros?`;
- caixa: `Por quanto você vende a caixa?` e `Qual estoque mínimo em caixas?`.

Typos de produto nao sao corrigidos automaticamente. `macan` pode virar rascunho como `Macan` para revisao do usuario ou pode ser desambiguado se houver produto cadastrado semelhante. O assistant nao deve trocar silenciosamente por `maçã`.

O estoque ja aceita decimais no schema Prisma e nas validacoes (`Decimal` no banco, `parseBrazilianQuantity` em Zod). O laboratorio cobre `0,5 kg` e `1,5 kg`.

## Produto Ambiguo

Se houver mais de um produto compativel, o assistant responde com lista curta numerada e guarda contexto da intencao original, quantidade, preco/custo informado e opcoes de produto com `id` e nome. A proxima resposta e interpretada primeiro como selecao pendente, nao como uma mensagem isolada.

- `a de 600`;
- `a de 350`;
- `1`;
- `a 1`;
- `opcao 1`;
- `numero 2`;
- `opcao 2`;
- `a primeira`;
- `2`;
- `primeira`;
- `segunda`;
- `coca lata`;
- `coca cola lata eu vendi`;
- `a de lata`, somente quando houver uma unica opcao segura com `lata`;
- `a de 2 litros`;
- `Coca-Cola 2L`.

Depois da escolha, o assistant busca o produto ativo pelo `id` da opcao escolhida e monta o rascunho correspondente. Ele nao volta a resolver pelo nome aproximado, evitando o loop `Coca Cola lata` versus `Coca Cola lata 350 ml`. Se a resposta ainda for ambigua, como `a lata` ou `a de lata` quando existem `lata` e `lata 350 ml`, a pergunta volta em modo seguro pedindo o numero.

Cobertura automatizada atual:

- `tests/ai/product-disambiguation.test.ts` cobre numero, ordinal, volume, texto parcial seguro, resposta ainda ambigua e `1` sem contexto;
- `tests/e2e/assistant-human-conversation.spec.ts` simula conversas reais em sequencia e valida que escolha por numero continua a venda original sem baixar estoque antes do botao.

## Laboratorio Humano Multi-Negocio

Atualizado em 2026-05-25.

O assistant agora tem um laboratorio deterministico para evitar overfitting em marca ou frase unica:

- `tests/ai/assistant-human-fuzz-corpus.test.ts` valida 122 frases fixas por dominio;
- `tests/e2e/assistant-human-business-flow.spec.ts` valida 7 conversas completas em mobile Chromium;
- `docs/ASSISTANT_HUMAN_FUZZ_REPORT.md` registra falhas iniciais e correcoes;
- `docs/ASSISTANT_BUSINESS_SCENARIOS.md` descreve cenarios A-G.

Regras novas de operacao:

- `cadatra`, `conprei`, `vedi` e `cliente pego` sao normalizados de forma conservadora;
- `bota no estoque <quantidade> <produto>` e entrada com `paguei X cada` sao compra/entrada, nao despesa;
- entrada completa com custo, venda e minimo pode virar rascunho de produto, mas ainda salva somente por botao;
- `metro de areia fina` vira produto `areia fina` com unidade `METER`;
- produto sensivel ficticio gera apenas rascunho financeiro/cadastral com aviso de operacao legal/autorizada;
- servico sem estoque retorna fora de escopo seguro e nao cria produto fisico;
- multiplas acoes na mesma frase continuam bloqueadas em modo seguro.
