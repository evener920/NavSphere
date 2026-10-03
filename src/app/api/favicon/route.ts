import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server';

export const runtime = 'edge'

// Google s2 favicons 在境内常被墙/挂起：浏览器直连既不成功也不失败，不会触发 onError，
// 表现为「破图 + 残留 alt 文字」。因此统一由本站服务端取回，浏览器只读本站同源地址。

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

/**
 * 把用户输入归一化为纯域名。
 *
 * 关键：Google s2 的 domain 参数只接受裸主机名。若传入完整 URL
 * （如 https://github.com），Google 无法解析，会**返回一张 200 的32x32 灰色地球占位图**——
 * 表面「获取成功」，实际拿到的不是该站点的真实图标。因此在服务端强制归一化。
 */
function normalizeDomain(input: string): string | null {
    const raw = input.trim()
    if (!raw) return null
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`
    try {
        const { hostname } = new URL(withScheme)
        // 去掉前导 www.，Google 对带www 与不带 www 的结果一致，省得用户纠结
        return hostname.replace(/^www\./i, '') || null
    } catch {
        return null
    }
}

/** 按魔术字节判定内容是否真的是图片，防止把上游的 HTML 错误页/占位内容当成图标。 */
function sniffImageType(buf: ArrayBuffer): string | null {
    if (buf.byteLength < 4) return null
    const b = new Uint8Array(buf, 0, Math.min(buf.byteLength, 16))
    // PNG: 89 50 4E 47
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png'
    // JPEG: FF D8 FF
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
    // GIF: GIF8
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif'
    // WebP: RIFF....WEBP
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
        b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp'
    // ICO: 00 00 01 00
    if (b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x01 && b[3] === 0x00) return 'image/x-icon'
    // AVIF/HEIC: ....ftyp
    if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return 'image/avif'
    // SVG / XML：以 '<' 开头
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

    // Google 对没有收录图标的域名返回 404（响应体是一张灰色地球占位图），必须以状态码判定，
    // 不能只看「有没有拿到字节」。
    const upstreamUrl = `https://www.google.com/s2/favicons?sz=128&domain=${encodeURIComponent(domain)}`

    try {
        const response = await fetch(upstreamUrl, {
            headers: { 'User-Agent': UA, Accept: 'image/*,*/*;q=0.8' },
            signal: AbortSignal.timeout(15000),
        })

        if (response.status === 404) {
            return NextResponse.json(
                { error: `Google 未收录 ${domain} 的图标，请改用 favicon.im 方式，或换用站点自己的 /favicon.ico` },
                { status: 404 }
            )
        }
        if (!response.ok) {
            return NextResponse.json({ error: `上游返回 ${response.status}` }, { status: 502 })
        }

        const buf = await response.arrayBuffer()
        const contentType = sniffImageType(buf)
        if (!contentType) {
            return NextResponse.json({ error: '上游返回的不是图片内容' }, { status: 415 })
        }

        return new NextResponse(buf, {
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `inline; filename="${domain}.${contentType.split('/')[1] === 'svg+xml' ? 'svg' : contentType.split('/')[1]}"`,
                // 告诉前端真实取到的域名，便于回显
                'X-Favicon-Domain': domain,
                'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
                'X-Content-Type-Options': 'nosniff',
            },
        })
    } catch (error) {
        console.error('Error fetching favicon:', error)
        return NextResponse.json({ error: '获取失败，请稍后重试' }, { status: 502 })
    }
}