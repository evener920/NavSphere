import { NextResponse } from 'next/server'
import { getFileContentPublic } from '@/lib/github'
import navigationDataFallback from '@/navsphere/content/navigation.json'

export const runtime = 'edge'

export async function GET() {
  try {
    const data = await getFileContentPublic('src/navsphere/content/navigation.json')
    const nav =
      data && Array.isArray((data as any).navigationItems)
        ? data
        : navigationDataFallback

    return NextResponse.json(nav, {
      headers: {
        'Cache-Control': 's-maxage=60, stale-while-revalidate',
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('Error in navigation API:', error)
    return NextResponse.json(navigationDataFallback, {
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }
}
