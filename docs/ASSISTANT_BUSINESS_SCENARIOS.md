# Cenarios de Negocio para Testes Conversacionais

Ultima atualizacao: 2026-05-28

Este documento descreve os fluxos humanos cobertos pelo laboratorio automatico do assistant. Todos os dados sao ficticios.

## Cenarios Obrigatorios de IA Embarcada

A bateria minima fica automatizada em `tests/ai/assistant-required-business-scenarios.test.ts` e `tests/e2e/assistant-required-business-scenarios.spec.ts`. Ela e uma bateria minima, nao um dicionario de hardcode: os testes devem continuar usando padroes genericos de unidade, embalagem, dinheiro, contexto e produto.

| Cenario | Entrada humana | Resultado esperado |
| --- | --- | --- |
| 1 | caixa com 12 unidades, custo total, venda unitario e minimo | rascunho de produto por unidade, custo unitario calculado e confirmacao |
| 2 | mesma caixa escrita em outra ordem | mesmo comportamento, sem depender de frase literal ou marca |
| 3 | 2 fardos de agua com 12 garrafas cada e custo por fardo | estoque 24, custo por unidade, venda unitario, minimo e confirmacao |
| 4 | fardos com valor total da compra | custo unitario por total/quantidade e pergunta de minimo se faltar |
| 5 | bandeja de ovos | estoque pela quantidade interna e pergunta de minimo se faltar |
| 6 | cartela de doces | estoque pela quantidade interna, custo unitario, venda unitario e minimo |
| 7 | pacote ambiguo | perguntar se vende pacote fechado ou cada item separado |
| 8 | produto por kg com custo total | unidade KG, custo por kg, venda por kg e minimo em kg |
| 9 | produto por kg com custo por kg explicito | unidade KG, custo e venda por kg sem dividir errado |
| 10 | gramas | nao tratar gramas como unidades; converter deterministicamente quando suportado ou perguntar |
| 11 | litro | unidade LITER, custo/venda/minimo por litro |
| 12 | ml como variante de produto unitario | manter `300 ml`/`350 ml`/`500 ml` no nome e vender por unidade |
| 13 | produto com campos faltantes e resposta posterior | perguntar campos, completar rascunho e salvar so por botao |
| 14 | compra de produto ja cadastrado | reconhecer produto, gerar rascunho de compra e aumentar estoque so apos confirmacao |
| 15 | venda de produto ja cadastrado | gerar rascunho de venda, baixar estoque so apos confirmacao e usar custo snapshot |
| 16 | venda com produto ambiguo | listar opcoes e nao escolher sozinho |
| 17 | venda de produto inexistente | bloquear venda e oferecer cadastro seguro, sem registrar direto |
| 18 | frase baguncada de comerciante | extrair embalagem, produto, custo, venda e minimo quando houver seguranca |
| 19 | caixa como produto vendido | manter `caixa de bombom` como produto; nao dividir sem unidades internas |
| 20 | compra/cadastro incompleto sem preco de venda | se produto nao existe, pedir campos de cadastro; se existe, tratar como compra |
| 21 | despesa | classificar como despesa, nao produto de estoque, e exigir confirmacao |
| 22 | perda/quebra | bloquear enquanto nao existir fluxo rastreavel; nao baixar estoque |
| 23 | cancelamento/correcao | bloquear enquanto nao existir fluxo rastreavel; nao apagar dados |
| 24 | pergunta de estoque | responder pelo banco real |
| 25 | resumo de vendas/lucro | usar calculos deterministicos de faturamento, custo, lucro bruto, despesas e lucro liquido |

## Cenario A - Espetinho

Conversa:

1. `cadatra pra mim 20 espetinho de carne comprei a 4 real cada vendo por 8 minimo 5`
2. Salvar produto pelo botao.
3. `vendi 2 espetinho de carne`
4. Confirmar venda pelo botao.
5. `gastei 30 com carvão`
6. Confirmar despesa pelo botao.
7. `qual meu lucro líquido hoje?`

Expectativa:

- Rascunho de produto com custo R$ 4,00, venda R$ 8,00, estoque 20 e minimo 5.
- Nada e salvo antes do botao.
- Venda baixa estoque apenas depois do botao.
- Despesa entra apenas depois do botao.
- Lucro liquido vem de calculo deterministico do backend.

## Cenario B - Material de Construcao / Areia

Conversa:

1. `bota no estoque 3 metro de areia fina paguei 90 cada metro e vendo por 130 mínimo 1`
2. Salvar produto.
3. `bota no estoque 4 metro de areia grossa paguei 85 cada metro e vendo por 125 mínimo 1`
4. Salvar produto.
5. `vendi a areia grossa`
6. Confirmar venda.

Expectativa:

- `areia fina` e `areia grossa` ficam produtos diferentes, ambos com unidade `METER`.
- `vendi a areia grossa` resolve o produto correto.
- Estoque de areia grossa cai de 4 para 3.
- Estoque de areia fina permanece 3.

## Cenario C - Cimento com Valor Ambiguo

Conversa:

1. `comprei 5 saco de cimento por 160`
2. Assistant pergunta se R$ 160 e total ou unitario.
3. `foi 160 no total`
4. `vendo a 45`
5. `mínimo 2`

Expectativa:

- O sistema nao gera rascunho antes de esclarecer valor.
- Custo unitario e calculado por codigo: 160 / 5 = R$ 32,00.
- Produto novo segue fluxo seguro de cadastro.
- Nada salva sem botao.

## Cenario D - Produto Sensivel Ficticio

Conversa:

1. `cadastre glifosato fictício custo 80 venda 120 estoque 5 mínimo 1`

Expectativa:

- Rascunho de produto financeiro/cadastral.
- Aviso simples: registrar apenas operacoes legais e autorizadas.
- Nenhuma instrucao de uso, dose, aplicacao ou mistura.
- Salvar somente por botao.

## Cenario E - Servico Sem Estoque

Conversa:

1. `fiz um corte de cabelo de 40 reais`

Expectativa:

- Resposta segura de fora de escopo: receita de servico sem estoque ainda nao esta implementada com seguranca.
- Nao cria produto fisico.
- Nao baixa estoque.
- Nao salva receita.

## Cenario F - Produto Ambiguo em Outro Dominio

Base:

- `Água 500ml`
- `Água 1L`
- `Água com gás 500ml`

Conversa:

1. `vendi uma água`
2. Assistant pergunta qual agua.
3. `a com gás`

Expectativa:

- Produto ambiguo gera pergunta.
- Resposta por variante textual escolhe `Água com gás 500ml`.
- Gera rascunho de venda sem baixar estoque antes do botao.

## Cenario G - Multiplas Acoes

Conversa:

1. `comprei areia, vendi cimento e gastei 10`

Expectativa:

- Assistant pede uma acao por vez.
- Nenhum rascunho critico incorreto e gerado.
- Nada e salvo.

## Cenario H - Produto por Kg com Typo

Base: banco vazio.

Conversa:

1. `eu comprei hoje 2 kg de macan a 25,50 o kg`
2. Assistant pergunta preco de venda por kg, sem pedir produto, quantidade nem custo.
3. `vendo por 35 o kg`
4. Assistant pergunta estoque minimo em kg.
5. `mínimo 1 kg`

Expectativa:

- Produto informado fica `Macan` para revisao; o assistant nao corrige silenciosamente para `Maçã`.
- Rascunho mostra unidade `KG`, custo R$ 25,50, venda R$ 35,00, estoque inicial 2 e minimo 1.
- Nada e salvo antes de `Salvar produto`.

## Cenario I - Material por Metro em Uma Frase

Base: banco vazio.

Conversa:

1. `bota no estoque 3 metros de areia fina a 90 o metro e vendo por 130 o metro mínimo 1`

Expectativa:

- Rascunho de produto `Areia fina`.
- Unidade `METER`.
- Estoque inicial 3, custo R$ 90,00, venda R$ 130,00 e minimo 1.
- Nada e salvo antes do botao.

## Cenario J - Produto por Saco

Base: banco vazio.

Conversa:

1. `comprei 5 sacos de cimento a 32 o saco vendo por 45 mínimo 2`

Expectativa:

- Rascunho de produto `Cimento`.
- Unidade `SACK`.
- Estoque inicial 5, custo R$ 32,00, venda R$ 45,00 e minimo 2.
- Nada e salvo antes do botao.
