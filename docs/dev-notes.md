# Desenvolvimento local

Este projeto é um sistema fullstack de gestão de assistência técnica de eletrônicos.
O backend usa Node, Express e Prisma com PostgreSQL; o frontend usa React + Vite.

## Estrutura principal

- `src/server.ts` - servidor Express e rotas da API
- `src/frontend/main.tsx` - entrypoint do frontend React
- `src/frontend/AppShell.tsx` - layout e navegação do painel
- `src/frontend/ClientsPage.tsx` - módulo de clientes
- `src/frontend/ServiceOrdersPage.tsx` - módulo de ordens de serviço
- `src/frontend/TechnicalReportTabs.tsx` - visualização de laudo técnico
- `prisma/schema.prisma` - modelo de dados Prisma
- `prisma.config.js` - configuração do Prisma e adapter PostgreSQL
- `scripts/seed.ts` - script de semeadura de dados de exemplo
- `docker-compose.yml` - container PostgreSQL para desenvolvimento

## Passos básicos

1. Instalar dependências:

```bash
npm install
```

2. Iniciar o banco PostgreSQL:

```bash
docker compose up -d
```

3. Definir `DATABASE_URL` (pode ser via `.env`):

```bash
set DATABASE_URL=postgresql://postgres:Alice100%25@localhost:5432/assist_tech_laudos?schema=public
```

4. Aplicar migrations:

```bash
npx prisma migrate dev --name init
```

5. Popular dados de exemplo:

```bash
npm run db:seed
```

6. Iniciar backend:

```bash
npm run dev
```

7. Iniciar frontend:

```bash
npm run frontend:dev
```

## Scripts importantes

- `npm run dev` - inicia o backend em `http://localhost:3000`
- `npm run frontend:dev` - inicia o frontend Vite em `http://localhost:5173`
- `npm run db:seed` - popula o banco com dados de exemplo
- `npm test` - executa testes Node

## Módulos do sistema

- **Clientes** - cadastro, edição, busca e validação de CPF/CNPJ
- **Equipamentos** - cadastro e vínculo com cliente
- **Ordens de Serviço** - criação, atualização e arquivamento de OS
- **Laudos Técnicos** - relatórios vinculados à OS com componentes e fotos
- **IA** - endpoint de sugestão de texto para laudos (`/ai/reports/:id/suggest`), atualmente como stub local

## Dependências externas

- Backend: `express`, `cors`, `pg`, `@prisma/client`, `@prisma/adapter-pg`, `tsx`
- Frontend: `react`, `react-dom`, `vite`, `@vitejs/plugin-react`
- Dev: `typescript`, `@types/node`, `@types/express`, `@types/react`, `@types/react-dom`

## Observações

- O projeto já usa `type: module` em `package.json`.
- O Prisma client gerado fica em `generated/prisma`.
- A conexão com o banco é controlada por `DATABASE_URL`.

## Arquitetura de agentes e uso de IA no desenvolvimento

O projeto utiliza uma arquitetura colaborativa de agentes para orientar evolução, qualidade e coordenação entre frontend, backend, banco e IA.
### Rotina obrigatória do Agente Orquestrador

O Agente Orquestrador deve garantir que toda tarefa relevante passa pela rotina obrigatória antes de ser considerada concluída:

- executar `npm test` ou `npm test -- --runInBand` e confirmar sucesso;
- executar `npx vite build` e confirmar que o frontend compila;
- revisar `git status` e `git diff` para resumir mudanças em módulos e arquivos principais;
- gerar a mensagem de commit em formato `tipo: descrição curta`;
- preparar os comandos `git add .`, `git commit -m "<mensagem>"` e `git push origin main`;
- atualizar `PROJECT_MEMORY.md` com registro de data/hora, resumo técnico, impacto nas camadas e próximos passos;
- atualizar `docs/dev-notes.md` sempre que houver detalhes de teste, build ou pontos de atenção.

### Diretriz de foco funcional

Ao propor ou implementar mudanças no Assist Tech Laudos, priorize sempre as funcionalidades núcleo:

- geração e edição persistente de laudos técnicos;
- cadastro e gestão de clientes;
- cadastro e gestão de serviços, peças e materiais;
- geração de cobrança automática baseada em OS + laudo.

O módulo de Comunicação/Omnichannel deve continuar evoluindo de forma concomitante, mas **não substitui o foco principal**. Antes de mexer em Comunicação, verifique se:

- o fluxo de laudo técnico está completo e persistindo dados corretamente;
- o cadastro de clientes, serviços e peças está funcional;
- o módulo financeiro/cobrança está ao menos gerando cobranças internas.

Ao propor próximos passos, alinhe sempre:

1. estado atual de laudos/clientes/serviços/financeiro, conforme `PROJECT_MEMORY.md`;
2. impacto da mudança na operação diária da assistência técnica;
3. como o módulo de Comunicação pode apoiar esses fluxos (notificações, mensagens, envio de laudo, etc.).

Essa rotina vale para qualquer agente (Frontend, Backend/API, Prisma, Comunicação/Omnichannel, IA, UX/Documentação).
### Papel dos agentes

- **Agente Orquestrador do Projeto**: mantém a visão global e garante que os fluxos principais continuem funcionando.
- **Agente Frontend**: evolui React/Vite e assegura que a rota `/service-orders` e o fluxo de laudo em abas permaneçam intactos.
- **Agente Backend/API**: mantém as rotas Express, validações e integrações com Prisma e IA.
- **Agente Banco/Prisma**: cuida do schema e das migrations, atualizando a documentação quando necessário.
- **Agente IA/Diagnóstico**: evolui a sugestão de diagnóstico assistido e mantém o `DiagnosticContext` alinhado com os campos do laudo.
- **Agente UX/Documentação**: documenta decisões e mantém a interface e os templates visuais consistentes.

### Como pedir ajuda a Copilot

- Orquestrador: `Analise AGENTS.md, docs/dev-notes.md e proponha os próximos passos para evoluir o módulo Service Orders sem quebrar a rota /service-orders.`
- Frontend: `Considerando o AppShell e o design system, melhore a página ServiceOrdersPage sem quebrar o fluxo de laudo em abas.`
- Backend: `Alinhe as rotas de clientes com o schema Prisma e valide se o endpoint /reports/:id/view continua funcionando.`
- Banco/Prisma: `Revise o schema.prisma para suportar um novo campo de endereço completo no cliente e atualize a seed.`
- IA/Diagnóstico: `Aprimore o endpoint /ai/reports/:id/suggest para gerar sugestões mais completas com base no DiagnosticContext existente.`
- UX/Documentação: `Atualize a documentação com o novo componente de laudo e registre o fluxo de decisão em dev-notes.`

### Configuração de agentes (AgentConfig)

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

## Nota

Sempre que o projeto evoluir, registre o motivo da mudança e o impacto esperado no fluxo de usuários.

## Rotina de commit e push (assistida por Copilot)

Para manter o repositório GitHub (`https://github.com/blahxjr/laudos`) sempre atualizado com mudanças bem comentadas, use esta rotina com ajuda do Copilot:

1. **Após finalizar um bloco de trabalho**

   - Garanta que o código compila e testes passam:
     - `npm test`
     - `npx vite build`
   - Atualize, se necessário:
     - `PROJECT_MEMORY.md` com o que foi feito,
     - `dev-notes.md` com detalhes técnicos relevantes.

2. **Peça ao Copilot um resumo das mudanças**

   No editor ou no terminal integrado, use um prompt deste tipo:

   > “Copilot, por favor:
   >  1. Rode `git status` e `git diff` para ver as mudanças pendentes.
   >  2. Gere um resumo curto (em português) do que mudou, focando em módulos e arquivos principais.
   >  3. Proponha uma mensagem de commit no formato:  
   >     `tipo: descrição curta`  
   >     (ex.: `feat: adicionar módulo de comunicação omnichannel` ou `fix: ajustar validação CPF/CNPJ no cadastro de clientes`).”

   Use essa mensagem sugerida como base para o commit.

3. **Automatizar o `git commit` com ajuda do Copilot**

   Depois de aprovar a mensagem de commit, peça ao Copilot:

   > “Copilot, gere os comandos Git para:
   >  1. adicionar os arquivos modificados,
   >  2. criar um commit com a mensagem sugerida,
   >  3. enviar para o remoto `origin main`.
   >
   > Use o formato:
   > ```bash
   > git add .
   > git commit -m "<mensagem>"
   > git push origin main
   > ```
   > Não execute automaticamente; apenas mostre os comandos para eu rodar no terminal.”

   Em seguida, copie/cole os comandos no terminal e execute manualmente.

4. **Boas práticas de mensagens de commit**

   - Use prefixos consistentes:
     - `feat:` para novas funcionalidades,
     - `fix:` para correções de bug,
     - `refactor:` para mudanças internas sem alterar comportamento externo,
     - `docs:` para alterações em README, AGENTS, PROJECT_MEMORY, etc.,
     - `chore:` para scripts, configs, CI.
   - Mantenha a descrição objetiva, mencionando módulo e impacto:
     - Ex.: `feat: modelar domínio de comunicação para futura integração WhatsApp`,
     - Ex.: `fix: alinhar validação PF/PJ com CPF/CNPJ no backend de clientes`.

5. **Integrar a rotina ao dia a dia**

   - Ao terminar cada “feature” ou correção:
     - peça ao Copilot esse resumo + mensagem de commit,
     - rode os comandos de commit e push,
     - verifique no GitHub se o commit chegou em `main`.

Seguindo esse fluxo, Copilot passa a atuar como **assistente de versionamento**, garantindo que cada bloco de evolução do Assist Tech Laudos esteja bem documentado e enviado ao GitHub com mensagens de commit claras e consistentes.

## Diagnóstico de coerência documental — 2026-08-02

### Resumo executivo

A documentação do projeto está, em geral, alinhada com a estrutura existente no repositório. A base arquitetural do Assist Tech Laudos está consistente com o que foi implementado em frontend, backend, Prisma e módulos de clientes, ordens de serviço, laudos e IA assistiva.

### Ponto principal de alinhamento

- O backend Express, o schema Prisma e a UI React/Vite correspondem ao escopo descrito em README, AGENTS e dev-notes.
- Os módulos de clientes, equipamentos, OS, laudos técnicos e sugestão de IA estão presentes na implementação real.
- A documentação foi útil para orientar a evolução do projeto, especialmente no que diz respeito a comunicação omnichannel e integração futura com WhatsApp/Telegram.

### Pontos de atenção

- O fluxo de laudo técnico está bem representado, mas ainda está em um estágio de maturidade funcional mais avançado na documentação do que na experiência completa do usuário.
- A IA atual é assistiva e baseada em stub local; isso está coerente com a documentação, mas ainda precisa de evolução para integração real com provedor externo.
- A comunicação omnichannel existe como base estrutural, mas ainda não está consolidada como experiência completa de atendimento.

### Evidências verificadas

- Testes executados com sucesso: `npm test`
- Build do frontend validado com sucesso: `npx vite build`

### Próximos passos sugeridos

1. Consolidar a edição e persistência de laudos na interface.
2. Evoluir a IA assistiva para uma proposta mais realista e observável.
3. Refinar o fluxo financeiro/ cobrança ligado a OS e laudos.
4. Expandir a camada de comunicação para suportar conversas e mensagens de forma mais integrada.

