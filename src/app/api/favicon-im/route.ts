import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server';

export const runtime = 'edge'

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

/**
 * 把用户输入归一化为纯域名（与 /api/favicon 保持一致）。
 * 用户常直接粘贴完整 URL（含 https:// 与路径），favicon.im 的路径段只接受主机名。
 */
function normalizeDomain(input: string): string | null {
    const raw = input.trim()
    if (!raw) return null
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`
    try {
        const { hostname } = new URL(withScheme)
        return hostname.replace(/^www\./i, '') || null
    } catch {
        return null
    }
}

/** 按魔术字节判定内容是否真的是图片。 */
function sniffImageType(buf: ArrayBuffer): string | null {
    if (buf.byteLength < 4) return null
    const b = new Uint8Array(buf, 0, Math.min(buf.byteLength, 16))
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif'
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
        b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp'
    if (b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x01 && b[3] === 0x00) return 'image/x-icon'
    if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'image/avif'
    if (b[0] === 0x3c) return 'image/svg+xml'
    return null
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const raw = searchParams.get('domain')

    if (!raw) {
        return NextResponse.json({ error: '缺少 domain 参数' }, { status: 400 })
    }

    const domain = normalizeDomain(raw)
    if (!domain) {
        return NextResponse.json({ error: '网址格式不正确，请填写域名，例如 github.com' }, { status: 400 })
    }

    // 修复：原代码在这里多拼了"' }" 三个字符，实际请求的是一个畸形的 query，
    // 会让 favicon.im 返回与预期不同的结果。/zh/ 是中文站点的界面前缀，保留。
    const upstreamUrl = `https://favicon.im/zh/${encodeURIComponent(domain)}?larger=true`

    try {
        const response = await fetch(upstreamUrl, {
            headers: { 'User-Agent': UA, Accept: 'image/*,*/*;q=0.8' },
            redirect: 'follow',
            signal: AbortSignal.timeout(15000),
        })

        // favicon.im 对不存在的域名返回 403（text/plain），对存在但无图标的域名
        // 返回一张通用占位 SVG——两种情况都通过状态码/内容类型区分。
        if (!response.ok) {
            return NextResponse.json(
                { error: `favicon.im 返回 ${response.status}，该域名可能没有可用图标` },
                { status: response.status === 403 ? 404 : 502 }
            )
        }

        const buf = await response.arrayBuffer()
        const contentType = sniffImageType(buf)
        if (!contentType) {
            return NextResponse.json({ error: '上游返回的不是图片内容' }, { status: 415 })
        }

        const ext = contentType === 'image/svg+xml' ? 'svg' : contentType.split('/')[1]
        return new NextResponse(buf, {
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `inline; filename="${domain}.${ext}"`,
                'X-Favicon-Domain': domain,
                'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
                'X-Content-Type-Options': 'nosniff',
            },
        })
    } catch (error) {
        console.error('Error fetching favicon from favicon.im:', error)
        return NextResponse.json({ error: '获取失败，请稍后重试' }, { status: 502 })
    }
}