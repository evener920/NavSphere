// 境外图片源（GitHub raw / Google favicon）在境内常被墙或挂起：请求既不成功也不失败，
// 浏览器不会触发 onError，表现为「破图 + 残留 alt 文字」。因此统一改走本站服务端代理。
// 数据仓自建图由服务端取回，跨域与网络问题一并消失。
//
// 注意：任何渲染**数据仓/境外图片**的组件都应使用此函数，
// 否则会出现「导航页图标正常、后台资源页却裂图」的不一致。
export function proxiedImageUrl(icon?: string): string | undefined {
  if (!icon) return undefined
  if (icon.startsWith('/')) return icon // 站内路径原样使用
  if (icon.startsWith('/api/img-proxy')) return icon

  let url: URL
  try {
    url = new URL(icon)
  } catch {
    return undefined // 非法 URL
  }

  const needsProxy =
    url.hostname === 'raw.githubusercontent.com' ||
    url.hostname.endsWith('.githubusercontent.com') ||
    url.hostname === 'www.google.com' ||
    url.hostname === 'google.com'

  if (!needsProxy) return icon

  // 相对路径返回，避免代理地址与站点域名耦合
  return `/api/img-proxy?url=${encodeURIComponent(url.toString())}`
}
