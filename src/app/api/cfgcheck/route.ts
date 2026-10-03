import { NextResponse } from 'next/server'
import { config } from '@/lib/auth'
export const runtime = 'nodejs'
export async function GET() {
  const gh: any = (config.providers as any)[0]
  return NextResponse.json({
    providerId: gh?.id,
    hasClientId: !!(gh?.options?.clientId),
    clientIdLen: (gh?.options?.clientId || '').length,
    hasClientSecret: !!(gh?.options?.clientSecret),
    secretLen: (process.env.AUTH_SECRET || '').length,
    hasTrustHost: !!(config as any).trustHost,
    authorizationUrl: gh?.options?.authorization?.url,
    authorizationScope: gh?.options?.authorization?.params?.scope,
  })
}
