import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, Col, Form, Row, Stack } from 'react-bootstrap'
import { format } from 'date-fns'
import ErrorAlert from '../../components/common/ErrorAlert.jsx'
import useEmployeeAttendance from '../../hooks/useEmployeeAttendance.js'
import { useAuth } from '../../context/AuthContext.jsx'
import {
  clockIn,
  clockOut,
  formatWorkDate,
  updateAttendanceDetails,
} from '../../services/attendanceService.js'
import { formatTime, minutesToDuration, timestampToDate } from '../../utils/time.js'

const EmployeeDashboardPage = () => {
  const { user } = useAuth()
  const { today, realtimeTotals } = useEmployeeAttendance(user?.uid)
  const workDate = useMemo(() => formatWorkDate(new Date()), [])

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

    setClockInInput(toInputValue(today?.clockIn))
    setClockOutInput(toInputValue(today?.clockOut))
    setBreakMinutes(today?.breakMinutes ?? 60)
    setWorkDescription(today?.workDescription ?? '')
  }, [today])

  const handleClockIn = async () => {
    if (!user?.uid) return
    setError('')
    setSuccess('')
    if (!clockInInput) {
      setError('出勤時刻を入力してください。')
      return
    }

    setSavingClockIn(true)
    try {
      await clockIn(user.uid, workDate, clockInInput)
      setSuccess('出勤時刻を保存しました。')
    } catch (e) {
      setError(e.message)
    } finally {
      setSavingClockIn(false)
    }
  }

  const handleClockOut = async () => {
    if (!user?.uid) return
    setError('')
    setSuccess('')
    if (!clockOutInput) {
      setError('退勤時刻を入力してください。')
      return
    }

    setSavingClockOut(true)
    try {
      await clockOut(user.uid, workDate, clockOutInput)
      setSuccess('退勤時刻を保存しました。')
    } catch (e) {
      setError(e.message)
    } finally {
      setSavingClockOut(false)
    }
  }

  const handleSaveDetails = async () => {
    if (!user?.uid || !today) return
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      await updateAttendanceDetails(user.uid, workDate, {
        breakMinutes: Number(breakMinutes),
        workDescription,
      })
      setSuccess('休憩時間・勤務内容を保存しました。')
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const hasClockIn = Boolean(today?.clockIn)

  const workMinutesLabel = today?.totalMinutes ? minutesToDuration(today.totalMinutes) : '-'
  const overtimeLabel = today?.overtimeMinutes ? minutesToDuration(today.overtimeMinutes) : '-'

  const realtimeWork = realtimeTotals
    ? {
        total: minutesToDuration(realtimeTotals.workMinutes),
        overtime: minutesToDuration(realtimeTotals.overtimeMinutes),
      }
    : null

  return (
    <Stack gap={3}>
      <div>
        <h2 className="h5 fw-bold mb-1">今日の勤怠状況</h2>
        <p className="text-muted small mb-0">出勤・退勤はワンタップで登録できます。</p>
      </div>

      <ErrorAlert message={error} onClose={() => setError('')} />
      {success && (
        <div className="alert alert-success py-2 mb-0" role="alert">
          {success}
        </div>
      )}

      <Card className="shadow-sm">
        <Card.Body>
          <Row className="g-3 align-items-center">
            <Col xs={12} md={6}>
              <Stack direction="horizontal" gap={3} className="flex-wrap">
                <div>
                  <p className="text-muted small mb-1">出勤</p>
                  <h3 className="h4 mb-0">{formatTime(today?.clockIn)}</h3>
                </div>
                <div>
                  <p className="text-muted small mb-1">退勤</p>
                  <h3 className="h4 mb-0">{formatTime(today?.clockOut)}</h3>
                </div>
                <div>
                  <p className="text-muted small mb-1">勤務時間</p>
                  <h3 className="h4 mb-0">
                    {realtimeWork?.total ?? workMinutesLabel}
                    {today?.status === 'working' && !realtimeWork && (
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
                  <div className="d-flex gap-2">
                    <Form.Control
                      type="time"
                      value={clockInInput}
                      onChange={(event) => setClockInInput(event.target.value)}
                    />
                    <Button
                      variant="outline-primary"
                      className="flex-shrink-0"
                      onClick={handleClockIn}
                      disabled={savingClockIn || !clockInInput}
                    >
                      {savingClockIn ? '保存中…' : '保存'}
                    </Button>
                  </div>
                </Form.Group>

                <Form.Group controlId="clockOutTime">
                  <Form.Label className="mb-1">退勤入力</Form.Label>
                  <div className="d-flex gap-2">
                    <Form.Control
                      type="time"
                      value={clockOutInput}
                      onChange={(event) => setClockOutInput(event.target.value)}
                      disabled={!hasClockIn}
                    />
                    <Button
                      variant="primary"
                      className="flex-shrink-0"
                      onClick={handleClockOut}
                      disabled={savingClockOut || !clockOutInput || !hasClockIn}
                    >
                      {savingClockOut ? '保存中…' : '保存'}
                    </Button>
                  </div>
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
