import { Card, Table } from 'react-bootstrap'
import useAdminDashboard from '../../hooks/useAdminDashboard.js'
import {
  minutesToDuration,
  formatYearMonth,
} from '../../utils/time.js'

const AdminDashboardPage = () => {
  const {
    monthlySummaryRows,
  } = useAdminDashboard()
  const monthLabel = formatYearMonth(new Date())

  return (
    <div className="d-flex flex-column gap-3">
      <div>
        <h2 className="h5 fw-bold mb-1">月次勤務時間一覧</h2>
        <p className="text-muted small mb-0">当月の勤務時間合計を確認できます。</p>
      </div>
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
    </div>
  )
}

export default AdminDashboardPage
