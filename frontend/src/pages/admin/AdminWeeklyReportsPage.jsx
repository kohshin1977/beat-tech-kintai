import { useEffect, useMemo, useState } from 'react'
import { Card, Table } from 'react-bootstrap'
import { fetchAllUsers } from '../../services/userService.js'
import { listenToAllWeeklyReports } from '../../services/weeklyReportService.js'

const AdminWeeklyReportsPage = () => {
  const [users, setUsers] = useState([])
  const [reports, setReports] = useState([])

  useEffect(() => {
    fetchAllUsers().then((rows) => setUsers(rows))
  }, [])

  useEffect(() => {
    const stop = listenToAllWeeklyReports((rows) => setReports(rows))
    return () => stop?.()
  }, [])

  const userMap = useMemo(() => {
    const map = new Map()
    users.forEach((user) => map.set(user.id, user))
    return map
  }, [users])

  const rows = useMemo(
    () =>
      reports.map((report) => {
        const user = userMap.get(report.userId)
        return {
          ...report,
          name: user?.name ?? '不明',
          department: user?.department ?? '-',
        }
      }),
    [reports, userMap],
  )

  return (
    <div className="d-flex flex-column gap-3">
      <div>
        <h2 className="h5 fw-bold mb-1">週報一覧</h2>
        <p className="text-muted small mb-0">送信済みの週報を一覧で確認できます。</p>
      </div>

      <Card className="shadow-sm">
        <Card.Body className="p-0">
          <Table responsive hover className="mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>社員</th>
                <th>部署</th>
                <th>期間</th>
                <th>週</th>
                <th>状態</th>
                <th>内容</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4">
                    週報がまだありません。
                  </td>
                </tr>
              )}
              {rows.map((report) => (
                <tr key={`${report.userId}-${report.id}`}>
                  <td>{report.name}</td>
                  <td>{report.department}</td>
                  <td>
                    {report.start}〜{report.end}
                  </td>
                  <td>{report.week ? `第${report.week}週` : '-'}</td>
                  <td>{report.status === 'submitted' ? '送信済み' : '草稿'}</td>
                  <td style={{ maxWidth: 360 }}>
                    <div className="text-truncate">{report.content ?? ''}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </div>
  )
}

export default AdminWeeklyReportsPage
