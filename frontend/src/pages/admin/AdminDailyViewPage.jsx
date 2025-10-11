import { useEffect, useMemo, useState } from 'react'
import { Card, Form, Table } from 'react-bootstrap'
import { format } from 'date-fns'
import { listenToTodayStatuses } from '../../services/attendanceService.js'
import { listenToEmployees } from '../../services/userService.js'
import {
  formatTime,
  minutesToDuration,
  formatActualWorkDuration,
  minutesToHourMinute,
} from '../../utils/time.js'

const AdminDailyViewPage = () => {
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [employees, setEmployees] = useState([])
  const [attendanceRows, setAttendanceRows] = useState([])

  useEffect(() => {
    const stopEmployees = listenToEmployees((rows) => setEmployees(rows))
    return () => stopEmployees?.()
  }, [])

  useEffect(() => {
    const stopAttendance = listenToTodayStatuses(selectedDate, (rows) => setAttendanceRows(rows))
    return () => stopAttendance?.()
  }, [selectedDate])

  const mergedRows = useMemo(() => {
    const recordMap = new Map(attendanceRows.map((item) => [item.userId, item]))

    return employees
      .map((employee) => {
        const record = recordMap.get(employee.id)
        return {
          userId: employee.id,
          name: employee.name,
          department: employee.department,
          clockIn: record?.clockIn,
          clockOut: record?.clockOut,
          breakMinutes: record?.breakMinutes ?? 0,
          breakPeriods: record?.breakPeriods ?? [],
          totalMinutes: record?.totalMinutes ?? 0,
          overtimeMinutes: record?.overtimeMinutes ?? 0,
          workDescription: record?.workDescription ?? '',
          status: record?.status ?? 'pending',
        }
      })
      .sort((a, b) => a.department.localeCompare(b.department, 'ja') || a.name.localeCompare(b.name, 'ja'))
  }, [attendanceRows, employees])

  const summary = useMemo(() => {
    const totals = mergedRows.reduce(
      (acc, row) => {
        acc.totalMinutes += row.totalMinutes
        acc.overtimeMinutes += row.overtimeMinutes
        if (row.status === 'working') acc.working += 1
        if (row.status === 'completed') acc.completed += 1
        if (row.status === 'pending') acc.pending += 1
        return acc
      },
      { totalMinutes: 0, overtimeMinutes: 0, working: 0, completed: 0, pending: 0 },
    )
    return totals
  }, [mergedRows])

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
        <div>
          <h2 className="h5 fw-bold mb-1">日次勤怠</h2>
          <p className="text-muted small mb-0">指定日の全社員勤怠データを一覧表示します。</p>
        </div>
        <Form.Group className="d-flex align-items-center gap-2 mb-0">
          <Form.Label className="mb-0">表示日</Form.Label>
          <Form.Control
            type="date"
            value={selectedDate}
            max={format(new Date(), 'yyyy-MM-dd')}
            onChange={(event) => setSelectedDate(event.target.value)}
          />
        </Form.Group>
      </div>

      <Card className="shadow-sm">
        <Card.Body className="d-flex flex-wrap gap-4">
          <div>
            <p className="text-muted small mb-1">勤務中</p>
            <h3 className="h5 mb-0">{summary.working}</h3>
          </div>
          <div>
            <p className="text-muted small mb-1">退勤済み</p>
            <h3 className="h5 mb-0">{summary.completed}</h3>
          </div>
          <div>
            <p className="text-muted small mb-1">未出勤</p>
            <h3 className="h5 mb-0">{summary.pending}</h3>
          </div>
          <div>
            <p className="text-muted small mb-1">勤務時間合計</p>
            <h3 className="h5 mb-0">{minutesToDuration(summary.totalMinutes)}</h3>
          </div>
          <div>
            <p className="text-muted small mb-1">残業時間合計</p>
            <h3 className="h5 mb-0">{minutesToDuration(summary.overtimeMinutes)}</h3>
          </div>
        </Card.Body>
      </Card>

      <Card className="shadow-sm">
        <Card.Body className="p-0">
          <Table responsive hover className="mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>社員</th>
                <th>部署</th>
                <th>出勤</th>
                <th>退勤</th>
                <th className="text-end">休憩</th>
                <th className="text-end">実働時間</th>
                <th className="text-end">勤務時間</th>
                <th className="text-end">残業時間</th>
                <th>勤務内容</th>
              </tr>
            </thead>
            <tbody>
              {mergedRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center text-muted py-4">
                    社員情報が登録されていません。
                  </td>
                </tr>
              )}
              {mergedRows.map((row) => (
                <tr key={row.userId}>
                  <td>{row.name}</td>
                  <td>{row.department}</td>
                  <td>{formatTime(row.clockIn)}</td>
                  <td>{formatTime(row.clockOut)}</td>
                  <td className="text-end">{minutesToHourMinute(row.breakMinutes)}</td>
                  <td className="text-end">
                    {formatActualWorkDuration(
                      row.clockIn,
                      row.clockOut,
                      row.breakMinutes,
                      row.breakPeriods,
                    )}
                  </td>
                  <td className="text-end">{minutesToDuration(row.totalMinutes)}</td>
                  <td className="text-end">{minutesToDuration(row.overtimeMinutes)}</td>
                  <td>{row.workDescription}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </div>
  )
}

export default AdminDailyViewPage
