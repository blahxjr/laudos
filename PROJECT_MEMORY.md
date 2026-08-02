# Memória do Projeto Assist Tech Laudos

Este arquivo registra decisões técnicas, histórico de mudanças e o estado atual das funcionalidades.
Ele deve ser atualizado sempre que houver alterações relevantes em schema, UX, módulos ou IA.

## Visão geral atual do sistema

O projeto está em um estado "cru, porém sólido". A base fullstack já suporta:

- backend Express em `src/server.ts` com rotas de CRUD para clientes, equipamentos, ordens de serviço e laudos
- schema Prisma em `prisma/schema.prisma` para PostgreSQL
- frontend React + Vite em `src/frontend/` com páginas de clientes e ordens de serviço
- visualização de laudos por abas em `src/frontend/TechnicalReportTabs.tsx`
- endpoint de sugestão assistiva em `/ai/reports/:id/suggest`
- validação de CPF/CNPJ no fluxo de clientes
- arquivo de configuração de agentes `AGENTS.md` e documentação de desenvolvimento em `docs/dev-notes.md`

O projeto ainda precisa evoluir em algumas áreas de interface, cobertura de testes e integração completa de criação/edição de laudos no frontend.

## Linha do tempo de alterações

- **2026-07-29** — Módulo de clientes ganhou validação CPF/CNPJ, normalização de documento e campos de endereço.
  - Arquivos tocados: `src/server.ts`, `src/server/clientValidation.ts`, `src/frontend/ClientsPage.tsx`, `src/frontend/clientFormatting.ts`
  - Tags: `#clientes`, `#backend`, `#frontend`, `#prisma`

- **2026-07-30** — Adicionado AppShell e navegação inicial do painel com rotas React simples.
  - Arquivos tocados: `src/frontend/main.tsx`, `src/frontend/AppShell.tsx`, `src/frontend/App.tsx`, `src/frontend/ServiceOrdersPage.tsx`
  - Tags: `#frontend`, `#ux`, `#dashboard`

- **2026-07-30** — Evolução do módulo de ordens de serviço e conexão com laudos.
  - Arquivos tocados: `src/frontend/ServiceOrdersPage.tsx`, `src/frontend/TechnicalReportTabs.tsx`, `src/server.ts`
  - Tags: `#os`, `#laudos`, `#frontend`, `#backend`

- **2026-07-31** — Implementado endpoint assistivo de IA para sugestão de causa provável e conclusão técnica.
  - Arquivos tocados: `src/server.ts`, `src/frontend/TechnicalReportTabs.tsx`
  - Tags: `#ia`, `#diagnostico`, `#backend`, `#frontend`

- **2026-07-31** — Ajustes no design system e no README/ documentação de setup.
  - Arquivos tocados: `src/frontend/designSystem.css`, `README.md`, `docs/dev-notes.md`, `AGENTS.md`
  - Tags: `#ux`, `#documentacao`, `#frontend`

- **2026-08-01** — Definida rotina obrigatória do Agente Orquestrador para validação, documentação e versionamento.
  - Arquivos tocados: `AGENTS.md`, `docs/dev-notes.md`, `PROJECT_MEMORY.md`
  - Resumo: o Orquestrador agora deve validar testes (`npm test`), build do frontend (`npx vite build`), checar `git status`/`git diff`, propor mensagem de commit e preparar comandos de commit/push antes de encerrar qualquer tarefa relevante.
  - Impacto: reforça disciplina de qualidade em todas as camadas (frontend, backend, Prisma, comunicação, IA, documentação).
  - Próximos passos: aplicar essa rotina em cada entrega subsequente e incluir entradas curtas de memória técnica para alterações importantes.

- **2026-08-01 21:30** — Encerramento do dia: laudo técnico digital integrado ao ERP implementado e testado.
  - Arquivos tocados: `src/server.ts`, `src/frontend/TechnicalReportDocument.tsx`, `src/frontend/TechnicalReportTabs.tsx`, `src/frontend/main.tsx`, `src/frontend/designSystem.css`, `PROJECT_MEMORY.md`
  - Resumo: integração do documento de laudo completo com `/reports/:id/view`, novo componente de impressão, botão de visualização do laudo completo, ajustes de CSS de impressão e correções de TypeScript.
  - Status: build Vite e TypeScript passados; testes recomendados antes do commit.
  - Tags: `#laudos`, `#erp`, `#ux`, `#comunicacao`

- **2026-08-02** — Sprint Passo 1 concluído: fluxo avançado de OS com status e atividades.
  - Arquivos tocados: `prisma/schema.prisma`, `src/server.ts`, `src/server/serviceOrderStatus.ts`, `src/frontend/ServiceOrdersPage.tsx`, `src/frontend/designSystem.css`, `scripts/seed.ts`, `docs/dev-notes.md`, `PROJECT_MEMORY.md`
  - Resumo: implementação de status operacional para OS, modelo de atividades da ordem, endpoints de leitura/registro e atualização de status, além de interface na tela de ordens para acompanhamento das atividades.
  - Impacto: frontend e backend passaram a suportar um fluxo operacional mais rico para acompanhamento da OS sem quebrar a navegação de laudos em abas.
  - Próximos passos: expandir atividades automáticas para cobrança, envio por WhatsApp e integração com IA de diagnóstico.
  - Tags: `#os`, `#frontend`, `#backend`, `#prisma`, `#ux`

- **2026-08-02** — Sprint Passo 2 concluída: estoque integrado ao consumo de peças nas OS.
  - Arquivos tocados: `prisma/schema.prisma`, `prisma/migrations/20260802161724_add_part_stock_fields/`, `src/server.ts`, `src/server/stockFlow.ts`, `src/frontend/ServiceOrdersPage.tsx`, `src/frontend/CatalogPage.tsx`, `scripts/seed.ts`, `tests/stockFlow.test.mjs`, `tests/viteProxy.test.mjs`
  - Resumo: peças do catálogo passaram a ter `stockQuantity` e `minimumStock`; ao adicionar, editar ou remover itens do tipo `PARTE` em uma OS, o saldo é ajustado automaticamente, bloqueando operações que deixariam o estoque negativo e exibindo alerta visual de baixo estoque na UI.
  - Impacto: o fluxo operacional de OS agora consome estoque real da oficina, preservando a consistência entre catálogo, ordens e inventário.
  - Próximos passos: evoluir para histórico de movimentação de estoque, reserva de peças e integração com compras/fornecedores.
  - Tags: `#estoque`, `#os`, `#frontend`, `#backend`, `#prisma`

- **2026-08-02** — Sprint Passo 3 concluída: dashboard operacional simples.
  - Arquivos tocados: `src/server.ts`, `src/server/dashboard.ts`, `src/frontend/DashboardPage.tsx`, `src/frontend/main.tsx`, `vite.config.ts`, `tests/dashboardOverview.test.mjs`
  - Resumo: criado endpoint `GET /dashboard/overview` com resumo de ordens por status, total de laudos, faturamento total e valores acumulados nos últimos 30 dias. A rota `/dashboard` agora exibe um painel inicial com cards e lista simples, usando o design system existente.
  - Impacto: a equipe passa a ter uma visão operacional rápida sem depender de gráficos complexos ou de integrações externas.
  - Próximos passos: adicionar filtros de período, gráficos simples e métricas por técnico/cliente.
  - Tags: `#dashboard`, `#os`, `#laudos`, `#financeiro`

- **2026-08-02** — Sprint Passo 4 concluída: resumo de OS/laudo pronto para WhatsApp.
  - Arquivos tocados: `src/frontend/TechnicalReportTabs.tsx`, `src/frontend/whatsAppSummary.ts`, `tests/whatsAppSummary.test.mjs`
  - Resumo: adicionada função `buildWhatsAppSummary` que monta um texto objetivo com cliente, protocolo da OS, equipamento, diagnóstico, conclusão, valor total e link para o laudo completo. O botão “Copiar resumo para WhatsApp” copia o texto para a área de transferência e exibe feedback simples.
  - Impacto: o técnico consegue preparar rapidamente uma mensagem para WhatsApp/Telegram sem integrar API externa nem sair do fluxo de laudo.
  - Próximos passos: evoluir para templates por tipo de atendimento e envio automático via canal integrado.
  - Tags: `#whatsapp`, `#telegram`, `#laudos`, `#ux`

- **2026-08-02** — Sprint Passo 7 iniciada: POC de envio via gateway/API externo.
  - Arquivos tocados: `src/whatsappGateway.ts`, `src/server.ts`, `src/frontend/TechnicalReportTabs.tsx`, `tests/whatsappGateway.test.mjs`, `docs/dev-notes.md`, `docs/whatsapp-plan.md`
  - Resumo: criado helper genérico para envio de texto via gateway, rota `POST /communications/whatsapp/send-summary` no backend e novo botão na tela de laudo para disparar o resumo curto pelo gateway. O fluxo atual usa o número de WhatsApp do cliente quando disponível e não implementa recebimento nem mídia ainda.
  - Impacto: o ERP passa a ter um canal simples para disparar mensagens de resumo para clientes sem depender do fluxo manual de cópia/colar.
  - Próximos passos: validar com um gateway real em ambiente de dev, ajustar o corpo do request ao provider escolhido e expandir para webhooks de recebimento.
  - Tags: `#whatsapp`, `#gateway`, `#comunicacao`, `#backend`, `#frontend`

- **2026-08-02** — Micro Sprint 1 concluído: configurações WhatsApp persistidas no backend.
  - Arquivos tocados: `prisma/schema.prisma`, `prisma/migrations/20260802190000_add_app_settings/migration.sql`, `src/server/settingsService.ts`, `src/server/whatsappSettingsRoutes.ts`, `src/server.ts`, `tests/whatsappSettings.test.mjs`, `docs/dev-notes.md`, `PROJECT_MEMORY.md`
  - Resumo: adicionado modelo `AppSetting` para configurações globais e implementados endpoints `GET/PUT /settings/whatsapp` com validação de URL/telefone e resposta sem exposição de tokens (somente flags de presença).
  - Impacto: o backend passa a suportar gestão centralizada de credenciais/configurações de integração WhatsApp sem depender de UI neste estágio.
  - Próximos passos: criar tela administrativa para editar settings e adicionar teste de conexão com gateway no fluxo de configuração.
  - Tags: `#whatsapp`, `#configuracao`, `#backend`, `#prisma`, `#seguranca`

- **2026-08-02** — Micro Sprint 2 concluído: tela de Configurações > WhatsApp no frontend.
  - Arquivos tocados: `src/frontend/SettingsPage.tsx`, `src/frontend/main.tsx`, `vite.config.ts`, `tests/viteProxy.test.mjs`, `docs/dev-notes.md`, `PROJECT_MEMORY.md`
  - Resumo: criada página de configurações com formulário para URLs, tokens e telefone padrão; leitura via `GET /settings/whatsapp` e persistência via `PUT /settings/whatsapp`, com estados de loading, sucesso e erro.
  - Impacto: operação passa a editar a configuração de integração WhatsApp diretamente na UI, mantendo tokens mascarados e persistência no backend.
  - Próximos passos: adicionar ações de teste de conexão e envio de mensagem de teste no mesmo módulo de configurações.
  - Tags: `#whatsapp`, `#configuracao`, `#frontend`, `#ux`, `#integracao`

- **2026-08-02** — Micro Sprint 3 concluído: teste de conexão e mensagem de teste WhatsApp.
  - Arquivos tocados: `src/server/whatsappSettingsRoutes.ts`, `src/whatsappGateway.ts`, `src/frontend/SettingsPage.tsx`, `tests/whatsappSettings.test.mjs`, `docs/dev-notes.md`, `PROJECT_MEMORY.md`
  - Resumo: implementados endpoints de teste de conexão (`POST /settings/whatsapp/test-connection`) e envio de mensagem de teste (`POST /settings/whatsapp/send-test-message`), com interface visual na tela de configurações para disparo e leitura de feedback.
  - Impacto: o time consegue validar configuração do gateway e fluxo de envio sem sair do painel administrativo.
  - Próximos passos: integrar healthcheck específico do provider escolhido e enriquecer observabilidade de falhas de envio (status/code/trace simplificado).
  - Tags: `#whatsapp`, `#configuracao`, `#gateway`, `#backend`, `#frontend`

- **2026-08-02** — Micro Sprint 4 concluído: detalhes técnicos opcionais de falha no WhatsApp.
  - Arquivos tocados: `src/server/whatsappSettingsRoutes.ts`, `src/whatsappGateway.ts`, `src/frontend/SettingsPage.tsx`, `tests/whatsappSettings.test.mjs`, `docs/dev-notes.md`, `PROJECT_MEMORY.md`
  - Resumo: padronizado retorno de erro com `technicalDetails` (status, endpoint, código e descrição), sem exposição de segredos, e adicionada UI recolhível de “Ver detalhes técnicos” para diagnóstico administrativo.
  - Impacto: melhora da observabilidade operacional sem degradar segurança de credenciais no painel de configuração.
  - Próximos passos: padronizar esse mesmo contrato de erro técnico para outros módulos de integração externa.
  - Tags: `#whatsapp`, `#seguranca`, `#observabilidade`, `#backend`, `#frontend`

- **2026-08-02** — Micro Sprint 4B concluído: sessão WhatsApp com QR Code e status operacional.
  - Arquivos tocados: `src/frontend/SettingsPage.tsx`, `src/frontend/whatsappConnectionUi.tsx`, `src/server/whatsappSettingsRoutes.ts`, `src/server/whatsappSessionGateway.ts`, `tests/whatsappSettings.test.mjs`, `docs/dev-notes.md`, `PROJECT_MEMORY.md`
  - Resumo: painel de configuração ganhou fluxo de sessão por instância (`create/connect/status/refresh-qr/disconnect`), badge de estado, renderização de QR Code e polling automático de status. O envio de mensagem de teste passou a depender de sessão conectada na UI, e as rotas receberam fallback seguro para cenários de teste sem model de sessão no Prisma.
  - Impacto: operacionaliza o pareamento e monitoramento do WhatsApp dentro do sistema sem depender de ações externas, preservando compatibilidade de testes e estabilidade do backend.
  - Próximos passos: validar o fluxo com gateway real (Evolution/WAHA), adicionar telemetria simples por transição de status e ampliar testes de UI para os estados da sessão.
  - Tags: `#whatsapp`, `#qrcode`, `#sessao`, `#backend`, `#frontend`

- **2026-08-02** — Micro Sprint 5 concluído: inbound WhatsApp integrado a Conversation/Message com vínculo de cliente e OS.
  - Arquivos tocados: `src/server.ts`, `src/server/whatsappWebhook.ts`, `src/server/communicationsRouter.ts`, `tests/whatsappWebhook.test.mjs`, `docs/dev-notes.md`, `PROJECT_MEMORY.md`
  - Resumo: webhook inbound passou a responder `200` rápido e processar de forma resiliente; foi implementado normalizador do payload Evolution e normalização de telefone. O fluxo agora localiza cliente por telefone, cria/reutiliza conversa por `instance:phone`, deduplica mensagens inbound por id externo e faz associação simples com OS quando houver uma única opção aberta/recente.
  - Impacto: prepara a base para futura inbox operacional sem quebrar o fluxo atual de QR/sessão e sem exigir migração de schema nesta etapa.
  - Próximos passos: criar tela de atendimento consumindo `GET /communications/conversations/recent`; adicionar campos formais de `externalMessageId/rawPayload/messageTimestamp` no schema para reduzir sobrecarga semântica dos campos reaproveitados; evoluir suporte a mídia.
  - Tags: `#whatsapp`, `#webhook`, `#conversations`, `#messages`, `#backend`

- **2026-08-02** — Micro Sprint 6 concluído: Inbox web de conversas WhatsApp.
  - Arquivos tocados: `src/frontend/pages/ConversationsInboxPage.tsx`, `src/frontend/ConversationDetailPanel.tsx`, `src/frontend/httpClient.ts`, `src/frontend/main.tsx`, `src/frontend/AppShell.tsx`, `src/frontend/ServiceOrdersPage.tsx`, `src/frontend/designSystem.css`, `tests/conversationsInbox.test.mjs`, `tests/communicationsRecent.test.mjs`, `docs/dev-notes.md`, `PROJECT_MEMORY.md`
  - Resumo: criada rota de inbox (`/communications` e alias `/inbox`) com lista de conversas recentes, filtro por telefone, seleção de conversa e painel de detalhes com cliente/OS/última mensagem. O painel ganhou atalho para abrir OS vinculada e preview de mensagens recentes carregado por detalhe da conversa.
  - Impacto: o módulo de comunicação saiu do estado apenas backend e passou a ter uma interface operacional mínima para atendimento, já integrada ao fluxo de OS existente.
  - Próximos passos: implementar envio de mensagens outbound direto da inbox, ação real de "Criar OS a partir da conversa" e paginação/atualização em tempo real da lista.
  - Tags: `#whatsapp`, `#inbox`, `#frontend`, `#os`, `#comunicacao`

## Backlog de próximos passos

### Alta prioridade
- Adicionar metadados formais ao laudo completo: data do laudo, assinatura do técnico, número de versão e emissão de documento.
- Estruturar melhor a seção de diagnóstico em `TechnicalReportDocument.tsx`: separar claramente procedimentos executados, conclusão e recomendações.
- Tornar a navegação do laudo completo mais evidente na UI de OS e laudo por abas, com instruções de uso e feedback visual.

### Média prioridade
- Melhorar o painel de `InvoicesPage.tsx` com filtros de status, busca por OS/cliente e destaque de invoices pendentes.
- Adicionar vinculação direta no `ClientsPage.tsx` para abrir ordens de serviço e conversas relacionadas ao cliente.
- Exibir no `ServiceOrdersPage.tsx` o status de invoice/OS e resumo financeiro da OS selecionada de forma mais visível.

### Baixa prioridade
- Ajustar textos e labels do laudo: `Total do laudo` para algo mais técnico, `Observações da OS` para `Resumo de serviços`, e legendas de fotos mais claras.
- Refinar o layout de impressão: incluir rodapé fixo, numeração de páginas e margens de papel.
- Oferecer melhor apresentação de fotos no laudo com legendas maiores e ordenação por relevância.

## Estado dos módulos

### Clientes

- Pronto: cadastro, edição, busca e validação de CPF/CNPJ.
- Faltam: exclusão lógica no frontend, filtros avançados, e relacionar clientes diretamente nas ordens de serviço a partir da UI.

### Equipamentos

- Pronto: CRUD básico de equipamentos no backend, vínculo com cliente e listagem por cliente.
- Faltam: interface de gerenciamento de equipamentos no frontend, formulários de edição e validação adicional.

### Ordens de Serviço

- Pronto: backend suporta listagem, criação, atualização de status e arquivamento.
- Faltam: interface de criação/edição completa de ordens no frontend, filtros refinados e dashboard operacional.

### Laudos Técnicos

- Pronto: visualização de laudo em abas, dados de assistência, cliente, diagnóstico, componentes e fotos.
- Faltam: UI de edição/criação de laudos, salvamento de laudos no backend via frontend, e geração de PDF ou snapshot completo.

### IA Assistiva

- Pronto: endpoint `/ai/reports/:id/suggest` existe e retorna rascunhos gerados localmente.
- Faltam: integração com provedor real de IA, tratamento de erros mais robusto, e validação de resultado pela interface de laudo.

## Regras de atualização da memória

Sempre que ocorrer uma mudança relevante, adicione uma entrada em `PROJECT_MEMORY.md` com:

- Data/hora aproximada
- Descrição técnica resumida
- Impacto em frontend/backend/banco
- Próximos passos sugeridos

Isso deve acontecer especialmente quando:

- mudar o schema Prisma
- criar ou alterar módulos grandes (Clientes, Equipment, OS, Laudos, IA)
- mexer em `AppShell` ou no design system
- atualizar rotas principais ou fluxo de laudo

## Como reorientar a IA do projeto

Qualquer novo agente ou prompt deve seguir este fluxo antes de propor mudanças grandes:

1. Ler `PROJECT_MEMORY.md` para entender o histórico e o estado atual.
2. Ler `AGENTS.md` para saber os papéis dos agentes e regras de coordenação.
3. Ler o diagnóstico original e o roteiro de evolução do sistema.
4. Mencionar claramente no prompt:
   - objetivo atual
   - módulo a ser mexido
   - necessidade de preservar os fluxos existentes

Exemplo de prompt:

> "O objetivo atual é tornar o front-end de ordens de serviço mais completo sem quebrar `/service-orders` e o fluxo de visualização de laudos. Trabalhe apenas na UI e valide os impactos no backend e no Prisma antes de propor alterações." 

## Visão futura: integração omnichannel com WhatsApp e Telegram

### Objetivo estratégico

Transformar o Assist Tech Laudos em um sistema de assistência técnica omnichannel, onde técnicos e clientes possam interagir diretamente via WhatsApp (prioridade) e, em segundo plano, Telegram. O fluxo completo de atendimento deve poder ocorrer por chat:

- abrir chamados e OS via mensagem;
- cadastrar ou identificar clientes automaticamente (via telefone + dados solicitados);
- vincular equipamentos ao cliente durante a conversa;
- receber mensagens de texto, fotos e vídeos do atendimento;
- enviar atualizações de status da OS;
- gerar e entregar o laudo técnico final pelo próprio WhatsApp/Telegram.

Essa integração deve ser tratada como **diferencial principal do sistema** e considerada desde já na arquitetura de módulos (Clientes, Equipamentos, OS, Laudos, IA).

### Referências de integração com WhatsApp

Para orientar o desenho da integração, o projeto deve considerar:

- **Bibliotecas client para WhatsApp Web**, como `whatsapp-web.js`, que permitem controlar uma sessão do WhatsApp Web em Node.js, enviar/receber mensagens, mídias e reagir a eventos.
- **Wrappers REST e APIs HTTP em cima dessas libs**, como projetos que expõem endpoints Express para interação (ex.: wrappers em torno de whatsapp-web.js).
- **WhatsApp Business Platform Cloud API (oficial, via Meta)** e seu SDK Node.js, que suportam envio/recebimento de mensagens via API + webhooks, adequado para operação mais robusta e compliance.
- **Templates de CRM para WhatsApp**, que mostram padrões de “shared inbox”, contatos, tags e automações (úteis como referência de modelagem de contatos e conversas).

Esses projetos e guias demonstram padrões importantes:
- uso de webhooks para receber mensagens;
- mapeamento de número de telefone → contato/cliente;
- destaque para sessões de conversa (24h user-initiated no Cloud API);
- suporte a envio/recebimento de mídia (fotos, documentos).

### Impacto na arquitetura do Assist Tech Laudos

Para que todos os módulos atuais já “nasçam” com essa integração em mente, o sistema deve:

1. **Criar um módulo de Comunicação/Canal**
   - Entidades como `Channel` (ex.: `WHATSAPP_BUSINESS`, `WHATSAPP_WEB`, `TELEGRAM`), `Conversation`, `Message`.
   - Relacionar `Conversation` a `Client` e `ServiceOrder`:
     - um número de WhatsApp abre uma conversação,
     - dessa conversação nascem OS, laudos e registros de atendimento.

2. **Adaptar Clientes e OS para serem omnichannel**
   - `Client` deve armazenar telefone/identificadores de chat (WhatsApp/Telegram).
   - `ServiceOrder` deve permitir origem “WhatsApp”, “Telegram” ou “Painel Web”.
   - Logs de OS devem poder referenciar mensagens recebidas/enviadas.

3. **Preparar o módulo de Laudos para entrega via chat**
   - Laudos devem ter uma representação “compacta” e segmentada (texto, resumo, anexos) adequada para envio por WhatsApp.
   - Fotos vinculadas (ReportPhoto) devem poder ser recuperadas e enviadas como mídia.

4. **Planejar endpoints e handlers de chat**
   - Endpoints webhooks (ex.: `/webhooks/whatsapp`, `/webhooks/telegram`) para receber mensagens.
   - Handlers que traduzam comandos ou mensagens em intenções:
     - “Quero abrir uma OS” → fluxo de criação de OS;
     - “Meu equipamento X está com defeito Y” → coletar dados, criar ou atualizar OS/laudo;
     - envio de fotos → vincular a `ReportPhoto` do laudo mais recente.

5. **Integrar IA assistiva também ao canal de chat**
   - Aproveitar `/ai/reports/:id/suggest` para gerar rascunhos de laudo a partir do contexto e, futuramente, do histórico de mensagens do WhatsApp.
   - Permitir que o técnico, via chat, peça “sugerir laudo” e receba um resumo técnico gerado pela IA.

### Diretrizes para desenvolvimento futuro

Ao evoluir o projeto, os agentes devem:

- **Sempre avaliar impactos na futura integração com WhatsApp/Telegram**:
  - nenhum novo módulo deve ser pensado exclusivamente para UI web; deve considerar como seria acionado via mensagem.
- **Evitar acoplamento forte entre UI web e regras de negócio**:
  - privilegiar serviços/handlers que possam ser chamados tanto pelo painel web quanto pelo canal de chat.
- **Manter campos de telefone e identificadores de chat bem modelados** em `Client` e `ServiceOrder`.

### Prompt base para agentes (Copilot, Orquestrador etc.)

Use este prompt ao trabalhar em qualquer evolução relevante, para lembrar a integração omnichannel:

> “Ao propor ou implementar mudanças neste projeto (Assist Tech Laudos), considere que, no futuro próximo, o sistema terá um módulo de comunicação omnichannel com prioridade para WhatsApp e suporte a Telegram.
>  Técnicos e clientes poderão abrir e acompanhar ordens de serviço, cadastrar dados, enviar fotos e receber laudos diretamente via WhatsApp/Telegram.
>  Antes de sugerir alterações em Clientes, Equipamentos, Ordens de Serviço, Laudos ou IA, leia `PROJECT_MEMORY.md`, `AGENTS.md` e o diagnóstico inicial, e garanta que:
>  > - os modelos de dados permitem vincular conversas de WhatsApp/Telegram a clientes e OS;
>  > - novos fluxos de negócio podem ser acionados tanto pelo painel web quanto por mensagens de chat;
>  > - as decisões não inviabilizam o uso de bibliotecas como `whatsapp-web.js` ou da WhatsApp Business Cloud API para enviar/receber mensagens, mídias e laudos.
>  > Documente, ao final, qualquer decisão que impacte a futura integração omnichannel em `PROJECT_MEMORY.md`, usando tags como `#whatsapp`, `#telegram`, `#omnichannel`, `#comunicacao`.”

Esse bloco pode entrar como seção “Visão futura / integração WhatsApp & Telegram” em `PROJECT_MEMORY.md` e como subseção em `AGENTS.md` sob o agente IA/Diagnóstico ou um futuro agente “Omnichannel/Comunicação”.

## Diagnóstico de coerência documental — 2026-08-02

### Contexto

A documentação do projeto está, em geral, alinhada à implementação existente. A base fullstack do Assist Tech Laudos está coerente com o escopo descrito em AGENTS, README e docs/dev-notes.

### Conclusão principal

- O backend Express, o schema Prisma e o frontend React/Vite correspondem ao que o projeto realmente entrega.
- Os módulos de clientes, equipamentos, ordens de serviço, laudos técnicos e IA assistiva existem e estão conectados.
- A documentação está mais avançada do que a experiência de alguns fluxos específicos, especialmente no que diz respeito à maturidade de edição e persistência de laudos.

### Evidências verificadas

- Testes: `npm test` — passou com 4 testes.
- Build frontend: `npx vite build` — concluído com sucesso.

### Próximos passos

1. Consolidar a edição e persistência de laudos técnicos pela interface.
2. Melhorar a integração da IA assistiva com um fluxo mais realista.
3. Refinar a camada financeira e de cobrança vinculada a OS e laudos.
4. Avançar o módulo de comunicação omnichannel com base em conversas e mensagens.

## Tags de contexto

Use tags para facilitar busca e organização das entradas futuras. Cada nova entrada deve citar 2–3 tags.

- `#clientes`
- `#equipamentos`
- `#os`
- `#laudos`
- `#ia`
- `#frontend`
- `#backend`
- `#prisma`
- `#ux`
- `#documentacao`
