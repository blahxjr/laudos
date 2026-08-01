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

## Comandos Git para enviar ao GitHub

```bash
git remote add origin https://github.com/<usuario>/<repo>.git
git branch -M main
git push -u origin main
```
