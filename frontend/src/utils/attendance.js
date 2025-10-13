import { isNonWorkingDay } from './workday.js'

export const resolveDisplayBreakMinutes = (dateValue, record) => {
  const hasWorkTimes = Boolean(record?.clockIn && record?.clockOut)
  if (hasWorkTimes) {
    return record?.breakMinutes ?? 0
  }

  if (isNonWorkingDay(dateValue)) {
    return 0
  }

  return record?.breakMinutes
}

export default {
  resolveDisplayBreakMinutes,
}
