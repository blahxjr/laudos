import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from './generated/prisma/client.ts'

const connectionString = process.env.DATABASE_URL ?? 'postgresql://postgres:Alice100%25@localhost:5432/assist_tech_laudos?schema=public'
const pool = new Pool({ connectionString })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
await prisma.$connect()

try {
  const result = await prisma.client.create({
    data: {
      name: 'Teste isolado',
      type: 'PF',
      document: '52998224725',
      street: 'Rua Teste',
      number: '100',
      complement: 'Sala 1',
      neighborhood: 'Centro',
      city: 'São Paulo',
      state: 'SP',
      zipCode: '01000-000',
      accountStatus: 'ATIVO',
    },
  })
  console.log('CREATED', result)
} catch (error) {
  console.error(error)
} finally {
  await prisma.$disconnect()
}
