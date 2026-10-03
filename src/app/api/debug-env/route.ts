export const runtime = 'nodejs'
export async function GET() {
  const probe = (k: string) => {
    const v = process.env[k]
    return { exists: v !== undefined && v !== '', length: v ? v.length : 0 }
  }
  return Response.json({
    GITHUB_CLIENT_ID: probe('GITHUB_CLIENT_ID'),
    GITHUB_CLIENT_SECRET: probe('GITHUB_CLIENT_SECRET'),
    AUTH_SECRET: probe('AUTH_SECRET'),
    AUTH_GITHUB_ID: probe('AUTH_GITHUB_ID'),
  })
}
