# Regras Invariantes do NEXIS

Ultima atualizacao: 2026-05-28

Este arquivo descreve o que nao pode acontecer no NEXIS, mesmo quando a implementacao, a interface ou o provider de IA mudarem. Antes de alterar codigo, testes, docs, prompts, schemas, banco ou fluxos do assistant, leia este arquivo junto com `AGENTS.md`, `docs/PROJECT_STATE.md`, `docs/AI_OPERATING_RULES.md` e `docs/ACCEPTANCE_CRITERIA.md`.

## Regra Central

A IA interpreta a frase e monta rascunho. O backend valida, calcula e salva somente apos confirmacao explicita do usuario. A IA nao pode ser fonte de verdade financeira.

## O Que Nao Pode Acontecer

- A IA nao pode salvar produto, compra, venda, estoque, despesa, perda, cancelamento, correcao ou configuracao critica sem botao/acao explicita de confirmacao.
- A IA nao pode calcular lucro, faturamento, custo, estoque, despesa ou margem como fonte final; esses numeros devem vir de codigo deterministico e banco real.
- A IA nao pode inventar produto, custo, preco, quantidade, estoque inicial, estoque minimo, lucro ou despesa.
- Produto inexistente em venda nao pode virar venda registrada nem produto criado automaticamente.
- Produto ambiguo nao pode ser escolhido por palpite; o sistema deve perguntar e listar opcoes.
- Venda nao pode baixar estoque antes da confirmacao.
- Compra nao pode aumentar estoque antes da confirmacao.
- Despesa nao pode entrar no lucro liquido antes da confirmacao quando o fluxo exigir revisao.
- Perda/quebra/desperdicio so pode baixar estoque por fluxo proprio rastreavel, validado no backend e confirmado pelo usuario.
- Cancelamento/correcao/estorno nao pode apagar dados; deve registrar evento rastreavel, recalcular impactos por codigo e exigir confirmacao.
- Audio, STT ou resposta textual como `sim`, `ok`, `pode salvar` nao pode substituir o botao de confirmacao.
- Prompt, modelo externo ou provider gratuito nao pode sobrepor validacao Zod, regras financeiras ou persistencia server-side.
- Erro tecnico cru nao deve ser exposto ao usuario leigo quando houver resposta segura possivel.
- Dados reais de cliente, `.env`, tokens, cookies, API keys, bancos locais e credenciais nao podem ser versionados nem transcritos.

## Invariantes Financeiras

- `faturamento = soma das vendas confirmadas`.
- `custo_das_vendas = quantidade_vendida * unitCostSnapshotCents`.
- `lucro_bruto = faturamento - custo_das_vendas`.
- `lucro_liquido = lucro_bruto - despesas_confirmadas`.
- Compra confirmada aumenta estoque e registra movimento.
- Venda confirmada reduz estoque, grava snapshot de custo e registra movimento.
- Produto abaixo do estoque minimo aparece como estoque baixo.
- Estoque, custo e lucro devem ser recalculaveis a partir dos registros persistidos.

## Invariantes do Assistant

- Texto livre pode gerar rascunho, pergunta de campo faltante, pergunta de desambiguacao, resposta financeira deterministica ou bloqueio seguro.
- Cadastro de produto precisa de nome, unidade, custo, preco de venda, estoque inicial e estoque minimo, salvo quando houver regra explicita documentada.
- Caixa, fardo, pacote, bandeja e cartela devem ser tratados por regras genericas de embalagem e unidades internas, sem regra por marca/produto/frase literal.
- `ml` em produto unitario, como `350 ml` ou `500 ml`, deve permanecer no nome/variante do produto quando a venda for por unidade.
- `kg`, `grama` e `litro` devem ser tratados como unidade operacional quando a compra/venda for por medida.
- Frase com pacote ambiguo deve perguntar se o usuario vende o pacote fechado ou cada item separado.
- Frase com varias acoes deve pedir uma acao por vez.
- Perguntas de estoque, vendas, compras, despesas e lucro devem consultar banco/backend deterministico.
- Servico sem estoque deve bloquear de forma clara enquanto nao houver fluxo seguro.
- Perda/quebra e cancelamento/correcao devem usar fluxo rastreavel; se o alvo estiver ambiguo, inexistente ou inseguro, devem bloquear sem alterar dados.

## Invariantes de Implementacao

- Trabalhe somente dentro do diretorio do NEXIS, salvo instrucao explicita posterior do usuario.
- Prefira mudancas pequenas, revisaveis e alinhadas ao MVP.
- Use funcoes pequenas e puras para normalizacao, dinheiro, unidades, embalagem e nome de produto quando isso reduzir risco.
- Validacoes criticas ficam estruturadas com Zod ou codigo deterministico equivalente.
- O fallback rule-based deve continuar seguro com IA externa desligada.
- Nao coloque regra financeira dentro de prompt.
- Nao crie hardcode para Coca-Cola, agua, marca, produto especifico ou frase literal da bateria minima.
- Testes devem variar produto, marca, ordem da frase e unidade quando cobrirem linguagem natural.

## Invariantes de Qualidade

Antes de declarar uma etapa pronta, rode e registre resultados reais dos comandos relevantes. No minimo, quando houver mudanca em assistant, regras financeiras, Prisma, UI critica ou docs de aceite, tente:

```bash
npx prisma validate
npx prisma generate
npm run lint
npm run typecheck
npm run test
npm run build
git diff --check
```

Quando o fluxo de UI/assistant for alterado, tambem rode E2E relevante:

```bash
npm run verify:e2e
```

Se algum comando falhar, registre o erro real em `docs/PROJECT_STATE.md`. Nunca invente resultado de teste.
