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
