# Assist Tech Laudos

Sistema fullstack para gestão de assistência técnica de eletrônicos.

## Stack

- Frontend: React, Vite, TypeScript
- Backend: Node.js, Express, TypeScript
- Banco de dados: PostgreSQL
- ORM: Prisma v7 com adapter PostgreSQL

## Visão geral

O projeto cobre os principais módulos de um sistema de assistência técnica:

- `Clientes` - cadastro e validação de CPF/CNPJ
- `Equipamentos` - vinculação de equipamento ao cliente
- `Ordens de Serviço` - fluxo de serviço, status e prioridade
- `Laudos Técnicos` - relatórios vinculados a ordens de serviço
- `IA` - sugestão de texto para laudos via endpoint local

## Como começar

1. Instale as dependências:

```bash
npm install
```

2. Inicie o banco PostgreSQL:

```bash
docker compose up -d
```

3. Configure a variável de ambiente `DATABASE_URL`:

```bash
set DATABASE_URL=postgresql://postgres:Alice100%25@localhost:5432/assist_tech_laudos?schema=public
```

4. Aplique as migrations:

```bash
npx prisma migrate dev --name init
```

5. Rode o seed de exemplo:

```bash
npm run db:seed
```

6. Inicie o backend:

```bash
npm run dev
```

7. Inicie o frontend:

```bash
npm run frontend:dev
```

## Scripts úteis

- `npm run dev` - inicia o servidor backend em `http://localhost:3000`
- `npm run frontend:dev` - inicia o frontend Vite em `http://localhost:5173`
- `npm run db:seed` - popula o banco com dados de exemplo
- `npm test` - executa testes

## Estrutura de pastas

- `src/` - código-fonte principal
  - `src/server.ts` - servidor Express e rotas
  - `src/frontend/` - aplicação React
- `prisma/` - schema Prisma e migrações
- `scripts/` - scripts auxiliares, incluindo seed
- `generated/prisma/` - Prisma Client gerado

## Observações

- Não versionar `.env` nem arquivos sensíveis.
- `generated/prisma/` é excluído do Git pelos arquivos ignorados.

## Preparar repositório GitHub

Use os comandos abaixo manualmente:

```bash
git remote add origin https://github.com/<usuario>/<repo>.git
git branch -M main
git push -u origin main
```
