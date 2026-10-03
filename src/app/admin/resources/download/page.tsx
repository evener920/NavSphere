'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

type Source = 'google' | 'faviconim'

interface FetchedFavicon {
    blob: Blob
    objectUrl: string
    domain: string
    source: Source
}

const SOURCE_LABEL: Record<Source, string> = {
    google: 'Google Favicon',
    faviconim: 'favicon.im',
}

// blob 的 MIME → 扩展名。原先无论真实类型一律存成 .ico，下载后文件与内容不符。
function extForMime(mime: string): string {
    if (mime.includes('svg')) return 'svg'
    if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg'
    if (mime.includes('gif')) return 'gif'
    if (mime.includes('webp')) return 'webp'
    if (mime.includes('avif')) return 'avif'
    if (mime.includes('x-icon') || mime.includes('vnd.microsoft.icon')) return 'ico'
    return 'png'
}

const FaviconDownloader: React.FC = () => {
    const [url, setUrl] = useState('')
    const [result, setResult] = useState<FetchedFavicon | null>(null)
    const [error, setError] = useState('')
    const [isLoading, setIsLoading] = useState<Source | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    // 图片直接用 objectURL 渲染。注意：**不能**再过 proxiedImageUrl——blob: 不是 http(s) URL，
    // 交给代理只会得到 undefined，画面反而空白。
    const objectUrlRef = useRef<string | null>(null)

    // 组件卸载时回收 objectURL，避免内存泄漏
    useEffect(() => {
        return () => {
            if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
        }
    }, [])

    const handleFetch = useCallback(async (source: Source) => {
        const input = url.trim()
        if (!input) return

        setIsLoading(source)
        setError('')
        if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current)
            objectUrlRef.current = null
        }
        setResult(null)

        const endpoint = source === 'google' ? '/api/favicon' : '/api/favicon-im'

        try {
            const response = await fetch(`${endpoint}?domain=${encodeURIComponent(input)}`)
            if (!response.ok) {
                let msg = `获取失败（${response.status}）`
                try {
                    const data = await response.json()
                    if (data?.error) msg = data.error
                } catch {
                    /* 响应不是 JSON，保留默认文案 */
                }
                throw new Error(msg)
            }

            const blob = await response.blob()
            // 兜底：服务端已做魔术字节校验，这里再挡一次，防止代理/缓存被污染
            if (!blob.type.startsWith('image/')) {
                throw new Error('上游返回的不是图片内容')
            }

            const objectUrl = URL.createObjectURL(blob)
            objectUrlRef.current = objectUrl
            setResult({
                blob,
                objectUrl,
                domain: response.headers.get('X-Favicon-Domain') || input,
                source,
            })
        } catch (e) {
            setError(e instanceof Error ? e.message : '发生错误，请重试。')
        } finally {
            setIsLoading(null)
        }
    }, [url])

    const downloadFavicon = useCallback(() => {
        if (!result) return
        const ext = extForMime(result.blob.type)
        const link = document.createElement('a')
        link.href = result.objectUrl
        link.download = `${result.domain}.${ext}`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }, [result])

    // 下载到本地并不能直接给 NavSphere 用——站点图标必须是数据仓里的 URL。
    // 这里直接把抓到的图传进资源库，拿到可立即粘贴的 raw 链接。
    const uploadToLibrary = useCallback(async () => {
        if (!result) return
        setIsUploading(true)
        try {
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () => resolve(String(reader.result))
                reader.onerror = () => reject(new Error('读取图片失败'))
                reader.readAsDataURL(result.blob)
            })

            const response = await fetch('/api/resource', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64, folder: 'assets', prefix: 'favicon' }),
            })
            const data = await response.json()
            if (!response.ok || !data?.imageUrl) {
                throw new Error(data?.error || '上传到资源库失败')
            }
            toast.success('已上传到资源库', {
                description: '复制下面的链接，粘贴到站点的「图标」字段即可',
            })
            navigator.clipboard?.writeText(data.imageUrl).catch(() => {})
        } catch (e) {
            toast.error(e instanceof Error ? e.message : '上传失败')
        } finally {
            setIsUploading(false)
        }
    }, [result])

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
            <div className="max-w-2xl mx-auto py-12 px-4">
                <div className="bg-white rounded-lg shadow-lg p-8">
                    <h1 className="text-3xl font-bold text-center text-gray-800 mb-3">
                        网站图标下载
                    </h1>
                    <p className="text-center text-sm text-gray-500 mb-8">
                        抓取站点 favicon，可下载到本地，或直接上传到资源库供导航使用
                    </p>

                    <div className="space-y-6">
                        <div className="relative">
                            <input
                                type="text"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && url.trim() && !isLoading) handleFetch('google')
                                }}
                                placeholder="域名，例如 github.com"
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                            />
                        </div>

                        <p className="text-xs text-gray-500 text-center -mt-2">
                            填域名即可（<code className="bg-gray-100 px-1 py-0.5 rounded">github.com</code>）；
                            粘贴完整网址也能自动识别
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <button
                                onClick={() => handleFetch('google')}
                                disabled={isLoading !== null || !url.trim()}
                                className="flex-1 bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading === 'google' ? '获取中…' : '通过 Google Favicon 获取'}
                            </button>
                            <button
                                onClick={() => handleFetch('faviconim')}
                                disabled={isLoading !== null || !url.trim()}
                                className="flex-1 bg-emerald-500 text-white px-6 py-3 rounded-lg hover:bg-emerald-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading === 'faviconim' ? '获取中…' : '通过 favicon.im 获取'}
                            </button>
                        </div>

                        {result && (
                            <div className="text-center p-6 bg-gray-50 rounded-lg">
                                <img
                                    src={result.objectUrl}
                                    alt="Favicon"
                                    className="w-20 h-20 mx-auto mb-3 shadow-md rounded"
                                />
                                <p className="text-gray-600 mb-1">
                                    {result.domain} · {SOURCE_LABEL[result.source]}
                                </p>
                                <p className="text-xs text-gray-400 mb-4">
                                    {result.blob.type} · {(result.blob.size / 1024).toFixed(1)} KB
                                </p>
                                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                    <button
                                        onClick={downloadFavicon}
                                        className="bg-indigo-500 text-white px-6 py-2 rounded-lg hover:bg-indigo-600 transition"
                                    >
                                        下载到本地
                                    </button>
                                    <button
                                        onClick={uploadToLibrary}
                                        disabled={isUploading}
                                        className="bg-slate-700 text-white px-6 py-2 rounded-lg hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isUploading ? '上传中…' : '上传到资源库'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-red-600 text-center text-sm">{error}</p>
                            </div>
                        )}

                        <div className="pt-4 border-t border-gray-100 text-xs text-gray-400 leading-relaxed">
                            <p className="font-medium text-gray-500 mb-1">怎么使用</p>
                            <ol className="list-decimal list-inside space-y-1">
                                <li>填入站点域名（如 <code>github.com</code>），回车或点按钮抓取图标。</li>
                                <li>两个按钮都失败时换一个再试：Google 收录不全，favicon.im 对冷门站点更友好。</li>
                                <li>抓到后点<strong>「上传到资源库」</strong>，链接会自动复制到剪贴板。</li>
                                <li>到「站点管理」新增/编辑站点，把链接粘进<strong>「图标」</strong>字段并保存。</li>
                            </ol>
                            <p className="mt-2">
                                提示：在「站点管理」新增站点时点<strong>「自动获取」</strong>，通常已经包含图标下载这一步，无需单独来此页。
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default FaviconDownloader