import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'
import { config as baseConfig } from '@/lib/auth'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const captured: any[] = []
  const logLines: string[] = []

  const testConfig: any = {
    ...baseConfig,
    basePath: '/api/auth',
    debug: false,
    logger: {
      error: (code: any, ...rest: any[]) => {
        captured.push({
          codeType: code?.type ?? (typeof code === 'string' ? code : undefined),
          codeName: code?.name,
          message: code?.message,
          cause: code?.cause
            ? {
                message: (code.cause as any)?.message,
                name: (code.cause as any)?.name,
                stack: (code.cause as any)?.stack,
              }
            : undefined,
          stack: code?.stack,
        })
        logLines.push(`[error] ${code?.type ?? code?.name ?? code}`)
      },
      warn: (...a: any[]) => logLines.push(`[warn] ${a.join(' ')}`),
      debug: (...a: any[]) => logLines.push(`[debug] ${a.join(' ')}`),
      info: (...a: any[]) => {},
    },
  }

  const handler = NextAuth(testConfig)
  const { GET } = handler.handlers

  const origin = req.nextUrl.origin
  const target = new URL('/api/auth/signin/github', origin)

  let result: any = {}
  try {
    const res = await GET(new NextRequest(target.toString(), { headers: req.headers }))
    result = {
      status: res.status,
      location: res.headers.get('location'),
      bodyStart: (await res.text()).slice(0, 300),
    }
  } catch (e: any) {
    result = {
      threw: true,
      message: e?.message,
      type: e?.type,
      name: e?.name,
      stack: e?.stack,
    }
  }

  const envKeys = [
    'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'AUTH_SECRET',
    'NEXTAUTH_SECRET', 'NEXTAUTH_URL', 'GITHUB_OWNER', 'GITHUB_REPO',
  ]
  const envState = envKeys.map((k) => {
    const v = process.env[k]
    return { key: k, present: !!v, len: v ? v.length : 0 }
  })

  return new Response(
    JSON.stringify({
      envState,
      signinResult: result,
      capturedErrors: captured,
      logLines,
    }),
    { headers: { 'content-type': 'application/json' } }
  )
}
