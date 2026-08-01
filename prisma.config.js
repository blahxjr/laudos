// prisma.config.js
const { defineConfig } = require("prisma/config");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:Alice100%25@localhost:5432/assist_tech_laudos?schema=public';

const pool = new Pool({
  connectionString,
});

const adapter = new PrismaPg(pool);

module.exports = defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // URL exigida pelo migrate dev
    url: connectionString,
    // adapter para o Prisma Client
    adapter,
  },
});