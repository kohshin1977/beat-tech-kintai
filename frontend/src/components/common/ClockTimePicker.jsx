import PropTypes from 'prop-types'
import { useEffect, useMemo, useState } from 'react'
import { Button, Form, Modal } from 'react-bootstrap'

const HOURS = Array.from({ length: 24 }, (_, index) => index)

const getMinuteValues = (step) => Array.from({ length: 60 / step }, (_, index) => index * step)

const normalizeTimeValue = (value) => {
  if (!value || typeof value !== 'string') {
    return { hour: null, minute: null }
  }

  const [hourPart, minutePart] = value.split(':').map((part) => Number.parseInt(part, 10))

  return {
    hour: Number.isInteger(hourPart) ? Math.max(0, Math.min(23, hourPart)) : null,
    minute: Number.isInteger(minutePart) ? Math.max(0, Math.min(59, minutePart)) : null,
  }
}

const getPositionStyle = (total, index, radius) => {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2
  const x = Math.cos(angle) * radius
  const y = Math.sin(angle) * radius

  return {
    position: 'absolute',
    left: `calc(50% + ${x}px)`,
    top: `calc(50% + ${y}px)`,
    transform: 'translate(-50%, -50%)',
  }
}

const formatDisplay = (value) => {
  const padded = value.toString().padStart(2, '0')
  return padded
}

const buildHourMarkers = () => {
  const outerRadius = 95
  const innerRadius = 60

  return HOURS.map((hour) => ({
    value: hour,
    radius: hour < 12 ? outerRadius : innerRadius,
    index: hour % 12,
    total: 12,
    size: hour < 12 ? 44 : 36,
  }))
}

const buildMinuteMarkers = (minuteValues) => {
  const radius = 95
  return minuteValues.map((minute, index) => ({
    value: minute,
    radius,
    index,
    total: minuteValues.length,
    size: 40,
  }))
}

const ClockFace = ({ markers, activeValue, onSelect, renderLabel }) => (
  <div className="position-relative" style={{ width: 250, height: 250 }}>
    <div
      className="position-absolute rounded-circle border border-secondary-subtle"
      style={{ inset: 5 }}
    />
    {markers.map(({ value, radius, index, total, size }) => (
      <button
        key={`${value}-${radius}`}
        type="button"
        className={`btn btn-sm ${value === activeValue ? 'btn-primary text-white' : 'btn-outline-secondary'} position-absolute`}
        style={{
          ...getPositionStyle(total, index, radius),
          width: size,
          height: size,
          borderRadius: '50%',
          padding: 0,
          fontWeight: 600,
        }}
        onClick={() => onSelect(value)}
      >
        {renderLabel(value)}
      </button>
    ))}
    <div
      className="position-absolute rounded-circle bg-body"
      style={{ width: 12, height: 12, left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
    />
  </div>
)

ClockFace.propTypes = {
  markers: PropTypes.arrayOf(
    PropTypes.shape({
      value: PropTypes.number.isRequired,
      radius: PropTypes.number.isRequired,
      index: PropTypes.number.isRequired,
      total: PropTypes.number.isRequired,
      size: PropTypes.number.isRequired,
    }),
  ).isRequired,
  activeValue: PropTypes.number,
  onSelect: PropTypes.func.isRequired,
  renderLabel: PropTypes.func.isRequired,
}

const ClockTimePicker = ({
  value,
  onChange,
  disabled = false,
  minuteStep = 5,
  label,
}) => {
  const [show, setShow] = useState(false)
  const [mode, setMode] = useState('hour')
  const [tempHour, setTempHour] = useState(null)
  const [tempMinute, setTempMinute] = useState(null)

  const minuteValues = useMemo(() => getMinuteValues(minuteStep), [minuteStep])

  useEffect(() => {
    if (!show) return

    const { hour, minute } = normalizeTimeValue(value)
    setTempHour(hour)
    setTempMinute(minuteValues.includes(minute ?? -1) ? minute : minuteValues[0])
    setMode('hour')
  }, [show, value, minuteValues])

  const displayValue = useMemo(() => {
    const { hour, minute } = normalizeTimeValue(value)
    if (hour === null || minute === null) return '--:--'
    return `${formatDisplay(hour)}:${formatDisplay(minute)}`
  }, [value])

  const handleHourSelect = (hour) => {
    setTempHour(hour)
    setMode('minute')
  }

  const handleMinuteSelect = (minute) => {
    setTempMinute(minute)
  }

  const handleConfirm = () => {
    if (tempHour === null || tempMinute === null) return
    const nextValue = `${formatDisplay(tempHour)}:${formatDisplay(tempMinute)}`
    onChange(nextValue)
    setShow(false)
  }

  const handleClear = () => {
    onChange('')
    setShow(false)
  }

  const { hour: currentHour, minute: currentMinute } = normalizeTimeValue(value)

  return (
    <div className="d-flex flex-column gap-2">
      <Form.Control
        type="text"
        readOnly
        value={displayValue}
        onClick={() => !disabled && setShow(true)}
        aria-label={label}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && !disabled) {
            event.preventDefault()
            setShow(true)
          }
        }}
        disabled={disabled}
      />
      <div className="d-flex gap-2">
        <Button variant="outline-primary" onClick={() => setShow(true)} disabled={disabled} className="flex-grow-1">
          時計で選ぶ
        </Button>
        {value && !disabled && (
          <Button variant="outline-secondary" onClick={handleClear}>
            クリア
          </Button>
        )}
      </div>

      <Modal show={show} onHide={() => setShow(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{label ?? '時刻を選択'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="text-center mb-3">
            <span className="fs-1 fw-bold">
              {formatDisplay(tempHour ?? currentHour ?? 0)}:{formatDisplay(tempMinute ?? currentMinute ?? 0)}
            </span>
          </div>

          {mode === 'hour' ? (
            <ClockFace
              markers={buildHourMarkers()}
              activeValue={tempHour ?? currentHour}
              onSelect={handleHourSelect}
              renderLabel={(hour) => formatDisplay(hour)}
            />
          ) : (
            <ClockFace
              markers={buildMinuteMarkers(minuteValues)}
              activeValue={tempMinute ?? currentMinute}
              onSelect={handleMinuteSelect}
              renderLabel={(minute) => formatDisplay(minute)}
            />
          )}

          <div className="d-flex justify-content-between gap-2 mt-4">
            <Button variant="outline-secondary" onClick={() => setMode('hour')} disabled={mode === 'hour'}>
              時刻を選び直す
            </Button>
            <div className="d-flex gap-2">
              <Button variant="outline-secondary" onClick={handleClear}>
                クリア
              </Button>
              <Button variant="primary" onClick={handleConfirm} disabled={tempHour === null || tempMinute === null}>
                決定
              </Button>
            </div>
          </div>
        </Modal.Body>
      </Modal>
    </div>
  )
}

ClockTimePicker.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  minuteStep: PropTypes.oneOf([5, 10, 15, 30]),
  label: PropTypes.string,
}

export default ClockTimePicker
