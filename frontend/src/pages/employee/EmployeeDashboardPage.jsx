import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, Col, Form, Row, Stack, Table } from 'react-bootstrap'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import ErrorAlert from '../../components/common/ErrorAlert.jsx'
import ClockTimePicker from '../../components/common/ClockTimePicker.jsx'
import useEmployeeAttendance from '../../hooks/useEmployeeAttendance.js'
import { useAuth } from '../../context/AuthContext.jsx'
import {
  clockIn,
  clockOut,
  clearClockIn,
  clearClockOut,
  updateAttendanceDetails,
} from '../../services/attendanceService.js'
import { formatTime, minutesToDuration, timestampToDate } from '../../utils/time.js'

const EmployeeDashboardPage = () => {
  const { user } = useAuth()
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const {
    today: attendanceRecord,
    realtimeTotals,
    monthlyRecords,
    loading,
    error: fetchError,
    workDate,
    isViewingToday,
  } = useEmployeeAttendance(user?.uid, {
    monthDate: calendarMonth,
    selectedDate,
  })

  const [clockInInput, setClockInInput] = useState('')
  const [clockOutInput, setClockOutInput] = useState('')
  const [breakMinutes, setBreakMinutes] = useState(60)
  const [workDescription, setWorkDescription] = useState('')
  const [savingClockIn, setSavingClockIn] = useState(false)
  const [savingClockOut, setSavingClockOut] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const toInputValue = (value) => {
      const date = timestampToDate(value)
      return date ? format(date, 'HH:mm') : ''
    }

    setClockInInput(toInputValue(attendanceRecord?.clockIn))
    setClockOutInput(toInputValue(attendanceRecord?.clockOut))
    setBreakMinutes(attendanceRecord?.breakMinutes ?? 60)
    setWorkDescription(attendanceRecord?.workDescription ?? '')
  }, [attendanceRecord])

  const getExistingTime = (timestampValue) => {
    const date = timestampToDate(timestampValue)
    return date ? format(date, 'HH:mm') : ''
  }

  const handleClockInChange = async (nextValue) => {
    setClockInInput(nextValue ?? '')

    if (!user?.uid) return

    const existing = getExistingTime(attendanceRecord?.clockIn)
    if ((nextValue ?? '') === existing) return

    setError('')
    setSuccess('')
    setSavingClockIn(true)
    try {
      if (!nextValue) {
        await clearClockIn(user.uid, workDate)
        setSuccess(`出勤時刻を削除しました (${format(selectedDate, 'M月d日')})。`)
      } else {
        await clockIn(user.uid, workDate, nextValue)
        setSuccess(`出勤時刻を保存しました (${format(selectedDate, 'M月d日')})。`)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setSavingClockIn(false)
    }
  }

  const handleClockOutChange = async (nextValue) => {
    setClockOutInput(nextValue ?? '')

    if (!user?.uid) return

    const existing = getExistingTime(attendanceRecord?.clockOut)
    if ((nextValue ?? '') === existing) return

    setError('')
    setSuccess('')
    setSavingClockOut(true)
    try {
      if (!nextValue) {
        await clearClockOut(user.uid, workDate)
        setSuccess(`退勤時刻を削除しました (${format(selectedDate, 'M月d日')})。`)
      } else {
        await clockOut(user.uid, workDate, nextValue)
        setSuccess(`退勤時刻を保存しました (${format(selectedDate, 'M月d日')})。`)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setSavingClockOut(false)
    }
  }

  const handleSaveDetails = async () => {
    if (!user?.uid || !attendanceRecord) return
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      await updateAttendanceDetails(user.uid, workDate, {
        breakMinutes: Number(breakMinutes),
        workDescription,
      })
      setSuccess(`休憩時間・勤務内容を保存しました (${format(selectedDate, 'M月d日')})。`)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const hasClockIn = Boolean(attendanceRecord?.clockIn)

  const workMinutesLabel = attendanceRecord?.totalMinutes
    ? minutesToDuration(attendanceRecord.totalMinutes)
    : '-'
  const overtimeLabel = attendanceRecord?.overtimeMinutes
    ? minutesToDuration(attendanceRecord.overtimeMinutes)
    : '-'

  const realtimeWork = realtimeTotals
    ? {
        total: minutesToDuration(realtimeTotals.workMinutes),
        overtime: minutesToDuration(realtimeTotals.overtimeMinutes),
      }
    : null

  const recordsByDate = useMemo(() => {
    const map = {}
    monthlyRecords.forEach((record) => {
      if (record?.workDate) {
        map[record.workDate] = record
      }
    })
    return map
  }, [monthlyRecords])

  const calendarWeeks = useMemo(() => {
    const start = startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 0 })
    const days = eachDayOfInterval({ start, end })
    const weeks = []
    for (let index = 0; index < days.length; index += 7) {
      weeks.push(days.slice(index, index + 7))
    }
    return weeks
  }, [calendarMonth])

  const selectedDateLabel = format(selectedDate, 'M月d日 (E)')
  const calendarMonthLabel = format(calendarMonth, 'yyyy年M月')

  const handleSelectDate = (day) => {
    setSelectedDate(day)
    if (!isSameMonth(day, calendarMonth)) {
      setCalendarMonth(startOfMonth(day))
    }
  }

  const handleMonthChange = (offset) => {
    const next = startOfMonth(addMonths(calendarMonth, offset))
    setCalendarMonth(next)
    setSelectedDate(next)
  }

  return (
    <Stack gap={3}>
      <div>
        <h2 className="h5 fw-bold mb-1">今日の勤怠状況</h2>
        <p className="text-muted small mb-0">カレンダーから日付を選び、出勤・退勤時刻を入力できます。</p>
      </div>

      <ErrorAlert message={error} onClose={() => setError('')} />
      {success && (
        <div className="alert alert-success py-2 mb-0" role="alert">
          {success}
        </div>
      )}
      {fetchError && !error && (
        <div className="alert alert-danger py-2 mb-0" role="alert">
          {fetchError}
        </div>
      )}

      <Card className="shadow-sm">
        <Card.Body>
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-3">
            <div className="d-flex justify-content-between align-items-center gap-2">
              <Button variant="outline-secondary" size="sm" onClick={() => handleMonthChange(-1)}>
                前の月
              </Button>
              <h3 className="h6 mb-0">{calendarMonthLabel}</h3>
              <Button variant="outline-secondary" size="sm" onClick={() => handleMonthChange(1)}>
                次の月
              </Button>
            </div>
            <div className="text-muted small">選択中: {selectedDateLabel}</div>
          </div>

          <Table bordered responsive hover className="mb-0 text-center align-middle">
            <thead className="table-light">
              <tr>
                {['日', '月', '火', '水', '木', '金', '土'].map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calendarWeeks.map((week, rowIndex) => (
                <tr key={rowIndex}>
                  {week.map((day) => {
                    const key = format(day, 'yyyy-MM-dd')
                    const record = recordsByDate[key]
                    const isCurrentMonth = isSameMonth(day, calendarMonth)
                    const isSelected = isSameDay(day, selectedDate)

                    const cellClasses = [
                      isCurrentMonth ? '' : 'bg-light text-muted',
                      isSelected ? 'table-primary text-white fw-semibold' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')

                    return (
                      <td
                        key={day.toISOString()}
                        className={cellClasses}
                        role="button"
                        onClick={() => handleSelectDate(day)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div>{format(day, 'd')}</div>
                        <div className="small">
                          {record ? (
                            <>
                              <div>{formatTime(record.clockIn)}</div>
                              <div>{formatTime(record.clockOut)}</div>
                            </>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Card className="shadow-sm">
        <Card.Body>
          {loading && (
            <div className="alert alert-info py-2 mb-3" role="status">
              データを読み込んでいます…
            </div>
          )}
          <Row className="g-3 align-items-center">
            <Col xs={12} md={6}>
              <Stack direction="horizontal" gap={3} className="flex-wrap">
                <div>
                  <p className="text-muted small mb-1">出勤</p>
                  <h3 className="h4 mb-0">{formatTime(attendanceRecord?.clockIn)}</h3>
                </div>
                <div>
                  <p className="text-muted small mb-1">退勤</p>
                  <h3 className="h4 mb-0">{formatTime(attendanceRecord?.clockOut)}</h3>
                </div>
                <div>
                  <p className="text-muted small mb-1">勤務時間</p>
                  <h3 className="h4 mb-0">
                    {realtimeWork?.total ?? workMinutesLabel}
                    {attendanceRecord?.status === 'working' && isViewingToday && !realtimeWork && (
                      <Badge bg="info" className="ms-2">
                        集計中
                      </Badge>
                    )}
                  </h3>
                </div>
                <div>
                  <p className="text-muted small mb-1">残業</p>
                  <h3 className="h4 mb-0">{realtimeWork?.overtime ?? overtimeLabel}</h3>
                </div>
              </Stack>
            </Col>
            <Col xs={12} md={6}>
              <Form className="d-flex flex-column gap-3">
                <Form.Group controlId="clockInTime">
                  <Form.Label className="mb-1">出勤入力</Form.Label>
                  <ClockTimePicker
                    value={clockInInput}
                    onChange={handleClockInChange}
                    disabled={savingClockIn}
                  />
                </Form.Group>

                <Form.Group controlId="clockOutTime">
                  <Form.Label className="mb-1">退勤入力</Form.Label>
                  <ClockTimePicker
                    value={clockOutInput}
                    onChange={handleClockOutChange}
                    disabled={!hasClockIn || savingClockOut}
                  />
                </Form.Group>
              </Form>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="shadow-sm">
        <Card.Body>
          <Row className="g-3">
            <Col xs={12} md={4}>
              <Form.Group controlId="breakMinutes">
                <Form.Label>休憩時間（分）</Form.Label>
                <Form.Control
                  type="number"
                  min={0}
                  step={15}
                  value={breakMinutes}
                  onChange={(event) => setBreakMinutes(event.target.value)}
                  disabled={!hasClockIn}
                />
              </Form.Group>
            </Col>
            <Col xs={12} md={8}>
              <Form.Group controlId="workDescription">
                <Form.Label>勤務内容</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={workDescription}
                  onChange={(event) => setWorkDescription(event.target.value)}
                  placeholder="本日の作業内容を入力 (任意)"
                  disabled={!hasClockIn}
                />
              </Form.Group>
            </Col>
          </Row>

          <div className="d-flex justify-content-end mt-3">
            <Button variant="success" onClick={handleSaveDetails} disabled={!hasClockIn || saving}>
              {saving ? '保存中…' : '内容を保存'}
            </Button>
          </div>
        </Card.Body>
      </Card>
    </Stack>
  )
}

export default EmployeeDashboardPage
