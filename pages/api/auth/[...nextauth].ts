import NextAuth from "next-auth"
import GoogleProvider from 'next-auth/providers/google'

interface authProvider {
    clientId: string,
    clientSecret:string
}

export default NextAuth({
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_ID,
            clientSecret: process.env.GOOGLE_SECRET
        } as authProvider)
    ],
    callbacks: {
        async jwt({ token, account }) {
          if (account) {
            token.accessToken = account.access_token
          }
          return token
        },
        async session({ session, token, user }) {
          session.accessToken = token.accessToken
          return session
        }
    }
  })