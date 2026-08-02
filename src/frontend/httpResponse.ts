export type SafeApiTechnicalDetails = {
  statusCode?: number
  contentType?: string
  preview?: string
}

export type SafeApiParseResult<T = unknown> = {
  ok: boolean
  status: number
  data: T | null
  rawText: string
  technicalDetails?: SafeApiTechnicalDetails
  message?: string
}

const toPreview = (text: string, maxLength = 200) => {
  const normalized = text.replace(/\s+/g, ' ').trim()
  return normalized.slice(0, maxLength)
}

export async function parseHttpResponseSafely<T = unknown>(response: Response): Promise<SafeApiParseResult<T>> {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase()
  const rawText = await response.text().catch(() => '')
  const trimmedText = rawText.trim()
  const isJson = contentType.includes('application/json') || contentType.includes('+json')
  const isJsonLike = isJson || (!contentType && (trimmedText.startsWith('{') || trimmedText.startsWith('[')))

  if (!isJsonLike) {
    return {
      ok: false,
      status: response.status,
      data: null,
      rawText,
      message: 'Gateway respondeu em formato inesperado',
      technicalDetails: {
        statusCode: response.status,
        contentType: contentType || 'unknown',
        preview: toPreview(rawText),
      },
    }
  }

  if (!trimmedText) {
    return {
      ok: response.ok,
      status: response.status,
      data: {} as T,
      rawText,
    }
  }

  try {
    const data = JSON.parse(rawText) as T
    return {
      ok: response.ok,
      status: response.status,
      data,
      rawText,
    }
  } catch {
    return {
      ok: false,
      status: response.status,
      data: null,
      rawText,
      message: 'Gateway respondeu em formato inesperado',
      technicalDetails: {
        statusCode: response.status,
        contentType: contentType || 'application/json',
        preview: toPreview(rawText),
      },
    }
  }
}
