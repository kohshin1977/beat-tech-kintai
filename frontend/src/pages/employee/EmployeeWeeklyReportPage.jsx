import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Form } from 'react-bootstrap'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { saveWeeklyReport } from '../../services/weeklyReportService.js'

const EmployeeWeeklyReportPage = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [report, setReport] = useState(
    ['[作業内容]', '', '[課題と解決策]', '', '[学びと気付き]', '', '[報告・相談事項]'].join('\n'),
  )
  const [savedMessage, setSavedMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const { start, end, week } = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return {
      start: params.get('start') ?? '',
      end: params.get('end') ?? '',
      week: params.get('week') ?? '',
    }
  }, [location.search])

  const rangeLabel = start && end ? `${start} 〜 ${end}` : '対象期間未選択'
  const draftKey = useMemo(
    () => `weeklyReportDraft:${user?.uid ?? 'guest'}:${start || 'start'}:${end || 'end'}`,
    [user?.uid, start, end],
  )

  useEffect(() => {
    const saved = localStorage.getItem(draftKey)
    if (saved) {
      setReport(saved)
    }
  }, [draftKey])

  const handleDraftSave = () => {
    localStorage.setItem(draftKey, report)
    setSavedMessage('草稿を保存しました。')
    setTimeout(() => setSavedMessage(''), 2000)
  }

  const handleSubmit = async () => {
    if (!user?.uid) {
      setError('ログイン情報が取得できません。')
      return
    }
    if (!start || !end) {
      setError('週の期間が取得できません。')
      return
    }

    setError('')
    setSending(true)
    try {
      await saveWeeklyReport(user.uid, `${start}_${end}`, {
        start,
        end,
        week: Number(week) || null,
        content: report,
        status: 'submitted',
      })
      localStorage.removeItem(draftKey)
      setSavedMessage('週報を送信しました。')
      setTimeout(() => setSavedMessage(''), 2000)
    } catch (submitError) {
      console.error('Failed to submit weekly report', submitError)
      setError('送信に失敗しました。時間をおいて再度お試しください。')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="d-flex flex-column gap-3">
      <div>
        <h2 className="h5 fw-bold mb-1">週報入力</h2>
        <p className="text-muted small mb-0">
          {week ? `第${week}週` : '週'} / {rangeLabel}
        </p>
      </div>

      <Card className="shadow-sm">
        <Card.Body>
          <Form.Group controlId="weeklyReportBody">
            <Form.Label>週報</Form.Label>
            <Form.Control
              as="textarea"
              rows={8}
              value={report}
              onChange={(event) => setReport(event.target.value)}
              placeholder="今週の作業内容・成果・課題などを入力"
            />
          </Form.Group>
          {savedMessage && <div className="text-success small mt-2">{savedMessage}</div>}
          {error && <div className="text-danger small mt-2">{error}</div>}
        </Card.Body>
      </Card>

      <div className="d-flex justify-content-between">
        <Button variant="outline-secondary" onClick={() => navigate(-1)}>
          戻る
        </Button>
        <div className="d-flex gap-2">
          <Button variant="outline-primary" onClick={handleDraftSave}>
            草稿に保存
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={sending}>
            {sending ? '送信中…' : '送信'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default EmployeeWeeklyReportPage
