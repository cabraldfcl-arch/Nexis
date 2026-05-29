# Relatorio do Laboratorio Humano Fuzz do Assistant

Ultima atualizacao: 2026-05-25

## Objetivo

Testar o assistant como atendente humano real, com frases de microempreendedores de varios dominios, sem depender de Groq e sem treinar o motor apenas em Coca-Cola.

## Escopo Coberto

- Bebidas e mercearia.
- Espetinho e comida.
- Material de construcao e areia.
- Agro ficticio.
- Produtos sensiveis ficticios.
- Servicos sem estoque.
- Despesas.
- Relatorios.
- Ambiguidade de produto.
- Frases informais, abreviadas e com erro de portugues.
- Valor ambiguo entre total e unitario.
- Multiplas acoes na mesma mensagem.
- Unidades comerciais reais: kg, gramas, litro, ml, metro, m2, m3, caixa, saco, fardo, pacote, duzia e unidade.

## Falhas Encontradas Inicialmente

| Falha | Exemplo | Causa provavel | Correcao aplicada |
| --- | --- | --- | --- |
| Typos comuns viravam `unknown` | `cadatra`, `conprei`, `vedi`, `cocacola`, `cliente pego` | normalizacao nao corrigia erros previsiveis | `normalizeUserMessage` e `parseAssistantMessage` passaram a normalizar typos conservadores |
| Entrada com `bota no estoque` nao extraia produto | `bota no estoque 3 metro de areia fina...` | parser esperava quantidade logo apos `bota` | parser e extrator aceitam `bota no estoque <qtd> <produto>` |
| Compra com `paguei X cada` era confundida com despesa | `entrou 10 saco de cimento paguei 32 cada` | `paguei` tinha prioridade de despesa | despesa ignora `paguei` quando a frase tambem e entrada/compra com `cada`, `unidade` ou `estoque` |
| Cadastro completo por entrada nao virava rascunho de produto | `20 espetinho... comprei a 4... vendo por 8 minimo 5` | compra e cadastro estavam separados demais | adicionado parser de rascunho de produto a partir de entrada de estoque completa |
| Pergunta de estoque perdia produto | `quanto tenho de areia no estoque?` | extrator nao lia o padrao `quanto tenho de X no estoque` | `parseInventoryProductName` passou a extrair o produto desse padrao |
| Receita de servico forçava fallback generico | `fiz um corte de cabelo de 40 reais` | servico sem estoque nao tinha mensagem segura | resposta explicita de fora de escopo, sem draft nem estoque |
| Unidade/variante 2L nao inferia litro | `refrigerante 2L` | unidade compacta `2l` nao entrava em `LITER` | `inferProductUnit` reconhece volumes compactos em litro |
| Compra por kg do print pedia produto/quantidade/custo | `eu comprei hoje 2 kg de macan a 25,50 o kg` | parser esperava quantidade logo apos `comprei` e nao entendia `a valor o kg` | adicionada camada `commercial-units` para extrair quantidade, unidade, produto, custo e priceBasis |
| Alias de uma letra confundia palavra comum | `mínimo 1` em cadastro | `m` podia ser lido como metro por fronteira ASCII | aliases `m`, `l` e `g` passaram a usar fronteira que considera letras acentuadas |
| Produto por medida perdia unidade na continuacao | `vendo por 35 o kg` apos compra por kg | contexto pendente nao carregava unidade | `pendingContext` carrega `unit`, `unitLabel` e `priceBasis` ate gerar rascunho |

## Correcoes Aplicadas no Motor

- Normalizacao de typos previsiveis: `cadatra`, `conprei`, `vedi`, `cocacola`, `pego`.
- Prioridade de compra/entrada antes de despesa quando `paguei` aparece como custo unitario.
- Parser de entrada/cadastro completo com quantidade, produto, custo, venda e minimo na mesma frase.
- Normalizacao de nomes como `metro de areia fina` para produto `areia fina` com unidade `METER`.
- Parser de unidades comerciais em `lib/ai/commercial-units.ts`, incluindo conversao `gramas -> kg` quando a base e kg, preservacao de `GRAM` quando a base e grama, e `ml -> litro`.
- Perguntas de continuacao por unidade: kg, metro, caixa, saco, fardo, pacote e duzia.
- `ProductUnit` expandido para `GRAM`, `METER`, `SQUARE_METER`, `CUBIC_METER`, `SACK`, `BALE`, `PACKAGE` e `DOZEN`.
- Estoque decimal validado para produtos por peso (`0,5 kg`, `1,5 kg`) sem salvar antes do botao.
- Venda singular por artigo: `vendi a areia grossa` vira quantidade 1 quando o produto esta claro.
- Produto sensivel ficticio gera apenas rascunho financeiro/cadastral com aviso simples de legalidade.
- Servico sem estoque retorna resposta segura e nao cria produto fisico.
- Contrato externo/Groq ganhou `sensitiveProductWarning` e `serviceUnsupported`, mantendo fallback local.

## Evidencia Automatizada

- `tests/ai/assistant-human-fuzz-corpus.test.ts`: mais de 150 frases parametrizadas, incluindo 30+ frases de unidades comerciais.
- `tests/e2e/assistant-human-business-flow.spec.ts`: 7 conversas humanas completas em mobile Chromium.
- `tests/e2e/assistant-commercial-units.spec.ts`: fluxos por kg, metro e saco/caixa com banco vazio.

## Resultado Direcionado Atual

- `npx vitest run tests/ai/parse-message.test.ts tests/ai/conversation-engine-corpus.test.ts tests/ai/assistant-human-fuzz-corpus.test.ts tests/validation/product.test.ts`: passou com 292 testes na validacao direcionada de unidades.
- `npx playwright test tests/e2e/assistant-commercial-units.spec.ts`: passou com 3 testes mobile Chromium cobrindo kg, metro e saco.
- `npm run e2e`: passou com 34 testes mobile Chromium, incluindo laboratorio humano e unidades comerciais.
- Atualizacao de 2026-05-26: `npm run e2e` passou com 35 testes mobile Chromium apos incluir cadastro e venda por grama.
- `npm run verify`: passou com lint, typecheck, 452 testes e build.
- Atualizacao de 2026-05-26: `npm run verify` passou com lint, typecheck, 454 testes e build.

## Pendencias Fora do MVP Atual

- Receita de servico sem estoque continua fora de escopo persistente.
- Produtos sensiveis ficticios sao tratados apenas como cadastro financeiro; o sistema nao orienta uso, dose, aplicacao ou mistura.
- Perda/quebra, cancelamento/correcao, pro-labore, auth e Postgres continuam fora desta rodada.
