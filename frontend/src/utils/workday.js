import { format, isValid, parseISO, isWeekend } from 'date-fns'
import holidayJp from '@holiday-jp/holiday_jp'

const resolveDate = (value) => {
  if (!value) return null
  if (value instanceof Date) {
    return isValid(value) ? value : null
  }
  if (typeof value === 'string') {
    const parsed = parseISO(value)
    return isValid(parsed) ? parsed : null
  }
  return null
}

const resolveDateKey = (value) => {
  const date = resolveDate(value)
  if (!date) return null
  return format(date, 'yyyy-MM-dd')
}

export const isJapaneseHoliday = (value) => {
  const dateKey = resolveDateKey(value)
  if (!dateKey) return false
  return Boolean(holidayJp.isHoliday(dateKey))
}

export const isNonWorkingDay = (value) => {
  const date = resolveDate(value)
  if (!date) return false
  if (isWeekend(date)) return true
  return isJapaneseHoliday(date)
}

export default {
  isJapaneseHoliday,
  isNonWorkingDay,
}
