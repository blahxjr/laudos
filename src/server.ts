import express from 'express'
import type { Request, Response } from 'express'
import cors from 'cors'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../generated/prisma/client.js'
import { createClientApiErrorPayload, createClientValidationErrors, normalizeClientPayload } from './server/clientValidation.js'

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

  app.get('/health', async (_req: Request, res: Response) => {
    try {
      const clientsCount = await prisma.client.count()
      res.json({ status: 'ok', clientsCount })
    } catch (error) {
      console.error('Health check error:', error)
      res.status(500).json({ status: 'error', error: error instanceof Error ? error.message : String(error) })
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

    return { valid: errors.length === 0, errors: errors.map((error) => ({ field: error.field, message: error.message, code: error.code })) }
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

  const SERVICE_ORDER_STATUSES = ['ABERTA', 'EM_DIAGNOSTICO', 'AGUARDANDO_CLIENTE', 'CONCLUIDA', 'SEM_CONSERTO']
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
    if (status !== undefined && !SERVICE_ORDER_STATUSES.includes(status)) errors.push('Invalid status')
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

  /* -------------------------------------------------------------------------- */
  /* TechnicalReport routes                                                      */
  /* -------------------------------------------------------------------------- */

  const parseDecimal = (value: any) => {
    if (value === null || value === undefined || value === '') return null
    if (typeof value === 'number') return value
    if (typeof value === 'string') {
      // Accept formats like "1.234,56" or "1234.56" or "1234,56"
      const cleaned = value.replace(/\./g, '').replace(',', '.')
      const n = Number(cleaned)
      return Number.isNaN(n) ? null : n
    }
    return null
  }

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
          serviceOrder: { include: { client: true, equipment: true } },
          components: true,
          photos: true,
        },
      })
      if (!report) return res.status(404).json({ error: 'Report not found' })

      const so = report.serviceOrder || ({} as any)
      const client = so.client || null
      const equipment = so.equipment || null

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
