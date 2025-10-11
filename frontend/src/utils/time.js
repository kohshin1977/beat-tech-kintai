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

export const calculateSpanMinutes = (startTime, endTime) => {
  const startDate = timestampToDate(startTime)
  const endDate = timestampToDate(endTime)
  if (!startDate || !endDate) return null

  return Math.max(differenceInMinutes(endDate, startDate), 0)
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

export const minutesToTimeLabel = (minutes) => {
  if (minutes === null || minutes === undefined) return '--:--'
  const absolute = Math.max(minutes, 0)
  const hours = Math.floor(absolute / 60)
  const mins = absolute % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

export const minutesToHourMinute = (minutes) => {
  if (minutes === null || minutes === undefined) return '-'
  if (!Number.isFinite(minutes)) return '-'
  const safeMinutes = Math.max(Math.floor(minutes), 0)
  const hours = Math.floor(safeMinutes / 60)
  const mins = safeMinutes % 60
  return `${hours}:${mins.toString().padStart(2, '0')}`
}

const dateWithTimeToken = (baseDate, token) => {
  if (!baseDate || !isValidTimeToken(token)) return null
  const result = new Date(baseDate)
  const [hours, minutes] = token.split(':').map((value) => Number.parseInt(value, 10))
  result.setHours(hours, minutes, 0, 0)
  return result
}

const resolveBreakMinutes = (breakMinutes, breakPeriods = []) => {
  let parsed = null

  if (breakMinutes !== null && breakMinutes !== undefined && breakMinutes !== '') {
    parsed = typeof breakMinutes === 'number' ? breakMinutes : Number.parseInt(breakMinutes, 10)
  }

  if (Number.isFinite(parsed)) {
    return Math.max(parsed, 0)
  }

  if (Array.isArray(breakPeriods) && breakPeriods.length > 0) {
    return calculateBreakMinutesFromPeriods(breakPeriods)
  }

  return 0
}

const calculateOverlapFromPeriods = (startDate, endDate, breakPeriods = []) => {
  if (!startDate || !endDate) return 0

  return breakPeriods.reduce((total, period) => {
    if (!period) return total
    const breakStart = dateWithTimeToken(startDate, period.start)
    const breakEnd = dateWithTimeToken(startDate, period.end)
    if (!breakStart || !breakEnd) return total

    const overlapStart = breakStart > startDate ? breakStart : startDate
    const overlapEnd = breakEnd < endDate ? breakEnd : endDate
    if (overlapEnd <= overlapStart) return total

    return total + Math.max(differenceInMinutes(overlapEnd, overlapStart), 0)
  }, 0)
}

export const calculateDeductibleBreakMinutes = (clockIn, clockOut, breakMinutes, breakPeriods) => {
  const startDate = timestampToDate(clockIn)
  const endDate = timestampToDate(clockOut)

  if (!startDate || !endDate) {
    return resolveBreakMinutes(breakMinutes, breakPeriods)
  }

  const spanMinutes = Math.max(differenceInMinutes(endDate, startDate), 0)
  let deductedMinutes = 0

  if (Array.isArray(breakPeriods) && breakPeriods.length > 0) {
    deductedMinutes = calculateOverlapFromPeriods(startDate, endDate, breakPeriods)
  } else {
    deductedMinutes = resolveBreakMinutes(breakMinutes, breakPeriods)
  }

  if (!Number.isFinite(deductedMinutes)) {
    return 0
  }

  return Math.min(Math.max(deductedMinutes, 0), spanMinutes)
}

export const calculateActualWorkMinutes = (clockIn, clockOut, breakMinutes, breakPeriods) => {
  const startDate = timestampToDate(clockIn)
  const endDate = timestampToDate(clockOut)
  if (!startDate || !endDate) return null

  const spanMinutes = Math.max(differenceInMinutes(endDate, startDate), 0)

  const deductedMinutes = calculateDeductibleBreakMinutes(clockIn, clockOut, breakMinutes, breakPeriods)

  return Math.max(spanMinutes - deductedMinutes, 0)
}

export const formatActualWorkDuration = (clockIn, clockOut, breakMinutes, breakPeriods) => {
  const minutes = calculateActualWorkMinutes(clockIn, clockOut, breakMinutes, breakPeriods)
  if (minutes === null) return '--:--'
  return minutesToTimeLabel(minutes)
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
