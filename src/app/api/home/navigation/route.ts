import { NextResponse } from 'next/server'
import { getFileContentPublic } from '@/lib/github'
import navigationDataFallback from '@/navsphere/content/navigation.json'

export const runtime = 'nodejs'

// 不要用 edge runtime：`next: { revalidate }` 的数据缓存在 edge 下不可靠，
// 会让后台新增的站点长时间不出现（首页是 node runtime hence 正常，API 却滞后）。
export async function GET() {
  try {
    const data = await getFileContentPublic('src/navsphere/content/navigation.json')
    const nav =
      data && Array.isArray((data as any).navigationItems)
        ? data
        : navigationDataFallback

    return NextResponse.json(nav, {
      headers: {
        'Cache-Control': 's-maxage=30, stale-while-revalidate',
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
