/**
 * PDF Parser - Extracts payroll data from uploaded payslip PDFs
 * Uses pdf-parse (Node-compatible, no desktop tools)
 * Includes fallback for low-confidence extractions
 */

import pdfParse from 'pdf-parse'

export interface PayslipData {
  employeeName: string | null
  employeeId: string | null
  grossPay: number | null
  regularPay: number | null
  holidayPay: number | null
  holidayHours: number | null
  publicHolidayPay: number | null
  paye: number | null
  eeNic: number | null
  pensionEE: number | null
  studentLoan: number | null
  postgradLoan: number | null
  totalDeductions: number | null
  netPay: number | null
  erNic: number | null
  erPension: number | null
  confidence: number // 0-1 scale
}

export interface ParseResult {
  success: boolean
  data: PayslipData | null
  rawText: string
  confidence: number
  errors: string[]
}

function extractCurrency(text: string, label: string): number | null {
  // Try various patterns for currency extraction
  const patterns = [
    new RegExp(`${label}[:\\s]+[£$]?([\\d,]+\\.\\d{2})`, 'i'),
    new RegExp(`${label}[\\s\\S]{0,20}?[£$]([\\d,]+\\.\\d{2})`, 'i'),
  ]
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const value = parseFloat(match[1].replace(/,/g, ''))
      if (!isNaN(value)) return value
    }
  }
  return null
}

function extractHours(text: string, label: string): number | null {
  const pattern = new RegExp(`${label}[:\\s]+([\\d.]+)\\s*(?:hrs?|hours?)`, 'i')
  const match = text.match(pattern)
  if (match) {
    const value = parseFloat(match[1])
    return isNaN(value) ? null : value
  }
  return null
}

function extractEmployeeName(text: string): string | null {
  // Common patterns in payslips
  const patterns = [
    /employee[:s]+([A-Z][a-z]+(?: [A-Z][a-z]+)+)/,
    /name[:s]+([A-Z][a-z]+(?: [A-Z][a-z]+)+)/,
    /dears+([A-Z][a-z]+(?: [A-Z][a-z]+)+)/i,
  ]
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return match[1].trim()
  }
  return null
}

function extractPayrollId(text: string): string | null {
  const patterns = [
    /payrolls*(?:id|ref|no)[:s]+([A-Z]{2,5}\d{1,5})/i,
    /employees*(?:id|ref|no)[:s]+([A-Z]{2,5}\d{1,5})/i,
    /ref[:s]+([A-Z]{2,5}\d{1,5})/i,
  ]
  
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) return match[1].trim()
  }
  return null
}

function calculateConfidence(data: PayslipData): number {
  const criticalFields = ['grossPay', 'netPay', 'paye', 'eeNic']
  const allFields = ['employeeName', 'grossPay', 'regularPay', 'netPay', 'paye', 'eeNic', 'pensionEE', 'totalDeductions']
  
  const criticalFound = criticalFields.filter(f => data[f as keyof PayslipData] !== null).length
  const allFound = allFields.filter(f => data[f as keyof PayslipData] !== null).length
  
  // Critical fields have higher weight
  const criticalScore = criticalFound / criticalFields.length
  const overallScore = allFound / allFields.length
  
  return (criticalScore * 0.7 + overallScore * 0.3)
}

export async function parsePayslipPDF(buffer: Buffer): Promise<ParseResult> {
  const errors: string[] = []
  
  try {
    const result = await pdfParse(buffer)
    const text = result.text
    
    const data: PayslipData = {
      employeeName: extractEmployeeName(text),
      employeeId: extractPayrollId(text),
      grossPay: extractCurrency(text, 'gross(?:\s+pay)?'),
      regularPay: extractCurrency(text, 'regular(?:\s+pay)?|basic(?:\s+pay)?'),
      holidayPay: extractCurrency(text, 'holiday(?:\s+pay)?'),
      holidayHours: extractHours(text, 'holiday'),
      publicHolidayPay: extractCurrency(text, 'public\s+holiday(?:\s+pay)?|bank\s+holiday'),
      paye: extractCurrency(text, 'paye|income\s+tax'),
      eeNic: extractCurrency(text, 'ee\s+nic|employee\s+ni[c]?|national\s+insurance'),
      pensionEE: extractCurrency(text, 'pension(?:\s+ee)?(?:\s+employee)?'),
      studentLoan: extractCurrency(text, 'student\s+loan'),
      postgradLoan: extractCurrency(text, 'postgrad(?:uate)?\s+loan|pg\s+loan'),
      totalDeductions: extractCurrency(text, 'total\s+deductions?'),
      netPay: extractCurrency(text, 'net(?:\s+pay)?|take\s+home'),
      erNic: extractCurrency(text, 'er\s+nic|employer\s+ni[c]?'),
      erPension: extractCurrency(text, 'er\s+pension|employer\s+pension'),
      confidence: 0,
    }
    
    data.confidence = calculateConfidence(data)
    
    if (!data.employeeName) errors.push('Could not extract employee name')
    if (!data.netPay) errors.push('Could not extract net pay')
    if (!data.grossPay) errors.push('Could not extract gross pay')
    
    return {
      success: data.confidence > 0.5,
      data,
      rawText: text,
      confidence: data.confidence,
      errors,
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    return {
      success: false,
      data: null,
      rawText: '',
      confidence: 0,
      errors: [`PDF parsing failed: ${error}`],
    }
  }
}

export async function parseNewStarterPDF(buffer: Buffer): Promise<{
  name: string | null
  salary: number | null
  startDate: string | null
  taxCode: string | null
  niNumber: string | null
  confidence: number
  rawText: string
}> {
  try {
    const result = await pdfParse(buffer)
    const text = result.text
    
    const name = extractEmployeeName(text)
    const salary = extractCurrency(text, 'salary|annual\s+(?:pay|salary)')
    
    // Extract start date
    const dateMatch = text.match(/start(?:ing)?\s*date[:\s]+([\d]{1,2}[/-][\d]{1,2}[/-][\d]{2,4})/i)
    const startDate = dateMatch ? dateMatch[1] : null
    
    // Extract tax code
    const taxCodeMatch = text.match(/tax\s*code[:\s]+([0-9]{1,4}[A-Z]{1,2}[0-9]?)/i)
    const taxCode = taxCodeMatch ? taxCodeMatch[1] : null
    
    // Extract NI number (format: XX999999X)
    const niMatch = text.match(/n[io]\s*(?:number|no)[:\s]+([A-Z]{2}\s?[0-9]{6}\s?[A-Z])/i)
    const niNumber = niMatch ? niMatch[1].replace(/\s/g, '') : null
    
    const fieldsFound = [name, salary, startDate, taxCode, niNumber].filter(Boolean).length
    const confidence = fieldsFound / 5
    
    return { name, salary, startDate, taxCode, niNumber, confidence, rawText: text }
  } catch (err) {
    return { name: null, salary: null, startDate: null, taxCode: null, niNumber: null, confidence: 0, rawText: '' }
  }
}
