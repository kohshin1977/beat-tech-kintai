import { Badge, Card, Col, Row, Table } from 'react-bootstrap'
import useAdminDashboard from '../../hooks/useAdminDashboard.js'
import {
  minutesToDuration,
  formatActualWorkDuration,
  minutesToHourMinute,
  formatYearMonth,
} from '../../utils/time.js'

const AdminDashboardPage = () => {
  const {
    stats,
    workingEmployees,
    completedEmployees,
    notStartedEmployees,
    overtimeEmployees,
    monthlySummaryRows,
  } = useAdminDashboard()
  const monthLabel = formatYearMonth(new Date())

  const renderEmployeeRow = (item) => (
    <tr key={item.userId}>
      <td>
        <div className="fw-semibold">{item.name}</div>
        <div className="text-muted small">{item.department}</div>
      </td>
      <td>{item.clockInLabel ?? '--:--'}</td>
      <td>{item.clockOutLabel ?? '--:--'}</td>
      <td className="text-end">{minutesToHourMinute(item.breakMinutes)}</td>
      <td className="text-end">
        {formatActualWorkDuration(item.clockIn, item.clockOut, item.breakMinutes, item.breakPeriods)}
      </td>
      <td className="text-end">{minutesToDuration(item.totalMinutes ?? 0)}</td>
      <td className="text-end">
        <Badge bg={item.overtimeMinutes > 0 ? 'danger' : 'secondary'}>
          {minutesToDuration(item.overtimeMinutes ?? 0)}
        </Badge>
      </td>
    </tr>
  )

  return (
    <div className="d-flex flex-column gap-3">
      <div>
        <h2 className="h5 fw-bold mb-1">リアルタイムダッシュボード</h2>
        <p className="text-muted small mb-0">勤務状況をリアルタイムで確認できます。</p>
      </div>

      <Row className="g-3">
        <Col md={3} sm={6} xs={12}>
          <Card className="shadow-sm text-center">
            <Card.Body>
              <p className="text-muted small mb-1">社員数</p>
              <h3 className="h4 mb-0">{stats.total}</h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6} xs={12}>
          <Card className="shadow-sm text-center">
            <Card.Body>
              <p className="text-muted small mb-1">勤務中</p>
              <h3 className="h4 mb-0">{stats.working}</h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6} xs={12}>
          <Card className="shadow-sm text-center">
            <Card.Body>
              <p className="text-muted small mb-1">退勤済み</p>
              <h3 className="h4 mb-0">{stats.completed}</h3>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} sm={6} xs={12}>
          <Card className="shadow-sm text-center">
            <Card.Body>
              <p className="text-muted small mb-1">未出勤</p>
              <h3 className="h4 mb-0">{stats.notStarted}</h3>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="shadow-sm">
        <Card.Header className="fw-semibold">月次勤務時間（{monthLabel}）</Card.Header>
        <Card.Body className="p-0">
          <Table responsive hover className="mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>社員</th>
                <th>部署</th>
                <th className="text-end">勤務時間合計</th>
              </tr>
            </thead>
            <tbody>
              {monthlySummaryRows.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-muted py-4">
                    月次集計データがありません。
                  </td>
                </tr>
              )}
              {monthlySummaryRows.map((item) => (
                <tr key={item.userId}>
                  <td>{item.name}</td>
                  <td>{item.department}</td>
                  <td className="text-end">{minutesToDuration(item.totalMinutes)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Row className="g-3">
        <Col xs={12} xl={6}>
          <Card className="shadow-sm">
            <Card.Header className="fw-semibold">勤務中の社員</Card.Header>
            <Card.Body className="p-0">
              <Table responsive hover className="mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th>社員</th>
                    <th>出勤</th>
                    <th>退勤</th>
                    <th className="text-end">休憩</th>
                    <th className="text-end">実働</th>
                    <th className="text-end">勤務</th>
                    <th className="text-end">残業</th>
                  </tr>
                </thead>
                <tbody>
                  {workingEmployees.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center text-muted py-4">
                        勤務中の社員はいません。
                      </td>
                    </tr>
                  )}
                  {workingEmployees.map((item) => renderEmployeeRow(item))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} xl={6}>
          <Card className="shadow-sm">
            <Card.Header className="fw-semibold">退勤済みの社員</Card.Header>
            <Card.Body className="p-0">
              <Table responsive hover className="mb-0 align-middle">
                <thead className="table-light">
                  <tr>
                    <th>社員</th>
                    <th>出勤</th>
                    <th>退勤</th>
                    <th className="text-end">休憩</th>
                    <th className="text-end">実働</th>
                    <th className="text-end">勤務</th>
                    <th className="text-end">残業</th>
                  </tr>
                </thead>
                <tbody>
                  {completedEmployees.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center text-muted py-4">
                        退勤済みの社員はいません。
                      </td>
                    </tr>
                  )}
                  {completedEmployees.map((item) => renderEmployeeRow(item))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="shadow-sm">
        <Card.Header className="fw-semibold">今日の残業超過者</Card.Header>
        <Card.Body className="p-0">
          <Table responsive hover className="mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>社員</th>
                <th>出勤</th>
                <th>退勤</th>
                <th className="text-end">勤務時間</th>
                <th className="text-end">残業時間</th>
              </tr>
            </thead>
            <tbody>
              {overtimeEmployees.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-4">
                    残業超過者はいません。
                  </td>
                </tr>
              )}
              {overtimeEmployees.map((item) => (
                <tr key={item.userId}>
                  <td>
                    <div className="fw-semibold">{item.name}</div>
                    <div className="text-muted small">{item.department}</div>
                  </td>
                  <td>{item.clockInLabel ?? '--:--'}</td>
                  <td>{item.clockOutLabel ?? '--:--'}</td>
                  <td className="text-end">{minutesToDuration(item.totalMinutes ?? 0)}</td>
                  <td className="text-end">
                    <Badge bg="danger">{minutesToDuration(item.overtimeMinutes ?? 0)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Card className="shadow-sm">
        <Card.Header className="fw-semibold">未出勤の社員</Card.Header>
        <Card.Body className="p-0">
          <Table responsive hover className="mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>社員</th>
                <th>部署</th>
              </tr>
            </thead>
            <tbody>
              {notStartedEmployees.length === 0 && (
                <tr>
                  <td colSpan={2} className="text-center text-muted py-4">
                    未出勤の社員はいません。
                  </td>
                </tr>
              )}
              {notStartedEmployees.map((item) => (
                <tr key={item.userId}>
                  <td>{item.name}</td>
                  <td>{item.department}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </div>
  )
}

export default AdminDashboardPage
