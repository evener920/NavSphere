'use client'

import { useState, useEffect, useMemo } from 'react'
import { LetterAvatar } from './letter-avatar'
import { proxiedImageUrl as proxied } from '@/lib/image-proxy'

interface SiteFaviconProps {
  title: string
  icon?: string
  useDefaultIcon?: boolean
  className?: string
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
