# Roadmap de Correcao para MVP Operacional

Ultima atualizacao: 2026-05-25

Este documento substitui os planos e auditorias historicas. Ele descreve somente o que falta fazer a partir do estado atual do codigo.

## Principios

- Calculos financeiros sempre deterministas.
- IA interpreta, pergunta e cria rascunho; nao grava sozinha.
- Nenhuma acao critica sem confirmacao explicita.
- Fluxos pequenos, testaveis e mobile-first.
- SQLite continua local/demo; producao real exige banco persistente.

## Referencias de Produto

Pro-labore, despesas fixas e fluxo de caixa devem seguir uma logica simples de educacao financeira:

- separar dinheiro da empresa e dinheiro pessoal;
- tratar pro-labore como retirada planejada do dono;
- acompanhar despesas fixas, vendas, estoque e retiradas para saber lucro/prejuizo;
- usar fluxo de caixa para prever compromissos e necessidade de capital;
- nao transformar recorrencia planejada em despesa paga sem confirmacao.

Referencias usadas:

- Sebrae, separacao entre financas pessoais e empresa: https://sebrae.com.br/sites/PortalSebrae/ufs/pe/artigos/como-separar-as-financas-pessoais-das-contas-da-empresa-8-dicas%2C6f0ad38b1525a810VgnVCM1000001b00320aRCRD
- Sebrae, MEI e pro-labore: https://sebrae.com.br/sites/PortalSebrae/artigos/mei-como-definir-seu-pro-labore%2Ce1178222a9663810VgnVCM100000d701210aRCRD
- Sebrae, lucro ou prejuizo: https://sebrae.com.br/sites/PortalSebrae/ufs/mg/artigos/saiba-como-avaliar-se-sua-empresa-esta-dando-lucro-ou-prejuizo%2C21cc91c67982e410VgnVCM1000003b74010aRCRD
- Sebrae, fluxo de caixa: https://sebrae.com.br/sites/PortalSebrae/artigos/artigoshome/fluxo-de-caixa-o-que-e-e-como-implantar%2Cb29e438af1c92410VgnVCM100000b272010aRCRD
- Caixa, planejamento de saidas: https://www.caixa.gov.br/educacao-financeira/empresa/planeje-as-saidas/Paginas/default.aspx
- Caixa, capital de giro: https://www.caixa.gov.br/educacao-financeira/empresa/capital-de-giro/Paginas/default.aspx

## Etapa 0 - Lentidao dos Botoes

Status: implementada em 2026-05-25.

Problema: o usuario relatou que botoes demoram para abrir telas.

Hipoteses no codigo atual:

- paginas principais sao dinamicas e consultam Prisma antes de renderizar;
- `/products`, `/sales`, `/purchases` e `/expenses` carregam listas no servidor;
- `next dev` compila rotas sob demanda no primeiro clique;
- nao ha feedback de loading por rota.

Como fazer:

1. Medir clique em `npm run dev`.
2. Rodar `npm run build` e medir em `next start`.
3. Separar tempo de compilacao, consulta Prisma e renderizacao.
4. Criar `loading.tsx` nas rotas principais.
5. Limitar/paginar listas recentes.
6. Avaliar prefetch dos links principais.

Aceite:

- rota abre rapido em producao local com banco pequeno;
- usuario ve feedback imediato;
- E2E mobile continua passando.

Resultado implementado:

- rotas principais ganharam `loading.tsx`;
- `RouteLoading` centraliza feedback acessivel com `role="status"`, `aria-live="polite"` e `aria-busy="true"`;
- dashboard manteve botoes grandes e ganhou `touch-manipulation`, estado `active` e `prefetch`;
- produtos passaram a carregar ate 50 itens na lista inicial;
- vendas/compras/despesas mantiveram limites de 20/20/30 e agora mostram esse limite na UI;
- producao local apos build ficou abaixo de 0,51s no primeiro acesso das rotas medidas e abaixo de 0,054s no segundo acesso.

## Etapa 1 - Assistant e Perguntas Financeiras

Status: implementada em 2026-05-25.

Problemas atuais:

- intents sao limitadas a `sales`, `profit`, `expenses` e `lowStock`;
- lucro bruto e liquido nao sao intents separados;
- estoque atual, compras do dia, produtos mais vendidos e resumo diario nao existem no assistant;
- textos de cadastro/cancelamento podem ser interpretados de forma errada se nao forem bloqueados.

Como fazer:

1. Expandir intents para `grossProfit`, `netProfit`, `dailySummary`, `inventory`, `purchases`, `topProducts` e `cashFlow`.
2. Tratar `hoje`, `dia`, `do dia` e `nesse dia` como periodo `today`.
3. Bloquear `cancelar`, `corrigir`, `estornar`, `desfazer`, `apagar` ate existir fluxo seguro.
4. Criar testes para cada frase critica.
5. Responder somente quando houver carregador deterministico para a pergunta.

Aceite:

- perguntas basicas usam dados reais;
- comandos perigosos nao viram relatorio indevido;
- o assistant diz claramente quando a consulta ainda nao existe.

Resultado implementado:

- intents expandidas para `grossProfit`, `netProfit`, `dailySummary`, `inventory`, `purchases`, `topProducts` e `cashFlow`;
- `cashFlow` fica bloqueado com resposta segura: `Ainda não tenho essa consulta implementada com segurança.`;
- expressoes `hoje`, `dia`, `do dia`, `nesse dia`, `este mês`, `mês`, `no mês` e `mês atual` direcionam periodo `today` ou `month`;
- perguntas de estoque podem consultar produto especifico por nome aproximado, sempre usando dados do backend;
- comandos `cancelar`, `corrigir`, `estornar`, `desfazer`, `apagar`, `excluir`, `deletar` e `remover` sao bloqueados antes de virarem relatorio ou rascunho.

## Etapa 2 - Relatorios Deterministicos Faltantes

Status: implementada parcialmente em 2026-05-25. Estoque, compras, produtos mais vendidos, resumo diario e lucro bruto/liquido foram implementados; fluxo de caixa projetado continua pendente.

Como fazer:

1. Criar funcoes puras para:
   - produtos mais vendidos por quantidade e faturamento;
   - estoque atual por produto;
   - compras por periodo;
   - resumo diario completo;
   - fluxo de caixa simples futuro.
2. Criar carregadores Prisma em `lib/reports/` ou `lib/dashboard/`.
3. Conectar respostas do assistant a esses carregadores.
4. Cobrir com testes unitarios e E2E texto-only.

Aceite:

- `Quais produtos venderam mais?` usa `SaleItem`;
- `Qual meu estoque atual?` usa `Product.currentStock`;
- `O que comprei hoje?` usa `Purchase`;
- `Resumo financeiro do dia` bate com formulas deterministicas.

Resultado implementado:

- `lib/finance/reports.ts` agora tem funcoes puras para estoque atual, compras por periodo e produtos mais vendidos por periodo;
- `lib/reports/assistant-question.ts` carrega dados reais de `Product`, `Purchase` e `SaleItem` para o assistant;
- respostas do assistant separam lucro bruto e lucro liquido e explicam a diferenca em linguagem simples;
- resumo diario combina vendas, custo, lucro bruto, despesas confirmadas, lucro liquido, compras, despesas pendentes e estoque baixo quando disponivel;
- nenhuma pergunta nova grava venda, compra, despesa, produto, estoque, cancelamento ou correcao.

## Etapa 3 - Cadastro de Produto por IA

Status: implementada em 2026-05-25.

Como fazer:

1. Criar intent `product_draft`.
2. Criar schema Zod para produto: nome, categoria, unidade, custo, preco, estoque inicial e estoque minimo.
3. Perguntar campos obrigatorios faltantes.
4. Detectar duplicado por nome normalizado.
5. Confirmar antes de gravar.
6. Reusar regra de `createProductAction`, incluindo `StockMovement ADJUSTMENT` para estoque inicial.

Aceite:

- `Cadastrar produto refrigerante` pergunta o que falta;
- `Cadastrar Coca lata custo 3 venda 6 estoque 20 mínimo 5` gera rascunho;
- frase sem estoque minimo pergunta o campo faltante;
- duplicado nao e criado sem aviso;
- preco negativo, estoque negativo e quantidade zero bloqueiam.

Resultado implementado:

- intent interna `product` e contrato externo `product_draft` geram rascunho validado;
- frases completas criam card de revisao com botao `Salvar produto`;
- frases incompletas pedem custo, preco de venda, estoque inicial e estoque minimo sem chute;
- cadastro manual e assistant compartilham `lib/products/create-product.ts`;
- estoque inicial cria `StockMovement ADJUSTMENT` com `INITIAL_STOCK`;
- duplicado por nome normalizado e bloqueado antes do rascunho e antes da persistencia;
- mensagens de confirmacao textual como `sim` nao persistem produto sozinhas.

## Etapa 3.5 - Demo Mobile Instalavel/PWA

Status: implementada em 2026-05-25.

Objetivo: preparar a demonstracao no celular como app instalavel, sem criar regra financeira nova.

Resultado implementado:

- manifest PWA em `app/manifest.ts` com `name=NEXIS`, `short_name=NEXIS`, `display=standalone`, `theme_color`, `background_color`, `start_url=/` e `scope=/`;
- icones temporarios em `public/icons/nexis-icon.svg` e `public/icons/nexis-maskable.svg`;
- metadata mobile em `app/layout.tsx`, incluindo `applicationName`, `appleWebApp`, `manifest`, icones e viewport com `themeColor`;
- CSS global protege contra scroll horizontal indevido em mobile, incluindo selects com textos longos;
- E2E mobile valida manifest e ausencia de overflow horizontal em `/`, `/products`, `/sales`, `/purchases`, `/expenses` e `/assistant`;
- README e Runbook explicam teste no celular, modo producao local, preview na Vercel, instalacao/adicao a tela inicial e roteiro de demonstracao.

Proximo passo recomendado desta frente: publicar um preview demonstrativo na Vercel para validar abertura real em Android/iOS antes de iniciar novas regras financeiras.

## Etapa 4 - Pro-labore, Despesas Fixas e Metas

Objetivo: permitir ao usuario informar quanto quer ganhar por mes, quanto gasta fixo e qual margem/lucro quer acompanhar.

Modelo recomendado:

- `RecurringExpense`: aluguel, salario de funcionario, energia, internet, contador, sistema, taxa fixa, transporte fixo e outros custos recorrentes.
- `OwnerCompensationPlan`: pro-labore mensal desejado.
- `MonthlyFinancialGoal`: margem liquida desejada, lucro minimo, faturamento alvo e reserva minima.
- `Expense`: continua sendo pagamento real confirmado.

Regras:

- pro-labore e opcional;
- despesa fixa planejada nao vira despesa paga automaticamente;
- dashboard deve separar lucro bruto, resultado operacional e saldo apos pro-labore;
- IA pode criar rascunho de configuracao ou pagamento, mas confirmacao continua obrigatoria.

Como fazer:

1. Criar tela `Planejamento mensal`.
2. Adicionar modelos Prisma e migrations.
3. Criar Server Actions e schemas Zod.
4. Mostrar despesas fixas previstas, pro-labore previsto, faturamento necessario, margem desejada e ponto de equilibrio simples.
5. Ensinar assistant frases como:
   - `Quero tirar 3000 por mes de pro-labore`;
   - `Meu aluguel mensal e 1200`;
   - `Pago funcionario 2000 por mes`;
   - `Quero margem liquida de 20%`;
   - `Quanto preciso vender para pagar minhas contas e meu pro-labore?`

Aceite:

- usuario pode ignorar planejamento e usar o MVP normalmente;
- quando preencher, relatorios mostram impacto separado;
- recorrencias nao distorcem lucro real pago;
- assistant pergunta valor/frequencia/categoria quando faltar.

## Etapa 5 - Servico sem Estoque

Problema atual: venda exige produto fisico e estoque.

Como fazer:

1. Decidir entre evoluir `Product` para item com `itemType PRODUCT | SERVICE` ou criar modelo separado de receita de servico.
2. Recomendacao MVP: evoluir catalogo para item com tipo, preservando compatibilidade de produto fisico.
3. Servico nao altera estoque.
4. Receita de servico entra no faturamento.
5. Custo de servico pode ser zero ou opcional.
6. Despesas relacionadas seguem em `Expense`.

Aceite:

- `Fiz uma consulta de 300 reais` gera rascunho de receita de servico;
- `Corte de cabelo 50 reais` gera rascunho;
- nenhum servico baixa estoque;
- lucro bruto/liquido continuam deterministicos.

## Etapa 6 - Perda, Quebra e Desperdicio

Status em 2026-05-28: implementado no assistant texto para produto existente, com rascunho, confirmacao, `StockLoss`, movimento `LOSS` e despesa `LOSS_WASTE`. Ainda falta uma tela manual dedicada de historico/auditoria.

Como fazer:

1. Criar fluxo com produto, quantidade, motivo, custo unitario snapshot e valor estimado.
2. Criar `StockLoss` ou `StockMovementType.LOSS`.
3. Baixar estoque somente apos confirmacao.
4. Refletir perda como custo/perda operacional, nao faturamento.
5. Adicionar assistant para `Perdi 5 refrigerantes`, `Quebraram 3 garrafas`, `Estragaram 2 queijos`.

Aceite:

- perda reduz estoque;
- perda nao aumenta faturamento;
- relatorio mostra impacto financeiro;
- IA pergunta produto/quantidade quando faltar.

## Etapa 7 - Cancelamento e Correcao

Status em 2026-05-28: implementado no assistant texto para venda, compra e despesa com rascunho, confirmacao, `CancellationEvent`, reversao de estoque quando aplicavel e relatorios ignorando lancamentos cancelados. Ainda falta tela manual dedicada e correcao granular sem relancar.

Como fazer:

1. Evitar delete fisico.
2. Adicionar status/eventos de reversao.
3. Venda cancelada restaura estoque.
4. Compra cancelada remove estoque se houver saldo.
5. Despesa cancelada sai do lucro liquido.
6. Registrar motivo, usuario e data.
7. Assistant lista lancamento alvo e pede confirmacao.

Aceite:

- usuario consegue corrigir erro comum;
- dados ficam rastreaveis;
- estoque e lucro recalculam corretamente;
- comando destrutivo nunca apaga silenciosamente.

## Etapa 8 - Voz Preenchendo Rascunhos

Como fazer:

1. Conectar STT real por provider seguro.
2. Manter transcricao como texto revisavel.
3. Criar roteador de intents: produto, venda, compra, despesa, pro-labore, recorrencia, servico, perda, pergunta.
4. Manter contexto de conversa para campos faltantes.
5. Registrar origem do rascunho: manual, texto, voz ou IA externa.

Aceite:

- voz gera o mesmo rascunho que texto;
- campos entram no rascunho correto;
- audio incerto pede revisao;
- confirmacao por botao segue obrigatoria.

## Etapa 9 - Producao Real

Como fazer:

1. Migrar para Postgres/Supabase.
2. Adicionar autenticacao.
3. Adicionar `businessId`/multiempresa.
4. Criar backup/exportacao.
5. Criar logs sanitizados.
6. Separar demo, homologacao e producao.

Aceite:

- dados sobrevivem a deploy;
- usuario nao acessa dados de outro usuario;
- existe restauracao/exportacao basica;
- segredos ficam fora do frontend e do Git.

## Ordem Recomendada

1. Pro-labore, despesas fixas e metas.
2. Servico sem estoque.
3. Perda/quebra.
4. Cancelamento/correcao.
5. Voz/STT real.
6. Fluxo de caixa projetado seguro.
7. Banco de producao, auth e backup.
