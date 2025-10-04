import { useMemo, useState } from 'react'
import { Badge, ButtonGroup, Card, Col, Form, Row, Table, ToggleButton } from 'react-bootstrap'
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import useEmployeeAttendance from '../../hooks/useEmployeeAttendance.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { formatTime, minutesToDuration } from '../../utils/time.js'

const VIEW_MODES = {
  LIST: 'list',
  CALENDAR: 'calendar',
}

const EmployeeHistoryPage = () => {
  const { user } = useAuth()
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [viewMode, setViewMode] = useState(VIEW_MODES.LIST)

  const monthDate = useMemo(() => parseISO(`${selectedMonth}-01`), [selectedMonth])
  const { monthlyRecords } = useEmployeeAttendance(user?.uid, { monthDate })

  const sortedRecords = useMemo(
    () =>
      [...monthlyRecords].sort((a, b) => (a.workDate < b.workDate ? 1 : -1)),
    [monthlyRecords],
  )

  const calendarMatrix = useMemo(() => {
    const start = startOfWeek(startOfMonth(monthDate), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(monthDate), { weekStartsOn: 0 })
    const days = eachDayOfInterval({ start, end })

    return days.reduce((weeks, day, index) => {
      const weekIndex = Math.floor(index / 7)
      if (!weeks[weekIndex]) weeks[weekIndex] = []
      const record = monthlyRecords.find((item) => item.workDate && isSameDay(parseISO(item.workDate), day))
      weeks[weekIndex].push({ day, record })
      return weeks
    }, [])
  }, [monthDate, monthlyRecords])

  const handleMonthChange = (event) => setSelectedMonth(event.target.value)

  return (
    <div>
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-3">
        <div>
          <h2 className="h5 fw-bold mb-1">勤務履歴</h2>
          <p className="text-muted small mb-0">過去の勤務状況を一覧またはカレンダー形式で確認できます。</p>
        </div>
        <div className="d-flex flex-column flex-md-row gap-2">
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
          <ButtonGroup>
            <ToggleButton
              type="radio"
              id="view-list"
              variant="outline-primary"
              value={VIEW_MODES.LIST}
              checked={viewMode === VIEW_MODES.LIST}
              onChange={(event) => setViewMode(event.currentTarget.value)}
            >
              リスト
            </ToggleButton>
            <ToggleButton
              type="radio"
              id="view-calendar"
              variant="outline-primary"
              value={VIEW_MODES.CALENDAR}
              checked={viewMode === VIEW_MODES.CALENDAR}
              onChange={(event) => setViewMode(event.currentTarget.value)}
            >
              カレンダー
            </ToggleButton>
          </ButtonGroup>
        </div>
      </div>

      {viewMode === VIEW_MODES.LIST && (
        <Row className="g-3">
          {sortedRecords.length === 0 && (
            <Col xs={12}>
              <Card className="shadow-sm">
                <Card.Body className="text-center text-muted py-4">
                  該当期間の勤務履歴はありません。
                </Card.Body>
              </Card>
            </Col>
          )}
          {sortedRecords.map((record) => (
            <Col xs={12} key={record.workDate}>
              <Card className="shadow-sm">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                      <h3 className="h6 mb-1">{format(parseISO(record.workDate), 'M月d日 (E)')}</h3>
                      <div className="text-muted small">
                        出勤 {formatTime(record.clockIn)} / 退勤 {formatTime(record.clockOut)}
                      </div>
                    </div>
                    <div className="text-end">
                      <Badge bg="primary" className="me-2">
                        {minutesToDuration(record.totalMinutes ?? 0)}
                      </Badge>
                      <Badge bg={record.overtimeMinutes > 0 ? 'danger' : 'secondary'}>
                        残業 {minutesToDuration(record.overtimeMinutes ?? 0)}
                      </Badge>
                    </div>
                  </div>
                  {record.workDescription && (
                    <p className="mb-0 text-muted small">{record.workDescription}</p>
                  )}
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      {viewMode === VIEW_MODES.CALENDAR && (
        <Card className="shadow-sm">
          <Card.Body className="p-0">
            <Table bordered responsive hover className="mb-0 text-center align-middle">
              <thead className="table-light">
                <tr>
                  {['日', '月', '火', '水', '木', '金', '土'].map((label) => (
                    <th key={label}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {calendarMatrix.map((week, index) => (
                  <tr key={index}>
                    {week.map(({ day, record }) => (
                      <td
                        key={day.toISOString()}
                        className={isSameMonth(day, monthDate) ? '' : 'bg-light text-muted'}
                      >
                        <div className="fw-semibold">{format(day, 'd')}</div>
                        {record ? (
                          <div className="small">
                            <div>{minutesToDuration(record.totalMinutes ?? 0)}</div>
                            <div className="text-muted">残 {minutesToDuration(record.overtimeMinutes ?? 0)}</div>
                          </div>
                        ) : (
                          <div className="text-muted small">-</div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      )}
    </div>
  )
}

export default EmployeeHistoryPage
