import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { differenceInMinutes } from 'date-fns'

initializeApp()

const db = getFirestore()
const TIME_TOKEN_PATTERN = /^([0-1]\d|2[0-3]):([0-5]\d)$/
const STANDARD_DAILY_MINUTES = 480

const isValidTimeToken = (value) => TIME_TOKEN_PATTERN.test(value ?? '')

const dateWithTimeToken = (baseDate, token) => {
  if (!baseDate || !isValidTimeToken(token)) return null
  const result = new Date(baseDate)
  const [hours, minutes] = token.split(':').map((v) => Number.parseInt(v, 10))
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
    return breakPeriods.reduce((total, period) => {
      if (!period) return total
      const startToken = typeof period.start === 'string' ? period.start : ''
      const endToken = typeof period.end === 'string' ? period.end : ''
      if (!isValidTimeToken(startToken) || !isValidTimeToken(endToken)) return total
      const [startHours, startMinutes] = startToken.split(':').map((v) => Number.parseInt(v, 10))
      const [endHours, endMinutes] = endToken.split(':').map((v) => Number.parseInt(v, 10))
      const startTotal = startHours * 60 + startMinutes
      const endTotal = endHours * 60 + endMinutes
      if (!Number.isFinite(startTotal) || !Number.isFinite(endTotal) || endTotal <= startTotal) {
        return total
      }
      return total + (endTotal - startTotal)
    }, 0)
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

const calculateDeductibleBreakMinutes = (clockIn, clockOut, breakMinutes, breakPeriods = []) => {
  if (!clockIn || !clockOut) {
    return resolveBreakMinutes(breakMinutes, breakPeriods)
  }

  const spanMinutes = Math.max(differenceInMinutes(clockOut, clockIn), 0)

  let deductedMinutes = 0
  if (Array.isArray(breakPeriods) && breakPeriods.length > 0) {
    deductedMinutes = calculateOverlapFromPeriods(clockIn, clockOut, breakPeriods)
  } else {
    deductedMinutes = resolveBreakMinutes(breakMinutes, breakPeriods)
  }

  if (!Number.isFinite(deductedMinutes)) {
    return 0
  }

  return Math.min(Math.max(deductedMinutes, 0), spanMinutes)
}

const toDate = (value) => {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate()
  return new Date(value)
}

const calculateTotals = (data) => {
  const clockIn = toDate(data.clockIn)
  const clockOut = toDate(data.clockOut)
  if (!clockIn || !clockOut) return null

  const breakMinutes = Number(data.breakMinutes ?? 0)
  const breakPeriods = Array.isArray(data.breakPeriods) ? data.breakPeriods : []
  const diffMinutes = Math.max(differenceInMinutes(clockOut, clockIn), 0)
  const effectiveBreakMinutes = calculateDeductibleBreakMinutes(
    clockIn,
    clockOut,
    breakMinutes,
    breakPeriods,
  )
  const totalMinutes = Math.max(diffMinutes - effectiveBreakMinutes, 0)
  const overtimeMinutes = Math.max(totalMinutes - STANDARD_DAILY_MINUTES, 0)

  return { totalMinutes, overtimeMinutes }
}

const getYearMonthFromWorkDate = (workDate) => workDate?.slice(0, 7)

const rebuildMonthlySummary = async (userId, yearMonth) => {
  if (!yearMonth) return

  const attendanceRef = db.collection('users').doc(userId).collection('attendance')
  const startKey = `${yearMonth}-01`
  const endKey = `${yearMonth}-31`

  const snapshot = await attendanceRef
    .where('workDate', '>=', startKey)
    .where('workDate', '<=', endKey)
    .get()

  let totalMinutes = 0
  let overtimeMinutes = 0

  snapshot.forEach((docSnap) => {
    const data = docSnap.data()
    totalMinutes += data.totalMinutes ?? 0
    overtimeMinutes += data.overtimeMinutes ?? 0
  })

  const summaryRef = db.collection('users').doc(userId).collection('monthlySummary').doc(yearMonth)
  await summaryRef.set(
    {
      userId,
      yearMonth,
      totalMinutes,
      overtimeMinutes,
      updatedAt: Timestamp.now(),
    },
    { merge: true },
  )
}

export const onAttendanceWrite = onDocumentWritten('users/{userId}/attendance/{workDate}', async (event) => {
  const { userId, workDate } = event.params
  const beforeData = event.data?.before?.data()
  const afterData = event.data?.after?.data()

  if (!afterData) {
    // Document deleted => rebuild aggregate and exit
    await rebuildMonthlySummary(userId, getYearMonthFromWorkDate(workDate))
    return
  }

  const totals = calculateTotals(afterData)
  const status = afterData.clockOut ? 'completed' : afterData.clockIn ? 'working' : 'pending'

  const updates = {
    status,
    userId,
    workDate,
    updatedAt: Timestamp.now(),
  }

  if (totals && (!beforeData || beforeData.totalMinutes !== totals.totalMinutes)) {
    updates.totalMinutes = totals.totalMinutes
    updates.overtimeMinutes = totals.overtimeMinutes
  }

  if (!afterData.workDate) {
    updates.workDate = workDate
  }

  await event.data.after.ref.set(updates, { merge: true })
  await rebuildMonthlySummary(userId, getYearMonthFromWorkDate(workDate))
})

export const nightlySummaryRebuild = onSchedule('0 3 * * *', async (event) => {
  const executedAt = event.scheduleTime ? new Date(event.scheduleTime) : new Date()
  const yearMonth = executedAt.toISOString().slice(0, 7)

  const employeesSnapshot = await db.collection('users').where('role', '==', 'employee').get()
  const tasks = []
  employeesSnapshot.forEach((docSnap) => {
    tasks.push(rebuildMonthlySummary(docSnap.id, yearMonth))
  })

  await Promise.all(tasks)
})
