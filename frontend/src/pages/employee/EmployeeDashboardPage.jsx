import { useEffect, useMemo, useState } from 'react'
import { Badge, Button, Card, Col, Form, Modal, Nav, Row, Stack, Table } from 'react-bootstrap'
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
import { ja } from 'date-fns/locale'
import ErrorAlert from '../../components/common/ErrorAlert.jsx'
import ClockTimePicker from '../../components/common/ClockTimePicker.jsx'
import useEmployeeAttendance from '../../hooks/useEmployeeAttendance.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { getUserProfile } from '../../services/userService.js'
import {
  clockIn,
  clockOut,
  clearClockIn,
  clearClockOut,
  updateAttendanceDetails,
  updateBreakScheduleRange,
} from '../../services/attendanceService.js'
import {
  calculateBreakMinutesFromPeriods,
  formatTime,
  minutesToDuration,
  timestampToDate,
  isValidTimeToken,
  timeTokenToMinutes,
} from '../../utils/time.js'

const VIEW_MODES = {
  CALENDAR: 'calendar',
  LIST: 'list',
}

const formatWithLocale = (date, pattern) => format(date, pattern, { locale: ja })

const MAX_BREAK_SLOTS = 5

const normalizeBreakSchedule = (values = []) => {
  if (!Array.isArray(values)) return []

  const sanitized = values
    .map((slot) => ({
      start: typeof slot?.start === 'string' ? slot.start.trim() : '',
      end: typeof slot?.end === 'string' ? slot.end.trim() : '',
    }))
    .filter(({ start, end }) => {
      if (!isValidTimeToken(start) || !isValidTimeToken(end)) return false
      const startMinutes = timeTokenToMinutes(start)
      const endMinutes = timeTokenToMinutes(end)
      if (startMinutes === null || endMinutes === null) return false
      return endMinutes > startMinutes
    })

  sanitized.sort((a, b) => {
    const startA = timeTokenToMinutes(a.start) ?? 0
    const startB = timeTokenToMinutes(b.start) ?? 0
    return startA - startB
  })

  return sanitized.slice(0, MAX_BREAK_SLOTS)
}

const buildBreakScheduleValues = (periods = []) => {
  const normalized = normalizeBreakSchedule(periods)
  return Array.from({ length: MAX_BREAK_SLOTS }, (_, index) => ({
    start: normalized[index]?.start ?? '',
    end: normalized[index]?.end ?? '',
  }))
}

const areBreakSchedulesEqual = (a = [], b = []) => {
  if (a.length !== b.length) return false
  return a.every((slot, index) => slot.start === b[index]?.start && slot.end === b[index]?.end)
}

const buildInitialBreakScheduleModalState = () => ({
  show: false,
  day: null,
  values: buildBreakScheduleValues(),
  initialNormalized: [],
})

const EmployeeDashboardPage = () => {
  const { user } = useAuth()
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [viewMode, setViewMode] = useState(VIEW_MODES.LIST)
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
  const [pickerOpenKey, setPickerOpenKey] = useState({ clockIn: 0, clockOut: 0 })
  const [breakModal, setBreakModal] = useState({ show: false, day: null, value: '' })
  const [descriptionModal, setDescriptionModal] = useState({ show: false, day: null, value: '' })
  const [savingBreak, setSavingBreak] = useState(false)
  const [savingDescription, setSavingDescription] = useState(false)
  const [breakScheduleModal, setBreakScheduleModal] = useState(() => buildInitialBreakScheduleModalState())
  const [savingBreakSchedule, setSavingBreakSchedule] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [defaultBreakSchedule, setDefaultBreakSchedule] = useState({ periods: [], effectiveFrom: null })

  const toInputValue = (value) => {
    const date = timestampToDate(value)
    return date ? format(date, 'HH:mm') : ''
  }

  useEffect(() => {
    setClockInInput(toInputValue(attendanceRecord?.clockIn))
    setClockOutInput(toInputValue(attendanceRecord?.clockOut))
    setBreakMinutes(attendanceRecord?.breakMinutes ?? 60)
    setWorkDescription(attendanceRecord?.workDescription ?? '')
  }, [attendanceRecord])

  useEffect(() => {
    if (!user?.uid) {
      setDefaultBreakSchedule({ periods: [], effectiveFrom: null })
      return undefined
    }

    let cancelled = false

    const loadDefaultSchedule = async () => {
      try {
        const profile = await getUserProfile(user.uid)
        if (cancelled) return
        const schedule = profile?.attendancePreferences?.breakSchedule ?? null
        const normalizedPeriods = schedule?.periods ? normalizeBreakSchedule(schedule.periods) : []
        setDefaultBreakSchedule({
          periods: normalizedPeriods,
          effectiveFrom: schedule?.effectiveFrom ?? null,
        })
      } catch (loadError) {
        console.error('Failed to load default break schedule', loadError)
        if (!cancelled) {
          setDefaultBreakSchedule({ periods: [], effectiveFrom: null })
        }
      }
    }

    loadDefaultSchedule()

    return () => {
      cancelled = true
    }
  }, [user?.uid])

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

  const hasClockIn = Boolean(attendanceRecord?.clockIn || clockInInput)

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

  const breakScheduleHistory = useMemo(() => {
    return monthlyRecords
      .map((record) => ({
        workDate: record?.workDate ?? '',
        periods: normalizeBreakSchedule(record?.breakPeriods ?? []),
      }))
      .filter((entry) => entry.workDate && entry.periods.length > 0)
      .sort((a, b) => {
        if (a.workDate === b.workDate) return 0
        return a.workDate > b.workDate ? -1 : 1
      })
  }, [monthlyRecords])

  const monthDays = useMemo(() => {
    const start = startOfMonth(calendarMonth)
    const end = endOfMonth(calendarMonth)
    return eachDayOfInterval({ start, end })
  }, [calendarMonth])

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

  const selectedDateLabel = formatWithLocale(selectedDate, 'M月d日(E)')
  const calendarMonthLabel = formatWithLocale(calendarMonth, 'yyyy年M月')

  const clockInputControls = (
    <>
      <Form.Group controlId="clockInTime">
        <Form.Label className="mb-1">出勤入力</Form.Label>
        <ClockTimePicker
          value={clockInInput}
          onChange={handleClockInChange}
          disabled={savingClockIn}
          openRequestKey={pickerOpenKey.clockIn}
        />
      </Form.Group>

      <Form.Group controlId="clockOutTime">
        <Form.Label className="mb-1">退勤入力</Form.Label>
        <ClockTimePicker
          value={clockOutInput}
          onChange={handleClockOutChange}
          disabled={!hasClockIn || savingClockOut}
          openRequestKey={pickerOpenKey.clockOut}
        />
      </Form.Group>
    </>
  )

  const handleSelectDate = (day) => {
    setSelectedDate(day)
    if (!isSameMonth(day, calendarMonth)) {
      setCalendarMonth(startOfMonth(day))
    }
  }

  const handleMonthChange = (offset) => {
    const next = startOfMonth(addMonths(calendarMonth, offset))
    setCalendarMonth(next)
    // 現在の選択日が同月にない場合は月初に変更
    setSelectedDate((current) => (isSameMonth(current, next) ? current : next))
    setPickerOpenKey({ clockIn: 0, clockOut: 0 })
  }

  const focusField = (fieldId) => {
    window.requestAnimationFrame(() => {
      const element = document.getElementById(fieldId)
      element?.focus()
    })
  }

  const requestOpenPicker = (target) => {
    setPickerOpenKey((prev) => ({
      ...prev,
      [target]: prev[target] + 1,
    }))
  }

  const handleListCellAction = (day, target) => {
    setSelectedDate(day)
    if (!isSameMonth(day, calendarMonth)) {
      setCalendarMonth(startOfMonth(day))
    }

    const key = format(day, 'yyyy-MM-dd')
    const record = recordsByDate[key]

    switch (target) {
      case 'clockIn':
        setClockInInput(toInputValue(record?.clockIn))
        requestOpenPicker('clockIn')
        break
      case 'clockOut':
        setClockOutInput(toInputValue(record?.clockOut))
        requestOpenPicker('clockOut')
        break
      case 'break':
        if (viewMode === VIEW_MODES.LIST) {
          setBreakModal({ show: true, day, value: record?.breakMinutes ?? '' })
        } else {
          focusField('breakMinutes')
        }
        break
      case 'description':
        if (viewMode === VIEW_MODES.LIST) {
          setDescriptionModal({ show: true, day, value: record?.workDescription ?? '' })
        } else {
          focusField('workDescription')
        }
        break
      default:
        break
    }
  }

  const formatDateKey = (date) => format(date, 'yyyy-MM-dd')

  const findMostRecentBreakPeriods = (dateKey) => {
    if (!dateKey) return []
    for (const entry of breakScheduleHistory) {
      if (!entry.workDate) continue
      if (entry.workDate <= dateKey) {
        return entry.periods
      }
    }
    return breakScheduleHistory[0]?.periods ?? []
  }

  const handleBreakScheduleModalClose = () => {
    setBreakScheduleModal(buildInitialBreakScheduleModalState())
  }

  const handleOpenBreakScheduleModal = (day) => {
    setError('')
    setSuccess('')
    setSelectedDate(day)
    if (!isSameMonth(day, calendarMonth)) {
      setCalendarMonth(startOfMonth(day))
    }
    const key = formatDateKey(day)
    const record = recordsByDate[key]
    const normalizedRecordPeriods = normalizeBreakSchedule(record?.breakPeriods ?? [])
    const dateKey = formatDateKey(day)
    const defaultApplicable =
      normalizedRecordPeriods.length === 0 &&
      defaultBreakSchedule.periods.length > 0 &&
      (!defaultBreakSchedule.effectiveFrom || defaultBreakSchedule.effectiveFrom <= dateKey)
    const hasClockTimes = Boolean(record?.clockIn || record?.clockOut)

    let initialPeriods = normalizedRecordPeriods

    if (initialPeriods.length === 0) {
      if (!hasClockTimes) {
        const recentPeriods = findMostRecentBreakPeriods(dateKey)
        if (recentPeriods.length > 0) {
          initialPeriods = recentPeriods
        } else if (defaultApplicable) {
          initialPeriods = defaultBreakSchedule.periods
        }
      } else if (defaultApplicable) {
        initialPeriods = defaultBreakSchedule.periods
      }
    }

    const initialNormalized = normalizeBreakSchedule(initialPeriods)
    setBreakScheduleModal({
      show: true,
      day,
      values: buildBreakScheduleValues(initialNormalized),
      initialNormalized,
    })
  }

  const handleBreakScheduleFieldChange = (index, field, value) => {
    if (!['start', 'end'].includes(field)) return
    setBreakScheduleModal((prev) => {
      const nextValues = prev.values.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, [field]: value } : slot,
      )
      return { ...prev, values: nextValues }
    })
  }

  const validateBreakSchedule = (values) => {
    for (let index = 0; index < values.length; index += 1) {
      const slot = values[index]
      const hasStart = Boolean(slot.start)
      const hasEnd = Boolean(slot.end)
      if (hasStart !== hasEnd) {
        return `休憩時間${index + 1}の開始と終了時刻を両方入力してください。`
      }
      if (hasStart && hasEnd) {
        if (!isValidTimeToken(slot.start) || !isValidTimeToken(slot.end)) {
          return `休憩時間${index + 1}の時刻はHH:MM形式で入力してください。`
        }
        const startMinutes = timeTokenToMinutes(slot.start)
        const endMinutes = timeTokenToMinutes(slot.end)
        if (startMinutes !== null && endMinutes !== null && endMinutes <= startMinutes) {
          return `休憩時間${index + 1}は終了時刻を開始時刻より後に設定してください。`
        }
      }
    }
    return null
  }

  const handleBreakScheduleSave = async () => {
    if (!user?.uid || !breakScheduleModal.day) return

    const validationMessage = validateBreakSchedule(breakScheduleModal.values)
    if (validationMessage) {
      setError(validationMessage)
      return
    }

    const normalized = normalizeBreakSchedule(breakScheduleModal.values)
    if (areBreakSchedulesEqual(normalized, breakScheduleModal.initialNormalized)) {
      handleBreakScheduleModalClose()
      return
    }

    setSavingBreakSchedule(true)
    setError('')
    setSuccess('')
    const workDateKey = formatDateKey(breakScheduleModal.day)

    try {
      await updateBreakScheduleRange(user.uid, workDateKey, normalized)

      if (formatDateKey(selectedDate) === workDateKey) {
        setBreakMinutes(calculateBreakMinutesFromPeriods(normalized))
      }

      setDefaultBreakSchedule({ periods: normalized, effectiveFrom: workDateKey })

      const messageLabel = format(breakScheduleModal.day, 'yyyy/MM/dd')
      setSuccess(`${messageLabel}以降の休憩時間が設定されました。`)
      handleBreakScheduleModalClose()
    } catch (updateError) {
      setError(updateError.message)
    } finally {
      setSavingBreakSchedule(false)
    }
  }

  const handleBreakModalClose = () => setBreakModal({ show: false, day: null, value: '' })
  const handleDescriptionModalClose = () => setDescriptionModal({ show: false, day: null, value: '' })

  const handleBreakModalSave = async () => {
    if (!user?.uid || !breakModal.day) return
    setSavingBreak(true)
    setError('')
    setSuccess('')
    const workDateKey = formatDateKey(breakModal.day)
    try {
      await updateAttendanceDetails(user.uid, workDateKey, {
        breakMinutes: Number(breakModal.value ?? 0),
      })
      if (formatDateKey(selectedDate) === workDateKey) {
        setBreakMinutes(Number(breakModal.value ?? 0))
      }
      setSuccess(`${formatWithLocale(breakModal.day, 'M月d日(E)')}の休憩時間を保存しました。`)
      handleBreakModalClose()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSavingBreak(false)
    }
  }

  const handleDescriptionModalSave = async () => {
    if (!user?.uid || !descriptionModal.day) return
    setSavingDescription(true)
    setError('')
    setSuccess('')
    const workDateKey = formatDateKey(descriptionModal.day)
    try {
      await updateAttendanceDetails(user.uid, workDateKey, {
        workDescription: descriptionModal.value ?? '',
      })
      if (formatDateKey(selectedDate) === workDateKey) {
        setWorkDescription(descriptionModal.value ?? '')
      }
      setSuccess(`${formatWithLocale(descriptionModal.day, 'M月d日(E)')}の勤務内容を保存しました。`)
      handleDescriptionModalClose()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSavingDescription(false)
    }
  }

  return (
    <Stack gap={3}>
      <div>
        <h2 className="h5 fw-bold mb-1">今日の勤怠状況</h2>
        <p className="text-muted small mb-0">カレンダーから日付を選び、出勤・退勤時刻を入力できます。</p>
      </div>

      <Nav
        variant="tabs"
        activeKey={viewMode}
        onSelect={(key) => {
          if (key) setViewMode(key)
        }}
        className="align-self-start"
      >
        <Nav.Item>
          <Nav.Link eventKey={VIEW_MODES.LIST}>一覧</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey={VIEW_MODES.CALENDAR}>カレンダー</Nav.Link>
        </Nav.Item>
      </Nav>

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

      {viewMode === VIEW_MODES.CALENDAR && (
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
                          <div>{formatWithLocale(day, 'd')}</div>
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
      )}

      {viewMode === VIEW_MODES.LIST && (
        <div style={{ display: 'none' }}>
          <Form>{clockInputControls}</Form>
        </div>
      )}

      {viewMode === VIEW_MODES.LIST && (
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

            <div className="table-responsive">
              <Table bordered hover className="mb-0 align-middle text-nowrap">
                <thead className="table-light">
                  <tr>
                    <th>日付</th>
                    <th>出勤</th>
                    <th>退勤</th>
                    <th>休憩(分)</th>
                    <th>勤務内容</th>
                    <th>休憩時間</th>
                  </tr>
                </thead>
                <tbody>
                  {monthDays.map((day) => {
                    const key = format(day, 'yyyy-MM-dd')
                    const record = recordsByDate[key]
                    const isSelected = isSameDay(day, selectedDate)

                    return (
                      <tr key={key} className={isSelected ? 'table-primary' : ''}>
                        <td role="button" onClick={() => handleListCellAction(day, 'date')}>
                          {formatWithLocale(day, 'd日(E)')}
                        </td>
                        <td
                          role="button"
                          onClick={() => handleListCellAction(day, 'clockIn')}
                          className="text-primary"
                        >
                          {record?.clockIn ? formatTime(record.clockIn) : '--:--'}
                        </td>
                        <td
                          role="button"
                          onClick={() => handleListCellAction(day, 'clockOut')}
                          className="text-primary"
                        >
                          {record?.clockOut ? formatTime(record.clockOut) : '--:--'}
                        </td>
                        <td
                          role="button"
                          onClick={() => handleListCellAction(day, 'break')}
                          className="text-primary"
                        >
                          {record?.breakMinutes ?? '-'}
                        </td>
                        <td
                          role="button"
                          onClick={() => handleListCellAction(day, 'description')}
                          className="text-primary"
                          style={{ maxWidth: 240 }}
                        >
                          <span className="d-inline-block text-truncate" style={{ maxWidth: 220 }}>
                            {record?.workDescription ?? '-'}
                          </span>
                        </td>
                        <td>
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation()
                              handleOpenBreakScheduleModal(day)
                            }}
                          >
                            設定
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            </div>
          </Card.Body>
        </Card>
      )}

      {viewMode === VIEW_MODES.CALENDAR && (
        <>
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
                  <Form className="d-flex flex-column gap-3">{clockInputControls}</Form>
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
        </>
      )}

      <Modal show={breakScheduleModal.show} onHide={handleBreakScheduleModalClose} centered>
        <Modal.Header closeButton>
          <Modal.Title>{formatWithLocale(breakScheduleModal.day ?? selectedDate, 'M月d日(E)')}の休憩時間</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="d-flex flex-column gap-3">
            {breakScheduleModal.values.map((slot, index) => (
              <Row key={index} className="g-3 align-items-start">
                <Col xs={12} md={4} className="d-flex align-items-center">
                  <span className="fw-semibold">休憩時間{index + 1}</span>
                </Col>
                <Col xs={6} md={4}>
                  <Form.Group controlId={`break-start-${index}`}>
                    <Form.Label className="small mb-1">開始</Form.Label>
                    <ClockTimePicker
                      value={slot.start}
                      onChange={(value) => handleBreakScheduleFieldChange(index, 'start', value)}
                      disabled={savingBreakSchedule}
                      minuteStep={5}
                      label={`休憩時間${index + 1}の開始時刻`}
                    />
                  </Form.Group>
                </Col>
                <Col xs={6} md={4}>
                  <Form.Group controlId={`break-end-${index}`}>
                    <Form.Label className="small mb-1">終了</Form.Label>
                    <ClockTimePicker
                      value={slot.end}
                      onChange={(value) => handleBreakScheduleFieldChange(index, 'end', value)}
                      disabled={savingBreakSchedule}
                      minuteStep={5}
                      label={`休憩時間${index + 1}の終了時刻`}
                    />
                  </Form.Group>
                </Col>
              </Row>
            ))}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={handleBreakScheduleModalClose}
            disabled={savingBreakSchedule}
          >
            キャンセル
          </Button>
          <Button variant="primary" onClick={handleBreakScheduleSave} disabled={savingBreakSchedule}>
            {savingBreakSchedule ? '保存中…' : '保存'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={breakModal.show} onHide={handleBreakModalClose} centered>
        <Modal.Header closeButton>
          <Modal.Title>{formatWithLocale(breakModal.day ?? selectedDate, 'M月d日(E)')}の休憩時間</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group controlId="breakMinutesModal">
            <Form.Label>休憩時間（分）</Form.Label>
            <Form.Control
              type="number"
              min={0}
              step={15}
              value={breakModal.value}
              onChange={(event) =>
                setBreakModal((prev) => ({ ...prev, value: event.target.value }))
              }
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={handleBreakModalClose} disabled={savingBreak}>
            キャンセル
          </Button>
          <Button variant="primary" onClick={handleBreakModalSave} disabled={savingBreak}>
            {savingBreak ? '保存中…' : '保存'}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={descriptionModal.show} onHide={handleDescriptionModalClose} centered>
        <Modal.Header closeButton>
          <Modal.Title>{formatWithLocale(descriptionModal.day ?? selectedDate, 'M月d日(E)')}の勤務内容</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group controlId="workDescriptionModal">
            <Form.Label>勤務内容</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={descriptionModal.value}
              onChange={(event) =>
                setDescriptionModal((prev) => ({ ...prev, value: event.target.value }))
              }
              placeholder="作業内容を入力"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="outline-secondary"
            onClick={handleDescriptionModalClose}
            disabled={savingDescription}
          >
            キャンセル
          </Button>
          <Button variant="primary" onClick={handleDescriptionModalSave} disabled={savingDescription}>
            {savingDescription ? '保存中…' : '保存'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Stack>
  )
}

export default EmployeeDashboardPage
