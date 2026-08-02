import express from 'express'
import type { Request, Response } from 'express'
import cors from 'cors'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../generated/prisma/client.js'
import { createClientApiErrorPayload, createClientValidationErrors, normalizeClientPayload } from './server/clientValidation.js'
import { createCommunicationsRouter } from './server/communicationsRouter.js'
import { SERVICE_ORDER_STATUS_OPTIONS, validateServiceOrderStatus } from './server/serviceOrderStatus.js'
import { applyStockDelta, isLowStock } from './server/stockFlow.js'
import { buildDashboardOverview } from './server/dashboard.js'
import { sendWhatsAppTextMessage } from './whatsappGateway.js'
import { buildWhatsAppFullSummary, buildWhatsAppShortSummary } from './frontend/whatsAppSummary.js'
import { handleWhatsAppWebhook } from './server/whatsappWebhook.js'
import { registerWhatsAppSettingsRoutes } from './server/whatsappSettingsRoutes.js'

// PrismaClient configurado para ESM (NodeNext).
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000
const connectionString = process.env.DATABASE_URL ?? 'postgresql://postgres:Alice100%25@localhost:5432/assist_tech_laudos?schema=public'

async function createServer() {
  const pool = new Pool({ connectionString })
  const prisma = new PrismaClient({
    adapter: new PrismaPg(pool),
  })

  try {
    await prisma.$connect()
  } catch (err) {
    console.warn('Prisma connection warning:', err)
  }

  const app = express()
  app.use(express.json())
  app.use(cors())
  app.use('/communications', createCommunicationsRouter(prisma))
  registerWhatsAppSettingsRoutes(app, prisma as any)

  const processInboundWebhook = (body: unknown) => {
    queueMicrotask(async () => {
      try {
        await handleWhatsAppWebhook(prisma, (body || {}) as any)
      } catch (error) {
        console.error('[whatsapp-webhook] async processing error:', error)
      }
    })
  }

  const handleInboundWebhookRequest = async (req: Request, res: Response) => {
    const gatewayToken = process.env.WHATSAPP_GATEWAY_WEBHOOK_TOKEN?.trim()
    const incomingToken = typeof req.headers['x-gateway-token'] === 'string'
      ? req.headers['x-gateway-token']
      : typeof req.query.token === 'string'
        ? req.query.token
        : undefined

    if (gatewayToken && incomingToken !== gatewayToken) {
      console.warn('[whatsapp-webhook] token inválido', { received: incomingToken ? 'present' : 'missing' })
      return res.status(401).json({ ok: false, error: 'Unauthorized' })
    }

    if (!gatewayToken && incomingToken) {
      console.warn('[whatsapp-webhook] token não configurado, mas foi recebido', { received: incomingToken })
    }

    try {
      const body = (req.body || {}) as any
      console.info('[whatsapp-webhook] request received', {
        event: body?.event,
        instanceName: body?.instance ?? body?.instanceName,
        messageId: body?.messageId ?? body?.data?.key?.id,
      })

      processInboundWebhook(body)
      return res.status(200).json({ ok: true, accepted: true })
    } catch (error) {
      console.error('POST /webhooks/whatsapp error:', error)
      return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  }

  app.post('/webhooks/whatsapp', handleInboundWebhookRequest)
  app.post('/communications/webhook/inbound', handleInboundWebhookRequest)

  app.post('/communications/whatsapp/send-summary', async (req: Request, res: Response) => {
    try {
      const { reportId, clientId, phone, mode = 'short' } = req.body as {
        reportId?: string
        clientId?: string
        phone?: string
        mode?: 'short' | 'full'
      }

      const report = reportId
        ? await prisma.technicalReport.findUnique({
            where: { id: reportId },
            include: {
              serviceOrder: {
                include: {
                  client: true,
                  equipment: true,
                  invoices: true,
                },
              },
            },
          })
        : null

      const client = clientId
        ? await prisma.client.findUnique({ where: { id: clientId } })
        : report?.serviceOrder?.client ?? null

      const serviceOrder = report?.serviceOrder ?? null
      const invoice = serviceOrder?.invoices?.[0] ?? null
      const resolvedPhone = typeof phone === 'string' && phone.trim()
        ? phone.trim()
        : (client?.whatsappNumber || client?.primaryPhone || '').trim()

      if (!resolvedPhone) {
        return res.status(400).json({ ok: false, error: 'Número de WhatsApp não encontrado para o cliente.' })
      }

      if (!report) {
        return res.status(404).json({ ok: false, error: 'Laudo não encontrado.' })
      }

      const summaryText = mode === 'full'
        ? buildWhatsAppFullSummary(
            {
              assistencia: { companyName: report.companyName },
              cliente: client,
              equipamento: serviceOrder?.equipment,
              diagnostico: {
                probableCause: report.probableCause,
                technicalConclusion: report.technicalConclusion,
              },
              financeiro: { totalValue: Number(report.totalValue ?? 0) },
              meta: { id: report.id, protocol: serviceOrder?.protocol },
            },
            { protocol: serviceOrder?.protocol },
            { total: Number(invoice?.total ?? report.totalValue ?? 0) },
            process.env.APP_BASE_URL || 'http://localhost:5173'
          )
        : buildWhatsAppShortSummary(
            {
              assistencia: { companyName: report.companyName },
              cliente: client,
              equipamento: serviceOrder?.equipment,
              diagnostico: {
                probableCause: report.probableCause,
                technicalConclusion: report.technicalConclusion,
              },
              financeiro: { totalValue: Number(report.totalValue ?? 0) },
              meta: { id: report.id, protocol: serviceOrder?.protocol },
            },
            { protocol: serviceOrder?.protocol },
            { total: Number(invoice?.total ?? report.totalValue ?? 0) },
            process.env.APP_BASE_URL || 'http://localhost:5173'
          )

      const gatewayResult = await sendWhatsAppTextMessage({ phone: resolvedPhone, text: summaryText })
      if (!gatewayResult.ok) {
        return res.status(502).json({ ok: false, error: gatewayResult.error || 'Falha ao enviar mensagem via gateway.' })
      }

      return res.json({ ok: true, phone: resolvedPhone, mode, reportId: report.id })
    } catch (error) {
      console.error('POST /communications/whatsapp/send-summary error:', error)
      return res.status(500).json({ ok: false, error: error instanceof Error ? error.message : String(error) })
    }
  })

  app.get('/health', async (_req: Request, res: Response) => {
    try {
      const clientsCount = await prisma.client.count()
      res.json({ status: 'ok', clientsCount })
    } catch (error) {
      console.error('Health check error:', error)
      res.status(500).json({ status: 'error', error: error instanceof Error ? error.message : String(error) })
    }
  })

  app.get('/dashboard/overview', async (_req: Request, res: Response) => {
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const [osByStatus, totalLaudos, totalFaturamento, last30DaysLaudos, last30DaysFaturamento] = await Promise.all([
        Promise.all([
          prisma.serviceOrder.count({ where: { status: 'ABERTA' } }),
          prisma.serviceOrder.count({ where: { status: 'EM_DIAGNOSTICO' } }),
          prisma.serviceOrder.count({ where: { status: 'AGUARDANDO_CLIENTE' } }),
          prisma.serviceOrder.count({ where: { status: 'CONCLUIDA' } }),
          prisma.serviceOrder.count({ where: { status: 'SEM_CONSERTO' } }),
        ]),
        prisma.technicalReport.count(),
        prisma.invoice.aggregate({ _sum: { total: true } }),
        prisma.technicalReport.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
        prisma.invoice.aggregate({
          _sum: { total: true },
          where: { issuedAt: { gte: thirtyDaysAgo } },
        }),
      ])

      const overview = buildDashboardOverview({
        osByStatus: {
          ABERTA: osByStatus[0],
          EM_DIAGNOSTICO: osByStatus[1],
          AGUARDANDO_CLIENTE: osByStatus[2],
          CONCLUIDA: osByStatus[3],
          SEM_CONSERTO: osByStatus[4],
        },
        totalLaudos,
        totalFaturamento: Number(totalFaturamento._sum.total ?? 0),
        last30DaysLaudos,
        last30DaysFaturamento: Number(last30DaysFaturamento._sum.total ?? 0),
      })

      res.json(overview)
    } catch (error) {
      console.error('GET /dashboard/overview error:', error)
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
    }
  })

  /* -------------------------------------------------------------------------- */
  /* Client routes                                                              */
  /* -------------------------------------------------------------------------- */

  const validateClientInput = async (data: any, prismaClient: any, currentId?: string) => {
    const payload = normalizeClientPayload(data)
    const errors = createClientValidationErrors(payload)

    if (payload.document) {
      const existing = await prismaClient.client.findFirst({
        where: {
          document: payload.document,
          id: currentId ? { not: currentId } : undefined,
        } as any,
      })
      if (existing) {
        errors.push({ field: 'document', code: 'DUPLICATE_DOCUMENT', message: 'Já existe um cliente com este CPF/CNPJ.' })
      }
    }

    return { valid: errors.length === 0, errors }
  }

  app.get('/clients', async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1)
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10))
      const skip = (page - 1) * pageSize

      const [clients, total] = await Promise.all([
        prisma.client.findMany({ skip, take: pageSize, orderBy: { createdAt: 'desc' } }),
        prisma.client.count(),
      ])

      res.json({ data: clients, meta: { page, pageSize, total } })
    } catch (err) {
      console.error('GET /clients error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.get('/clients/:id', async (req: Request, res: Response) => {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'Missing id' })

    try {
      const client = await prisma.client.findUnique({ where: { id } })
      if (!client) return res.status(404).json({ error: 'Client not found' })
      res.json(client)
    } catch (err) {
      console.error('GET /clients/:id error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.post('/clients', async (req: Request, res: Response) => {
    try {
      const payload = normalizeClientPayload(req.body)
      console.log('[POST /clients] payload', {
        type: payload.type,
        document: payload.document,
        city: payload.city,
        state: payload.state,
        zipCode: payload.zipCode,
        name: payload.name,
      })

      const { valid, errors } = await validateClientInput(payload, prisma)
      if (!valid) {
        const errorPayload = createClientApiErrorPayload(errors)
        const isDuplicate = errors.some((error) => error.code === 'DUPLICATE_DOCUMENT')
        return res.status(isDuplicate ? 409 : 400).json(errorPayload)
      }

      const createPayload = {
        name: payload.name,
        type: payload.type,
        document: payload.document,
        street: payload.street,
        number: payload.number,
        complement: payload.complement,
        neighborhood: payload.neighborhood,
        city: payload.city,
        state: payload.state,
        zipCode: payload.zipCode,
        primaryPhone: payload.primaryPhone,
        whatsappNumber: payload.whatsappNumber,
        telegramHandle: payload.telegramHandle,
        accountStatus: payload.accountStatus,
      }

      const created = await prisma.client.create({ data: createPayload as any })
      res.status(201).json(created)
    } catch (err) {
      console.error('POST /clients error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.put('/clients/:id', async (req: Request, res: Response) => {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'Missing id' })

    try {
      const payload = normalizeClientPayload(req.body)
      const { valid, errors } = await validateClientInput(payload, prisma, id)
      if (!valid) {
        const errorPayload = createClientApiErrorPayload(errors)
        return res.status(400).json(errorPayload)
      }

      const existing = await prisma.client.findUnique({ where: { id } })
      if (!existing) return res.status(404).json({ error: 'Client not found' })

      const updatePayload = {
        name: payload.name,
        type: payload.type,
        document: payload.document,
        street: payload.street,
        number: payload.number,
        complement: payload.complement,
        neighborhood: payload.neighborhood,
        city: payload.city,
        state: payload.state,
        zipCode: payload.zipCode,
        primaryPhone: payload.primaryPhone,
        whatsappNumber: payload.whatsappNumber,
        telegramHandle: payload.telegramHandle,
        accountStatus: payload.accountStatus,
      }

      const updated = await prisma.client.update({ where: { id }, data: updatePayload as any })
      res.json(updated)
    } catch (err) {
      console.error('PUT /clients/:id error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.delete('/clients/:id', async (req: Request, res: Response) => {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'Missing id' })

    try {
      const existing = await prisma.client.findUnique({ where: { id } })
      if (!existing) return res.status(404).json({ error: 'Client not found' })

      const updated = await prisma.client.update({ where: { id }, data: { accountStatus: 'INATIVO' } as any })
      res.json({ message: 'Client marked as INATIVO', client: updated })
    } catch (err) {
      console.error('DELETE /clients/:id error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  /* -------------------------------------------------------------------------- */
  /* Equipment routes                                                            */
  /* -------------------------------------------------------------------------- */

  const validateEquipmentInput = (data: any) => {
    const errors: string[] = []
    if (!data || typeof data !== 'object') {
      errors.push('Invalid payload')
      return { valid: false, errors }
    }

    const { clientId, type } = data
    if (!clientId || typeof clientId !== 'string' || !clientId.trim()) {
      errors.push('Field "clientId" is required')
    }
    if (!type || typeof type !== 'string' || !type.trim()) {
      errors.push('Field "type" is required')
    }

    return { valid: errors.length === 0, errors }
  }

  app.get('/equipments', async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1)
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10))
      const skip = (page - 1) * pageSize

      const [equipments, total] = await Promise.all([
        prisma.equipment.findMany({ skip, take: pageSize, orderBy: { createdAt: 'desc' } }),
        prisma.equipment.count(),
      ])

      res.json({ data: equipments, meta: { page, pageSize, total } })
    } catch (err) {
      console.error('GET /equipments error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.get('/equipments/:id', async (req: Request, res: Response) => {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'Missing id' })

    try {
      const equipment = await prisma.equipment.findUnique({ where: { id } })
      if (!equipment) return res.status(404).json({ error: 'Equipment not found' })
      res.json(equipment)
    } catch (err) {
      console.error('GET /equipments/:id error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.get('/clients/:clientId/equipments', async (req: Request, res: Response) => {
    const clientId = req.params.clientId
    if (!clientId) return res.status(400).json({ error: 'Missing clientId' })

    try {
      const equipments = await prisma.equipment.findMany({ where: { clientId }, orderBy: { createdAt: 'desc' } })
      res.json({ data: equipments })
    } catch (err) {
      console.error('GET /clients/:clientId/equipments error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.post('/equipments', async (req: Request, res: Response) => {
    try {
      const payload = req.body
      const { valid, errors } = validateEquipmentInput(payload)
      if (!valid) return res.status(400).json({ error: errors.join('; ') })

      const clientId = typeof payload.clientId === 'string' && payload.clientId.trim() ? payload.clientId : undefined
      if (!clientId) return res.status(400).json({ error: 'Field "clientId" is required' })

      // Optionally ensure client exists
      const client = await prisma.client.findUnique({ where: { id: clientId } })
      if (!client) return res.status(404).json({ error: 'Client not found for provided clientId' })

      const created = await prisma.equipment.create({ data: { ...payload, clientId } })
      res.status(201).json(created)
    } catch (err) {
      console.error('POST /equipments error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.put('/equipments/:id', async (req: Request, res: Response) => {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'Missing id' })

    try {
      const payload = req.body
      const { valid, errors } = validateEquipmentInput({ ...payload, clientId: payload.clientId ?? undefined })
      if (!valid) return res.status(400).json({ error: errors.join('; ') })

      const existing = await prisma.equipment.findUnique({ where: { id } })
      if (!existing) return res.status(404).json({ error: 'Equipment not found' })

      const updated = await prisma.equipment.update({ where: { id }, data: payload })
      res.json(updated)
    } catch (err) {
      console.error('PUT /equipments/:id error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.delete('/equipments/:id', async (req: Request, res: Response) => {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'Missing id' })

    try {
      const existing = await prisma.equipment.findUnique({ where: { id } })
      if (!existing) return res.status(404).json({ error: 'Equipment not found' })

      // Mark as inativo via physicalState
      const updated = await prisma.equipment.update({ where: { id }, data: { physicalState: 'INATIVO' } as any })
      res.json({ message: 'Equipment marked as INATIVO', equipment: updated })
    } catch (err) {
      console.error('DELETE /equipments/:id error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  /* -------------------------------------------------------------------------- */
  /* ServiceOrder routes                                                         */
  /* -------------------------------------------------------------------------- */

  const SERVICE_ORDER_STATUSES = SERVICE_ORDER_STATUS_OPTIONS.map((option) => option.value)
  const SERVICE_ORDER_PRIORITIES = ['BAIXA', 'MEDIA', 'ALTA']

  const generateProtocol = async () => {
    const year = new Date().getFullYear()
    const prefix = `OS-${year}-`
    const count = await prisma.serviceOrder.count({ where: { protocol: { startsWith: prefix } } })
    const seq = String(count + 1).padStart(6, '0')
    return `${prefix}${seq}`
  }

  const validateServiceOrderInput = (data: any, requireIds = true) => {
    const errors: string[] = []
    if (!data || typeof data !== 'object') {
      errors.push('Invalid payload')
      return { valid: false, errors }
    }

    const { clientId, equipmentId, status, priority } = data
    if (requireIds) {
      if (!clientId || typeof clientId !== 'string' || !clientId.trim()) errors.push('Field "clientId" is required')
      if (!equipmentId || typeof equipmentId !== 'string' || !equipmentId.trim()) errors.push('Field "equipmentId" is required')
    }
    if (status !== undefined) {
      const statusValidation = validateServiceOrderStatus(status)
      if (!statusValidation.valid) errors.push(statusValidation.error ?? 'Invalid status')
    }
    if (priority !== undefined && !SERVICE_ORDER_PRIORITIES.includes(priority)) errors.push('Invalid priority')

    return { valid: errors.length === 0, errors }
  }

  app.get('/service-orders', async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1)
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10))
      const skip = (page - 1) * pageSize

      const where: any = {}
      if (req.query.status) where.status = String(req.query.status)
      if (req.query.clientId) where.clientId = String(req.query.clientId)
      if (req.query.equipmentId) where.equipmentId = String(req.query.equipmentId)

      const [orders, total] = await Promise.all([
        prisma.serviceOrder.findMany({ where, skip, take: pageSize, orderBy: { createdAt: 'desc' } }),
        prisma.serviceOrder.count({ where }),
      ])

      res.json({ data: orders, meta: { page, pageSize, total } })
    } catch (err) {
      console.error('GET /service-orders error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.get('/service-orders/:id', async (req: Request, res: Response) => {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'Missing id' })

    try {
      const order = await prisma.serviceOrder.findUnique({ where: { id }, include: { client: true, equipment: true } })
      if (!order) return res.status(404).json({ error: 'ServiceOrder not found' })
      res.json(order)
    } catch (err) {
      console.error('GET /service-orders/:id error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.post('/service-orders', async (req: Request, res: Response) => {
    try {
      const payload = req.body
      const clientId = typeof payload?.clientId === 'string' && payload.clientId.trim() ? payload.clientId : undefined
      const equipmentId = typeof payload?.equipmentId === 'string' && payload.equipmentId.trim() ? payload.equipmentId : undefined
      if (!clientId || !equipmentId) return res.status(400).json({ error: 'Fields "clientId" and "equipmentId" are required' })
      const { valid, errors } = validateServiceOrderInput(payload, true)
      if (!valid) return res.status(400).json({ error: errors.join('; ') })

      // ensure client and equipment exist
      const [client, equipment] = await Promise.all([
        prisma.client.findUnique({ where: { id: clientId } }),
        prisma.equipment.findUnique({ where: { id: equipmentId } }),
      ])
      if (!client) return res.status(404).json({ error: 'Client not found for provided clientId' })
      if (!equipment) return res.status(404).json({ error: 'Equipment not found for provided equipmentId' })

      const protocol = await generateProtocol()
      const data: any = { ...payload, clientId, equipmentId, protocol, status: 'ABERTA' }
      const created = await prisma.serviceOrder.create({ data })
      res.status(201).json(created)
    } catch (err) {
      console.error('POST /service-orders error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.put('/service-orders/:id', async (req: Request, res: Response) => {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'Missing id' })

    try {
      const payload = req.body
      const { valid, errors } = validateServiceOrderInput(payload, false)
      if (!valid) return res.status(400).json({ error: errors.join('; ') })

      const existing = await prisma.serviceOrder.findUnique({ where: { id } })
      if (!existing) return res.status(404).json({ error: 'ServiceOrder not found' })

      const allowed: any = {}
      if (payload.status !== undefined) allowed.status = payload.status
      if (payload.priority !== undefined) allowed.priority = payload.priority
      if (payload.assignedUserId !== undefined) allowed.assignedUserId = payload.assignedUserId
      if (payload.notes !== undefined) allowed.notes = payload.notes

      const updated = await prisma.serviceOrder.update({ where: { id }, data: allowed })
      res.json(updated)
    } catch (err) {
      console.error('PUT /service-orders/:id error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.delete('/service-orders/:id', async (req: Request, res: Response) => {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'Missing id' })

    try {
      const existing = await prisma.serviceOrder.findUnique({ where: { id } })
      if (!existing) return res.status(404).json({ error: 'ServiceOrder not found' })

      const updated = await prisma.serviceOrder.update({ where: { id }, data: { notes: `${existing.notes ?? ''}\nARCHIVED`, status: 'CONCLUIDA', closedAt: new Date() } as any })
      res.json({ message: 'ServiceOrder archived', serviceOrder: updated })
    } catch (err) {
      console.error('DELETE /service-orders/:id error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.get('/service-orders/:id/activities', async (req: Request, res: Response) => {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'Missing id' })

    try {
      const activities = await prisma.serviceOrderActivity.findMany({
        where: { serviceOrderId: id },
        orderBy: { createdAt: 'asc' },
      })
      res.json({ data: activities })
    } catch (err) {
      console.error('GET /service-orders/:id/activities error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.post('/service-orders/:id/activities', async (req: Request, res: Response) => {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'Missing id' })

    try {
      const existing = await prisma.serviceOrder.findUnique({ where: { id } })
      if (!existing) return res.status(404).json({ error: 'ServiceOrder not found' })

      const payload = req.body ?? {}
      const message = typeof payload.message === 'string' ? payload.message.trim() : ''
      const author = typeof payload.author === 'string' && payload.author.trim() ? payload.author.trim() : null
      const type = typeof payload.type === 'string' && payload.type.trim() ? payload.type.trim().toUpperCase() : 'NOTE'

      if (!message) return res.status(400).json({ error: 'Field "message" is required' })

      const created = await prisma.serviceOrderActivity.create({
        data: {
          serviceOrderId: id,
          type,
          message,
          author: author ?? undefined,
        },
      })
      res.status(201).json(created)
    } catch (err) {
      console.error('POST /service-orders/:id/activities error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.put('/service-orders/:id/status', async (req: Request, res: Response) => {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'Missing id' })

    try {
      const payload = req.body ?? {}
      const status = typeof payload.status === 'string' ? payload.status.trim().toUpperCase() : undefined
      const statusValidation = validateServiceOrderStatus(status)
      if (!statusValidation.valid) return res.status(400).json({ error: statusValidation.error })

      const existing = await prisma.serviceOrder.findUnique({ where: { id } })
      if (!existing) return res.status(404).json({ error: 'ServiceOrder not found' })

      const normalizedStatus = status as any
      const closedAt = normalizedStatus === 'CONCLUIDA' ? (existing.closedAt ?? new Date()) : null
      const updated = await prisma.serviceOrder.update({
        where: { id },
        data: { status: normalizedStatus, closedAt },
      })

      const activityMessage = typeof payload.message === 'string' && payload.message.trim()
        ? payload.message.trim()
        : `Status atualizado para ${normalizedStatus}.`
      const activityAuthor = typeof payload.author === 'string' && payload.author.trim() ? payload.author.trim() : 'Sistema'
      const activity = await prisma.serviceOrderActivity.create({
        data: {
          serviceOrderId: id,
          type: 'STATUS',
          message: activityMessage,
          author: activityAuthor,
        },
      })

      res.json({ serviceOrder: updated, activity })
    } catch (err) {
      console.error('PUT /service-orders/:id/status error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  const parseDecimal = (value: any) => {
    if (value === null || value === undefined || value === '') return null
    if (typeof value === 'number') return value
    if (typeof value === 'string') {
      const cleaned = value.replace(/\./g, '').replace(',', '.')
      const n = Number(cleaned)
      return Number.isNaN(n) ? null : n
    }
    return null
  }

  const calculateTotalPrice = (quantity: number, unitPrice: number) => {
    return Number((quantity * unitPrice).toFixed(2))
  }

  /* -------------------------------------------------------------------------- */
  /* Catalog and Billing routes                                                   */
  /* -------------------------------------------------------------------------- */

  app.get('/services/catalog', async (_req: Request, res: Response) => {
    try {
      const services = await prisma.serviceCatalog.findMany({ orderBy: { createdAt: 'desc' } })
      res.json({ data: services })
    } catch (err) {
      console.error('GET /services/catalog error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.get('/parts/low-stock', async (_req: Request, res: Response) => {
    try {
      const parts = await prisma.partCatalog.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      })
      const lowStockParts = parts.filter((part: any) => isLowStock(Number(part.stockQuantity ?? 0), Number(part.minimumStock ?? 0)))
      res.json({ data: lowStockParts })
    } catch (err) {
      console.error('GET /parts/low-stock error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.post('/services/catalog', async (req: Request, res: Response) => {
    try {
      const { name, description, price } = req.body
      const normalizedPrice = parseDecimal(price)
      if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Field "name" is required' })
      if (normalizedPrice === null || normalizedPrice < 0) return res.status(400).json({ error: 'Field "price" must be a valid non-negative number' })

      const created = await prisma.serviceCatalog.create({ data: { name, description, price: normalizedPrice } })
      res.status(201).json(created)
    } catch (err) {
      console.error('POST /services/catalog error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.put('/services/catalog/:id', async (req: Request, res: Response) => {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'Missing id' })
    try {
      const { name, description, price, isActive } = req.body
      const normalizedPrice = price !== undefined ? parseDecimal(price) : undefined
      if (name !== undefined && typeof name !== 'string') return res.status(400).json({ error: 'Field "name" must be a string' })
      if (normalizedPrice !== undefined && (normalizedPrice === null || normalizedPrice < 0)) return res.status(400).json({ error: 'Field "price" must be a valid non-negative number' })

      const existing = await prisma.serviceCatalog.findUnique({ where: { id } })
      if (!existing) return res.status(404).json({ error: 'ServiceCatalog item not found' })

      const data: any = {}
      if (name !== undefined) data.name = name
      if (description !== undefined) data.description = description
      if (normalizedPrice !== undefined) data.price = normalizedPrice
      if (isActive !== undefined) data.isActive = isActive

      const updated = await prisma.serviceCatalog.update({ where: { id }, data })
      res.json(updated)
    } catch (err) {
      console.error('PUT /services/catalog/:id error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.delete('/services/catalog/:id', async (req: Request, res: Response) => {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'Missing id' })
    try {
      const existing = await prisma.serviceCatalog.findUnique({ where: { id } })
      if (!existing) return res.status(404).json({ error: 'ServiceCatalog item not found' })

      const updated = await prisma.serviceCatalog.update({ where: { id }, data: { isActive: false } })
      res.json({ message: 'ServiceCatalog item marked as inactive', service: updated })
    } catch (err) {
      console.error('DELETE /services/catalog/:id error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.get('/parts/catalog', async (_req: Request, res: Response) => {
    try {
      const parts = await prisma.partCatalog.findMany({ orderBy: { createdAt: 'desc' } })
      res.json({ data: parts })
    } catch (err) {
      console.error('GET /parts/catalog error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.post('/parts/catalog', async (req: Request, res: Response) => {
    try {
      const { name, description, price, stockQuantity, minimumStock } = req.body
      const normalizedPrice = parseDecimal(price)
      const normalizedStockQuantity = Number(stockQuantity)
      const normalizedMinimumStock = Number(minimumStock)
      if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Field "name" is required' })
      if (normalizedPrice === null || normalizedPrice < 0) return res.status(400).json({ error: 'Field "price" must be a valid non-negative number' })
      if (!Number.isFinite(normalizedStockQuantity) || normalizedStockQuantity < 0) return res.status(400).json({ error: 'Field "stockQuantity" must be a non-negative number' })
      if (!Number.isFinite(normalizedMinimumStock) || normalizedMinimumStock < 0) return res.status(400).json({ error: 'Field "minimumStock" must be a non-negative number' })

      const created = await prisma.partCatalog.create({
        data: {
          name,
          description,
          price: normalizedPrice,
          stockQuantity: normalizedStockQuantity,
          minimumStock: normalizedMinimumStock,
        },
      })
      res.status(201).json(created)
    } catch (err) {
      console.error('POST /parts/catalog error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.put('/parts/catalog/:id', async (req: Request, res: Response) => {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'Missing id' })
    try {
      const { name, description, price, stockQuantity, minimumStock, isActive } = req.body
      const normalizedPrice = price !== undefined ? parseDecimal(price) : undefined
      const normalizedStockQuantity = stockQuantity !== undefined ? Number(stockQuantity) : undefined
      const normalizedMinimumStock = minimumStock !== undefined ? Number(minimumStock) : undefined
      if (name !== undefined && typeof name !== 'string') return res.status(400).json({ error: 'Field "name" must be a string' })
      if (normalizedPrice !== undefined && (normalizedPrice === null || normalizedPrice < 0)) return res.status(400).json({ error: 'Field "price" must be a valid non-negative number' })
      if (normalizedStockQuantity !== undefined && (!Number.isFinite(normalizedStockQuantity) || normalizedStockQuantity < 0)) return res.status(400).json({ error: 'Field "stockQuantity" must be a non-negative number' })
      if (normalizedMinimumStock !== undefined && (!Number.isFinite(normalizedMinimumStock) || normalizedMinimumStock < 0)) return res.status(400).json({ error: 'Field "minimumStock" must be a non-negative number' })

      const existing = await prisma.partCatalog.findUnique({ where: { id } })
      if (!existing) return res.status(404).json({ error: 'PartCatalog item not found' })

      const data: any = {}
      if (name !== undefined) data.name = name
      if (description !== undefined) data.description = description
      if (normalizedPrice !== undefined) data.price = normalizedPrice
      if (normalizedStockQuantity !== undefined) data.stockQuantity = normalizedStockQuantity
      if (normalizedMinimumStock !== undefined) data.minimumStock = normalizedMinimumStock
      if (isActive !== undefined) data.isActive = isActive

      const updated = await prisma.partCatalog.update({ where: { id }, data })
      res.json(updated)
    } catch (err) {
      console.error('PUT /parts/catalog/:id error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.delete('/parts/catalog/:id', async (req: Request, res: Response) => {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'Missing id' })
    try {
      const existing = await prisma.partCatalog.findUnique({ where: { id } })
      if (!existing) return res.status(404).json({ error: 'PartCatalog item not found' })

      const updated = await prisma.partCatalog.update({ where: { id }, data: { isActive: false } })
      res.json({ message: 'PartCatalog item marked as inactive', part: updated })
    } catch (err) {
      console.error('DELETE /parts/catalog/:id error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.get('/service-orders/:id/items', async (req: Request, res: Response) => {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'Missing id' })
    try {
      const items = await prisma.serviceOrderItem.findMany({ where: { serviceOrderId: id }, include: { serviceCatalog: true, partCatalog: true } })
      res.json({ data: items })
    } catch (err) {
      console.error('GET /service-orders/:id/items error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.post('/service-orders/:id/items', async (req: Request, res: Response) => {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'Missing service order id' })
    try {
      const serviceOrder = await prisma.serviceOrder.findUnique({ where: { id } })
      if (!serviceOrder) return res.status(404).json({ error: 'ServiceOrder not found' })

      const { type, serviceCatalogId, partCatalogId, description, quantity, unitPrice } = req.body
      if (!type || (type !== 'SERVICO' && type !== 'PARTE')) return res.status(400).json({ error: 'Field "type" must be SERVICO or PARTE' })
      if (!description || typeof description !== 'string') return res.status(400).json({ error: 'Field "description" is required' })
      if (type === 'PARTE' && (!partCatalogId || typeof partCatalogId !== 'string' || !partCatalogId.trim())) return res.status(400).json({ error: 'Field "partCatalogId" is required for PARTE items' })

      const quantityNumber = Number(quantity)
      const priceNumber = parseDecimal(unitPrice)
      if (!Number.isFinite(quantityNumber) || quantityNumber <= 0) return res.status(400).json({ error: 'Field "quantity" must be a positive number' })
      if (priceNumber === null || priceNumber < 0) return res.status(400).json({ error: 'Field "unitPrice" must be a valid non-negative number' })

      let stockUpdateResult: { valid: boolean; stockQuantity: number; error?: string } | null = null
      if (type === 'PARTE' && partCatalogId) {
        const partCatalog = await prisma.partCatalog.findUnique({ where: { id: String(partCatalogId) } })
        if (!partCatalog) return res.status(404).json({ error: 'PartCatalog item not found' })
        stockUpdateResult = applyStockDelta({
          currentStock: Number(partCatalog.stockQuantity ?? 0),
          minimumStock: Number(partCatalog.minimumStock ?? 0),
          quantity: quantityNumber,
          direction: 'decrement',
        })
        if (!stockUpdateResult.valid) return res.status(400).json({ error: stockUpdateResult.error })
        const lowStock = isLowStock(stockUpdateResult.stockQuantity, Number(partCatalog.minimumStock ?? 0))
        await prisma.partCatalog.update({
          where: { id: partCatalog.id },
          data: { stockQuantity: stockUpdateResult.stockQuantity },
        })
        if (lowStock) {
          console.warn(`[stock] Part ${partCatalog.name} is below minimum stock after OS consumption`) 
        }
      }

      const totalPrice = calculateTotalPrice(quantityNumber, priceNumber)
      const created = await prisma.serviceOrderItem.create({
        data: {
          serviceOrderId: id,
          type,
          serviceCatalogId: type === 'SERVICO' ? serviceCatalogId : undefined,
          partCatalogId: type === 'PARTE' ? partCatalogId : undefined,
          description,
          quantity: quantityNumber,
          unitPrice: priceNumber,
          totalPrice,
        },
      })
      res.status(201).json(created)
    } catch (err) {
      console.error('POST /service-orders/:id/items error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.put('/service-orders/:id/items/:itemId', async (req: Request, res: Response) => {
    const { id, itemId } = req.params
    if (!id || !itemId) return res.status(400).json({ error: 'Missing service order id or item id' })
    try {
      const existingItem = await prisma.serviceOrderItem.findUnique({ where: { id: itemId } })
      if (!existingItem || existingItem.serviceOrderId !== id) return res.status(404).json({ error: 'ServiceOrderItem not found' })

      const { description, quantity, unitPrice, serviceCatalogId, partCatalogId } = req.body
      const updates: any = {}
      if (description !== undefined) {
        if (typeof description !== 'string' || !description.trim()) return res.status(400).json({ error: 'Field "description" is required' })
        updates.description = description
      }
      if (quantity !== undefined) {
        const quantityNumber = Number(quantity)
        if (!Number.isFinite(quantityNumber) || quantityNumber <= 0) return res.status(400).json({ error: 'Field "quantity" must be a positive number' })
        updates.quantity = quantityNumber
      }
      if (unitPrice !== undefined) {
        const priceNumber = parseDecimal(unitPrice)
        if (priceNumber === null || priceNumber < 0) return res.status(400).json({ error: 'Field "unitPrice" must be a valid non-negative number' })
        updates.unitPrice = priceNumber
      }
      if (serviceCatalogId !== undefined) updates.serviceCatalogId = serviceCatalogId
      if (partCatalogId !== undefined) updates.partCatalogId = partCatalogId

      const updatedValues = {
        ...existingItem,
        ...updates,
      }
      if (updates.quantity !== undefined || updates.unitPrice !== undefined) {
        const quantityNumber = updates.quantity ?? existingItem.quantity
        const unitPriceNumber = updates.unitPrice ?? existingItem.unitPrice
        updatedValues.totalPrice = calculateTotalPrice(quantityNumber, unitPriceNumber)
        updates.totalPrice = updatedValues.totalPrice
      }

      if (existingItem.type === 'PARTE' && existingItem.partCatalogId && updates.quantity !== undefined) {
        const partCatalog = await prisma.partCatalog.findUnique({ where: { id: existingItem.partCatalogId } })
        if (!partCatalog) return res.status(404).json({ error: 'PartCatalog item not found' })
        const delta = Number(updates.quantity) - Number(existingItem.quantity)
        const direction = delta > 0 ? 'decrement' : 'increment'
        const stockResult = applyStockDelta({
          currentStock: Number(partCatalog.stockQuantity ?? 0),
          minimumStock: Number(partCatalog.minimumStock ?? 0),
          quantity: Math.abs(delta),
          direction,
        })
        if (!stockResult.valid) return res.status(400).json({ error: stockResult.error })
        const lowStock = isLowStock(stockResult.stockQuantity, Number(partCatalog.minimumStock ?? 0))
        await prisma.partCatalog.update({
          where: { id: partCatalog.id },
          data: { stockQuantity: stockResult.stockQuantity },
        })
        if (lowStock) {
          console.warn(`[stock] Part ${partCatalog.name} is below minimum stock after OS item update`) 
        }
      }

      const updated = await prisma.serviceOrderItem.update({ where: { id: itemId }, data: updates })
      res.json(updated)
    } catch (err) {
      console.error('PUT /service-orders/:id/items/:itemId error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.delete('/service-orders/:id/items/:itemId', async (req: Request, res: Response) => {
    const { id, itemId } = req.params
    if (!id || !itemId) return res.status(400).json({ error: 'Missing service order id or item id' })
    try {
      const existingItem = await prisma.serviceOrderItem.findUnique({ where: { id: itemId } })
      if (!existingItem || existingItem.serviceOrderId !== id) return res.status(404).json({ error: 'ServiceOrderItem not found' })
      if (existingItem.type === 'PARTE' && existingItem.partCatalogId) {
        const partCatalog = await prisma.partCatalog.findUnique({ where: { id: existingItem.partCatalogId } })
        if (!partCatalog) return res.status(404).json({ error: 'PartCatalog item not found' })
        const stockResult = applyStockDelta({
          currentStock: Number(partCatalog.stockQuantity ?? 0),
          minimumStock: Number(partCatalog.minimumStock ?? 0),
          quantity: Number(existingItem.quantity ?? 0),
          direction: 'increment',
        })
        if (!stockResult.valid) return res.status(400).json({ error: stockResult.error })
        await prisma.partCatalog.update({
          where: { id: partCatalog.id },
          data: { stockQuantity: stockResult.stockQuantity },
        })
      }
      await prisma.serviceOrderItem.delete({ where: { id: itemId } })
      res.json({ message: 'ServiceOrderItem deleted' })
    } catch (err) {
      console.error('DELETE /service-orders/:id/items/:itemId error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.post('/service-orders/:id/invoices/generate', async (req: Request, res: Response) => {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'Missing service order id' })
    try {
      const serviceOrder = await prisma.serviceOrder.findUnique({ where: { id }, include: { client: true, items: true } })
      if (!serviceOrder) return res.status(404).json({ error: 'ServiceOrder not found' })
      if (serviceOrder.status !== 'CONCLUIDA' && serviceOrder.status !== 'SEM_CONSERTO') {
        return res.status(400).json({ error: 'Invoice can only be generated for orders with status CONCLUIDA or SEM_CONSERTO' })
      }

      const invoiceItems = Array.isArray((serviceOrder as any).items) ? (serviceOrder as any).items : []
      if (invoiceItems.length === 0) return res.status(400).json({ error: 'Cannot generate invoice for an order without items' })

      const subtotal = invoiceItems.reduce((sum: number, item: any) => sum + Number(item.totalPrice ?? 0), 0)
      const discountAmount = parseDecimal(req.body.discountAmount) ?? 0
      if (discountAmount < 0) return res.status(400).json({ error: 'discountAmount must be a non-negative number' })
      const total = Number((subtotal - discountAmount).toFixed(2))

      const created = await prisma.invoice.create({
        data: {
          serviceOrderId: id,
          clientId: serviceOrder.clientId,
          subtotal,
          discountAmount,
          total,
          status: 'PENDENTE',
          issuedAt: new Date(),
        },
      })
      res.status(201).json(created)
    } catch (err) {
      console.error('POST /service-orders/:id/invoices/generate error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.get('/service-orders/:id/invoices', async (req: Request, res: Response) => {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'Missing service order id' })
    try {
      const invoices = await prisma.invoice.findMany({ where: { serviceOrderId: id }, include: { client: true, serviceOrder: true }, orderBy: { createdAt: 'desc' } })
      res.json({ data: invoices })
    } catch (err) {
      console.error('GET /service-orders/:id/invoices error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.get('/invoices', async (req: Request, res: Response) => {
    try {
      const invoices = await prisma.invoice.findMany({ include: { client: true, serviceOrder: true }, orderBy: { createdAt: 'desc' } })
      res.json({ data: invoices })
    } catch (err) {
      console.error('GET /invoices error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.get('/invoices/:id', async (req: Request, res: Response) => {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'Missing id' })
    try {
      const invoice = await prisma.invoice.findUnique({ where: { id }, include: { client: true, serviceOrder: true } })
      if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
      res.json(invoice)
    } catch (err) {
      console.error('GET /invoices/:id error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.get('/clients/:clientId/invoices', async (req: Request, res: Response) => {
    const clientId = req.params.clientId
    if (!clientId) return res.status(400).json({ error: 'Missing clientId' })
    try {
      const invoices = await prisma.invoice.findMany({ where: { clientId }, include: { serviceOrder: true }, orderBy: { createdAt: 'desc' } })
      res.json({ data: invoices })
    } catch (err) {
      console.error('GET /clients/:clientId/invoices error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.put('/invoices/:id', async (req: Request, res: Response) => {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'Missing id' })
    try {
      const { status, discountAmount } = req.body
      const updates: any = {}
      if (status !== undefined) {
        if (!['PENDENTE', 'PAGO', 'CANCELADA'].includes(status)) return res.status(400).json({ error: 'Invalid invoice status' })
        updates.status = status
        if (status === 'PAGO') updates.paidAt = new Date()
      }
      if (discountAmount !== undefined) {
        const discountNumber = parseDecimal(discountAmount)
        if (discountNumber === null || discountNumber < 0) return res.status(400).json({ error: 'discountAmount must be a non-negative number' })
        updates.discountAmount = discountNumber

        const invoice = await prisma.invoice.findUnique({ where: { id } })
        if (!invoice) return res.status(404).json({ error: 'Invoice not found' })
        updates.total = Number((Number(invoice.subtotal) - discountNumber).toFixed(2))
      }
      if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No update fields provided' })

      const updated = await prisma.invoice.update({ where: { id }, data: updates })
      res.json(updated)
    } catch (err) {
      console.error('PUT /invoices/:id error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  /* -------------------------------------------------------------------------- */
  /* TechnicalReport routes                                                      */
  /* -------------------------------------------------------------------------- */

  app.get('/reports', async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1)
      const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10))
      const skip = (page - 1) * pageSize

      const where: any = {}
      if (req.query.serviceOrderId) where.serviceOrderId = String(req.query.serviceOrderId)
      if (req.query.startDate || req.query.endDate) {
        where.createdAt = {}
        if (req.query.startDate) where.createdAt.gte = new Date(String(req.query.startDate))
        if (req.query.endDate) where.createdAt.lte = new Date(String(req.query.endDate))
      }

      const [reports, total] = await Promise.all([
        prisma.technicalReport.findMany({ where, skip, take: pageSize, orderBy: { createdAt: 'desc' } }),
        prisma.technicalReport.count({ where }),
      ])

      res.json({ data: reports, meta: { page, pageSize, total } })
    } catch (err) {
      console.error('GET /reports error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.get('/reports/:id', async (req: Request, res: Response) => {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'Missing id' })

    try {
      const report = await prisma.technicalReport.findUnique({
        where: { id },
        include: {
          serviceOrder: { include: { client: true, equipment: true } },
          components: true,
          photos: true,
        },
      })
      if (!report) return res.status(404).json({ error: 'Report not found' })
      res.json(report)
    } catch (err) {
      console.error('GET /reports/:id error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.get('/reports/:id/view', async (req: Request, res: Response) => {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'Missing id' })

    try {
      const report = await prisma.technicalReport.findUnique({
        where: { id },
        include: {
          serviceOrder: {
            include: {
              client: true,
              equipment: true,
              items: { include: { serviceCatalog: true, partCatalog: true } },
              invoices: true,
            },
          },
          components: true,
          photos: true,
        },
      })
      if (!report) return res.status(404).json({ error: 'Report not found' })

      const so = report.serviceOrder || ({} as any)
      const client = so.client || null
      const equipment = so.equipment || null
      const orderItems = Array.isArray(so.items)
        ? so.items.map((item: any) => ({
            id: item.id,
            type: item.type,
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            serviceCatalogName: item.serviceCatalog?.name,
            partCatalogName: item.partCatalog?.name,
          }))
        : []
      const invoices = Array.isArray(so.invoices)
        ? so.invoices.map((invoice: any) => ({
            id: invoice.id,
            subtotal: invoice.subtotal,
            discountAmount: invoice.discountAmount,
            total: invoice.total,
            status: invoice.status,
            issuedAt: invoice.issuedAt,
            paidAt: invoice.paidAt,
          }))
        : []
      const latestInvoice = invoices[0] || null

      const payload = {
        assistencia: {
          companyName: report.companyName,
          companyDocument: report.companyDocument,
          companyContact: report.companyContact,
          companyAddress: report.companyAddress,
          companyEmail: report.companyEmail,
          companySite: report.companySite,
          technicianName: report.technicianName,
          technicianRegistry: report.technicianRegistry,
          cityDate: report.cityDate ? report.cityDate : null,
        },
        cliente: client,
        equipamento: equipment,
        ordemServico: {
          id: so.id,
          protocol: so.protocol,
          status: so.status,
          priority: so.priority,
          notes: so.notes,
          createdAt: so.createdAt ?? null,
          updatedAt: so.updatedAt ?? null,
          closedAt: so.closedAt ?? null,
          items: orderItems,
          invoices,
          latestInvoice,
        },
        diagnostico: {
          clientReport: report.clientReport,
          testsExecuted: report.testsExecuted,
          powerStageStatus: report.powerStageStatus,
          usageTimeEstimate: report.usageTimeEstimate,
          probableCause: report.probableCause,
          technicalConclusion: report.technicalConclusion,
          noRepair: report.noRepair,
          noRepairReason: report.noRepairReason,
        },
        financeiro: {
          partsValue: report.partsValue ?? 0,
          laborValue: report.laborValue ?? 0,
          totalValue: report.totalValue ?? 0,
        },
        componentes: report.components || [],
        fotos: report.photos || [],
        meta: {
          id: report.id,
          serviceOrderId: report.serviceOrderId,
          protocol: so.protocol ?? null,
          status: so.status ?? null,
        },
      }

      res.json(payload)
    } catch (err) {
      console.error('GET /reports/:id/view error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.post('/reports', async (req: Request, res: Response) => {
    try {
      const payload = req.body
      if (!payload || !payload.serviceOrderId) return res.status(400).json({ error: 'serviceOrderId is required' })

      // ensure serviceOrder exists
      const so = await prisma.serviceOrder.findUnique({ where: { id: payload.serviceOrderId } })
      if (!so) return res.status(404).json({ error: 'ServiceOrder not found for provided serviceOrderId' })

      const partsValue = parseDecimal(payload.partsValue)
      const laborValue = parseDecimal(payload.laborValue)
      const totalValue = parseDecimal(payload.totalValue)
      if ((payload.partsValue && partsValue === null) || (payload.laborValue && laborValue === null) || (payload.totalValue && totalValue === null)) {
        return res.status(400).json({ error: 'Invalid numeric value for partsValue, laborValue or totalValue' })
      }

      const data: any = {
        serviceOrderId: payload.serviceOrderId,
        companyName: payload.companyName,
        companyDocument: payload.companyDocument,
        companyContact: payload.companyContact,
        companyAddress: payload.companyAddress,
        companyEmail: payload.companyEmail,
        companySite: payload.companySite,
        technicianName: payload.technicianName,
        technicianRegistry: payload.technicianRegistry,
        cityDate: payload.cityDate ? new Date(payload.cityDate) : undefined,
        clientReport: payload.clientReport,
        testsExecuted: payload.testsExecuted,
        powerStageStatus: payload.powerStageStatus,
        usageTimeEstimate: payload.usageTimeEstimate,
        probableCause: payload.probableCause,
        technicalConclusion: payload.technicalConclusion,
        noRepair: payload.noRepair === true,
        noRepairReason: payload.noRepairReason,
        partsValue: partsValue,
        laborValue: laborValue,
        totalValue: totalValue,
        version: payload.version ?? 1,
        htmlSnapshot: payload.htmlSnapshot,
      }

      const created = await prisma.technicalReport.create({ data })
      res.status(201).json(created)
    } catch (err) {
      console.error('POST /reports error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.put('/reports/:id', async (req: Request, res: Response) => {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'Missing id' })

    try {
      const payload = req.body
      const existing = await prisma.technicalReport.findUnique({ where: { id } })
      if (!existing) return res.status(404).json({ error: 'Report not found' })

      const partsValue = payload.partsValue !== undefined ? parseDecimal(payload.partsValue) : existing.partsValue
      const laborValue = payload.laborValue !== undefined ? parseDecimal(payload.laborValue) : existing.laborValue
      const totalValue = payload.totalValue !== undefined ? parseDecimal(payload.totalValue) : existing.totalValue
      if ((payload.partsValue !== undefined && partsValue === null) || (payload.laborValue !== undefined && laborValue === null) || (payload.totalValue !== undefined && totalValue === null)) {
        return res.status(400).json({ error: 'Invalid numeric value for partsValue, laborValue or totalValue' })
      }

      const allowed: any = {
        clientReport: payload.clientReport ?? existing.clientReport,
        testsExecuted: payload.testsExecuted ?? existing.testsExecuted,
        probableCause: payload.probableCause ?? existing.probableCause,
        technicalConclusion: payload.technicalConclusion ?? existing.technicalConclusion,
        partsValue,
        laborValue,
        totalValue,
      }

      const updated = await prisma.technicalReport.update({ where: { id }, data: allowed })
      res.json(updated)
    } catch (err) {
      console.error('PUT /reports/:id error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.delete('/reports/:id', async (req: Request, res: Response) => {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'Missing id' })

    try {
      const existing = await prisma.technicalReport.findUnique({ where: { id } })
      if (!existing) return res.status(404).json({ error: 'Report not found' })

      const newVersion = (existing.version ?? 1) + 1
      const updated = await prisma.technicalReport.update({ where: { id }, data: { version: newVersion, printedAt: new Date() } as any })
      res.json({ message: 'Report archived (version incremented)', report: updated })
    } catch (err) {
      console.error('DELETE /reports/:id error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  /* -------------------------------------------------------------------------- */
  /* ReportComponent routes                                                      */
  /* -------------------------------------------------------------------------- */

  app.post('/reports/:id/components', async (req: Request, res: Response) => {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'Missing id' })

    try {
      const payload = req.body
      const report = await prisma.technicalReport.findUnique({ where: { id } })
      if (!report) return res.status(404).json({ error: 'Report not found' })

      const created = await prisma.reportComponent.create({
        data: {
          technicalReportId: id,
          description: typeof payload.description === 'string' ? payload.description : undefined,
          quantity: typeof payload.quantity === 'number' ? payload.quantity : undefined,
          unitPrice: typeof payload.unitPrice === 'number' ? payload.unitPrice : undefined,
          price: typeof payload.price === 'number' ? payload.price : undefined,
        },
      })
      res.status(201).json(created)
    } catch (err) {
      console.error('POST /reports/:id/components error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.delete('/components/:id', async (req: Request, res: Response) => {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'Missing id' })

    try {
      const existing = await prisma.reportComponent.findUnique({ where: { id } })
      if (!existing) return res.status(404).json({ error: 'Component not found' })
      await prisma.reportComponent.delete({ where: { id } })
      res.json({ message: 'Component deleted' })
    } catch (err) {
      console.error('DELETE /components/:id error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  /* -------------------------------------------------------------------------- */
  /* ReportPhoto routes                                                          */
  /* -------------------------------------------------------------------------- */

  app.post('/reports/:id/photos', async (req: Request, res: Response) => {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'Missing id' })

    try {
      const payload = req.body
      const report = await prisma.technicalReport.findUnique({ where: { id } })
      if (!report) return res.status(404).json({ error: 'Report not found' })

      const created = await prisma.reportPhoto.create({
        data: {
          technicalReportId: id,
          storagePath: typeof payload.storagePath === 'string' ? payload.storagePath : undefined,
          caption: typeof payload.caption === 'string' ? payload.caption : undefined,
        },
      })
      res.status(201).json(created)
    } catch (err) {
      console.error('POST /reports/:id/photos error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  app.delete('/photos/:id', async (req: Request, res: Response) => {
    const id = req.params.id
    if (!id) return res.status(400).json({ error: 'Missing id' })

    try {
      const existing = await prisma.reportPhoto.findUnique({ where: { id } })
      if (!existing) return res.status(404).json({ error: 'Photo not found' })
      await prisma.reportPhoto.delete({ where: { id } })
      res.json({ message: 'Photo deleted' })
    } catch (err) {
      console.error('DELETE /photos/:id error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  /* -------------------------------------------------------------------------- */
  /* AI helper: suggestion endpoint for reports                                 */
  /* -------------------------------------------------------------------------- */

  type DiagnosticContext = {
    relatoCliente: string | undefined
    testesExecutados: string | undefined
    componentesAvariados: string | undefined
    estadoFonte: string | undefined
    tempoUso: string | undefined
    contextoEquipamento: string | undefined
    garantia: string | undefined
    protecaoEletrica: string | undefined
    outrosCampos: Record<string, any> | undefined
  }

  const callAiForReportSuggestion = async (ctx: DiagnosticContext): Promise<{ probableCauseDraft: string; technicalConclusionDraft: string; notes?: string }> => {
    // Stub: create simple drafts based on provided context. Replace with real AI call later.
    const parts: string[] = []
    if (ctx.relatoCliente) parts.push(`Relato: ${ctx.relatoCliente}`)
    if (ctx.testesExecutados) parts.push(`Testes: ${ctx.testesExecutados}`)
    if (ctx.componentesAvariados) parts.push(`Componentes avariados: ${ctx.componentesAvariados}`)
    if (ctx.estadoFonte) parts.push(`Estado da fonte: ${ctx.estadoFonte}`)
    if (ctx.tempoUso) parts.push(`Tempo de uso: ${ctx.tempoUso}`)
    if (ctx.contextoEquipamento) parts.push(`Contexto do equipamento: ${ctx.contextoEquipamento}`)
    if (ctx.garantia) parts.push(`Garantia: ${ctx.garantia}`)
    if (ctx.protecaoEletrica) parts.push(`Proteção elétrica: ${ctx.protecaoEletrica}`)

    const probableCauseDraft = parts.length ? `Possível causa: ${parts.join('; ')}.` : 'Possível causa: análise adicional necessária.'
    const technicalConclusionDraft = parts.length ? `Parecer técnico preliminar com base em: ${parts.join('; ')}.` : 'Parecer técnico: não conclusivo. Requer testes complementares.'

    return { probableCauseDraft, technicalConclusionDraft, notes: 'Sugestão gerada por stub local. Integrar IA real posteriormente.' }
  }

  app.post('/ai/reports/:id/suggest', async (req: Request, res: Response) => {
    const { id } = req.params
    try {
      const body = req.body as DiagnosticContext
      const relato = (body.relatoCliente || '').toString().trim()
      const testes = (body.testesExecutados || '').toString().trim()

      if (!relato && !testes) {
        return res.status(400).json({ error: 'Pelo menos um dos campos "relatoCliente" ou "testesExecutados" deve ser preenchido.' })
      }

      const diagnosticContext: DiagnosticContext = {
        relatoCliente: body.relatoCliente,
        testesExecutados: body.testesExecutados,
        componentesAvariados: body.componentesAvariados,
        estadoFonte: body.estadoFonte,
        tempoUso: body.tempoUso,
        contextoEquipamento: body.contextoEquipamento,
        garantia: body.garantia,
        protecaoEletrica: body.protecaoEletrica,
        outrosCampos: body.outrosCampos,
      }

      let suggestion
      try {
        suggestion = await callAiForReportSuggestion(diagnosticContext)
      } catch (aiErr) {
        console.error('AI suggestion error:', aiErr)
        return res.status(502).json({ error: 'Falha ao gerar sugestão pela IA' })
      }

      res.json({ reportId: id, suggestion })
    } catch (err) {
      console.error('POST /ai/reports/:id/suggest error:', err)
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
    }
  })

  const server = app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`)
  })

  const shutdown = async () => {
    console.log('Shutting down...')
    try {
      await prisma.$disconnect()
    } catch (err) {
      console.warn('Error disconnecting Prisma', err)
    }
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(1), 10000)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  return { app, prisma, server }
}

createServer().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})

export default createServer
