export type AtendimentoType = 'BANCADA_ELETRONICOS' | 'CAMPO_REDE' | 'CAMPO_CCTV' | 'GENERIC'

export type WhatsAppSummaryContext = {
  clientName?: string
  companyName?: string
  protocol?: string
  equipment?: string
  diagnosis?: string
  conclusion?: string
  totalValue?: number
  reportId?: string
  reportUrl?: string
  atendimentoType?: AtendimentoType
}

function buildSummaryContext(reportData: any, serviceOrderData: any, invoiceData: any, baseUrl = 'http://localhost:5173') {
  const clientName = reportData?.cliente?.name || serviceOrderData?.client?.name || 'cliente'
  const companyName = reportData?.assistencia?.companyName || 'assistência técnica'
  const protocol = serviceOrderData?.protocol || reportData?.meta?.protocol || 'sem protocolo'
  const equipment = [reportData?.equipamento?.type, reportData?.equipamento?.brand, reportData?.equipamento?.model]
    .filter(Boolean)
    .join(' ')
    .trim() || 'equipamento não informado'
  const diagnosis = reportData?.diagnostico?.probableCause?.trim() || 'Diagnóstico em andamento.'
  const conclusion = reportData?.diagnostico?.technicalConclusion?.trim() || 'Conclusão em andamento.'
  const totalValue = Number(invoiceData?.total ?? reportData?.financeiro?.totalValue ?? 0)
  const reportId = reportData?.meta?.id || serviceOrderData?.firstReportId || ''
  const reportUrl = reportData?.reportUrl || (reportId ? `${baseUrl.replace(/\/$/, '')}/reports/${encodeURIComponent(reportId)}/document` : 'Link do laudo indisponível')

  return {
    clientName,
    companyName,
    protocol,
    equipment,
    diagnosis,
    conclusion,
    totalValue,
    reportId,
    reportUrl,
    atendimentoType: reportData?.atendimentoType || serviceOrderData?.atendimentoType || 'GENERIC',
  } satisfies WhatsAppSummaryContext
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function getTemplateLines(context: WhatsAppSummaryContext, mode: 'full' | 'short') {
  const base = [
    `Olá ${context.clientName},`,
    `Aqui é da ${context.companyName}.`,
    `OS: ${context.protocol}`,
  ]

  if (mode === 'full') {
    const specificLines = [] as string[]
    if (context.atendimentoType === 'CAMPO_REDE') {
      specificLines.push(`Atendimento em campo: foco em rede e infraestrutura.`)
    } else if (context.atendimentoType === 'CAMPO_CCTV') {
      specificLines.push(`Atendimento em campo: foco em câmeras e infraestrutura de vídeo.`)
    } else if (context.atendimentoType === 'BANCADA_ELETRONICOS') {
      specificLines.push(`Atendimento em bancada: foco em equipamento e troca de peças.`)
    }

    return [
      ...base,
      ...(specificLines.length ? specificLines : []),
      `Equipamento: ${context.equipment}.`,
      `Diagnóstico: ${context.diagnosis}.`,
      `Conclusão: ${context.conclusion}.`,
      `Valor total: ${formatCurrency(context.totalValue ?? 0)}.`,
      `Veja o laudo completo em: ${context.reportUrl}`,
    ]
  }

  if (context.atendimentoType === 'CAMPO_REDE') {
    return [
      `Olá, ${context.clientName}, a visita à sua rede foi concluída.`,
      `Pontos principais: ${context.diagnosis}.`,
      `Situação atual: ${context.conclusion}.`,
      `Valor: ${formatCurrency(context.totalValue ?? 0)}. Laudo completo: ${context.reportUrl}.`,
    ]
  }

  if (context.atendimentoType === 'CAMPO_CCTV') {
    return [
      `Olá, ${context.clientName}, o atendimento aos seus equipamentos de CFTV foi finalizado.`,
      `Achados: ${context.diagnosis}.`,
      `Status final: ${context.conclusion}.`,
      `Valor: ${formatCurrency(context.totalValue ?? 0)}. Laudo completo: ${context.reportUrl}.`,
    ]
  }

  if (context.atendimentoType === 'BANCADA_ELETRONICOS') {
    return [
      `Olá, ${context.clientName}, seu ${context.equipment} já foi analisado.`,
      `Diagnóstico: ${context.diagnosis}.`,
      `Conclusão: ${context.conclusion}.`,
      `Valor: ${formatCurrency(context.totalValue ?? 0)}. Laudo completo: ${context.reportUrl}.`,
    ]
  }

  return [
    `Olá, ${context.clientName}, o atendimento foi concluído.`,
    `Diagnóstico: ${context.diagnosis}.`,
    `Conclusão: ${context.conclusion}.`,
    `Valor: ${formatCurrency(context.totalValue ?? 0)}. Laudo completo: ${context.reportUrl}.`,
  ]
}

export function buildWhatsAppFullSummary(reportData: any, serviceOrderData: any, invoiceData: any, baseUrl = 'http://localhost:5173') {
  const context = buildSummaryContext(reportData, serviceOrderData, invoiceData, baseUrl)
  return getTemplateLines(context, 'full').join('\n')
}

export function buildWhatsAppShortSummary(reportData: any, serviceOrderData: any, invoiceData: any, baseUrl = 'http://localhost:5173') {
  const context = buildSummaryContext(reportData, serviceOrderData, invoiceData, baseUrl)
  return getTemplateLines(context, 'short').join('\n')
}

export function buildWhatsAppSummary(reportData: any, serviceOrderData: any, invoiceData: any, baseUrl = 'http://localhost:5173') {
  return buildWhatsAppFullSummary(reportData, serviceOrderData, invoiceData, baseUrl)
}
