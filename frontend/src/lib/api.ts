export type OtpStatus = 'PENDING' | 'VERIFIED' | 'EXPIRED' | 'BLOCKED' | 'REPORTED'
export type Channel = 'RCS' | 'SMS'
export type OtpMode = 'CLASSIC' | 'GOOGLE_PROMPT'
export type Period = '24h' | '7d' | '30d'

export interface CreateOtpAppPayload {
  name: string
  mail: string
  verifyRedirectUrl: string
  otpMode?: OtpMode
  ttlSeconds?: number
  codeLength?: number
  maxAttempts?: number
  resendCooldown?: number
  oneTapEnabled?: boolean
  senderLabel?: string
  logoUrl?: string
  cardTitle?: string
  messageTemplate?: string
  allowedCountries?: string[]
  rateLimitPhone?: number
  rateLimitIp?: number
  reportEnabled?: boolean
}

export interface CreateOtpAppResponse {
  id: string
  name: string
  apiKey: string
}

export interface GenerateOtpPayload {
  phoneNumber: string
  sessionId: string
}

export interface GenerateOtpResponse {
  challengeId: string
  expiresAt: string
  channel: Channel
  status: OtpStatus
  promptDigit?: number
}

export interface VerifyOtpPayload {
  challengeId: string
  code: string
}

export interface VerifyOtpResponse {
  valid: boolean
  reason?: string
  remainingAttempts?: number
}

export interface ChallengeStatusResponse {
  status: OtpStatus
}

export interface OverviewResponse {
  period: Period
  total: number
  verified: number
  blocked: number
  reported: number
  conversionRate: number
  fraudRate: number
  channels: { rcs: number; sms: number }
}

export interface StatusBreakdownItem {
  status: OtpStatus
  count: number
  percentage: number
}

export interface StatusBreakdownResponse {
  period: Period
  total: number
  breakdown: StatusBreakdownItem[]
}

export interface TimeseriesPoint {
  timestamp: string
  total: number
  verified: number
  fraud: number
}

export interface TimeseriesResponse {
  period: Period
  granularity: 'hour' | 'day'
  points: TimeseriesPoint[]
}

export interface ReportedItem {
  id: string
  sessionId: string
  updatedAt: string
  channel: Channel
}

export interface BlockedItem {
  id: string
  sessionId: string
  updatedAt: string
  attempts: number
}

export interface FraudAlertsResponse {
  period: string
  reported: { count: number; recent: ReportedItem[] }
  blocked: { count: number; recent: BlockedItem[] }
  suspiciousPhones: { phoneHashPrefix: string; failedAttempts: number }[]
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(
  method: string,
  path: string,
  options: { apiKey?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (options.apiKey) {
    headers['x-api-key'] = options.apiKey
  }

  const res = await fetch(path, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text()
    let message = text
    try {
      const json = JSON.parse(text) as { message?: string | string[] }
      if (typeof json.message === 'string') message = json.message
      else if (Array.isArray(json.message)) message = json.message.join(', ')
    } catch {
      /* keep text */
    }
    throw new ApiError(res.status, message)
  }

  return res.json() as Promise<T>
}

export const api = {
  createApp(payload: CreateOtpAppPayload): Promise<CreateOtpAppResponse> {
    return request('POST', '/api/v1/otp/apps', { body: payload })
  },

  generateOtp(payload: GenerateOtpPayload, apiKey: string): Promise<GenerateOtpResponse> {
    return request('POST', '/api/v1/otp/generate', { apiKey, body: payload })
  },

  verifyOtp(payload: VerifyOtpPayload, apiKey: string): Promise<VerifyOtpResponse> {
    return request('POST', '/api/v1/otp/verify', { apiKey, body: payload })
  },

  getStatus(challengeId: string, apiKey: string): Promise<ChallengeStatusResponse> {
    return request('GET', `/api/v1/otp/status/${challengeId}`, { apiKey })
  },

  getOverview(apiKey: string, period: Period): Promise<OverviewResponse> {
    return request('GET', `/api/v1/stats/overview?period=${period}`, { apiKey })
  },

  getStatusBreakdown(apiKey: string, period: Period): Promise<StatusBreakdownResponse> {
    return request('GET', `/api/v1/stats/status-breakdown?period=${period}`, { apiKey })
  },

  getTimeseries(apiKey: string, period: Period): Promise<TimeseriesResponse> {
    return request('GET', `/api/v1/stats/timeseries?period=${period}`, { apiKey })
  },

  getFraudAlerts(apiKey: string): Promise<FraudAlertsResponse> {
    return request('GET', '/api/v1/stats/fraud', { apiKey })
  },
}
