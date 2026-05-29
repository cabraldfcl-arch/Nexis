# Corpus de Inteligencia Conversacional do Assistant

Ultima atualizacao: 2026-05-25

Este corpus guia testes unitarios e E2E do motor conversacional v2. Todas as frases sao ficticias, rodam com `AI_ASSISTANT_ENABLED=false` e servem para impedir regressao de linguagem natural comum.

Campos das tabelas:

- `intent`: intencao esperada do classificador deterministico.
- `entidades`: produto, quantidade, custo, valor, variante ou categoria esperada.
- `faltantes/proxima`: campo que o assistant deve perguntar antes de rascunho.
- `draft/bloqueio/db`: se deve gerar rascunho, bloquear ou consultar produtos reais.

## 1. Social

| # | Frase | intent | entidades | faltantes/proxima | draft/bloqueio/db |
| --- | --- | --- | --- | --- | --- |
| S1 | `olá` | `social` | nenhuma | resposta util curta | sem draft, sem relatorio |
| S2 | `boa tarde` | `social` | nenhuma | resposta util curta | sem draft, sem relatorio |
| S3 | `olá boa tarde` | `social` | nenhuma | citar produtos, compras, vendas, despesas, lucro e estoque | sem draft, sem relatorio |
| S4 | `tudo bem?` | `social` | nenhuma | perguntar como ajudar no negocio | sem draft, sem relatorio |
| S5 | `bom dia` | `social` | nenhuma | resposta util curta | sem draft, sem relatorio |
| S6 | `boa noite` | `social` | nenhuma | resposta util curta | sem draft, sem relatorio |
| S7 | `você pode me ajudar?` | `social` | nenhuma | explicar capacidades | sem draft, sem relatorio |
| S8 | `o que você faz?` | `social` | nenhuma | explicar capacidades | sem draft, sem relatorio |

## 2. Cadastro de Produto

| # | Frase | intent | entidades | faltantes/proxima | draft/bloqueio/db |
| --- | --- | --- | --- | --- | --- |
| C1 | `cadastrar Coca lata custo 3 venda 6 estoque 20 mínimo 5` | `product_registration` | produto `Coca lata`; custo 300; venda 600; estoque 20; minimo 5 | nenhum | draft de produto; salvar so por botao |
| C2 | `cadastra pra mim coca cola lata 350ml` | `product_registration` | produto `coca cola lata 350ml`; variante `lata 350ml` | custo, preco, estoque, minimo | sem draft completo |
| C3 | `quero cadastrar 10 coca cola em lata que eu comprei por 4.20 cada uma` | `purchase_entry` | produto `coca cola lata`; quantidade 10; custo unitario 420; variante `lata` | perguntar preco de venda | consulta DB; se inexistente inicia cadastro seguro |
| C4 | `coloca esse produto no sistema` | `product_registration` | nome ausente | perguntar dados do produto | sem draft completo |
| C5 | `cadastre para mim coca lata 350 ml, comprei 10 por 3.50 cada` | `purchase_entry` | produto `coca cola lata 350 ml`; quantidade 10; custo 350 | perguntar preco de venda se produto novo | consulta DB |
| C6 | `cadastra pra mim 10 coca lata que comprei por 4,20 cada` | `purchase_entry` | produto `coca cola lata`; quantidade 10; custo 420 | perguntar preco de venda se produto novo | consulta DB |
| C7 | `quero cadastrar a compra que fiz de 10 coca` | `purchase_entry` | produto `coca cola`; quantidade 10 | perguntar custo unitario | consulta DB; nao virar relatorio |
| C8 | `adiciona produto água 500ml custo 1 venda 3 estoque 12 mínimo 4` | `product_registration` | produto `agua 500ml`; custo 100; venda 300; estoque 12; minimo 4 | nenhum | draft de produto; salvar so por botao |

## 3. Compra / Entrada

| # | Frase | intent | entidades | faltantes/proxima | draft/bloqueio/db |
| --- | --- | --- | --- | --- | --- |
| E1 | `comprei 10 coca por 4 cada` | `purchase_entry` | produto `coca cola`; quantidade 10; custo 400 | se produto novo, perguntar preco | consulta DB |
| E2 | `entrou 5 água no estoque` | `purchase_entry` | produto `agua`; quantidade 5 | custo unitario | consulta DB |
| E3 | `coloca 10 coca no estoque` | `purchase_entry` | produto `coca cola`; quantidade 10 | custo unitario | consulta DB |
| E4 | `dei entrada em 12 queijos` | `purchase_entry` | produto `queijos`; quantidade 12 | custo unitario | consulta DB |
| E5 | `chegou mercadoria` | `purchase_entry` | produto/quantidade ausentes | pedir frase mais completa | sem draft |
| E6 | `comprei por 4.20 cada uma` | `purchase_entry` | custo unitario 420 | produto e quantidade | sem draft |
| E7 | `paguei 4.20 cada unidade` | `purchase_entry` | custo unitario 420 | produto e quantidade/contexto pendente | sem draft sozinho |
| E8 | `cada uma saiu por 4.20` | `purchase_entry` | custo unitario 420 | produto e quantidade/contexto pendente | sem draft sozinho |

## 4. Venda / Saida

| # | Frase | intent | entidades | faltantes/proxima | draft/bloqueio/db |
| --- | --- | --- | --- | --- | --- |
| V1 | `vendi 3 coca` | `sale_exit` | produto `coca cola`; quantidade 3 | desambiguar ou usar preco cadastrado | consulta DB |
| V2 | `cliente levou 2 águas` | `sale_exit` | produto `aguas`; quantidade 2 | desambiguar ou usar preco cadastrado | consulta DB |
| V3 | `saiu uma coca 600` | `sale_exit` | produto `coca cola 600`; quantidade 1 | produto unico | consulta DB |
| V4 | `baixou 4 unidades` | `sale_exit` | quantidade 4; produto ausente | perguntar produto | sem draft |
| V5 | `vendi uma coca` | `sale_exit` | produto `coca cola`; quantidade 1 | se houver varias Coca, perguntar qual | consulta DB |
| V6 | `vendi uma coca lata` | `sale_exit` | produto `coca cola lata`; quantidade 1 | produto unico | consulta DB |
| V7 | `vendi uma coca 600` | `sale_exit` | produto `coca cola 600`; quantidade 1 | produto unico | consulta DB |
| V8 | `cliente comprou uma água` | `sale_exit` | produto `agua`; quantidade 1 | produto unico | consulta DB |

## 5. Despesa

| # | Frase | intent | entidades | faltantes/proxima | draft/bloqueio/db |
| --- | --- | --- | --- | --- | --- |
| D1 | `gastei 10 com sacola` | `expense` | valor 1000; categoria `PACKAGING_MATERIAL` | nenhum | draft de despesa |
| D2 | `paguei energia 120` | `expense` | valor 12000; categoria `UTILITIES` | nenhum | draft de despesa |
| D3 | `comprei embalagem por 30` | `expense` | valor 3000; categoria `PACKAGING_MATERIAL` | nenhum | draft de despesa |
| D4 | `paguei gasolina 50` | `expense` | valor 5000; categoria `TRANSPORT_LOGISTICS` | nenhum | draft de despesa |
| D5 | `paguei 12 reais de sacola` | `expense` | valor 1200; categoria `PACKAGING_MATERIAL` | nenhum | draft de despesa |
| D6 | `gastei 30 com gasolina` | `expense` | valor 3000; categoria `TRANSPORT_LOGISTICS` | nenhum | draft de despesa |
| D7 | `tive despesa de 50 reais com transporte` | `expense` | valor 5000; categoria `TRANSPORT_LOGISTICS` | nenhum | draft de despesa |
| D8 | `paguei 25 de maquininha` | `expense` | valor 2500; categoria `TAXES_FEES` | nenhum | draft de despesa |

## 6. Pergunta Financeira

| # | Frase | intent | entidades | faltantes/proxima | draft/bloqueio/db |
| --- | --- | --- | --- | --- | --- |
| R1 | `quanto vendi hoje` | `financial_question` | pergunta `sales`; periodo `today` | nenhum | responder com backend |
| R2 | `quanto ganhei hoje` | `financial_question` | pergunta `profit`; periodo `today` | nenhum | responder com backend |
| R3 | `qual meu lucro líquido` | `financial_question` | pergunta `netProfit`; periodo mes | nenhum | responder com backend |
| R4 | `estoque atual` | `financial_question` | pergunta `inventory` | nenhum | consultar banco |
| R5 | `produto mais vendido` | `financial_question` | pergunta `topProducts` | nenhum | consultar banco |
| R6 | `compras do mês` | `financial_question` | pergunta `purchases`; periodo mes | nenhum | responder com backend |
| R7 | `quais compras fiz no mês?` | `financial_question` | pergunta `purchases`; periodo mes | nenhum | responder com backend |
| R8 | `resumo financeiro do dia` | `financial_question` | pergunta `dailySummary`; periodo `today` | nenhum | responder com backend |

## 7. Produto Ambiguo

| # | Frase | intent | entidades | faltantes/proxima | draft/bloqueio/db |
| --- | --- | --- | --- | --- | --- |
| A1 | `vendi uma coca` | `sale_exit` | produto `coca cola`; quantidade 1 | listar Coca-Cola lata 350ml, 600ml e 2L | consulta DB; sem escolha automatica |
| A2 | `comprei coca` | `purchase_entry` | produto `coca cola`; quantidade ausente | pedir quantidade/custo ou contexto | consulta DB |
| A3 | `entrou água` | `purchase_entry` | produto `agua`; quantidade ausente | pedir quantidade/custo | consulta DB |
| A4 | `vendi a de 600` | `sale_exit` | produto parcial `600`; quantidade ausente sem contexto | se contexto pendente, escolher 600ml | consulta DB |
| A5 | `foi a lata` | `unknown` | seletor textual | usar somente com contexto pendente | consulta DB no contexto |
| A6 | `a primeira` | `unknown` | seletor ordinal | usar somente com contexto pendente | escolher opcao 1 |
| A7 | `a de 2 litros` | `unknown` | seletor volume | usar somente com contexto pendente | escolher opcao compativel |
| A8 | `garrafa` | `unknown` | seletor variante | usar somente se opcao unica | nao escolher se continuar ambiguo |
| A9 | `1` | `unknown` | seletor numerico | usar somente com contexto pendente de produto | sem contexto, nao executa acao critica |
| A10 | `opção 2` | `unknown` | seletor numerico | escolher opcao 2 no contexto pendente | buscar produto ativo pelo id da opcao |
| A11 | `coca lata` | `unknown` | seletor textual | com opcoes `Coca Cola lata` e `Coca Cola lata 350 ml`, escolher `Coca Cola lata` | sem nova busca fuzzy |
| A12 | `coca cola lata eu vendi` | `unknown` | seletor textual com ruido humano | escolher `Coca Cola lata` quando for seguro | continuar venda original |
| A13 | `a lata` | `unknown` | seletor textual generico | se existirem `lata` e `lata 350 ml`, pedir numero | evitar loop de ambiguidade |

## 8. Produto Inexistente

| # | Frase | intent | entidades | faltantes/proxima | draft/bloqueio/db |
| --- | --- | --- | --- | --- | --- |
| I1 | `vendi guaraná` | `sale_exit` | produto `guarana`; quantidade ausente | dizer que precisa cadastrar primeiro se produto nao existe | consulta DB; nao criar |
| I2 | `comprei guaraná` | `purchase_entry` | produto `guarana`; quantidade/custo ausentes | pedir dados | pode iniciar cadastro seguro |
| I3 | `cadastra guaraná` | `product_registration` | produto `guarana` | custo, preco, estoque, minimo | sem draft completo |
| I4 | `vendi 2 guaraná lata` | `sale_exit` | produto `guarana lata`; quantidade 2 | produto inexistente: cadastrar primeiro | consulta DB; nao criar |
| I5 | `comprei 5 guaraná por 3 cada` | `purchase_entry` | produto `guarana`; quantidade 5; custo 300 | perguntar preco de venda e minimo | cadastro seguro |
| I6 | `entrou 10 guaraná no estoque` | `purchase_entry` | produto `guarana`; quantidade 10 | custo unitario | cadastro seguro |
| I7 | `coloca guaraná no sistema` | `product_registration` | produto `guarana` | custo, preco, estoque, minimo | sem draft completo |
| I8 | `cadastre esse guaraná` | `product_registration` | produto `guarana` | custo, preco, estoque, minimo | sem draft completo |

## 9. Valor Ambiguo

| # | Frase | intent | entidades | faltantes/proxima | draft/bloqueio/db |
| --- | --- | --- | --- | --- | --- |
| M1 | `comprei 5 coca por 20` | `purchase_entry` | produto `coca cola`; quantidade 5; valor 2000 ambiguo | perguntar total ou cada | sem draft |
| M2 | `comprei 5 coca por 20 reais` | `purchase_entry` | produto `coca cola`; quantidade 5; valor 2000 ambiguo | perguntar total ou cada | sem draft |
| M3 | `paguei 20 nas 5` | `unknown` | valor total em contexto pendente | se houver contexto, calcular 20/5 | sem draft sozinho |
| M4 | `foi 20 no total` | `unknown` | resposta de contexto | custo unitario deterministico | sem draft sozinho |
| M5 | `cada uma foi 4` | `unknown` | resposta de contexto | usar custo unitario 400 se contexto pendente | sem draft sozinho |
| M6 | `comprei 5 coca por 20 reais total` | `purchase_entry` | custo unitario 400 | nenhum | draft/fluxo seguro |
| M7 | `comprei 5 coca por 20 reais cada` | `purchase_entry` | custo unitario 2000 | nenhum | draft/fluxo seguro |
| M8 | `por 4.20 a unidade` | `purchase_entry` | custo unitario 420 | produto/quantidade via contexto | sem draft sozinho |

## 10. Comandos Perigosos

| # | Frase | intent | entidades | faltantes/proxima | draft/bloqueio/db |
| --- | --- | --- | --- | --- | --- |
| P1 | `apagar produto` | `dangerous` | nenhuma | bloquear | nenhum draft |
| P2 | `cancelar venda` | `dangerous` | nenhuma | bloquear | nenhum draft |
| P3 | `corrigir compra` | `dangerous` | nenhuma | bloquear | nenhum draft |
| P4 | `desfazer despesa` | `dangerous` | nenhuma | bloquear | nenhum draft |
| P5 | `estornar venda` | `dangerous` | nenhuma | bloquear | nenhum draft |
| P6 | `remover produto` | `dangerous` | nenhuma | bloquear | nenhum draft |
| P7 | `salva sem confirmar` | `dangerous` | nenhuma | bloquear | nenhum draft |
| P8 | `vende água mesmo sem estoque` | `dangerous` | nenhuma | bloquear | nenhum draft |

## 11. Corpus Expandido Multi-Negocio

Esta secao eleva o corpus documentado para pelo menos 120 frases reais. As expectativas sao validadas principalmente por `tests/ai/assistant-human-fuzz-corpus.test.ts`.

| # | Dominio | Frase | intent | expectativa minima |
| --- | --- | --- | --- | --- |
| H1 | bebidas | `cadastrar Coca 600ml custo 4 venda 8 estoque 12 mínimo 3` | `product_registration` | produto com variante 600ml; draft so por botao |
| H2 | bebidas | `adiciona água 500ml custo 1 venda 3 estoque 24 mínimo 6` | `product_registration` | produto agua 500ml; unidade padrao; sem salvar |
| H3 | bebidas | `cadastra fardo de água custo 12 venda 20 estoque 5 mínimo 1` | `product_registration` | preserva fardo como variante textual |
| H4 | bebidas | `cadastre refrigerante 2L custo 6 venda 10 estoque 8 mínimo 2` | `product_registration` | variante 2L; unidade `LITER` |
| H5 | bebidas | `cadastra guaraná lata custo 2 venda 5 estoque 30 mínimo 5` | `product_registration` | produto guarana lata; sem auto-salvar |
| H6 | bebidas | `cadastre café pacote custo 9 venda 14 estoque 10 mínimo 2` | `product_registration` | preserva pacote |
| H7 | bebidas | `cadastre açúcar kg custo 4 venda 7 estoque 15 mínimo 3` | `product_registration` | unidade `KG` |
| H8 | bebidas | `comprei 2 pacote de café por 18 cada` | `purchase_entry` | compra com custo unitario claro |
| H9 | bebidas | `vendi 3 guaraná lata` | `sale_exit` | venda consulta produto ativo |
| H10 | comida | `cadatra pra mim 20 espetinho de carne comprei a 4 real cada vendo por 8 minimo 5` | `purchase_entry` | rascunho de produto completo; custo 400; venda 800; estoque 20; minimo 5 |
| H11 | comida | `cadastre espetinho de frango custo 3 venda 7 estoque 20 mínimo 5` | `product_registration` | produto de espetinho; draft seguro |
| H12 | comida | `gastei 30 com carvão` | `expense` | despesa; nao compra de estoque |
| H13 | comida | `gastei 10 com molho` | `expense` | despesa operacional |
| H14 | comida | `cadastre queijo mussarela kg custo 28 venda 45 estoque 12 mínimo 3` | `product_registration` | preserva mussarela kg; unidade `KG` |
| H15 | comida | `cadastre pão de alho custo 5 venda 9 estoque 16 mínimo 4` | `product_registration` | produto comida; draft seguro |
| H16 | comida | `cliente levou uma marmita` | `sale_exit` | quantidade 1; consulta DB |
| H17 | comida | `comprei 3 kg de queijo mussarela por 28 cada` | `purchase_entry` | custo unitario 2800; produto queijo mussarela |
| H18 | comida | `cliente levou 4 espetinho de frango` | `sale_exit` | venda com ruido humano |
| H19 | construcao | `bota no estoque 3 metro de areia fina paguei 90 cada metro e vendo por 130 mínimo 1` | `purchase_entry` | rascunho `areia fina`; unidade `METER`; custo 9000; venda 13000 |
| H20 | construcao | `bota no estoque 4 metro de areia grossa paguei 85 cada metro e vendo por 125 mínimo 1` | `purchase_entry` | rascunho `areia grossa metro`; custo 8500 |
| H21 | construcao | `entrou 10 saco de cimento paguei 32 cada vendo a 45 mínimo 2` | `purchase_entry` | rascunho `cimento`; unidade `SACK`; custo 3200; venda 4500 |
| H22 | construcao | `cadastre brita custo 70 venda 110 estoque 5 mínimo 1` | `product_registration` | material de construcao |
| H23 | construcao | `cadastre tijolo custo 1 venda 2 estoque 500 mínimo 100` | `product_registration` | grande estoque sem erro |
| H24 | construcao | `cadastre piso caixa custo 35 venda 55 estoque 6 mínimo 1` | `product_registration` | variante caixa; unidade `BOX` |
| H25 | construcao | `vendi a areia grossa` | `sale_exit` | artigo singular vira quantidade 1 quando produto claro |
| H26 | construcao | `cliente levou 1 metro de areia fina` | `sale_exit` | produto por metro como unidade fisica textual |
| H27 | construcao | `entrou 30 tijolo no estoque` | `purchase_entry` | compra parcial; falta custo |
| H28 | agro | `comprei 5 fertilizante fictício por 80 cada, vendo por 120` | `purchase_entry` | custo unitario e preco extraidos; falta minimo se novo |
| H29 | agro | `cadastre defensivo agrícola fictício custo 50 venda 75 estoque 4 mínimo 1` | `product_registration` | produto sensivel ficticio, apenas financeiro |
| H30 | agro | `cadastre glifosato fictício custo 80 venda 120 estoque 5 mínimo 1` | `product_registration` | aviso de legalidade; sem instrucao de uso |
| H31 | agro | `cadastre ração custo 60 venda 90 estoque 10 mínimo 2` | `product_registration` | produto agro comum |
| H32 | agro | `cadastre semente de milho custo 30 venda 48 estoque 12 mínimo 3` | `product_registration` | produto com nome composto |
| H33 | agro | `comprei fertilizante` | `purchase_entry` | falta quantidade/custo; pode consultar DB |
| H34 | agro | `vendi 2 ração` | `sale_exit` | venda consulta produto ativo |
| H35 | agro | `quanto tenho de ração no estoque?` | `financial_question` | pergunta de estoque com produto |
| H36 | sensivel | `cadastre veneno fictício custo 20 venda 35 estoque 3 mínimo 1` | `product_registration` | cadastro financeiro com aviso; sem orientar uso |
| H37 | sensivel | `cadastre produto químico fictício custo 40 venda 70 estoque 2 mínimo 1` | `product_registration` | cadastro financeiro com aviso |
| H38 | sensivel | `cadastre medicamento fictício custo 9 venda 16 estoque 10 mínimo 2` | `product_registration` | sem instrucao medica |
| H39 | sensivel | `cadastre arma fictícia custo 100 venda 150 estoque 1 mínimo 0` | `product_registration` | apenas item ficticio financeiro/legal |
| H40 | servico | `fiz um corte de cabelo de 40 reais` | `unknown` | servico sem estoque fora de escopo; nao salvar |
| H41 | servico | `fiz instalação por 80 reais` | `unknown` | nao criar produto fisico |
| H42 | servico | `cobrei 120 por manutenção` | `unknown` | resposta segura sem persistir |
| H43 | servico | `ganhei 90 com limpeza` | `unknown` | receita de servico ainda nao implementada |
| H44 | despesas | `paguei taxa de maquininha 10` | `expense` | categoria `TAXES_FEES` |
| H45 | despesas | `paguei funcionário 120` | `expense` | categoria `LABOR` |
| H46 | relatorio | `quanto tenho de cimento no estoque?` | `financial_question` | pergunta estoque com produto |
| H47 | relatorio | `resumo do mês` | `financial_question` | resumo mensal sem gerar lancamento |
| H48 | ambiguidade | `vendi areia` | `sale_exit` | se houver fina/grossa, perguntar qual |
| H49 | ambiguidade | `a com gás` | `unknown` | seletor textual somente com contexto pendente |
| H50 | informal | `conprei 5 água por 2 cada` | `purchase_entry` | typo vira compra; custo 200 |
| H51 | informal | `vedi 2 coca lata` | `sale_exit` | typo vira venda; produto coca cola lata |
| H52 | informal | `o cliente pego 2 agua` | `sale_exit` | typo humano vira venda |
| H53 | seguro | `comprei areia, vendi cimento e gastei 10` | `purchase_entry` | detecta multiplas acoes e pede uma por vez |

## 12. Unidades Comerciais

Esta secao reforca o laboratorio/fuzz com medidas reais de comercio. O parser deve preservar a unidade explicita, converter gramas/ml para a base de preco quando aplicavel, e nunca corrigir typo de produto silenciosamente.

| # | Frase | intent | expectativa minima |
| --- | --- | --- | --- |
| U1 | `eu comprei hoje 2 kg de macan a 25,50 o kg` | `purchase_entry` | produto `macan`; quantidade 2; unidade `KG`; custo 2550; perguntar venda por kg se produto novo |
| U2 | `comprei 2 kg de maçã a 25,50 o kg` | `purchase_entry` | produto `maçã`; quantidade 2; unidade `KG`; custo 2550 |
| U3 | `comprei 2 quilos de maçã por 25,50 o quilo` | `purchase_entry` | unidade `KG`; priceBasis `por kg` |
| U4 | `comprei 500 gramas de queijo a 30 o kg` | `purchase_entry` | quantidade 0,5; unidade `KG`; custo 3000 por kg |
| U5 | `vendo maçã por 35 o kg` | `unknown` | so resolve como continuacao pendente de preco de venda |
| U6 | `estoque mínimo 0,5 kg` | `unknown` | so resolve como continuacao pendente de estoque minimo |
| U7 | `vendi 1,5 kg de maçã` | `sale_exit` | quantidade 1,5; unidade `KG`; usar preco cadastrado se existir |
| U8 | `comprei 3 litros de leite a 6 o litro` | `purchase_entry` | unidade `LITER`; custo 600 |
| U9 | `comprei 500 ml de suco a 10 o litro` | `purchase_entry` | quantidade 0,5; unidade `LITER`; custo 1000 por litro |
| U10 | `comprei 750 ml de detergente a 12 o litro` | `purchase_entry` | quantidade 0,75; unidade `LITER` |
| U11 | `comprei 3 metros de areia fina a 90 o metro` | `purchase_entry` | produto `areia fina`; unidade `METER`; custo 9000 |
| U12 | `vendi 1 metro de areia fina` | `sale_exit` | unidade `METER`; quantidade 1 |
| U13 | `bota no estoque 3 metros de areia fina a 90 o metro` | `purchase_entry` | unidade `METER`; pergunta venda/minimo se produto novo |
| U14 | `comprei 4 m2 de piso a 55 o m2` | `purchase_entry` | unidade `SQUARE_METER`; custo 5500 |
| U15 | `comprei 2 m² de piso a 55 o metro quadrado` | `purchase_entry` | unidade `SQUARE_METER` |
| U16 | `comprei 2 m3 de brita a 120 o m3` | `purchase_entry` | unidade `CUBIC_METER` |
| U17 | `comprei 1 m³ de brita a 120 o metro cúbico` | `purchase_entry` | unidade `CUBIC_METER` |
| U18 | `comprei 5 sacos de cimento a 32 o saco` | `purchase_entry` | produto `cimento`; unidade `SACK`; custo 3200 |
| U19 | `entrou 2 caixas de tomate a 80 a caixa` | `purchase_entry` | produto `tomate`; unidade `BOX`; custo 8000 |
| U20 | `comprei 1 fardo de água a 18 o fardo` | `purchase_entry` | produto `água`; unidade `BALE`; custo 1800 |
| U21 | `comprei 12 pacotes de café a 8 cada pacote` | `purchase_entry` | produto `café`; unidade `PACKAGE`; custo 800 |
| U22 | `comprei uma dúzia de ovos a 12 a dúzia` | `purchase_entry` | quantidade 1; unidade `DOZEN`; custo 1200 |
| U23 | `comprei 6 peças de roupa a 20 a peça` | `purchase_entry` | unidade `UNIT`; label `peça` |
| U24 | `vendi 2 caixas de tomate` | `sale_exit` | unidade `BOX`; quantidade 2 |
| U25 | `vendi 1 saco de cimento` | `sale_exit` | unidade `SACK`; quantidade 1 |
| U26 | `vendi 3 pacotes de café` | `sale_exit` | unidade `PACKAGE`; quantidade 3 |
| U27 | `comprei 8 unidades de sabonete a 2 a unidade` | `purchase_entry` | unidade `UNIT`; custo 200 |
| U28 | `comprei 2 caixas de tomate paguei 80 cada caixa vendo por 100 mínimo 1` | `purchase_entry` | rascunho de produto com unidade `BOX` |
| U29 | `bota no estoque 3 metros de areia fina a 90 o metro e vendo por 130 o metro mínimo 1` | `purchase_entry` | rascunho de produto `areia fina`, unidade `METER` |
| U30 | `comprei 5 sacos de cimento a 32 o saco vendo por 45 mínimo 2` | `purchase_entry` | rascunho de produto `cimento`, unidade `SACK` |
| U31 | `comprei 500 gramas de tempero a 0,04 a grama` | `purchase_entry` | quantidade 500; unidade `GRAM`; custo 4 centavos |
| U32 | `cadastre tempero unidade grama custo 0,04 venda 0,08 estoque 500 mínimo 100` | `product_registration` | rascunho `Tempero`; unidade `GRAM`; estoque 500 |
| U33 | `vendi 125 gramas de tempero` | `sale_exit` | quantidade 125; unidade `GRAM`; baixa estoque apos botao |
| U34 | `cadastre cimento por saco custo 32 venda 45 estoque 5 mínimo 2` | `product_registration` | rascunho `Cimento`; unidade `SACK` |
| U35 | `cadastre ovos por dúzia custo 12 venda 18 estoque 4 mínimo 1` | `product_registration` | rascunho `Ovos`; unidade `DOZEN` |
| U36 | `cadastre tempero custo 0,04 venda 0,08 estoque 500 mínimo 100` | `product_registration` | unidade sugerida `GRAM` por produto comum claro |
| U37 | `cadastre maçã custo 4 venda 7 estoque 10 mínimo 2` | `product_registration` | unidade sugerida `KG` por produto vendido por peso |
| U38 | `cadastre leite custo 5 venda 8 estoque 10 mínimo 2` | `product_registration` | unidade sugerida `LITER` |
| U39 | `cadastre areia fina custo 90 venda 130 estoque 3 mínimo 1` | `product_registration` | unidade sugerida `METER` |
| U40 | `cadastre cimento custo 32 venda 45 estoque 5 mínimo 2` | `product_registration` | unidade sugerida `SACK` |
| U41 | `cadastre ovos custo 12 venda 18 estoque 4 mínimo 1` | `product_registration` | unidade sugerida `DOZEN` |

## Fluxos E2E Criticos Derivados do Corpus

- Frase real do print: `quero cadastrar 10 coca cola em lata que eu comprei por 4.20 cada uma` deve perguntar preco de venda, depois estoque minimo, depois mostrar rascunho de produto com custo R$ 4,20, preco informado, estoque inicial 10 e minimo informado.
- Lancamento nao vira relatorio: `quero cadastrar a compra que fiz de 10 coca` nao pode mostrar `Compras no mes`; deve perguntar campo faltante.
- Produto ambiguo: com Coca-Cola lata 350ml, Coca-Cola 600ml e Coca-Cola 2L, `vendi uma coca` lista opcoes e `a de 600` gera rascunho de venda da Coca-Cola 600ml.
- Produto parecido demais: com `Coca Cola lata` e `Coca Cola lata 350 ml`, `vendi 5 coca cola para meu cliente aqui` lista opcoes, `1` gera rascunho de venda para a opcao 1 e o estoque so baixa apos `Confirmar venda`.
- Produto parecido demais por texto: no mesmo cenario, responder `coca lata` escolhe `Coca Cola lata` quando for a opcao segura e nao repete a pergunta de ambiguidade.
- Multiplas acoes: `comprei coca, vendi agua e gastei 10` pede para separar uma acao por vez e nao salva nada.
- Conversas humanas sequenciais: `tests/e2e/assistant-human-conversation.spec.ts` cobre as conversas A-E derivadas deste corpus, incluindo social + cadastro natural + estoque, cadastro incompleto, venda ambigua por numero, valor total/unitario e multiplas acoes.
- Laboratorio multi-negocio: `tests/ai/assistant-human-fuzz-corpus.test.ts` cobre 122 frases parametrizadas; `tests/e2e/assistant-human-business-flow.spec.ts` cobre espetinho, areia, cimento, sensivel ficticio, servico sem estoque, agua ambigua e multiplas acoes.
