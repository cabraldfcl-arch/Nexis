# Auditoria de Conversas Humanas do Assistant

Ultima atualizacao: 2026-05-28

Objetivo: reproduzir conversas humanas simuladas do assistant NEXIS, com foco em contexto pendente, desambiguacao de produto, linguagem natural e continuidade da intencao original. Todos os exemplos usam dados ficticios.

## Diagnostico Principal

Bug reproduzido por analise de codigo: em contexto de produto ambiguo, o assistant podia aceitar a resposta do usuario, transformar a opcao escolhida em nome e chamar novamente a resolucao aproximada. Com produtos como `Coca Cola lata` e `Coca Cola lata 350 ml`, a escolha `1` virava `Coca Cola lata`, mas a busca fuzzy ainda encontrava os dois produtos e repetia a pergunta.

Correcao aplicada:

- o `pendingContext` de produto ambiguo guarda opcoes com `id` e nome;
- a resposta seguinte e interpretada primeiro como escolha pendente;
- escolha valida busca o produto ativo por `id`;
- venda/compra continua com a quantidade e preco/custo originais;
- se a resposta continuar ambigua, o assistant pede o numero em vez de reiniciar a ambiguidade.

## Conversas Simuladas

| Perfil | Entrada do usuario | Resposta esperada | Resposta atual apos correcao | Status | Causa provavel antes | Correcao aplicada |
| --- | --- | --- | --- | --- | --- | --- |
| Usuario direto | `vendi 5 coca` com varias Cocas | Perguntar qual produto e guardar quantidade 5 | Pergunta produto ambiguo com lista numerada | Passou | busca aproximada acha varios produtos | contexto guarda opcoes e intencao |
| Usuario humano natural | `vendi 5 coca cola para meu cliente aqui` | Perguntar qual Coca, sem incluir `cliente aqui` no produto | Pergunta produto ambiguo para `Coca Cola` | Passou | ruido de frase podia entrar no nome | limpeza remove trecho de cliente |
| Resposta numerica | `1` apos lista `Coca Cola lata` / `Coca Cola lata 350 ml` | Gerar rascunho de venda para opcao 1 | Gera rascunho para `Coca Cola lata` | Passou | escolha era reprocessada por nome fuzzy | resolvedor usa `id` da opcao |
| Resposta por nome | `coca lata` apos lista parecida | Escolher `Coca Cola lata` quando for a opcao segura | Escolhe produto mais especifico/curto seguro | Passou | texto batia nos dois produtos | ranking por tokens e menor extra |
| Resposta por variante | `a de 600` apos lista 350ml/600ml/2L | Escolher `Coca-Cola 600ml` | Gera rascunho para `Coca-Cola 600ml` | Passou | ja existia cobertura parcial | centralizado em resolvedor puro |
| Resposta informal | `essa mesmo` sem opcao destacada | Nao escolher sozinho; pedir numero | Pede numero quando nao ha seguranca | Passou | confirmacao generica podia ser insegura | confirmacao generica so e aceita com seguranca |
| Resposta ordinal | `a primeira` | Escolher opcao 1 | Escolhe opcao 1 | Passou | ordinal precisava estar preso ao contexto | resolvedor de ordinal no contexto |
| Resposta textual ambigua | `a lata` com `lata` e `lata 350 ml` | Pedir numero | Pede numero em modo seguro | Passou | trecho curto bate nos dois produtos | protecao para token unico generico |
| Cadastro novo | `quero cadastrar 10 coca cola em lata que comprei por 4.20 cada` | Perguntar preco de venda, depois minimo | Fluxo ja coberto pelo motor v2 | Passou | custo podia ser ignorado em frase natural | corpus e parser de custo unitario |
| Multiplas acoes | `comprei coca, vendi água e gastei 10` | Pedir uma acao por vez; nada salvo | Pede compra, venda ou despesa | Passou | risco de executar varias acoes | `detectMultipleActions` |
| Social | `olá boa tarde` | Resposta social util | Responde sem draft nem relatorio | Passou | risco de cair em relatorio | prioridade social antes de pergunta |
| Social | `tudo bem?` | Resposta social util | Responde sem draft nem relatorio | Passou | risco de resposta seca/generica | respostas sociais dedicadas |
| Social | `você pode me ajudar?` | Explicar capacidades do NEXIS | Responde com usos principais | Passou | social precisava cobrir ajuda | classificador social ampliado |
| Produto inexistente | `vendi guaraná` | Nao cadastrar; pedir cadastro primeiro | Bloqueia venda sem produto ativo | Passou | venda de inexistente poderia virar cadastro | venda exige produto ativo existente |

## Evidencia Automatizada

- Unitario: `tests/ai/product-disambiguation.test.ts` cobre escolha por `1`, `2`, `a primeira`, `a de 600`, `350 ml`, `coca lata`, `coca cola lata eu vendi`, ambiguidade persistente e `1` sem contexto.
- Parser: `tests/ai/parse-message.test.ts` cobre `vendi 5 coca cola para meu cliente aqui` como venda de `coca cola` com quantidade 5.
- E2E demo: `tests/e2e/ai-demo-flow.spec.ts` cobre venda ambigua com resposta `1`, venda ambigua com resposta `coca lata` e venda ambigua com resposta `a de 600`.
- E2E humano: `tests/e2e/assistant-human-conversation.spec.ts` cobre conversas sequenciais A-E: social + cadastro natural + consulta de estoque, produto incompleto + rascunho completo por botao, venda ambigua por numero, valor total/unitario e multiplas acoes sem salvar.

Validacao direcionada desta auditoria:

- `npx vitest run tests/ai/product-disambiguation.test.ts tests/ai/parse-message.test.ts`: passou com 2 arquivos e 40 testes.
- `npx playwright test tests/e2e/assistant-human-conversation.spec.ts`: passou com 5 testes mobile Chromium.

## Resultado

O loop de ambiguidade observado no teste manual foi corrigido e agora esta preso por unitarios e por uma suite E2E de conversa humana. A selecao valida nao reinicia a classificacao como mensagem nova e nao volta a escolher por nome aproximado. Nenhum fluxo salva ou baixa estoque sem botao de confirmacao.

## Rodada Multi-Negocio - 2026-05-25

| Perfil | Entrada simulada | Resposta esperada | Resultado atual | Causa/correcao |
| --- | --- | --- | --- | --- |
| Espetinho | `cadatra pra mim 20 espetinho de carne comprei a 4 real cada vendo por 8 minimo 5` | rascunho de produto completo | passou no E2E | normalizacao de typo + parser de entrada completa |
| Areia fina | `bota no estoque 3 metro de areia fina paguei 90 cada metro e vendo por 130 mínimo 1` | rascunho `areia fina metro` | passou no E2E | parser aceita `bota no estoque` e normaliza `metro de` |
| Areia grossa | `vendi a areia grossa` | rascunho da areia grossa | passou no E2E | venda singular por artigo com produto claro |
| Cimento | `comprei 5 saco de cimento por 160` + `foi 160 no total` | perguntar total/unitario e calcular R$ 32,00 | passou no E2E | custo unitario derivado deterministicamente |
| Sensivel ficticio | `cadastre glifosato fictício custo 80 venda 120 estoque 5 mínimo 1` | rascunho com aviso legal, sem instrucao de uso | passou no E2E | aviso no rascunho de produto sensivel |
| Servico | `fiz um corte de cabelo de 40 reais` | fora de escopo seguro | passou no E2E | resposta de servico sem estoque |
| Agua ambigua | `vendi uma água` + `a com gás` | pedir qual agua e escolher Agua com gas | passou no E2E | resolvedor textual funciona fora de Coca-Cola |
| Multiplas acoes | `comprei areia, vendi cimento e gastei 10` | pedir uma acao por vez | passou no E2E | `detectMultipleActions` mantido como bloqueio seguro |

Nova evidencia direcionada:

- `npx vitest run tests/ai/assistant-human-fuzz-corpus.test.ts`: passou com 132 testes.
- `npx playwright test tests/e2e/assistant-human-business-flow.spec.ts`: passou com 7 testes mobile Chromium.

## Rodada Invariantes e Contexto Pendente - 2026-05-28

Falha reproduzida no E2E ampliado: depois de o usuario enviar `comprei uma caixa com 12 coca lata 350 por 37 reais`, o assistant perguntava preco de venda para cadastrar produto novo. Se a proxima mensagem fosse uma nova acao, como `gastei 37 reais com sacolinha e embalagem`, o contexto pendente consumia o valor como preco de venda do produto e perguntava estoque minimo. Isso era inseguro porque uma despesa real deixava de virar rascunho de despesa.

Correcao aplicada:

- `app/assistant/actions.ts` passou a reclassificar a proxima mensagem antes de consumir contexto pendente;
- nova intencao clara volta ao parser normal;
- resposta curta de custo, como `paguei 3 reais`, continua podendo completar custo pendente;
- o E2E obrigatorio agora manda a mensagem no chat, observa o card, confirma somente quando correto e confere o banco temporario.

Evidencia:

- `npx playwright test tests/e2e/assistant-required-business-scenarios.spec.ts`: passou com 4 testes mobile Chromium.
- `npm run verify:e2e`: passou com 42 testes mobile Chromium.
