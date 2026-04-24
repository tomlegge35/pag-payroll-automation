/**
 * Inbox Polling - Parses replies from Khalid
 * Uses structured subject tags [PAG-Payroll-YYYY-MM] for deterministic matching
 */

import { graphRequest } from './client'

const PAYROLL_EMAIL = process.env.PAYROLL_EMAIL || 'payroll@premieradvisory.co.uk'
const CYCLE_TAG_REGEX = /\[PAG-Payroll-(\d{4})-(\d{2})\]/i

export interface EmailMessage {
  id: string
  subject: string
  bodyPreview: string
  body: { content: string; contentType: string }
  from: { emailAddress: { address: string; name: string } }
  receivedDateTime: string
  internetMessageId: string
  conversationId: string
}

export async function pollPayrollInbox(): Promise<EmailMessage[]> {
  const userId = PAYROLL_EMAIL
  
  // Get unread messages from the last 48 hours
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  
  const response = await graphRequest(
    `/users/${encodeURIComponent(userId)}/messages?$filter=isRead eq false and receivedDateTime gt ${cutoff}&$orderby=receivedDateTime desc&$top=50&$select=id,subject,bodyPreview,body,from,receivedDateTime,internetMessageId,conversationId`
  )
  
  return response?.value || []
}

export function extractCycleFromSubject(subject: string): { year: number; month: number } | null {
  const match = subject.match(CYCLE_TAG_REGEX)
  if (!match) return null
  
  return {
    year: parseInt(match[1]),
    month: parseInt(match[2]),
  }
}

export async function markEmailAsRead(messageId: string): Promise<void> {
  const userId = PAYROLL_EMAIL
  await graphRequest(
    `/users/${encodeURIComponent(userId)}/messages/${messageId}`,
    'PATCH',
    { isRead: true }
  )
}

export async function getEmailThread(conversationId: string): Promise<EmailMessage[]> {
  const userId = PAYROLL_EMAIL
  const response = await graphRequest(
    `/users/${encodeURIComponent(userId)}/messages?$filter=conversationId eq '${conversationId}'&$orderby=receivedDateTime asc&$select=id,subject,body,from,receivedDateTime,internetMessageId`
  )
  return response?.value || []
}

// Parse incoming email to extract query text
export function parseQueryFromEmail(email: EmailMessage): string {
  // Strip HTML tags for plain text extraction
  const plainText = email.body.content
    .replace(/<style[^>]*>.*?<\/style>/gis, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
  
  // Limit length for storage
  return plainText.substring(0, 2000)
}
