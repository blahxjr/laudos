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
      status: 'CONCLUIDA',
      priority: 'ALTA',
      notes: 'Seed de validação do fluxo.',
      activities: {
        create: [
          { type: 'STATUS', message: 'OS criada e encaminhada para diagnóstico.', author: 'Sistema' },
          { type: 'NOTE', message: 'Cliente relatou falha ao ligar o equipamento.', author: 'Cliente' },
        ],
      },
    },
  })

  const secondServiceOrder = await prisma.serviceOrder.create({
    data: {
      protocol: `OS-${new Date().getFullYear()}-SEED-${Date.now() + 1}`,
      clientId: client.id,
      equipmentId: equipment.id,
      status: 'AGUARDANDO_CLIENTE',
      priority: 'MEDIA',
      notes: 'OS aguardando retorno do cliente.',
      activities: {
        create: [{ type: 'STATUS', message: 'OS aguardando aprovação do orçamento.', author: 'Técnico' }],
      },
    },
  })

  const serviceCatalogItems = await prisma.serviceCatalog.createMany({
    data: [
      { name: 'Troca de fonte', description: 'Serviço de diagnóstico e substituição de fonte de alimentação.', price: 180.0 },
      { name: 'Limpeza interna', description: 'Limpeza e manutenção preventiva do equipamento.', price: 120.0 },
    ],
  })

  const partCatalogItems = await prisma.partCatalog.createMany({
    data: [
      { name: 'Fonte compatível 90W', description: 'Fonte de alimentação compatível para notebooks.', price: 150.0, stockQuantity: 10, minimumStock: 3 },
      { name: 'Pasta térmica', description: 'Pasta térmica para resfriamento do processador.', price: 35.0, stockQuantity: 6, minimumStock: 2 },
    ],
  })

  const [serviceCatalog, partCatalog] = await Promise.all([
    prisma.serviceCatalog.findFirst({ where: { name: 'Troca de fonte' } }),
    prisma.partCatalog.findFirst({ where: { name: 'Fonte compatível 90W' } }),
  ])

  if (!serviceCatalog || !partCatalog) {
    throw new Error('Seed prerequisites not found: catalog items')
  }

  const orderItems = await prisma.serviceOrderItem.createMany({
    data: [
      {
        serviceOrderId: serviceOrder.id,
        type: 'SERVICO',
        serviceCatalogId: serviceCatalog.id,
        description: serviceCatalog.name,
        quantity: 1,
        unitPrice: Number(serviceCatalog.price),
        totalPrice: Number(serviceCatalog.price),
      },
      {
        serviceOrderId: serviceOrder.id,
        type: 'PARTE',
        partCatalogId: partCatalog.id,
        description: partCatalog.name,
        quantity: 1,
        unitPrice: Number(partCatalog.price),
        totalPrice: Number(partCatalog.price),
      },
    ],
  })

  const serviceOrderItems = await prisma.serviceOrderItem.findMany({ where: { serviceOrderId: serviceOrder.id } })
  const invoiceSubtotal = serviceOrderItems.reduce((sum, item) => sum + Number(item.totalPrice ?? 0), 0)

  await prisma.invoice.create({
    data: {
      serviceOrderId: serviceOrder.id,
      clientId: client.id,
      subtotal: invoiceSubtotal,
      discountAmount: 0,
      total: invoiceSubtotal,
      status: 'PENDENTE',
      issuedAt: new Date(),
    },
  })

  const channel = await prisma.channel.create({
    data: {
      type: 'WHATSAPP_WEB',
      name: 'WhatsApp de atendimento',
      isActive: true,
    },
  })

  const conversation = await prisma.conversation.create({
    data: {
      channelId: channel.id,
      clientId: client.id,
      serviceOrderId: serviceOrder.id,
      externalId: '+5511999999999',
      status: 'OPEN',
    },
  })

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: 'INBOUND',
      type: 'TEXT',
      content: 'Olá, meu notebook não liga.',
      receivedAt: new Date(),
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
    secondServiceOrderId: secondServiceOrder.id,
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
