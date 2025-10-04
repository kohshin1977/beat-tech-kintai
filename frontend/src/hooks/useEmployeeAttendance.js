import { useEffect, useMemo, useState } from 'react'
import { addMonths, format } from 'date-fns'
import {
  calculateRealtimeTotals,
  formatWorkDate,
} from '../services/attendanceService.js'
import {
  listenToMonthlyAttendance,
  listenToMonthlySummary,
  listenToTodayAttendance,
} from '../services/attendanceService.js'

const useEmployeeAttendance = (userId, monthDateInput) => {
  const [today, setToday] = useState(null)
  const [monthlyRecords, setMonthlyRecords] = useState([])
  const [monthlySummary, setMonthlySummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const monthDate = useMemo(() => {
    if (monthDateInput instanceof Date && !Number.isNaN(monthDateInput.getTime())) {
      return monthDateInput
    }
    return new Date()
  }, [monthDateInput])

  useEffect(() => {
    if (!userId) return undefined

    setLoading(true)
    setError(null)

    const workDate = formatWorkDate(new Date())
    const yearMonth = format(monthDate, 'yyyy-MM')

    const unsubscribeToday = listenToTodayAttendance(userId, workDate, (data) => {
      setToday(data)
    })

    const unsubscribeMonthly = listenToMonthlyAttendance(userId, monthDate, (rows) => {
      setMonthlyRecords(rows)
    })

    const unsubscribeSummary = listenToMonthlySummary(userId, yearMonth, (summary) => {
      setMonthlySummary(summary)
      setLoading(false)
    })

    return () => {
      unsubscribeToday?.()
      unsubscribeMonthly?.()
      unsubscribeSummary?.()
    }
  }, [userId, monthDate])

  const realtimeTotals = useMemo(() => {
    if (!today?.clockIn || today?.clockOut) return null
    return calculateRealtimeTotals(today.clockIn, today.breakMinutes)
  }, [today])

  const nextMonthLabel = useMemo(() => format(addMonths(monthDate, 1), 'yyyy-MM'), [monthDate])

  return {
    today,
    monthlyRecords,
    monthlySummary,
    realtimeTotals,
    loading,
    error,
    nextMonthLabel,
  }
}

export default useEmployeeAttendance
