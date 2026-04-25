import { createBrowserClient } from '@supabase/ssr'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}.\n` +
      `Local dev: ensure it is set in .env.local\n` +
      `Production: ensure it is set in Netlify Site configuration → Environment variables`
    )
  }
  return value
}

export function createClient() {
  return createBrowserClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  )
}
