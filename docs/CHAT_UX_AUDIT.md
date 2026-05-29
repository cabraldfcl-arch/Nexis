# Auditoria UX do Chat do Assistant

Ultima atualizacao: 2026-05-28

## 1. Estado Atual do Chat

O assistant em `/assistant` ja funciona bem como fluxo de negocio: interpreta texto, cria rascunhos, abre o cadastro de produto pre-preenchido quando aplicavel, responde perguntas financeiras com dados deterministicos e exige botao antes de salvar produto, compra, venda ou despesa.

A interface, porem, ainda nao se comporta como um chat profissional mobile-first. A estrutura visual atual coloca o composer antes do historico. Quando a conversa cresce, a pagina inteira rola, as mensagens novas aparecem abaixo do input e o usuario perde acesso ao campo de digitacao sem voltar para cima.

Inspecao automatizada em viewport mobile `390x844` confirmou:

- antes da conversa, o form do input ficava entre `top=254` e `bottom=574`;
- depois de seis mensagens, o documento cresceu para `scrollHeight=1671`;
- o scroll da pagina foi para `scrollY=701`;
- o form ficou fora da tela, com `formTop=-447` e `formVisible=false`;
- nao houve scroll horizontal nessa medicao (`scrollWidth=390`).

## 2. Arquitetura Atual do Chat

Arquivos principais:

- `app/assistant/page.tsx`: renderiza pagina, header, link de retorno e `<ChatThread />`.
- `components/assistant/chat-thread.tsx`: guarda historico em memoria, estado `pending`, `pendingContext`, renderiza input, mensagens e respostas.
- `components/assistant/message-input.tsx`: textarea controlado localmente, botao enviar e audio/text-only panel.
- `components/assistant/answer-card.tsx`: card de resposta financeira ou pergunta de continuacao.
- `components/assistant/draft-confirmation.tsx`: card de rascunho e confirmacao por botao.
- `app/assistant/actions.ts`: server action de envio, contexto pendente, parsing, perguntas, drafts e confirmacoes.
- `lib/validation/assistant-draft.ts`: schemas Zod dos rascunhos criticos.
- `tests/e2e/ai-demo-flow.spec.ts` e `tests/e2e/text-only-demo.spec.ts`: cobrem fluxo funcional, mas ainda pouco sobre ergonomia visual do chat.

Fluxo atual:

1. `ChatThread` renderiza primeiro um card com `MessageInput`.
2. Abaixo do input, renderiza `section aria-label="Conversa com NEXIS"`.
3. Ao enviar, `ChatThread` adiciona uma bolha do usuario em `conversation`.
4. Monta `FormData` com `message` e, se existir, `pendingContext` serializado.
5. Chama `sendAssistantMessageAction`.
6. A server action retorna `AssistantActionState` com `answer`, `draft`, `error` ou novo `pendingContext`.
7. `ChatThread` adiciona a resposta do assistant ao historico local.
8. `useEffect` chama `endRef.current?.scrollIntoView(...)`.
9. Como nao existe area interna de mensagens, o autoscroll rola o documento inteiro.

Estado:

- historico existe apenas em memoria local do componente;
- nao ha historico persistido no banco;
- contexto de continuacao tambem fica em memoria local no cliente, e volta para a server action via `FormData` como `pendingContext`;
- confirmacoes de draft ficam encapsuladas em cada `DraftConfirmation`, com estado local de sucesso/erro/pending;
- a persistencia real continua acontecendo somente nas server actions de confirmacao.

## 3. Problemas Encontrados

Problemas visuais e de UX:

- input fica acima do historico, parecendo formulario antes de conversa;
- mensagens novas aparecem abaixo do composer, contrariando o padrao ChatGPT/WhatsApp;
- a pagina cresce para baixo indefinidamente;
- nao ha viewport propria para o historico;
- autoscroll rola o documento inteiro e pode esconder o input;
- composer nao fica acessivel quando a conversa cresce;
- o painel `Demo por texto` ocupa espaco dentro do composer e empurra o chat para baixo;
- resposta do assistant alterna entre card financeiro, card de draft e bolha de erro sem um envelope visual unico de identidade;
- cards de rascunho sao funcionais, mas grandes demais para leitura em conversa longa;
- erros aparecem como bloco, mas ainda sem padrao claro de mensagem do assistant;
- `Interpretando...` existe, mas nao aparece como uma mensagem consistente do assistant;
- nao ha tratamento explicito de Enter para enviar e Shift+Enter para quebrar linha;
- foco no input apos envio depende do comportamento do navegador e nao esta garantido.

Problemas mobile:

- em tela pequena, teclado virtual tende a reduzir ainda mais a area util;
- composer no topo obriga o usuario a voltar para digitar quando o historico cresce;
- textarea `min-h-28` e botao separado ocupam muita altura fixa;
- cards com grids de metricas podem ficar longos dentro do historico;
- nao ha `safe-area-inset-bottom` no composer porque ele nao e fixo/sticky;
- nao ha verificacao E2E de que o input permanece visivel depois de varias mensagens.

## 4. Comportamento Desejado

Arquitetura visual recomendada:

- header compacto no topo, com retorno ao painel e identidade NEXIS;
- area central de mensagens com scroll interno;
- mensagens antigas sobem dentro da area de conversa;
- mensagens novas entram sempre no fim do historico;
- composer fixo ou sticky no rodape da tela;
- botao enviar dentro ou ao lado do composer;
- Enter envia e Shift+Enter quebra linha, se isso nao prejudicar mobile;
- no mobile, botao de envio com area minima de toque de 44 a 48px;
- pending aparece como mensagem: `NEXIS esta analisando...`;
- erros aparecem como mensagem do assistant;
- rascunhos aparecem como cards dentro da conversa;
- ao confirmar um card, o sucesso/erro deve continuar visivel dentro do proprio historico;
- foco deve voltar ao textarea apos envio ou confirmacao quando fizer sentido;
- `aria-live` deve anunciar novas respostas e estados de confirmacao sem roubar foco.

Estrutura esperada:

```text
main min-h-dvh
  assistant-shell flex min-h-dvh flex-col
    compact-header shrink-0
    message-list flex-1 overflow-y-auto
      user-message
      assistant-message
      assistant-draft-card
      pending-indicator
    composer shrink-0 sticky bottom-0
```

## 5. Riscos

Riscos funcionais:

- perder `pendingContext` ao separar layout e estado;
- duplicar mensagem do usuario se o envio for refeito em retry;
- permitir duplo envio durante `pending`;
- quebrar confirmacao obrigatoria se o card for reestruturado sem manter `DraftConfirmation`;
- salvar draft antigo se houver varios cards e seletor/teste clicar no botao errado;
- voltar o bug de `Confirmando...` se a confirmacao for movida para um estado global mal controlado;
- apagar visualmente o historico ao confirmar um draft se a pagina fizer refresh completo;
- quebrar E2E existente que usa texto global em vez da ultima mensagem.

Riscos de UX/acessibilidade:

- composer fixo cobrir ultima mensagem se a lista nao tiver padding inferior;
- teclado virtual cobrir composer em mobile se usar altura errada;
- scroll interno competir com scroll da pagina;
- foco automatico agressivo abrir teclado em momentos ruins;
- `aria-live` excessivo anunciar cards grandes inteiros;
- cards grandes degradarem leitura em historico longo.

Riscos de escopo:

- transformar a melhoria visual em reescrita do assistant;
- misturar persistencia de historico sem necessidade;
- alterar parser, regras financeiras ou schema Prisma durante uma mudanca que deveria ser UI.

## 6. Plano Recomendado de Implementacao

### Etapa A - Layout profissional

Objetivo: mudar estrutura visual sem alterar regra de negocio.

- Ajustar `app/assistant/page.tsx` para ter shell full-height real.
- Tornar o header compacto e `shrink-0`.
- Fazer `ChatThread` ocupar `flex-1 min-h-0`.
- Criar area de mensagens `flex-1 overflow-y-auto`.
- Mover `MessageInput` para composer sticky/fixo no rodape.
- Adicionar padding inferior na lista para o composer nao cobrir a ultima mensagem.
- Manter largura mobile sem scroll horizontal.

### Etapa B - Padronizacao de mensagens

Objetivo: criar envelopes consistentes para cada tipo de item.

- Separar tipos visuais: `user`, `assistant`, `assistant-card`, `system-error`, `pending`.
- Manter `AnswerCard` e `DraftConfirmation`, mas renderizados dentro de um envelope de mensagem do assistant.
- Reduzir excesso de bordas/cartoes aninhados onde possivel.
- Padronizar avatar/label discreto do NEXIS para respostas do assistant.
- Padronizar mensagens de erro como resposta do NEXIS.

### Etapa C - Comportamento de conversa

Objetivo: ergonomia de chat moderno.

- Garantir limpeza do input apos envio aceito.
- Manter foco no textarea apos envio em desktop e avaliar no mobile.
- Implementar Enter envia e Shift+Enter quebra linha, com cuidado para mobile.
- Impedir duplo envio enquanto `pending=true`.
- Trocar `Interpretando...` solto por indicador dentro da lista.
- Fazer autoscroll apenas no container de mensagens.
- Evitar autoscroll agressivo quando o usuario estiver lendo mensagens antigas, se o historico crescer futuramente.

### Etapa D - Drafts e confirmacoes

Objetivo: preservar seguranca.

- Manter cada `DraftConfirmation` com seu proprio estado local.
- Apos confirmacao, exibir sucesso/erro dentro do card e manter botao desabilitado em sucesso.
- Garantir que card antigo nao possa ser confirmado duas vezes.
- Escopar testes e seletores para a ultima mensagem ou para o card correto.
- Nao salvar nada por mensagem textual como `sim`, `pode salvar` ou `confirma ai`.

### Etapa E - Testes E2E mobile

Objetivo: provar ergonomia e seguranca.

- Adicionar teste visual/comportamental do chat em viewport mobile.
- Validar que depois de varias mensagens o composer continua visivel.
- Validar que a lista de mensagens, nao o documento inteiro, e quem rola.
- Validar autoscroll para ultima mensagem.
- Validar que cadastro de produto navega para `/products` com formulario pre-preenchido.
- Reexecutar `ai-demo-flow`, `text-only-demo`, `mobile-smoke` e `verify:e2e`.

## 7. Testes Necessarios

Unitarios provavelmente nao sao o foco, pois a mudanca e majoritariamente UI. Os E2Es devem ser reforcados.

Testes E2E recomendados:

- `/assistant` renderiza como shell mobile com header, lista e composer;
- composer esta visivel em viewport `390x844` no carregamento inicial;
- apos 6 a 10 mensagens, composer continua visivel;
- `document.documentElement.scrollWidth <= viewportWidth`;
- area de mensagens tem `overflow-y` e altura propria;
- mensagem enviada aparece como bolha do usuario;
- resposta do assistant aparece dentro da lista;
- pending aparece como `NEXIS esta analisando...`;
- autoscroll leva a ultima mensagem para a area visivel;
- formulario de produto abre com dados entendidos pelo assistant;
- produto nao salva antes de clicar em `Salvar produto` no formulario;
- depois de salvar, sucesso aparece no formulario e `Salvando...` nao fica preso;
- fluxo de campos faltantes continua funcionando com campos em branco para completar;
- `ai-demo-flow.spec.ts` continua validando estoque/lucro/seguranca;
- `text-only-demo.spec.ts` continua validando perguntas, venda sem salvar e confirmacao.

Teste de acessibilidade recomendado:

- `aria-label` claro para lista de mensagens e composer;
- `aria-live="polite"` para novas respostas curtas/pending;
- `role="status"` para pending e sucesso;
- `role="alert"` somente para erros.

## 8. Criterios de Aceite para Chat Profissional

O chat deve ser considerado profissional somente se:

- o composer fica acessivel no rodape durante conversa longa;
- mensagens novas aparecem no fim do historico;
- a lista de mensagens tem scroll interno;
- a pagina nao cresce de forma que esconda o input;
- nao ha scroll horizontal em mobile;
- user bubbles e assistant bubbles/cards tem identidade visual consistente;
- rascunhos continuam dentro do historico e exigem botao;
- confirmacoes mostram sucesso/erro no historico;
- `Confirmando...` nao fica preso;
- `pendingContext` sobrevive entre mensagens enquanto a pagina nao recarrega;
- envio duplo fica bloqueado;
- Enter/Shift+Enter tem comportamento previsivel;
- E2Es mobile cobrem conversa longa, campos faltantes, rascunho e confirmacao;
- nenhuma regra financeira, parser, schema Prisma ou persistencia critica e alterada por essa etapa visual.

## 9. Documentacao a Atualizar Apos Implementacao

- `docs/PROJECT_STATE.md`: registrar estado real e comandos executados.
- `docs/AI_OPERATING_RULES.md`: atualizar apenas se houver mudanca no comportamento de confirmacao, pending ou contexto.
- `docs/RUNBOOK.md`: ajustar roteiro manual do assistant mobile.
- `docs/ARCHITECTURE_TREE.md`: atualizar se surgirem novos componentes de chat, como `message-list`, `message-bubble` ou `chat-composer`.
- `docs/AI_FLOW_VALIDATION_REPORT.md`: atualizar se E2Es de IA/chat forem reforcados.

## 10. Recomendacao Tecnica

Fazer a mudanca como refatoracao visual controlada, sem tocar no parser, sem alterar server actions de persistencia e sem mudar schemas Prisma.

Primeira PR recomendada:

- reorganizar `ChatThread` e `MessageInput` para shell de chat;
- criar pequenos componentes locais para `MessageList`, `AssistantMessage`, `UserMessage`, `ChatComposer` se isso reduzir complexidade;
- manter `DraftConfirmation` e `AnswerCard` funcionais;
- adicionar E2E que prova composer visivel apos conversa longa.

## 11. Implementacao Etapa A/B

Status em 2026-05-25: Etapas A/B implementadas na primeira versao profissional do chat.

Alteracoes aplicadas:

- `/assistant` passou a usar shell `h-dvh overflow-hidden`, header compacto e area de chat `flex-1 min-h-0`.
- `ChatThread` passou a renderizar primeiro a lista de mensagens com scroll interno e o composer no rodape.
- O autoscroll agora atua no container `assistant-message-list`, nao no documento inteiro.
- Mensagens do usuario foram padronizadas como bolha alinhada a direita.
- Respostas, erros, pending e cards do assistant foram padronizados dentro de um envelope do NEXIS alinhado a esquerda.
- O pending passou a aparecer como `NEXIS está analisando...` no historico.
- `MessageInput` virou composer compacto com textarea, botao de envio com icone, bloqueio de envio durante pending, limpeza apos envio e Enter para enviar com Shift+Enter para nova linha.
- `DraftConfirmation` e `AnswerCard` foram preservados dentro do historico, sem mudar regra de persistencia.

Teste criado:

- `tests/e2e/assistant-chat-ux.spec.ts` valida composer visivel no carregamento e depois de conversa longa, scroll interno, ausencia de scroll horizontal, pending como mensagem, rascunho dentro da conversa, produto nao salvo antes do botao, sucesso apos salvar e ausencia do bug `Confirmando...`.

Nao recomendado nesta etapa:

- persistir historico no banco;
- implementar memoria multi-sessao;
- alterar fluxo de IA externa;
- mudar regras de draft/confirmacao;
- redesenhar todos os cards financeiros do app.
