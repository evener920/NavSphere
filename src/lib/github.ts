import { auth } from '@/lib/auth'
import { stringToBase64 } from '@/lib/buffer-utils'

export async function getFileContent(path: string) {
  const owner = process.env.GITHUB_OWNER!
  const repo = process.env.GITHUB_REPO!
  const branch = process.env.GITHUB_BRANCH || 'main'

  try {
    const session = await auth()
    const token = session?.user?.accessToken

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`
    const response = await fetch(apiUrl, {
      headers: {
        Accept: 'application/vnd.github.v3.raw',
        Authorization: token ? `token ${token}` : '',
        'User-Agent': 'NavSphere',
      },
    })

    if (response.status === 404) {
      console.log(`File not found: ${path}, returning default data`)
      if (path.includes('navigation.json')) {
        return { navigationItems: [] }
      }
      return {}
    }

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching file:', error)
    if (path.includes('navigation.json')) {
      return { navigationItems: [] }
    }
    return {}
  }
}

export async function commitFile(
  path: string,
  content: string,
  message: string,
  token: string,
  retryCount = 3
) {
  const owner = process.env.GITHUB_OWNER!
  const repo = process.env.GITHUB_REPO!
  const branch = process.env.GITHUB_BRANCH || 'main'

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      // 1. 获取当前文件信息（如果存在）
      const currentFileUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`
      const currentFileResponse = await fetch(currentFileUrl, {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'NavSphere',
        },
        cache: 'no-store', // 禁用缓存，确保获取最新的文件信息
      })

      let sha = undefined
      if (currentFileResponse.ok) {
        const currentFile = await currentFileResponse.json()
        sha = currentFile.sha
      }

      // 2. 创建或更新文件
      const updateUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`
      const response = await fetch(updateUrl, {
        method: 'PUT',
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'NavSphere',
        },
        body: JSON.stringify({
          message,
          content: stringToBase64(content),
          sha,
          branch,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        if (attempt < retryCount && error.message?.includes('sha')) {
          console.log(`Attempt ${attempt} failed, retrying after delay...`)
          await delay(1000 * attempt) // 指数退避
          continue
        }
        throw new Error(`Failed to commit file: ${error.message}`)
      }

      return await response.json()
    } catch (error) {
      if (attempt === retryCount) {
        console.error('Error in commitFile:', error)
        throw error
      }
      console.log(`Attempt ${attempt} failed, retrying...`)
      await delay(1000 * attempt)
    }
  }
}

/**
 * 服务端公开读取：供前台（未登录）首页使用。
 * 用 GITHUB_PAT（部署环境变量）而非用户会话 token，这样即使数据仓是私有库、
 * 访客未登录也能读到。带 30s 缓存，读取失败/404 时返回兜底默认值（由调用方回退到本地打包文件）。
 */
export async function getFileContentPublic(path: string) {
  const owner = process.env.GITHUB_OWNER!
  const repo = process.env.GITHUB_REPO!
  const branch = process.env.GITHUB_BRANCH || 'main'
  const token = process.env.GITHUB_PAT || ''

  try {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`
    const response = await fetch(apiUrl, {
      headers: {
        Accept: 'application/vnd.github.v3.raw',
        Authorization: token ? `token ${token}` : '',
        'User-Agent': 'NavSphere',
      },
      // 30s 数据缓存：后台改动最多 30s 后前台可见，同时避免每次请求都打 GitHub
      next: { revalidate: 30 },
    })

    if (response.status === 404) {
      console.log(`[public] File not found: ${path}, returning default`)
      if (path.includes('navigation.json')) return { navigationItems: [] }
      return {}
    }

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('[public] Error fetching file:', error)
    if (path.includes('navigation.json')) return { navigationItems: [] }
    return {}
  }
}