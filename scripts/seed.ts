import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.js'
import { Pool } from 'pg'

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres:Alice100%25@localhost:5432/assist_tech_laudos?schema=public'
}

const adapter = new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL }))
const prisma = new PrismaClient({ adapter })

async function main() {
  const client = await prisma.client.create({
    data: {
      name: 'TechAssist LTDA',
      type: 'PJ',
      document: '12.345.678/0001-90',
      accountStatus: 'ATIVO',
    },
  })

  const equipment = await prisma.equipment.create({
    data: {
      clientId: client.id,
      type: 'Notebook',
      model: 'Dell Latitude 5420',
      serialNumber: 'SN123456',
      physicalState: 'ATIVO',
    },
  })

  const serviceOrder = await prisma.serviceOrder.create({
    data: {
      protocol: `OS-${new Date().getFullYear()}-SEED-${Date.now()}`,
      clientId: client.id,
      equipmentId: equipment.id,
      status: 'ABERTA',
      priority: 'ALTA',
      notes: 'Seed de validação do fluxo.',
    },
  })

  const report = await prisma.technicalReport.create({
    data: {
      serviceOrderId: serviceOrder.id,
      companyName: 'TechAssist LTDA',
      companyDocument: '12.345.678/0001-90',
      companyContact: 'João da Silva',
      companyAddress: 'Rua das Flores, 100',
      companyEmail: 'contato@techassist.com.br',
      companySite: 'https://techassist.com.br',
      technicianName: 'Maria Souza',
      technicianRegistry: 'REG-001',
      cityDate: new Date(),
      clientReport: 'Cliente relata falha ao ligar o equipamento.',
      testsExecuted: 'Teste de alimentação e diagnóstico de hardware.',
      powerStageStatus: 'OK',
      usageTimeEstimate: '2 anos',
      probableCause: 'Fonte de alimentação com defeito.',
      technicalConclusion: 'Equipamento necessita troca da fonte.',
      noRepair: false,
      noRepairReason: null,
      partsValue: 150.0,
      laborValue: 300.0,
      totalValue: 450.0,
      version: 1,
      htmlSnapshot: '<h1>Laudo gerado pelo seed</h1>',
    },
  })

  await prisma.reportComponent.createMany({
    data: [
      {
        technicalReportId: report.id,
        description: 'Fonte de alimentação',
        quantity: 1,
        unitPrice: 150.0,
        price: 150.0,
      },
    ],
  })

  await prisma.reportPhoto.createMany({
    data: [
      {
        technicalReportId: report.id,
        storagePath: '/tmp/foto-1.jpg',
        caption: 'Foto do equipamento recebido',
      },
    ],
  })

  console.log(JSON.stringify({
    clientId: client.id,
    equipmentId: equipment.id,
    serviceOrderId: serviceOrder.id,
    reportId: report.id,
  }, null, 2))
}

main()
  .catch((error) => {
    console.error('Seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
