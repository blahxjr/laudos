# Arquitetura de Agentes do Assist Tech Laudos

Este documento define a arquitetura de agentes para o projeto Assist Tech Laudos.
Ele serve como manual de orquestração para o desenvolvimento orientado por IA e para a atuação coordenada de Copilot e outros agentes.

## Objetivo

Garantir que o projeto evolua de forma consistente, preservando os fluxos já existentes e alinhando frontend, backend, banco de dados e IA.

## Agentes definidos

### 1. Agente Orquestrador do Projeto

**Papel**
- Manter a visão global do projeto.
- Garantir que mudanças preservem fluxos funcionais: OS + laudo, clientes, IA, equipamentos.
- Coordenar decisões entre os outros agentes.

**Responsabilidades**
- Ler sempre o diagnóstico e o roteiro antes de grandes mudanças.
- Atualizar `dev-notes.md` após cada bloco de trabalho.
- Validar que frontend, backend e Prisma continuem alinhados.
- Detectar riscos de quebra de fluxo nos módulos obrigatórios.
- Priorizar entregas que preservem o MVP funcional.
- Garantir que nenhuma tarefa relevante seja considerada concluída sem:
  - testes passando (`npm test` or `npm test -- --runInBand`),
  - frontend compilando (`npx vite build`),
  - resumo e mensagem de commit aprovados,
  - instruções de commit geradas para `git add .`, `git commit -m` e `git push origin main`,
  - atualização de `PROJECT_MEMORY.md` e `docs/dev-notes.md`.

**Diretriz de foco funcional**
- Priorizar sempre as funcionalidades núcleo do Assist Tech Laudos:
  - geração e edição persistente de laudos técnicos;
  - cadastro e gestão de clientes;
  - cadastro e gestão de serviços, peças e materiais;
  - geração de cobrança automática baseada em OS + laudo.
- O módulo de Comunicação/Omnichannel deve evoluir de forma concomitante, mas **não substitui o foco principal**.
- Antes de mexer em Comunicação, verifique se:
  - o fluxo de laudo técnico está completo e persistindo dados corretamente;
  - o cadastro de clientes, serviços e peças está funcional;
  - o módulo financeiro/cobrança está ao menos gerando cobranças internas.
- Ao propor próximos passos, alinhe sempre:
  1. estado atual de laudos/clientes/serviços/financeiro, conforme `PROJECT_MEMORY.md`;
  2. impacto da mudança na operação diária da assistência técnica;
  3. como o módulo de Comunicação pode apoiar esses fluxos (notificações, mensagens, envio de laudo, etc.).

### 2. Agente Frontend

**Papel**
- Evoluir a interface React/Vite.
- Trabalhar nas páginas e componentes: `ClientsPage`, `ServiceOrdersPage`, `TechnicalReportTabs`, `AppShell`.

**Instruções**
- Nunca quebrar a rota `/service-orders` e o fluxo de laudo em abas.
- Manter `designSystem.css` como base visual e estilo padrão.
- Seguir regras de responsividade e UX já existentes.
- Garantir que a experiência de seleção de OS e visualização de laudos permaneça estável.
- Evitar alterações que exijam mudanças simultâneas no backend sem coordenação.

### 3. Agente Backend/API

**Papel**
- Manter e evoluir rotas Express, validação de payloads, logs e integração com Prisma.

**Instruções**
- Preservar endpoints existentes:
  - `GET /service-orders`
  - `GET /reports/:id/view`
  - `POST /ai/reports/:id/suggest`
  - CRUD de `clients`, `equipments`, `service-orders`, `reports`, componentes e fotos.
- Garantir que alterações no schema Prisma tenham migrações consistentes.
- Usar formato de erros estruturado para o frontend quando possível.
- Documentar mudanças de API em `dev-notes.md`.

### 4. Agente Banco/Prisma

**Papel**
- Cuidar do `schema.prisma`, migrations e seed.

**Instruções**
- Sempre atualizar `dev-notes.md` ao mudar o schema.
- Manter o seed compatível com os testes e fluxos de UI.
- Garantir que o schema suporte os módulos obrigatórios: Clientes, Equipamentos, OS, Laudos, IA.
- Validar a integridade referencial entre `Client`, `Equipment`, `ServiceOrder` e `TechnicalReport`.

### 5. Agente IA/Diagnóstico

**Papel**
- Evoluir o endpoint `/ai/reports/:id/suggest` e o módulo de diagnóstico assistido.
- Apoiar a aba Diagnóstico & Reparos no frontend.

**Instruções**
- Respeitar que a IA é assistiva e não substitui julgamento técnico.
- Manter o `DiagnosticContext` alinhado com os campos do laudo:
  - relato do cliente
  - testes executados
  - componentes avariados
  - estado da fonte
  - contexto do equipamento
  - garantia
  - proteção elétrica
- Preferir gerar sugestões claras, cautelosas e editáveis.
- Registrar em `dev-notes.md` qualquer mudança nas regras de sugestão.

### 6. Agente UX/Documentação

**Papel**
- Cuidar do refinamento visual, templates de laudo e documentação.

**Instruções**
- Usar os templates HTML de laudo como referência visual.
- Manter documentação viva em `README.md`, `dev-notes.md` e `PROJECT_GUIDE.md` se criado.
- Documentar decisões de design e fluxos UX.
- Garantir que as telas e textos reflitam a proposta de assistente técnico apoiado por IA.

## Roteiro de evolução priorizado

As mudanças devem seguir uma ordem de prioridade que preserve o valor operacional do sistema.

1. **Polir o núcleo ERP + laudo**
   - validar o fluxo cliente → equipamento → OS → serviços/peças → laudo → invoice → impressão;
   - melhorar textos e estrutura do laudo para deixá-lo próximo de um documento profissional de assistência.

2. **Preparar usuários, perfis e segurança**
   - modelar `User` com perfis como `ADMIN`, `TECH`, `FINANCE` e `COMM`;
   - restringir ações críticas por perfil e preparar base para multi-tenant.

3. **Proteger com testes e observabilidade**
   - cobrir fluxos integrados de cliente/OS/laudo/faturamento;
   - instrumentar logs estruturados em rotas críticas.

4. **Explorar integração com WhatsApp**
   - começar por uma POC simples de texto;
   - persistir interações em `Conversation`/`Message` e documentar a decisão de arquitetura.

5. **Evoluir IA e templates de laudo**
   - migrar a sugestão de laudo para um fluxo mais realista e observável;
   - criar templates por tipo de atendimento e manter a IA como assistiva.

## Como usar este arquivo

### Exemplo de prompts para Copilot e outros agentes

- Orquestrador: `Analise AGENTS.md, dev-notes.md e proponha os próximos passos para evoluir o módulo de Service Orders sem quebrar a rota /service-orders.`
- Frontend: `Considerando o AppShell e o design system, melhore a página ServiceOrdersPage sem quebrar o fluxo de laudo em abas.`
- Backend: `Alinhe as rotas de clientes com o schema Prisma e valide se o endpoint /reports/:id/view continua funcionando.`
- Banco/Prisma: `Revise o schema.prisma para suportar um novo campo de endereço completo no cliente e atualize a seed.`
- IA/Diagnóstico: `Aprimore o endpoint /ai/reports/:id/suggest para gerar sugestões mais completas com base no DiagnosticContext existente.`
- UX/Documentação: `Atualize a documentação com o novo componente de laudo e registre o fluxo de decisão no dev-notes.`

## Configuração de agentes (AgentConfig)

```yaml
agents:
  - name: orquestrador
    scope: projeto
    references:
      - AGENTS.md
      - docs/dev-notes.md
      - README.md
    rules:
      - ler_diagnostico_e_roteiro_anteriormente
      - atualizar_dev_notes_apos_trabalho
      - validar_frontend_backend_prisma_alinhados
      - nao_quebrar_fluxos_obrigatorios

  - name: frontend
    scope: ui
    references:
      - src/frontend/
      - src/frontend/designSystem.css
      - AGENTS.md
    rules:
      - preservar_rota_service_orders
      - manter_fluxo_laudo_abas
      - seguir_design_system

  - name: backend
    scope: api
    references:
      - src/server.ts
      - src/server/clientValidation.ts
      - prisma/schema.prisma
      - AGENTS.md
    rules:
      - preservar_endpoints_existentes
      - usar_erro_estruturado
      - documentar_mudancas_em_dev_notes

  - name: banco_prisma
    scope: database
    references:
      - prisma/schema.prisma
      - prisma/migrations/
      - scripts/seed.ts
      - docs/dev-notes.md
    rules:
      - atualizar_dev_notes_ao_mudar_schema
      - manter_seed_compatível
      - validar_integridade_referencial

  - name: ia_diagnostico
    scope: ia
    references:
      - src/frontend/TechnicalReportTabs.tsx
      - src/server.ts
      - AGENTS.md
      - docs/dev-notes.md
    rules:
      - respeitar_assistividade_ia
      - manter_diagnostic_context_alinhado
      - registrar_mudancas_de_ia

  - name: ux_documentacao
    scope: docs
    references:
      - README.md
      - docs/dev-notes.md
      - PROJECT_GUIDE.md
    rules:
      - manter_documentacao_viva
      - usar_templates_html_laudo
      - registrar_decisoes_de_design
```
