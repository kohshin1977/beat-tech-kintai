import { useEffect, useMemo, useState } from 'react'
import {
  calculateRealtimeTotals,
  formatWorkDate,
  listenToTodayStatuses,
  listenToAllMonthlySummaries,
} from '../services/attendanceService.js'
import { listenToAllUsers } from '../services/userService.js'
import { formatTime, formatYearMonth } from '../utils/time.js'

const useAdminDashboard = (targetDate = new Date()) => {
  const [employees, setEmployees] = useState([])
  const [attendance, setAttendance] = useState([])
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
    return employees
      .map((employee) => {
        const summary = summaryMap.get(employee.id)
        return {
          userId: employee.id,
          name: employee.name,
          department: employee.department,
          totalMinutes: summary?.totalMinutes ?? 0,
        }
      })
      .sort((a, b) => a.department.localeCompare(b.department, 'ja') || a.name.localeCompare(b.name, 'ja'))
  }, [employees, monthlySummaries])

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
