import { VideoPlayerPage } from '@/components/video-player-page'
import { Metadata } from 'next/types'
import videosDataFallback from '@/navsphere/content/videos.json'
import siteDataFallback from '@/navsphere/content/site.json'
import { getFileContentPublic } from '@/lib/github'
import { getProcessedData } from '@/lib/data-loader'

// 每次请求都重新渲染，并从 GitHub 数据仓取最新视频数据（与 /videos 保持一致）
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
        title: `视频播放器 - ${siteData.basic.title}`,
        description: '视频播放中心',
        keywords: 'Bilibili, YouTube, Videos, Player',
        icons: {
            icon: siteData.appearance.favicon,
        },
    }
}

export default async function VideoPlayerRoute() {
    const { navigationData, siteData } = await getData()

    return (
        <VideoPlayerPage navigationData={navigationData} siteData={siteData} />
    )
}
