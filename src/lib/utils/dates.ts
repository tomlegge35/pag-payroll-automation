/**
 * Date utilities - all dates in Europe/London timezone
 */

import { format, addMonths, isWeekend, startOfDay } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

const LONDON_TZ = 'Europe/London'

export function getLondonNow(): Date {
  return toZonedTime(new Date(), LONDON_TZ)
}

export function formatMonthYear(month: number, year: number): string {
  const date = new Date(year, month - 1)
  return format(date, 'MMMM yyyy')
}

export function formatCycleTag(year: number, month: number): string {
  return `[PAG-Payroll-${year}-${String(month).padStart(2, '0')}]`
}

// Get nearest working day to 15th of a given month
export function getNearestWorkingDayTo15th(year: number, month: number): Date {
  // Start with the 15th in London timezone
  let target = fromZonedTime(new Date(year, month - 1, 15, 9, 0, 0), LONDON_TZ)
  
  // If weekend, move to nearest weekday
  if (isWeekend(target)) {
    const dayOfWeek = target.getDay()
    if (dayOfWeek === 0) { // Sunday -> Monday
      target = new Date(target.getTime() + 24 * 60 * 60 * 1000)
    } else if (dayOfWeek === 6) { // Saturday -> Friday
      target = new Date(target.getTime() - 24 * 60 * 60 * 1000)
    }
  }
  
  return target
}

// Get 25th of month in London timezone at 9am
export function get25thAtNoon(year: number, month: number): Date {
  return fromZonedTime(new Date(year, month - 1, 25, 9, 0, 0), LONDON_TZ)
}

export function getCurrentPayrollPeriod(): { month: number; year: number } {
  const now = getLondonNow()
  return { month: now.getMonth() + 1, year: now.getFullYear() }
}

export function getNextPayrollPeriod(): { month: number; year: number } {
  const now = getLondonNow()
  const next = addMonths(now, 1)
  return { month: next.getMonth() + 1, year: next.getFullYear() }
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(toZonedTime(d, LONDON_TZ), 'dd/MM/yyyy')
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(toZonedTime(d, LONDON_TZ), 'dd/MM/yyyy HH:mm')
}
