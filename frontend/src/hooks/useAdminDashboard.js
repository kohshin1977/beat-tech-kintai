import { useEffect, useMemo, useState } from 'react'
import {
  calculateRealtimeTotals,
  formatWorkDate,
  listenToTodayStatuses,
  listenToMonthlyAttendanceForAllUsers,
  listenToAllMonthlySummaries,
} from '../services/attendanceService.js'
import { listenToAllUsers } from '../services/userService.js'
import { calculateActualWorkMinutes, formatTime, formatYearMonth } from '../utils/time.js'

const useAdminDashboard = (targetDate = new Date()) => {
  const [employees, setEmployees] = useState([])
  const [attendance, setAttendance] = useState([])
  const [monthlyAttendance, setMonthlyAttendance] = useState([])
  const [monthlySummaries, setMonthlySummaries] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stopEmployees = listenToAllUsers((rows) => {
      setEmployees(rows)
      setLoading(false)
    })
    return () => stopEmployees?.()
  }, [])

  useEffect(() => {
    const workDate = formatWorkDate(targetDate)
    const stopAttendance = listenToTodayStatuses(workDate, (rows) => {
      setAttendance(rows)
    })
    return () => stopAttendance?.()
  }, [targetDate])

  useEffect(() => {
    const yearMonth = formatYearMonth(targetDate)
    const stopSummaries = listenToMonthlyAttendanceForAllUsers(yearMonth, (rows) => {
      setMonthlyAttendance(rows)
    })
    return () => stopSummaries?.()
  }, [targetDate])

  useEffect(() => {
    const yearMonth = formatYearMonth(targetDate)
    const stopSummaries = listenToAllMonthlySummaries(yearMonth, (rows) => {
      setMonthlySummaries(rows)
    })
    return () => stopSummaries?.()
  }, [targetDate])

  const statusRows = useMemo(() => {
    const workDate = formatWorkDate(targetDate)
    const map = new Map()

    attendance.forEach((record) => {
      if (!record.userId) return
      map.set(record.userId, record)
    })

    const data = employees.map((employee) => {
      const record = map.get(employee.id)
      const clockInLabel = formatTime(record?.clockIn)
      const clockOutLabel = formatTime(record?.clockOut)
      const baseMinutes = record?.totalMinutes ?? 0
      const workingRealtime = !record?.clockOut && record?.clockIn
        ? calculateRealtimeTotals(record.clockIn, record.breakMinutes, record.breakPeriods)
        : null

      const totalMinutes = workingRealtime?.workMinutes ?? baseMinutes
      const overtimeMinutes = workingRealtime?.overtimeMinutes ?? record?.overtimeMinutes ?? 0

      return {
        userId: employee.id,
        name: employee.name,
        department: employee.department,
        workDate,
        status: record?.status ?? 'pending',
        clockIn: record?.clockIn,
        clockOut: record?.clockOut,
        breakMinutes: record?.breakMinutes ?? 0,
        breakPeriods: record?.breakPeriods ?? [],
        totalMinutes,
        overtimeMinutes,
        clockInLabel,
        clockOutLabel,
        realtime: workingRealtime,
      }
    })

    data.sort((a, b) => a.name.localeCompare(b.name, 'ja'))
    return data
  }, [attendance, employees, targetDate])

  const workingEmployees = statusRows.filter((row) => row.status === 'working')
  const completedEmployees = statusRows.filter((row) => row.status === 'completed')
  const notStartedEmployees = statusRows.filter((row) => row.status === 'pending')
  const overtimeEmployees = statusRows.filter((row) => row.overtimeMinutes > 0)

  const stats = {
    total: statusRows.length,
    working: workingEmployees.length,
    completed: completedEmployees.length,
    notStarted: notStartedEmployees.length,
  }

  const monthlySummaryRows = useMemo(() => {
    const summaryMap = new Map(monthlySummaries.map((row) => [row.userId, row]))
    const totalMap = new Map()
    const countMap = new Map()
    monthlyAttendance.forEach((record) => {
      if (!record?.userId) return
      const current = totalMap.get(record.userId) ?? 0
      let totalMinutes = record.totalMinutes
      if (!Number.isFinite(totalMinutes) && record.clockIn && record.clockOut) {
        totalMinutes = calculateActualWorkMinutes(
          record.clockIn,
          record.clockOut,
          record.breakMinutes,
          record.breakPeriods,
        )
      }
      const safeMinutes = Number.isFinite(totalMinutes) ? totalMinutes : 0
      totalMap.set(record.userId, current + safeMinutes)
      countMap.set(record.userId, (countMap.get(record.userId) ?? 0) + 1)
    })
    return employees
      .map((employee) => {
        const summary = summaryMap.get(employee.id)
        const attendanceCount = countMap.get(employee.id) ?? 0
        const attendanceTotal = totalMap.get(employee.id) ?? 0
        const fallbackTotal = summary?.totalMinutes ?? 0
        return {
          userId: employee.id,
          name: employee.name,
          department: employee.department,
          totalMinutes: attendanceCount > 0 ? attendanceTotal : fallbackTotal,
        }
      })
      .sort((a, b) => a.department.localeCompare(b.department, 'ja') || a.name.localeCompare(b.name, 'ja'))
  }, [employees, monthlyAttendance, monthlySummaries])

  return {
    stats,
    workingEmployees,
    completedEmployees,
    notStartedEmployees,
    overtimeEmployees,
    monthlySummaryRows,
    loading,
  }
}

export default useAdminDashboard
