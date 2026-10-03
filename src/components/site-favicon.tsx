'use client'

import { useState, useEffect, useMemo } from 'react'
import { LetterAvatar } from './letter-avatar'

interface SiteFaviconProps {
  title: string
  icon?: string
  useDefaultIcon?: boolean
  className?: string
}

// 境外图片源（GitHub raw / Google favicon）在境内常被墙或挂起：请求既不成功也不失败，
// 浏览器不会触发 onError，表现为「破图 + 残留 alt 文字」。因此统一改走本站服务端代理。
// 数据仓自建图（/api/img-proxy?url=raw.githubusercontent...）由服务端取回，跨域与网络问题一并消失。
function proxied(icon?: string): string | undefined {
  if (!icon) return undefined
  if (icon.startsWith('/')) return icon // 站内路径原样使用
  if (icon.startsWith('/api/img-proxy')) return icon

  let url: URL
  try {
    url = new URL(icon)
  } catch {
    return undefined // 非法 URL，直接走字母兜底
  }

  const needsProxy =
    url.hostname === 'raw.githubusercontent.com' ||
    url.hostname.endsWith('.githubusercontent.com') ||
    url.hostname === 'www.google.com' ||
    url.hostname === 'google.com'

  if (!needsProxy) return icon

  const proxiedUrl = `/api/img-proxy?url=${encodeURIComponent(url.toString())}`
  // 相对路径返回，避免代理地址与站点域名耦合
  return proxiedUrl
}

// useDefaultIcon === true、无 icon、或图片加载失败 → 显示首字母色块;否则显示 <img>。
export function SiteFavicon({ title, icon, useDefaultIcon, className }: SiteFaviconProps) {
  const [errored, setErrored] = useState(false)
  const src = useMemo(() => proxied(icon), [icon])

  // icon 变化时重置错误态(同一组件实例复用于不同 item 时)
  useEffect(() => {
    setErrored(false)
  }, [src])

  if (useDefaultIcon || !src || errored) {
    return <LetterAvatar title={title} className={className} />
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setErrored(true)}
    />
  )
}
