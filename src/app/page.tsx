import { NavigationContent } from '@/components/navigation-content'
import { Metadata } from 'next/types'
import { ScrollToTop } from '@/components/ScrollToTop'
import { Container } from '@/components/ui/container'
import type { SiteConfig } from '@/types/site'
import navigationDataFallback from '@/navsphere/content/navigation.json'
import siteDataFallback from '@/navsphere/content/site.json'
import { getFileContentPublic } from '@/lib/github'
import { getProcessedData } from '@/lib/data-loader'

// 每次请求都重新渲染，并从 GitHub 数据仓取最新导航数据（后台添加后立即生效，最多 30s 缓存延迟）
export const dynamic = 'force-dynamic'

async function getData() {
  // 以本地打包文件为兜底，优先使用数据仓（后台写入）的内容
  let navRaw: any = navigationDataFallback
  let siteRaw: any = siteDataFallback

  try {
    const nav = await getFileContentPublic('src/navsphere/content/navigation.json')
    if (nav && Array.isArray((nav as any).navigationItems)) {
      navRaw = nav
    }
  } catch {
    // 读取失败 -> 保持本地兜底
  }

  try {
    const site = await getFileContentPublic('src/navsphere/content/site.json')
    // 数据仓可能没有 site.json（站点配置），仅当其确实返回了站点配置时才覆盖
    if (site && typeof site === 'object' && (site as any).basic) {
      siteRaw = site
    }
  } catch {
    // 读取失败 -> 保持本地兜底
  }

  return getProcessedData(navRaw, siteRaw)
}

export async function generateMetadata(): Promise<Metadata> {
  const { siteData } = await getData()

  return {
    title: siteData.basic.title,
    description: siteData.basic.description,
    keywords: siteData.basic.keywords,
    icons: {
      icon: siteData.appearance.favicon,
    },
  }
}

export default async function HomePage() {
  const { navigationData, siteData } = await getData()

  return (
    <Container>
      <NavigationContent navigationData={navigationData} siteData={siteData} />
      <ScrollToTop />
    </Container>
  )
}
