import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs'

// 数据仓图片代理：浏览器不直连 raw.githubusercontent.com（境内常被墙/挂起导致破图），
// 改由本站服务端取回后回传，稳定且不受跨域/网络限制影响。
// 允许的源：数据仓 raw 地址 + google s2 favicon（服务端取，不受浏览器侧封锁影响）。
const ALLOWED_HOSTS = new Set([
    'raw.githubusercontent.com',
    'www.google.com',
]);

function contentTypeFor(url: string, fallback: string | null): string {
    if (fallback && /^image\//i.test(fallback)) return fallback;
    if (url.includes('.png')) return 'image/png';
    if (url.includes('.jpg') || url.includes('.jpeg')) return 'image/jpeg';
    if (url.includes('.gif')) return 'image/gif';
    if (url.includes('.svg')) return 'image/svg+xml';
    if (url.includes('.webp')) return 'image/webp';
    if (url.includes('.ico')) return 'image/x-icon';
    return 'application/octet-stream';
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get('url');

    if (!raw) {
        return NextResponse.json({ error: '缺少 url 参数' }, { status: 400 });
    }

    let target: URL;
    try {
        target = new URL(raw);
    } catch {
        return NextResponse.json({ error: 'url 参数不合法' }, { status: 400 });
    }

    if (target.protocol !== 'https:' || !ALLOWED_HOSTS.has(target.hostname)) {
        return NextResponse.json({ error: '不允许的图片源' }, { status: 403 });
    }

    try {
        const upstream = await fetch(target.toString(), {
            redirect: 'follow',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
            },
            signal: AbortSignal.timeout(15000),
        });

        if (!upstream.ok) {
            return NextResponse.json({ error: '上游图片不可用' }, { status: 502 });
        }

        const buf = await upstream.arrayBuffer();
        const contentType = contentTypeFor(target.toString(), upstream.headers.get('content-type'));

        // 关键校验：上游可能返回 HTML 错误页（例如站点没有 favicon 时 google 会回 404 HTML，
        // 或某些站点把 404 页面当图片返回）。这类内容必须拒绝，否则浏览器会渲染出破图。
        const head = new Uint8Array(buf.slice(0, 2));
        const isHtml = head[0] === 0x3c && head[1] !== 0x3f; // '<' 开头且不是 '<?xml'
        if (isHtml) {
            return NextResponse.json({ error: '上游返回的不是图片' }, { status: 415 });
        }

        return new NextResponse(buf, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
                'X-Content-Type-Options': 'nosniff',
            },
        });
    } catch (error) {
        console.error('Image proxy failed:', error);
        return NextResponse.json({ error: '代理取图失败' }, { status: 502 });
    }
}
