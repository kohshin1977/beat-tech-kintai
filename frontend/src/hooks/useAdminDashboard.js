import { useEffect, useMemo, useState } from 'react'
import {
  calculateRealtimeTotals,
  formatWorkDate,
  listenToTodayStatuses,
} from '../services/attendanceService.js'
import { listenToEmployees } from '../services/userService.js'
import { formatTime } from '../utils/time.js'

const useAdminDashboard = (targetDate = new Date()) => {
  const [employees, setEmployees] = useState([])
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stopEmployees = listenToEmployees((rows) => {
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
        ? calculateRealtimeTotals(record.clockIn, record.breakMinutes)
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

  return {
    stats,
    workingEmployees,
    completedEmployees,
    notStartedEmployees,
    overtimeEmployees,
    loading,
  }
}

export default useAdminDashboard
