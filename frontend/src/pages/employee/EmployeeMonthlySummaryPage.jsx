import { useMemo, useState } from 'react'
import { Card, Col, Form, Row, Table } from 'react-bootstrap'
import { format, parseISO } from 'date-fns'
import useEmployeeAttendance from '../../hooks/useEmployeeAttendance.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { minutesToDuration, formatActualWorkDuration, formatTime } from '../../utils/time.js'

const EmployeeMonthlySummaryPage = () => {
  const { user } = useAuth()
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'))

  const monthDate = useMemo(() => parseISO(`${selectedMonth}-01`), [selectedMonth])
  const { monthlyRecords, monthlySummary } = useEmployeeAttendance(user?.uid, { monthDate })

  const handleMonthChange = (event) => {
    setSelectedMonth(event.target.value)
  }

  return (
    <div>
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-3">
        <div>
          <h2 className="h5 fw-bold mb-1">月次サマリー</h2>
          <p className="text-muted small mb-0">勤務時間と残業時間を月ごとに確認できます。</p>
        </div>
        <Form.Select value={selectedMonth} onChange={handleMonthChange} className="w-auto">
          {Array.from({ length: 6 }).map((_, index) => {
            const date = new Date()
            date.setMonth(date.getMonth() - index)
            const value = format(date, 'yyyy-MM')
            return (
              <option value={value} key={value}>
                {format(date, 'yyyy年M月')}
              </option>
            )
          })}
        </Form.Select>
      </div>

      <Row className="g-3 mb-3">
        <Col xs={6} md={3}>
          <Card className="text-center shadow-sm">
            <Card.Body>
              <p className="text-muted small mb-1">勤務時間合計</p>
              <h3 className="h5 mb-0">{minutesToDuration(monthlySummary?.totalMinutes ?? 0)}</h3>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} md={3}>
          <Card className="text-center shadow-sm">
            <Card.Body>
              <p className="text-muted small mb-1">残業時間合計</p>
              <h3 className="h5 mb-0">{minutesToDuration(monthlySummary?.overtimeMinutes ?? 0)}</h3>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} md={3}>
          <Card className="text-center shadow-sm">
            <Card.Body>
              <p className="text-muted small mb-1">勤務日数</p>
              <h3 className="h5 mb-0">{monthlyRecords.length}</h3>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} md={3}>
          <Card className="text-center shadow-sm">
            <Card.Body>
              <p className="text-muted small mb-1">平均残業</p>
              <h3 className="h5 mb-0">
                {minutesToDuration(
                  monthlyRecords.length
                    ? Math.round(
                        (monthlySummary?.overtimeMinutes ?? 0) / monthlyRecords.length,
                      )
                    : 0,
                )}
              </h3>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="shadow-sm">
        <Card.Body className="p-0">
          <Table responsive hover className="mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>日付</th>
                <th>出勤</th>
                <th>退勤</th>
                <th className="text-end">休憩(分)</th>
                <th className="text-end">実働時間</th>
                <th className="text-end">勤務時間</th>
                <th className="text-end">残業時間</th>
                <th>勤務内容</th>
              </tr>
            </thead>
            <tbody>
              {monthlyRecords.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-muted py-4">
                    該当期間の勤怠データはありません。
                  </td>
                </tr>
              )}
              {monthlyRecords.map((record) => (
                <tr key={record.workDate}>
                  <td>{record.workDate}</td>
                  <td>{formatTime(record.clockIn)}</td>
                  <td>{formatTime(record.clockOut)}</td>
                  <td className="text-end">{record.breakMinutes ?? 0}</td>
                  <td className="text-end">
                    {formatActualWorkDuration(
                      record.clockIn,
                      record.clockOut,
                      record.breakMinutes,
                      record.breakPeriods,
                    )}
                  </td>
                  <td className="text-end">{minutesToDuration(record.totalMinutes ?? 0)}</td>
                  <td className="text-end">{minutesToDuration(record.overtimeMinutes ?? 0)}</td>
                  <td>{record.workDescription}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </div>
  )
}

export default EmployeeMonthlySummaryPage
