import { differenceInMinutes, format, isValid, parseISO } from 'date-fns'

const TIME_TOKEN_PATTERN = /^([0-1]\d|2[0-3]):([0-5]\d)$/

export const isValidTimeToken = (value) => TIME_TOKEN_PATTERN.test(value ?? '')

export const timeTokenToMinutes = (value) => {
  if (!isValidTimeToken(value)) return null
  const [, hours, minutes] = TIME_TOKEN_PATTERN.exec(value)
  return Number.parseInt(hours, 10) * 60 + Number.parseInt(minutes, 10)
}

export const calculateBreakMinutesFromPeriods = (periods = []) => {
  if (!Array.isArray(periods)) return 0
  return periods.reduce((total, period) => {
    if (!period) return total
    const startMinutes = timeTokenToMinutes(period.start)
    const endMinutes = timeTokenToMinutes(period.end)
    if (startMinutes === null || endMinutes === null) return total
    return total + Math.max(endMinutes - startMinutes, 0)
  }, 0)
}

export const timestampToDate = (value) => {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate()
  if (value instanceof Date) return value
  if (typeof value === 'string') {
    const parsed = parseISO(value)
    return isValid(parsed) ? parsed : null
  }
  return null
}

export const calculateDailyMinutes = (clockIn, clockOut, breakMinutes = 0) => {
  const clockInDate = timestampToDate(clockIn)
  const clockOutDate = timestampToDate(clockOut)
  if (!clockInDate || !clockOutDate) return 0

  const diffMinutes = differenceInMinutes(clockOutDate, clockInDate)
  return Math.max(diffMinutes - (breakMinutes ?? 0), 0)
}

export const calculateOvertimeMinutes = (totalMinutes, thresholdMinutes = 480) => {
  if (!totalMinutes) return 0
  return Math.max(totalMinutes - thresholdMinutes, 0)
}

export const minutesToDuration = (minutes) => {
  if (minutes === null || minutes === undefined) return '-'
  const sign = minutes < 0 ? '-' : ''
  const absolute = Math.abs(minutes)
  const hours = Math.floor(absolute / 60)
  const mins = absolute % 60
  return `${sign}${hours}h${mins.toString().padStart(2, '0')}m`
}

export const minutesToHours = (minutes) => {
  if (minutes === null || minutes === undefined) return 0
  return Math.round((minutes / 60) * 100) / 100
}

export const formatTime = (value) => {
  const date = timestampToDate(value)
  if (!date) return '--:--'
  return format(date, 'HH:mm')
}

export const formatDateLabel = (value) => {
  const date = timestampToDate(value) ?? parseISO(value)
  if (!date || !isValid(date)) return ''
  return format(date, 'M月d日 (E)')
}

export const formatWorkDate = (date) => format(date, 'yyyy-MM-dd')

export const formatYearMonth = (date) => format(date, 'yyyy-MM')
