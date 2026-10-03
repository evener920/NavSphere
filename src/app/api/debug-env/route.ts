export const runtime = 'nodejs'
export async function GET() {
  const keys = [
    'GITHUB_CLIENT_ID','GITHUB_CLIENT_SECRET','AUTH_SECRET','AUTH_GITHUB_ID','AUTH_GITHUB_SECRET',
    'NEXTAUTH_URL','NEXT_PUBLIC_API_URL','GITHUB_OWNER','GITHUB_REPO','GITHUB_BRANCH','GITHUB_PAT'
  ]
  const present = keys.filter(k => process.env[k] !== undefined && process.env[k] !== '')
  return Response.json({ present, count: present.length })
}
