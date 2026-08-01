import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../generated/prisma/client.js'

const conn = process.env.DATABASE_URL
console.log('URL', conn)
const pool = new Pool({ connectionString: conn })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

try {
  await prisma.$connect()
  const count = await prisma.client.count()
  console.log({ count })
} catch (err) {
  console.error(err)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
