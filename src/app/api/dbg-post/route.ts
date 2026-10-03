import { GET as authGET, POST as authPOST } from '@/lib/auth'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin
  const out: any = {}

  const call = async (method: string, path: string, body?: string, cookies?: string) => {
    const headers: any = {}
    if (body) headers['content-type'] = 'application/x-www-form-urlencoded'
    if (cookies) headers.cookie = cookies
    const r = new NextRequest(origin + path, { method, headers, body })
    return method === 'GET' ? await authGET(r) : await authPOST(r)
  }

  // 1. get csrf
  const csrfRes = await call('GET', '/api/auth/csrf')
  const csrfBody = await csrfRes.text()
  out.csrf = {
    status: csrfRes.status,
    body: csrfBody,
    setCookie: csrfRes.headers.get('set-cookie'),
  }

  let csrfToken: string | undefined
  let cookie: string | undefined
  try {
    const j = JSON.parse(csrfBody)
    csrfToken = j.csrfToken
    cookie = csrfRes.headers.get('set-cookie') ?? undefined
  } catch {}

  // 2. POST signin/github (faithful to client signIn('github', {scope:'repo'}))
  const postBody = new URLSearchParams({
    csrfToken: csrfToken || '',
    callbackUrl: '/admin',
    scope: 'repo',
  }).toString()
  const signinRes = await call('POST', '/api/auth/signin/github', postBody, cookie)
  out.signin = {
    status: signinRes.status,
    location: signinRes.headers.get('location'),
  }

  const g: any = globalThis
  out.captured = g.__AUTH_ERR ?? []
  return new Response(JSON.stringify(out), {
    headers: { 'content-type': 'application/json' },
  })
}
