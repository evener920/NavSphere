import { GET } from '@/lib/auth'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin
  const target = new URL('/api/auth/signin/github', origin)

  let direct: any = {}
  try {
    const res = await GET(
      new NextRequest(target.toString(), { headers: req.headers })
    )
    direct = {
      status: res.status,
      location: res.headers.get('location'),
    }
  } catch (e: any) {
    direct = {
      threw: true,
      message: e?.message,
      type: e?.type,
      stack: e?.stack,
    }
  }

  const g: any = globalThis
  return new Response(
    JSON.stringify({ direct, captured: g.__AUTH_ERR ?? [] }),
    { headers: { 'content-type': 'application/json' } }
  )
}
