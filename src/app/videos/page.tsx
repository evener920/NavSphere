import { VideoContent } from '@/components/video-content'
import { Metadata } from 'next/types'
import { ScrollToTop } from '@/components/ScrollToTop'
import { Container } from '@/components/ui/container'
import videosDataFallback from '@/navsphere/content/videos.json'
import siteDataFallback from '@/navsphere/content/site.json'
import { getFileContentPublic } from '@/lib/github'
import { getProcessedData } from '@/lib/data-loader'

// 每次请求都重新渲染，并从 GitHub 数据仓取最新视频数据（后台添加后立即生效，最多 30s 缓存延迟）
export const dynamic = 'force-dynamic'

async function getData() {
    // 以本地打包文件为兜底，优先使用数据仓（后台写入）的内容
    let videosRaw: any = videosDataFallback
    let siteRaw: any = siteDataFallback

    try {
        const videos = await getFileContentPublic('src/navsphere/content/videos.json')
        if (videos && Array.isArray((videos as any).navigationItems)) {
            videosRaw = videos
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

    return getProcessedData(videosRaw, siteRaw)
}

export async function generateMetadata(): Promise<Metadata> {
    const { siteData } = await getData()

    return {
        title: `Videos - ${siteData.basic.title}`,
        description: 'Video Navigation',
        keywords: 'Bilibili, YouTube, Videos',
        icons: {
            icon: siteData.appearance.favicon,
        },
    }
}

export default async function VideosPage() {
    const { navigationData, siteData } = await getData()

    return (
        <Container>
            <VideoContent navigationData={navigationData} siteData={siteData} />
            <ScrollToTop />
        </Container>
    )
}
