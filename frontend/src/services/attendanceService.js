import {
  Timestamp,
  collection,
  collectionGroup,
  deleteField,
  doc,
  endAt,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAt,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { eachDayOfInterval, endOfMonth, format, parseISO, startOfMonth } from 'date-fns'
import { db } from '../firebase/config.js'
import {
  calculateDailyMinutes,
  calculateOvertimeMinutes,
  calculateBreakMinutesFromPeriods,
  calculateDeductibleBreakMinutes,
  isValidTimeToken,
  timeTokenToMinutes,
} from '../utils/time.js'

const MAX_BREAK_PERIODS = 5

const sanitizeBreakPeriods = (periods) => {
  if (!Array.isArray(periods)) return []
  const sanitized = periods
    .slice(0, MAX_BREAK_PERIODS)
    .map((period) => ({
      start: typeof period?.start === 'string' ? period.start : '',
      end: typeof period?.end === 'string' ? period.end : '',
    }))
    .filter(({ start, end }) => {
      if (!isValidTimeToken(start) || !isValidTimeToken(end)) return false
      const startMinutes = timeTokenToMinutes(start)
      const endMinutes = timeTokenToMinutes(end)
      if (startMinutes === null || endMinutes === null) return false
      return endMinutes > startMinutes
    })

  sanitized.sort((a, b) => {
    const startA = timeTokenToMinutes(a.start) ?? 0
    const startB = timeTokenToMinutes(b.start) ?? 0
    return startA - startB
  })

  return sanitized
}

const deriveBreakDetails = (existingData = {}, overrides = {}, context = {}) => {
  const safeExistingData = existingData ?? {}
  const overridePeriodsDefined = overrides.breakPeriods !== undefined
  const overridePeriods = overridePeriodsDefined
    ? sanitizeBreakPeriods(overrides.breakPeriods)
    : null
  const existingPeriods = sanitizeBreakPeriods(safeExistingData.breakPeriods)
  const fallbackPeriods = sanitizeBreakPeriods(context.defaultBreakPeriods ?? [])

  const breakPeriods = overridePeriodsDefined
    ? overridePeriods
    : existingPeriods.length > 0
      ? existingPeriods
      : fallbackPeriods

  let breakMinutes

  if (overridePeriodsDefined) {
    breakMinutes = calculateBreakMinutesFromPeriods(breakPeriods)
  } else if (overrides.breakMinutes !== undefined && overrides.breakMinutes !== null) {
    breakMinutes = Number(overrides.breakMinutes) || 0
  } else if (breakPeriods.length > 0) {
    breakMinutes = calculateBreakMinutesFromPeriods(breakPeriods)
  } else if (safeExistingData.breakMinutes !== undefined && safeExistingData.breakMinutes !== null) {
    breakMinutes = Number(safeExistingData.breakMinutes) || 0
  } else {
    breakMinutes = 0
  }

  return {
    breakPeriods,
    breakMinutes,
  }
}

const getDefaultBreakPeriods = async (userId, workDate) => {
  const userRef = doc(db, 'users', userId)
  const userSnap = await getDoc(userRef)
  if (!userSnap.exists()) return []

  const preferences = userSnap.data()?.attendancePreferences?.breakSchedule
  if (!preferences) return []

  const { periods = [], effectiveFrom } = preferences
  if (effectiveFrom && effectiveFrom > workDate) {
    return []
  }

  return sanitizeBreakPeriods(periods)
}

const STANDARD_DAILY_MINUTES = 480

const getAttendanceDocRef = (userId, workDate) =>
  doc(db, 'users', userId, 'attendance', workDate)

const getMonthlySummaryDocRef = (userId, yearMonth) =>
  doc(db, 'users', userId, 'monthlySummary', yearMonth)

const buildTimestampFromWorkDate = (workDate, timeString, label) => {
  if (!timeString) {
    throw new Error(`${label}を入力してください。`)
  }

  const match = /^([0-1]\d|2[0-3]):([0-5]\d)$/.exec(timeString)
  if (!match) {
    throw new Error(`${label}の形式が正しくありません (HH:MM)。`)
  }

  const [year, month, day] = workDate.split('-').map(Number)
  if ([year, month, day].some((value) => Number.isNaN(value))) {
    throw new Error('勤怠日付の形式が正しくありません。')
  }

  const hours = Number(match[1])
  const minutes = Number(match[2])
  const date = new Date(year, month - 1, day, hours, minutes, 0, 0)
  return Timestamp.fromDate(date)
}

export const clockIn = async (userId, workDate, clockInTime) => {
  const attendanceRef = getAttendanceDocRef(userId, workDate)
  const attendanceSnap = await getDoc(attendanceRef)
  const existingData = attendanceSnap.exists() ? attendanceSnap.data() : null

  const clockInTimestamp = buildTimestampFromWorkDate(workDate, clockInTime, '出勤時刻')
  let defaultBreakPeriods = []
  if (!existingData?.breakPeriods?.length) {
    defaultBreakPeriods = await getDefaultBreakPeriods(userId, workDate)
  }
  const { breakPeriods, breakMinutes } = deriveBreakDetails(existingData, {}, { defaultBreakPeriods })
  const workDescription = existingData?.workDescription ?? ''
  const clockOutTimestamp = existingData?.clockOut ?? null

  let effectiveBreakMinutes = breakMinutes
  if (clockOutTimestamp) {
    effectiveBreakMinutes = calculateDeductibleBreakMinutes(
      clockInTimestamp,
      clockOutTimestamp,
      breakMinutes,
      breakPeriods,
    )
  }

  const payload = {
    userId,
    workDate,
    clockIn: clockInTimestamp,
    breakMinutes: effectiveBreakMinutes,
    breakPeriods,
    workDescription,
    status: clockOutTimestamp ? 'completed' : 'working',
    updatedAt: serverTimestamp(),
  }

  if (!existingData) {
    payload.createdAt = serverTimestamp()
  }

  if (clockOutTimestamp) {
    const totalMinutes = calculateDailyMinutes(
      clockInTimestamp,
      clockOutTimestamp,
      effectiveBreakMinutes,
    )
    payload.totalMinutes = totalMinutes
    payload.overtimeMinutes = calculateOvertimeMinutes(totalMinutes, STANDARD_DAILY_MINUTES)
  } else {
    payload.totalMinutes = null
    payload.overtimeMinutes = null
  }

  await setDoc(attendanceRef, payload, { merge: true })

  if (clockOutTimestamp) {
    await updateMonthlySummaryTotals(userId, workDate.slice(0, 7))
  }
}

export const clockOut = async (userId, workDate, clockOutTime) => {
  const attendanceRef = getAttendanceDocRef(userId, workDate)
  const attendanceSnap = await getDoc(attendanceRef)

  if (!attendanceSnap.exists()) {
    throw new Error('先に出勤時刻を登録してください。')
  }

  const data = attendanceSnap.data()

  if (!data.clockIn) {
    throw new Error('出勤時刻が登録されていません。')
  }

  const clockOutTimestamp = buildTimestampFromWorkDate(workDate, clockOutTime, '退勤時刻')
  let defaultBreakPeriods = []
  if (!data?.breakPeriods?.length) {
    defaultBreakPeriods = await getDefaultBreakPeriods(userId, workDate)
  }
  const { breakPeriods, breakMinutes } = deriveBreakDetails(data, {}, { defaultBreakPeriods })
  const effectiveBreakMinutes = calculateDeductibleBreakMinutes(
    data.clockIn,
    clockOutTimestamp,
    breakMinutes,
    breakPeriods,
  )
  const totalMinutes = calculateDailyMinutes(data.clockIn, clockOutTimestamp, effectiveBreakMinutes)

  if (totalMinutes < 0) {
    throw new Error('退勤時刻は出勤時刻より後の時間を入力してください。')
  }

  const overtimeMinutes = calculateOvertimeMinutes(totalMinutes, STANDARD_DAILY_MINUTES)

  await setDoc(
    attendanceRef,
    {
      userId,
      workDate,
      clockOut: clockOutTimestamp,
      breakMinutes: effectiveBreakMinutes,
      breakPeriods,
      workDescription: data.workDescription ?? '',
      totalMinutes,
      overtimeMinutes,
      status: 'completed',
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )

  await updateMonthlySummaryTotals(userId, workDate.slice(0, 7))
}

export const clearClockIn = async (userId, workDate) => {
  const attendanceRef = getAttendanceDocRef(userId, workDate)
  const attendanceSnap = await getDoc(attendanceRef)

  if (!attendanceSnap.exists()) {
    return
  }

  await updateDoc(attendanceRef, {
    clockIn: deleteField(),
    clockOut: deleteField(),
    totalMinutes: deleteField(),
    overtimeMinutes: deleteField(),
    status: deleteField(),
    updatedAt: serverTimestamp(),
  })

  await updateMonthlySummaryTotals(userId, workDate.slice(0, 7))
}

export const clearClockOut = async (userId, workDate) => {
  const attendanceRef = getAttendanceDocRef(userId, workDate)
  const attendanceSnap = await getDoc(attendanceRef)

  if (!attendanceSnap.exists()) {
    return
  }

  const data = attendanceSnap.data()

  if (!data.clockIn) {
    await clearClockIn(userId, workDate)
    return
  }

  await updateDoc(attendanceRef, {
    clockOut: deleteField(),
    totalMinutes: deleteField(),
    overtimeMinutes: deleteField(),
    status: 'working',
    updatedAt: serverTimestamp(),
  })

  await updateMonthlySummaryTotals(userId, workDate.slice(0, 7))
}

export const updateAttendanceDetails = async (userId, workDate, updates) => {
  const attendanceRef = getAttendanceDocRef(userId, workDate)
  const attendanceSnap = await getDoc(attendanceRef)

  if (!attendanceSnap.exists()) {
    throw new Error('勤怠データが存在しません。')
  }

  const data = attendanceSnap.data()
  let defaultBreakPeriods = []
  if (!data?.breakPeriods?.length && updates.breakPeriods === undefined) {
    defaultBreakPeriods = await getDefaultBreakPeriods(userId, workDate)
  }
  const { breakPeriods, breakMinutes } = deriveBreakDetails(data, updates, { defaultBreakPeriods })
  const workDescription = updates.workDescription ?? data.workDescription ?? ''

  let totalMinutes = data.totalMinutes ?? null
  let overtimeMinutes = data.overtimeMinutes ?? null
  let effectiveBreakMinutes = breakMinutes

  if (data.clockIn && data.clockOut) {
    effectiveBreakMinutes = calculateDeductibleBreakMinutes(
      data.clockIn,
      data.clockOut,
      breakMinutes,
      breakPeriods,
    )
    totalMinutes = calculateDailyMinutes(data.clockIn, data.clockOut, effectiveBreakMinutes)
    overtimeMinutes = calculateOvertimeMinutes(totalMinutes, STANDARD_DAILY_MINUTES)
  }

  await updateDoc(attendanceRef, {
    breakMinutes: effectiveBreakMinutes,
    breakPeriods,
    workDescription,
    totalMinutes,
    overtimeMinutes,
    updatedAt: serverTimestamp(),
  })

  if (totalMinutes !== null) {
    await updateMonthlySummaryTotals(userId, workDate.slice(0, 7))
  }
}

export const updateBreakScheduleRange = async (userId, startWorkDate, breakPeriodsInput) => {
  if (!userId || !startWorkDate) return

  const sanitizedPeriods = sanitizeBreakPeriods(breakPeriodsInput)
  const breakMinutes = calculateBreakMinutesFromPeriods(sanitizedPeriods)
  const startDate = parseISO(startWorkDate)
  if (Number.isNaN(startDate.getTime())) {
    throw new Error('休憩設定の開始日が不正です。')
  }
  const monthEndDate = endOfMonth(startDate)
  const monthEndKey = format(monthEndDate, 'yyyy-MM-dd')

  const attendanceCol = collection(db, 'users', userId, 'attendance')
  const attendanceQuery = query(
    attendanceCol,
    orderBy('workDate'),
    startAt(startWorkDate),
    endAt(monthEndKey),
  )
  const snapshot = await getDocs(attendanceQuery)

  const batch = writeBatch(db)
  const affectedYearMonths = new Set()
  const existingKeys = new Set(snapshot.docs.map((docSnap) => docSnap.id))

  const applyUpdate = (docRef, data = {}) => {
    let totalMinutes = data.totalMinutes ?? null
    let overtimeMinutes = data.overtimeMinutes ?? null
    let effectiveBreakMinutes = breakMinutes

    if (data.clockIn && data.clockOut) {
      effectiveBreakMinutes = calculateDeductibleBreakMinutes(
        data.clockIn,
        data.clockOut,
        breakMinutes,
        sanitizedPeriods,
      )
      totalMinutes = calculateDailyMinutes(data.clockIn, data.clockOut, effectiveBreakMinutes)
      overtimeMinutes = calculateOvertimeMinutes(totalMinutes, STANDARD_DAILY_MINUTES)
    }

    batch.set(
      docRef,
      {
        userId,
        workDate: docRef.id,
        breakPeriods: sanitizedPeriods,
        breakMinutes: effectiveBreakMinutes,
        totalMinutes,
        overtimeMinutes,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )

    affectedYearMonths.add(docRef.id.slice(0, 7))
  }

  snapshot.forEach((docSnap) => {
    applyUpdate(docSnap.ref, docSnap.data())
  })

  const targetDays = eachDayOfInterval({ start: startDate, end: monthEndDate })
  targetDays.forEach((day) => {
    const dateKey = format(day, 'yyyy-MM-dd')
    if (dateKey < startWorkDate) return
    if (existingKeys.has(dateKey)) return
    const targetRef = doc(attendanceCol, dateKey)
    applyUpdate(targetRef, {})
    existingKeys.add(dateKey)
  })

  await batch.commit()

  await setDoc(
    doc(db, 'users', userId),
    {
      attendancePreferences: {
        breakSchedule: {
          periods: sanitizedPeriods,
          effectiveFrom: startWorkDate,
        },
      },
    },
    { merge: true },
  )

  await Promise.all(
    Array.from(affectedYearMonths).map((yearMonth) => updateMonthlySummaryTotals(userId, yearMonth)),
  )
}

export const listenToTodayAttendance = (userId, workDate, callback) => {
  const attendanceRef = getAttendanceDocRef(userId, workDate)
  return onSnapshot(attendanceRef, (snapshot) => {
    callback(snapshot.exists() ? snapshot.data() : null)
  })
}

export const listenToMonthlyAttendance = (userId, monthDate, callback) => {
  const start = startOfMonth(monthDate)
  const end = endOfMonth(monthDate)
  const attendanceCol = collection(db, 'users', userId, 'attendance')
  const startKey = format(start, 'yyyy-MM-dd')
  const endKey = format(end, 'yyyy-MM-dd')

  const attendanceQuery = query(
    attendanceCol,
    orderBy('workDate'),
    startAt(startKey),
    endAt(endKey),
  )

  return onSnapshot(attendanceQuery, (snapshot) => {
    const rows = snapshot.docs.map((docSnap) => docSnap.data())
    callback(rows)
  })
}

export const listenToMonthlySummary = (userId, yearMonth, callback) => {
  const summaryRef = getMonthlySummaryDocRef(userId, yearMonth)
  return onSnapshot(summaryRef, (snapshot) => {
    callback(snapshot.exists() ? snapshot.data() : null)
  })
}

export const listenToAllMonthlySummaries = (yearMonth, callback) => {
  const summaryQuery = query(
    collectionGroup(db, 'monthlySummary'),
    where('yearMonth', '==', yearMonth),
  )

  return onSnapshot(summaryQuery, (snapshot) => {
    const summaries = snapshot.docs.map((docSnap) => ({
      ...docSnap.data(),
      userId: docSnap.ref.parent.parent?.id ?? null,
    }))
    callback(summaries)
  })
}

export const listenToTodayStatuses = (workDate, callback) => {
  const attendanceQuery = query(
    collectionGroup(db, 'attendance'),
    where('workDate', '==', workDate),
  )

  return onSnapshot(attendanceQuery, (snapshot) => {
    const statuses = snapshot.docs.map((docSnap) => ({
      ...docSnap.data(),
      userId: docSnap.ref.parent.parent?.id ?? null,
    }))
    callback(statuses)
  })
}

export const fetchDailyAttendanceForAllEmployees = async (workDate) => {
  const attendanceQuery = query(
    collectionGroup(db, 'attendance'),
    where('workDate', '==', workDate),
    orderBy('clockIn', 'asc'),
  )

  const snapshot = await getDocs(attendanceQuery)

  return snapshot.docs.map((docSnap) => ({
    ...docSnap.data(),
    userId: docSnap.ref.parent.parent?.id ?? null,
  }))
}

export const updateMonthlySummaryTotals = async (userId, yearMonth) => {
  const start = startOfMonth(parseISO(`${yearMonth}-01`))
  const end = endOfMonth(start)
  const attendanceCol = collection(db, 'users', userId, 'attendance')
  const startKey = format(start, 'yyyy-MM-dd')
  const endKey = format(end, 'yyyy-MM-dd')

  const attendanceQuery = query(
    attendanceCol,
    orderBy('workDate'),
    startAt(startKey),
    endAt(endKey),
  )

  const snapshot = await getDocs(attendanceQuery)
  let totalMinutes = 0
  let overtimeMinutes = 0

  snapshot.forEach((docSnap) => {
    const data = docSnap.data()
    totalMinutes += data.totalMinutes ?? 0
    overtimeMinutes += data.overtimeMinutes ?? 0
  })

  const summaryRef = getMonthlySummaryDocRef(userId, yearMonth)

  await setDoc(
    summaryRef,
    {
      userId,
      yearMonth,
      totalMinutes,
      overtimeMinutes,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export const bulkUpdateMonthlySummaries = async (yearMonth) => {
  const userPaths = await getDocs(collection(db, 'users'))
  const batch = writeBatch(db)

  const monthDate = parseISO(`${yearMonth}-01`)
  const start = startOfMonth(monthDate)
  const end = endOfMonth(monthDate)
  const startKey = format(start, 'yyyy-MM-dd')
  const endKey = format(end, 'yyyy-MM-dd')

  await Promise.all(
    userPaths.docs.map(async (userDoc) => {
      const userId = userDoc.id
      const attendanceCol = collection(db, 'users', userId, 'attendance')
      const attendanceQuery = query(
        attendanceCol,
        orderBy('workDate'),
        startAt(startKey),
        endAt(endKey),
      )
      const attendanceSnapshot = await getDocs(attendanceQuery)

      let totalMinutes = 0
      let overtimeMinutes = 0

      attendanceSnapshot.forEach((attendanceDoc) => {
        const data = attendanceDoc.data()
        totalMinutes += data.totalMinutes ?? 0
        overtimeMinutes += data.overtimeMinutes ?? 0
      })

      const summaryRef = getMonthlySummaryDocRef(userId, yearMonth)

      batch.set(
        summaryRef,
        {
          userId,
          yearMonth,
          totalMinutes,
          overtimeMinutes,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
    }),
  )

  await batch.commit()
}

export const getMonthlyAttendanceRange = async (userId, yearMonth) => {
  const monthDate = parseISO(`${yearMonth}-01`)
  const start = startOfMonth(monthDate)
  const end = endOfMonth(monthDate)
  const attendanceCol = collection(db, 'users', userId, 'attendance')
  const startKey = format(start, 'yyyy-MM-dd')
  const endKey = format(end, 'yyyy-MM-dd')

  const attendanceQuery = query(
    attendanceCol,
    orderBy('workDate'),
    startAt(startKey),
    endAt(endKey),
  )

  const snapshot = await getDocs(attendanceQuery)

  return snapshot.docs.map((docSnap) => docSnap.data())
}

export const listenToDateRangeAttendance = (userId, startDate, endDate, callback) => {
  const attendanceCol = collection(db, 'users', userId, 'attendance')
  const startKey = format(startDate, 'yyyy-MM-dd')
  const endKey = format(endDate, 'yyyy-MM-dd')

  const attendanceQuery = query(
    attendanceCol,
    orderBy('workDate'),
    startAt(startKey),
    endAt(endKey),
  )

  return onSnapshot(attendanceQuery, (snapshot) => {
    callback(snapshot.docs.map((docSnap) => docSnap.data()))
  })
}

export const calculateRealtimeTotals = (clockIn, breakMinutes = 0, breakPeriods = []) => {
  if (!clockIn) return { workMinutes: 0, overtimeMinutes: 0 }
  const now = Timestamp.fromDate(new Date())
  const effectiveBreakMinutes = calculateDeductibleBreakMinutes(
    clockIn,
    now,
    breakMinutes,
    breakPeriods,
  )
  const workMinutes = calculateDailyMinutes(clockIn, now, effectiveBreakMinutes)
  const overtimeMinutes = calculateOvertimeMinutes(workMinutes, STANDARD_DAILY_MINUTES)
  return { workMinutes, overtimeMinutes }
}

export const formatWorkDate = (date) => format(date, 'yyyy-MM-dd')

export const getDefaultBreakMinutes = () => 60
