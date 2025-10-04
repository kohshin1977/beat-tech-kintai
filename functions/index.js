import { onDocumentWritten } from 'firebase-functions/v2/firestore'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { differenceInMinutes } from 'date-fns'

initializeApp()

const db = getFirestore()
const STANDARD_DAILY_MINUTES = 480

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
  const diffMinutes = differenceInMinutes(clockOut, clockIn)
  const totalMinutes = Math.max(diffMinutes - breakMinutes, 0)
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
