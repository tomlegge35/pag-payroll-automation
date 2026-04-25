#!/usr/bin/env node
/**
 * PAG Payroll Automation - Environment Variable Checker
 * Run: node scripts/check-env.js
 * Or:  npm run env:check
 *
 * Checks that all required env vars are present.
 * Loads .env.local if it exists (local dev).
 * In CI/Netlify, env vars come from the environment directly.
 */

const fs = require('fs')
const path = require('path')

// Load .env.local for local dev
const envLocalPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envLocalPath)) {
  const lines = fs.readFileSync(envLocalPath, 'utf8').split('\n')
  lines.forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) return
    const key = trimmed.substring(0, eqIndex).trim()
    const value = trimmed.substring(eqIndex + 1).trim()
    if (key && !process.env[key]) {
      process.env[key] = value
    }
  })
}

const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'GRAPH_TENANT_ID',
  'GRAPH_CLIENT_ID',
  'GRAPH_CLIENT_SECRET',
  'PAYROLL_EMAIL',
  'NEXT_PUBLIC_APP_URL',
]

const LEGACY_VARS = [
  'AZURE_AD_CLIENT_ID',
  'AZURE_AD_CLIENT_SECRET',
  'AZURE_AD_TENANT_ID',
  'GRAPH_REFRESH_TOKEN',
]

const SENSITIVE_KEYS = ['KEY', 'SECRET', 'TOKEN', 'ROLE']

function isSensitive(key) {
  return SENSITIVE_KEYS.some(s => key.includes(s))
}

function mask(key, value) {
  if (isSensitive(key)) return value.substring(0, 6) + '...[masked]'
  return value
}

console.log('\n=== PAG Payroll - Environment Variable Check ===\n')

let hasErrors = false

REQUIRED.forEach(key => {
  const value = process.env[key]
  if (!value) {
    console.error(`  MISSING  ${key}`)
    hasErrors = true
  } else {
    console.log(`  OK       ${key} = ${mask(key, value)}`)
  }
})

console.log('')

LEGACY_VARS.forEach(key => {
  if (process.env[key]) {
    console.warn(`  WARNING  ${key} is set but not used by this app. Remove it to avoid confusion.`)
  }
})

if (hasErrors) {
  console.error('\nFAIL: Missing required environment variables.')
  console.error('Copy .env.example to .env.local and fill in all values.\n')
  process.exit(1)
} else {
  console.log('PASS: All required environment variables are present.\n')
}
