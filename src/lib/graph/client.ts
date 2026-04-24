/**
 * Microsoft Graph API Client
 * Uses OAuth 2.0 client credentials flow
 * All calls via REST (no SDK dependency)
 */

interface GraphToken {
  access_token: string
  expires_in: number
  token_type: string
}

let cachedToken: { token: string; expiresAt: number } | null = null

export async function getGraphToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60000) {
    return cachedToken.token
  }

  const tenantId = process.env.GRAPH_TENANT_ID!
  const clientId = process.env.GRAPH_CLIENT_ID!
  const clientSecret = process.env.GRAPH_CLIENT_SECRET!

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  })

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get Graph token: ${error}`)
  }

  const data: GraphToken = await response.json()
  
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  }

  return cachedToken.token
}

export async function graphRequest(
  endpoint: string,
  method: string = 'GET',
  body?: unknown,
  additionalHeaders?: Record<string, string>
) {
  const token = await getGraphToken()
  
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...additionalHeaders,
  }

  const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Graph API error ${response.status}: ${error}`)
  }

  if (response.status === 204) return null
  return response.json()
}
