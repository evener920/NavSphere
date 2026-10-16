import NextAuth from 'next-auth'
import GitHub from 'next-auth/providers/github'
import Credentials from 'next-auth/providers/credentials'
import type { DefaultSession, NextAuthConfig } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      accessToken?: string
    } & DefaultSession['user']
  }
  interface JWT {
    accessToken?: string
  }
  interface User {
    accessToken?: string
  }
}

const config = {
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      // NavSphere needs `repo` scope to read/write the data repo (evener920/nav)
      authorization: {
        url: 'https://github.com/login/oauth/authorize',
        params: { scope: 'read:user user:email repo' }
      }
    }),
    Credentials({
      name: '管理口令',
      credentials: {
        password: { label: '管理口令', type: 'password' }
      },
      authorize: async (credentials) => {
        if (credentials?.password === process.env.ADMIN_PASSWORD) {
          return { id: 'admin', name: 'Admin', email: 'admin@nav.201573.xyz' }
        }
        return null
      }
    })
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account?.access_token) {
        token.accessToken = account.access_token
      } else if (account?.provider === 'credentials') {
        // 密码登录：写入仓库所需的 GitHub token 取自部署环境变量 GITHUB_PAT，
        // 不再依赖 GitHub OAuth App，避免回调域名 / 凭证失效导致整站无法登录。
        token.accessToken = process.env.GITHUB_PAT
      }
      return token
    },
    async session({ session, token }) {
      if (session?.user) {
        session.user.accessToken = token.accessToken as string
      }
      return session
    }
  },
  pages: {
    signIn: '/auth/signin'
  },
  trustHost: true,
  secret: process.env.AUTH_SECRET
} satisfies NextAuthConfig

const handler = NextAuth(config)

export const auth = handler.auth
export const { handlers: { GET, POST } } = handler
export { config }
