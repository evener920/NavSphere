import { NextResponse } from 'next/server'
export const runtime = 'nodejs'
export async function GET() {
  const keys = [
    'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET', 'AUTH_SECRET',
    'NEXTAUTH_URL', 'NEXT_PUBLIC_API_URL', 'GITHUB_OWNER', 'GITHUB_REPO'
  ]
  const info = keys.map((k) => {
    const v = process.env[k]
    return { key: k, present: v !== undefined && v !== '', len: v ? v.length : 0 }
  })
  return NextResponse.json(info)
}
