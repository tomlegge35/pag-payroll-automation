/**
 * Email Service - All 11 email types via Microsoft Graph API
 * Subject tags: [PAG-Payroll-YYYY-MM]
 */

import { graphRequest } from './client'

const PAYROLL_EMAIL = process.env.PAYROLL_EMAIL || 'payroll@premieradvisory.co.uk'
const KHALID_EMAIL = 'k.subhan@rodliffeaccounting.com'
const FINANCE_EMAIL = 'finance@premieradvisory.co.uk'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://pag-payroll.netlify.app'

function getCycleTag(year: number, month: number): string {
  return `[PAG-Payroll-${year}-${String(month).padStart(2, '0')}]`
}

function pagBranding(): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
      <div style="background-color: #1F3864; padding: 20px 30px; margin-bottom: 20px;">
        <h1 style="color: white; margin: 0; font-size: 20px;">Premier Advisory Group</h1>
        <p style="color: #5B9BD5; margin: 5px 0 0 0; font-size: 14px;">Payroll Management System</p>
      </div>
  `
}

function closingHtml(): string {
  return `
      <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; color: #666; font-size: 12px;">
        <p>This is an automated message from the PAG Payroll System. Do not reply directly to this email.</p>
        <p>For queries, contact <a href="mailto:${FINANCE_EMAIL}">${FINANCE_EMAIL}</a></p>
      </div>
    </div>
  `
}

async function sendEmail(
  to: string[],
  cc: string[] = [],
  subject: string,
  body: string,
  replyTo?: string
) {
  const message = {
    subject,
    body: {
      contentType: 'HTML',
      content: body,
    },
    toRecipients: to.map(email => ({ emailAddress: { address: email } })),
    ccRecipients: cc.map(email => ({ emailAddress: { address: email } })),
    replyTo: replyTo ? [{ emailAddress: { address: replyTo } }] : [],
  }

  const userId = PAYROLL_EMAIL
  await graphRequest(`/users/${userId}/sendMail`, 'POST', { message, saveToSentItems: true })
}

// E1: Cycle Initiation
export async function sendCycleInitiationEmail(
  cycleId: string,
  month: number,
  year: number,
  standingDataSummary: string
) {
  const tag = getCycleTag(year, month)
  const monthName = new Date(year, month - 1).toLocaleString('en-GB', { month: 'long' })
  const portalUrl = `${APP_URL}/cycle/${cycleId}/inputs`
  
  const body = `
    ${pagBranding()}
    <div style="padding: 0 30px 30px;">
      <h2 style="color: #1F3864;">Payroll Cycle Initiation: ${monthName} ${year}</h2>
      <p>The <strong>${monthName} ${year}</strong> payroll cycle has been initiated.</p>
      <p>Please review the standing data below and submit any changes by <strong>5pm on the 18th</strong>.</p>
      
      <div style="background: #f8f9fa; border: 1px solid #dee2e6; padding: 15px; border-radius: 4px; margin: 20px 0; overflow-x: auto;">
        ${standingDataSummary}
      </div>
      
      <div style="margin: 25px 0;">
        <a href="${portalUrl}?action=confirm" 
           style="background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin-right: 10px; display: inline-block;">
          ✓ Confirm No Changes
        </a>
        <a href="${portalUrl}" 
           style="background: #2E75B6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">
          📝 Submit Changes
        </a>
      </div>
      
      <p style="color: #666; font-size: 13px;">Reference: ${tag}</p>
    </div>
    ${closingHtml()}
  `
  
  await sendEmail(
    [PAYROLL_EMAIL],
    [KHALID_EMAIL],
    `${tag} Payroll Cycle Initiated: ${monthName} ${year}`,
    body
  )
}

// E2: Inputs to Rodliffe
export async function sendInputsToRodliffeEmail(
  cycleId: string,
  month: number,
  year: number,
  inputsSummary: string,
  docUrls: string[]
) {
  const tag = getCycleTag(year, month)
  const monthName = new Date(year, month - 1).toLocaleString('en-GB', { month: 'long' })
  const uploadUrl = `${APP_URL}/cycle/${cycleId}/upload`
  const queryUrl = `${APP_URL}/cycle/${cycleId}/queries`
  
  const body = `
    ${pagBranding()}
    <div style="padding: 0 30px 30px;">
      <h2 style="color: #1F3864;">PAG Payroll Inputs Ready: ${monthName} ${year}</h2>
      <p>PAG has submitted payroll inputs for processing. Please review and process.</p>
      
      <div style="background: #f8f9fa; border: 1px solid #dee2e6; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Input Summary</h3>
        ${inputsSummary}
      </div>
      
      ${docUrls.length > 0 ? `
        <div style="margin: 15px 0;">
          <h3>Supporting Documents</h3>
          <ul>
            ${docUrls.map((url, i) => `<li><a href="${url}">Document ${i + 1}</a> (secure link, valid 24 hours)</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      
      <div style="margin: 25px 0;">
        <a href="${uploadUrl}" 
           style="background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; margin-right: 10px; display: inline-block;">
          ✓ Accept Inputs & Upload Payroll
        </a>
        <a href="${queryUrl}" 
           style="background: #ffc107; color: #212529; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">
          ? Raise Query
        </a>
      </div>
      
      <p style="color: #666; font-size: 13px;">Reference: ${tag}</p>
    </div>
    ${closingHtml()}
  `
  
  await sendEmail(
    [KHALID_EMAIL],
    [],
    `${tag} Inputs Ready for Processing: ${monthName} ${year}`,
    body,
    PAYROLL_EMAIL
  )
}

// E3: Query Alert to PAG
export async function sendQueryAlertToPAG(
  cycleId: string,
  month: number,
  year: number,
  queryText: string,
  queryId: string
) {
  const tag = getCycleTag(year, month)
  const monthName = new Date(year, month - 1).toLocaleString('en-GB', { month: 'long' })
  const respondUrl = `${APP_URL}/cycle/${cycleId}/queries/${queryId}`
  
  const body = `
    ${pagBranding()}
    <div style="padding: 0 30px 30px;">
      <h2 style="color: #1F3864;">Query from Rodliffe: ${monthName} ${year}</h2>
      <p>Khalid at Rodliffe Accounting has raised a query regarding the ${monthName} ${year} payroll.</p>
      
      <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <strong>Query:</strong>
        <p style="margin-top: 8px;">${queryText}</p>
      </div>
      
      <div style="margin: 25px 0;">
        <a href="${respondUrl}" 
           style="background: #2E75B6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Respond to Query
        </a>
      </div>
      
      <p style="color: #666; font-size: 13px;">Reference: ${tag}</p>
    </div>
    ${closingHtml()}
  `
  
  await sendEmail(
    [PAYROLL_EMAIL],
    [],
    `${tag} Query from Rodliffe: ${monthName} ${year}`,
    body
  )
}

// E4: Query Response to Khalid
export async function sendQueryResponseToKhalid(
  cycleId: string,
  month: number,
  year: number,
  originalQuery: string,
  response: string,
  hasChanges: boolean
) {
  const tag = getCycleTag(year, month)
  const monthName = new Date(year, month - 1).toLocaleString('en-GB', { month: 'long' })
  const queriesUrl = `${APP_URL}/cycle/${cycleId}/queries`
  
  const body = `
    ${pagBranding()}
    <div style="padding: 0 30px 30px;">
      <h2 style="color: #1F3864;">Query Response: ${monthName} ${year}</h2>
      
      <div style="background: #f8f9fa; border: 1px solid #dee2e6; padding: 10px 15px; border-radius: 4px; margin: 15px 0;">
        <strong>Original query:</strong> ${originalQuery}
      </div>
      
      <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 15px; border-radius: 4px; margin: 15px 0;">
        <strong>PAG Response:</strong>
        <p style="margin-top: 8px;">${response}</p>
      </div>
      
      ${hasChanges ? '<p><strong>Note:</strong> Input data has been updated. Please review the updated inputs via the portal.</p>' : '<p>No changes to input data.</p>'}
      
      <div style="margin: 25px 0;">
        <a href="${queriesUrl}" 
           style="background: #2E75B6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">
          View Query Thread
        </a>
      </div>
      
      <p style="color: #666; font-size: 13px;">Reference: ${tag}</p>
    </div>
    ${closingHtml()}
  `
  
  await sendEmail(
    [KHALID_EMAIL],
    [],
    `${tag} Query Response: ${monthName} ${year}`,
    body,
    PAYROLL_EMAIL
  )
}

// E5: Upload Received
export async function sendUploadReceivedEmail(
  cycleId: string,
  month: number,
  year: number
) {
  const tag = getCycleTag(year, month)
  const monthName = new Date(year, month - 1).toLocaleString('en-GB', { month: 'long' })
  const reviewUrl = `${APP_URL}/cycle/${cycleId}/approve`
  
  const body = `
    ${pagBranding()}
    <div style="padding: 0 30px 30px;">
      <h2 style="color: #1F3864;">Payroll Upload Received: ${monthName} ${year}</h2>
      <p>Rodliffe has uploaded the completed payroll for ${monthName} ${year}.</p>
      <p>The system is processing the payslips and running variance analysis. You will receive a separate email with the variance report shortly.</p>
      
      <div style="margin: 25px 0;">
        <a href="${reviewUrl}" 
           style="background: #2E75B6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">
          View Variance Report
        </a>
      </div>
      
      <p style="color: #666; font-size: 13px;">Reference: ${tag}</p>
    </div>
    ${closingHtml()}
  `
  
  await sendEmail([PAYROLL_EMAIL], [], `${tag} Payroll Upload Received: ${monthName} ${year}`, body)
}

// E6: Variance Report
export async function sendVarianceReportEmail(
  cycleId: string,
  month: number,
  year: number,
  variances: Array<{employeeName: string; metric: string; priorValue: number; currentValue: number; variancePct: number; flag: string}>
) {
  const tag = getCycleTag(year, month)
  const monthName = new Date(year, month - 1).toLocaleString('en-GB', { month: 'long' })
  const approveUrl = `${APP_URL}/cycle/${cycleId}/approve`
  
  const flagColors: Record<string, string> = {
    threshold: '#ffc107',
    new_starter: '#28a745',
    leaver: '#dc3545',
    tax_code_change: '#007bff',
    ok: '#6c757d',
  }
  
  const varianceRows = variances.map(v => `
    <tr style="border-bottom: 1px solid #dee2e6;">
      <td style="padding: 8px 12px;">${v.employeeName}</td>
      <td style="padding: 8px 12px;">${v.metric}</td>
      <td style="padding: 8px 12px; text-align: right;">£${v.priorValue.toFixed(2)}</td>
      <td style="padding: 8px 12px; text-align: right;">£${v.currentValue.toFixed(2)}</td>
      <td style="padding: 8px 12px; text-align: right;">${v.variancePct > 0 ? '+' : ''}${v.variancePct.toFixed(1)}%</td>
      <td style="padding: 8px 12px;">
        <span style="background: ${flagColors[v.flag] || '#6c757d'}; color: ${v.flag === 'threshold' ? '#212529' : 'white'}; padding: 2px 8px; border-radius: 3px; font-size: 12px;">
          ${v.flag.replace('_', ' ')}
        </span>
      </td>
    </tr>
  `).join('')
  
  const body = `
    ${pagBranding()}
    <div style="padding: 0 30px 30px;">
      <h2 style="color: #1F3864;">Variance Analysis Report: ${monthName} ${year}</h2>
      <p>The payroll has been processed. Please review the ${variances.length} variance(s) below and approve or reject.</p>
      
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px;">
        <thead>
          <tr style="background: #1F3864; color: white;">
            <th style="padding: 10px 12px; text-align: left;">Employee</th>
            <th style="padding: 10px 12px; text-align: left;">Metric</th>
            <th style="padding: 10px 12px; text-align: right;">Prior</th>
            <th style="padding: 10px 12px; text-align: right;">Current</th>
            <th style="padding: 10px 12px; text-align: right;">Variance</th>
            <th style="padding: 10px 12px; text-align: left;">Flag</th>
          </tr>
        </thead>
        <tbody>
          ${varianceRows}
        </tbody>
      </table>
      
      <div style="margin: 25px 0;">
        <a href="${approveUrl}" 
           style="background: #2E75B6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Review & Approve Payroll
        </a>
      </div>
      
      <p style="color: #666; font-size: 13px;">Reference: ${tag}</p>
    </div>
    ${closingHtml()}
  `
  
  await sendEmail([PAYROLL_EMAIL], [], `${tag} Variance Report Ready: ${monthName} ${year}`, body)
}

// E7: Payroll Approved
export async function sendPayrollApprovedEmail(
  cycleId: string,
  month: number,
  year: number,
  netPayTable: Array<{name: string; netPay: number}>
) {
  const tag = getCycleTag(year, month)
  const monthName = new Date(year, month - 1).toLocaleString('en-GB', { month: 'long' })
  const summaryUrl = `${APP_URL}/cycle/${cycleId}/summary`
  const totalNet = netPayTable.reduce((sum, e) => sum + e.netPay, 0)
  
  const netPayRows = netPayTable.map(e => `
    <tr style="border-bottom: 1px solid #dee2e6;">
      <td style="padding: 8px 12px;">${e.name}</td>
      <td style="padding: 8px 12px; text-align: right; font-weight: bold;">£${e.netPay.toFixed(2)}</td>
    </tr>
  `).join('')
  
  const body = `
    ${pagBranding()}
    <div style="padding: 0 30px 30px;">
      <h2 style="color: #1F3864;">Payroll Approved: ${monthName} ${year}</h2>
      <p style="color: #28a745; font-weight: bold;">✓ PAG has approved the ${monthName} ${year} payroll.</p>
      
      <h3>Net Pay Summary</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 13px;">
        <thead>
          <tr style="background: #1F3864; color: white;">
            <th style="padding: 10px 12px; text-align: left;">Employee</th>
            <th style="padding: 10px 12px; text-align: right;">Net Pay</th>
          </tr>
        </thead>
        <tbody>
          ${netPayRows}
          <tr style="background: #f8f9fa; font-weight: bold;">
            <td style="padding: 10px 12px;">TOTAL</td>
            <td style="padding: 10px 12px; text-align: right;">£${totalNet.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
      
      <p>Please proceed with RTI submission and BACS payment.</p>
      
      <div style="margin: 25px 0;">
        <a href="${summaryUrl}" 
           style="background: #2E75B6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">
          View Full Summary
        </a>
      </div>
      
      <p style="color: #666; font-size: 13px;">Reference: ${tag}</p>
    </div>
    ${closingHtml()}
  `
  
  await sendEmail([KHALID_EMAIL], [], `${tag} Payroll Approved: ${monthName} ${year}`, body, PAYROLL_EMAIL)
}

// E8: Payroll Rejected
export async function sendPayrollRejectedEmail(
  cycleId: string,
  month: number,
  year: number,
  rejectionReasons: Array<{code: string; text: string}>
) {
  const tag = getCycleTag(year, month)
  const monthName = new Date(year, month - 1).toLocaleString('en-GB', { month: 'long' })
  const uploadUrl = `${APP_URL}/cycle/${cycleId}/upload`
  
  const reasonsList = rejectionReasons.map(r => `
    <li style="margin-bottom: 8px;">
      <strong>${r.code.replace('_', ' ')}:</strong> ${r.text}
    </li>
  `).join('')
  
  const body = `
    ${pagBranding()}
    <div style="padding: 0 30px 30px;">
      <h2 style="color: #1F3864;">Payroll Rejected: ${monthName} ${year}</h2>
      <p style="color: #dc3545; font-weight: bold;">✗ PAG has rejected the ${monthName} ${year} payroll.</p>
      
      <div style="background: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #721c24;">Rejection Reasons</h3>
        <ul style="margin: 0; padding-left: 20px;">
          ${reasonsList}
        </ul>
      </div>
      
      <p>Please address these issues and re-upload the corrected payroll.</p>
      
      <div style="margin: 25px 0;">
        <a href="${uploadUrl}" 
           style="background: #2E75B6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Re-upload Payroll
        </a>
      </div>
      
      <p style="color: #666; font-size: 13px;">Reference: ${tag}</p>
    </div>
    ${closingHtml()}
  `
  
  await sendEmail([KHALID_EMAIL], [], `${tag} Payroll Rejected: ${monthName} ${year}`, body, PAYROLL_EMAIL)
}

// E9: Staff Variance Notification
export async function sendStaffVarianceEmail(
  employeeEmail: string,
  employeeName: string,
  month: number,
  year: number,
  varianceSummary: string
) {
  const monthName = new Date(year, month - 1).toLocaleString('en-GB', { month: 'long' })
  
  const body = `
    ${pagBranding()}
    <div style="padding: 0 30px 30px;">
      <h2 style="color: #1F3864;">Your ${monthName} ${year} Payslip</h2>
      <p>Dear ${employeeName},</p>
      <p>Your ${monthName} ${year} payslip has been processed. Please note the following change(s) to your pay:</p>
      
      <div style="background: #e8f4f8; border: 1px solid #bee5eb; padding: 15px; border-radius: 4px; margin: 20px 0;">
        ${varianceSummary}
      </div>
      
      <p>If you have any questions about your pay, please contact 
        <a href="mailto:${FINANCE_EMAIL}">${FINANCE_EMAIL}</a>.
      </p>
      <p>Your payslip will be available through the usual channel.</p>
    </div>
    ${closingHtml()}
  `
  
  await sendEmail(
    [employeeEmail],
    [],
    `Your ${monthName} ${year} pay information`,
    body
  )
}

// E10: Payment Confirmation
export async function sendPaymentConfirmationEmail(
  cycleId: string,
  month: number,
  year: number,
  netPayTable: Array<{name: string; netPay: number}>
) {
  const tag = getCycleTag(year, month)
  const monthName = new Date(year, month - 1).toLocaleString('en-GB', { month: 'long' })
  const confirmUrl = `${APP_URL}/api/cycles/${cycleId}/confirm-payment`
  const totalNet = netPayTable.reduce((sum, e) => sum + e.netPay, 0)
  
  const netPayRows = netPayTable.map(e => `
    <tr style="border-bottom: 1px solid #dee2e6;">
      <td style="padding: 8px 12px;">${e.name}</td>
      <td style="padding: 8px 12px; text-align: right; font-weight: bold;">£${e.netPay.toFixed(2)}</td>
    </tr>
  `).join('')
  
  const body = `
    ${pagBranding()}
    <div style="padding: 0 30px 30px;">
      <h2 style="color: #1F3864;">Payment Confirmation Required: ${monthName} ${year}</h2>
      <p>Today is the 25th. Please confirm that BACS payments have been made for the following amounts:</p>
      
      <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 13px;">
        <thead>
          <tr style="background: #1F3864; color: white;">
            <th style="padding: 10px 12px; text-align: left;">Employee</th>
            <th style="padding: 10px 12px; text-align: right;">Net Pay</th>
          </tr>
        </thead>
        <tbody>
          ${netPayRows}
          <tr style="background: #f8f9fa; font-weight: bold;">
            <td style="padding: 10px 12px;">TOTAL BACS</td>
            <td style="padding: 10px 12px; text-align: right;">£${totalNet.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
      
      <div style="margin: 25px 0;">
        <a href="${confirmUrl}" 
           style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-size: 16px;">
          ✓ Confirm Payments Made
        </a>
      </div>
      
      <p style="color: #666; font-size: 13px;">Reference: ${tag}</p>
    </div>
    ${closingHtml()}
  `
  
  await sendEmail([PAYROLL_EMAIL], [], `${tag} Payment Confirmation Required: ${monthName} ${year}`, body)
}

// E11: Quarterly Quality Report
export async function sendQuarterlyReportEmail(
  quarter: number,
  year: number,
  reportHtml: string
) {
  const body = `
    ${pagBranding()}
    <div style="padding: 0 30px 30px;">
      <h2 style="color: #1F3864;">Quarterly Quality Report: Q${quarter} ${year}</h2>
      ${reportHtml}
    </div>
    ${closingHtml()}
  `
  
  await sendEmail(
    [PAYROLL_EMAIL, KHALID_EMAIL],
    [],
    `PAG Payroll Quality Report: Q${quarter} ${year}`,
    body
  )
}
