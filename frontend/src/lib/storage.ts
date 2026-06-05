export type OtpMode = 'CLASSIC' | 'GOOGLE_PROMPT'

export interface StoredApp {
  id: string
  name: string
  apiKey: string
  otpMode: OtpMode
  createdAt: string
}

const KEY = 'otp_apps'

export function getApps(): StoredApp[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as StoredApp[]
  } catch {
    return []
  }
}

export function saveApp(app: StoredApp): void {
  const apps = getApps()
  apps.push(app)
  localStorage.setItem(KEY, JSON.stringify(apps))
}

export function deleteApp(id: string): void {
  const apps = getApps().filter((a) => a.id !== id)
  localStorage.setItem(KEY, JSON.stringify(apps))
}
