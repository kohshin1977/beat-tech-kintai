import { useMemo, useState } from 'react'
import { Button, Card, Form } from 'react-bootstrap'
import { useLocation, useNavigate } from 'react-router-dom'

const EmployeeWeeklyReportPage = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [report, setReport] = useState(
    ['[作業内容]', '', '[課題と解決策]', '', '[学びと気付き]', '', '[報告・相談事項]'].join('\n'),
  )

  const { start, end, week } = useMemo(() => {
    const params = new URLSearchParams(location.search)
    return {
      start: params.get('start') ?? '',
      end: params.get('end') ?? '',
      week: params.get('week') ?? '',
    }
  }, [location.search])

  const rangeLabel = start && end ? `${start} 〜 ${end}` : '対象期間未選択'

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
        </Card.Body>
      </Card>

      <div className="d-flex justify-content-between">
        <Button variant="outline-secondary" onClick={() => navigate(-1)}>
          戻る
        </Button>
        <Button variant="primary" disabled>
          保存（準備中）
        </Button>
      </div>
    </div>
  )
}

export default EmployeeWeeklyReportPage
