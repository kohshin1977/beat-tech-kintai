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

const useEmployeeAttendance = (userId, { monthDate: monthDateInput, selectedDate: selectedDateInput } = {}) => {
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

  const selectedDate = useMemo(() => {
    if (selectedDateInput instanceof Date && !Number.isNaN(selectedDateInput.getTime())) {
      return selectedDateInput
    }
    return new Date()
  }, [selectedDateInput])

  const workDate = useMemo(() => formatWorkDate(selectedDate), [selectedDate])
  const isViewingToday = useMemo(
    () => workDate === formatWorkDate(new Date()),
    [workDate],
  )

  useEffect(() => {
    if (!userId) return undefined

    setLoading(true)
    setError(null)

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
  }, [userId, monthDate, workDate])

  const realtimeTotals = useMemo(() => {
    if (!isViewingToday || !today?.clockIn || today?.clockOut) return null
    return calculateRealtimeTotals(today.clockIn, today.breakMinutes, today.breakPeriods)
  }, [today, isViewingToday])

  const nextMonthLabel = useMemo(() => format(addMonths(monthDate, 1), 'yyyy-MM'), [monthDate])

  return {
    today,
    monthlyRecords,
    monthlySummary,
    realtimeTotals,
    loading,
    error,
    nextMonthLabel,
    selectedDate,
    isViewingToday,
    workDate,
  }
}

export default useEmployeeAttendance
