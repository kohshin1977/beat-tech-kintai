import { useEffect, useMemo, useState } from 'react'
import { Button, ButtonGroup, Card, Form, Table } from 'react-bootstrap'
import { format, parseISO } from 'date-fns'
import {
  getMonthlyAttendanceRange,
  listenToAllMonthlySummaries,
} from '../../services/attendanceService.js'
import { fetchAllUsers } from '../../services/userService.js'
import {
  buildAttendanceWorkbook,
  buildCsvContent,
  downloadCsv,
  downloadWorkbook,
} from '../../services/exportService.js'
import { minutesToDuration } from '../../utils/time.js'
import { formatTime } from '../../utils/time.js'

const AdminExportPage = () => {
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [employees, setEmployees] = useState([])
  const [summaries, setSummaries] = useState([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setLoading(true)
    fetchAllUsers()
      .then((rows) => setEmployees(rows.filter((row) => row.role === 'employee')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const stop = listenToAllMonthlySummaries(selectedMonth, (rows) => setSummaries(rows))
    return () => stop?.()
  }, [selectedMonth])

  const mergedSummaries = useMemo(() => {
    const summaryMap = new Map(summaries.map((row) => [row.userId, row]))
    return employees
      .filter((employee) => employee.role === 'employee')
      .map((employee) => {
        const summary = summaryMap.get(employee.id)
        return {
          userId: employee.id,
          name: employee.name,
          department: employee.department,
          totalMinutes: summary?.totalMinutes ?? 0,
          overtimeMinutes: summary?.overtimeMinutes ?? 0,
        }
      })
      .sort((a, b) => a.department.localeCompare(b.department, 'ja') || a.name.localeCompare(b.name, 'ja'))
  }, [employees, summaries])

  const totals = useMemo(
    () =>
      mergedSummaries.reduce(
        (acc, item) => {
          acc.totalMinutes += item.totalMinutes
          acc.overtimeMinutes += item.overtimeMinutes
          return acc
        },
        { totalMinutes: 0, overtimeMinutes: 0 },
      ),
    [mergedSummaries],
  )

  const buildSheetName = (employee) => {
    const base = `${employee.name || '社員'}_${employee.department || '部署'}`
    return base.replace(/[^\p{L}\p{N}_-]/gu, '_')
  }

  const handleExport = async (type) => {
    if (exporting) return
    setExporting(true)
    setMessage('')
    try {
      const monthLabel = format(parseISO(`${selectedMonth}-01`), 'yyyy年M月')
      const detailsEntries = await Promise.all(
        mergedSummaries.map(async (employee) => {
          const records = await getMonthlyAttendanceRange(employee.userId, selectedMonth)
          const normalised = records.map((record) => ({
            ...record,
            clockInLabel: formatTime(record.clockIn),
            clockOutLabel: formatTime(record.clockOut),
          }))
          return { employee, records: normalised }
        }),
      )
      const detailsMap = new Map(
        detailsEntries.map(({ employee, records }) => [buildSheetName(employee), records]),
      )

      if (type === 'xlsx') {
        const workbook = buildAttendanceWorkbook({
          monthLabel,
          summaries: mergedSummaries,
          dailyDetails: detailsMap,
        })
        downloadWorkbook(workbook, `勤怠_${selectedMonth}.xlsx`)
        setMessage('Excelファイルを生成しました。')
      } else {
        const flatRecords = detailsEntries.flatMap(({ employee, records }) =>
          records.map((record) => ({
            ...record,
            userId: employee.userId,
            name: employee.name,
            department: employee.department,
          })),
        )
        const csv = buildCsvContent(flatRecords)
        downloadCsv(csv, `勤怠_${selectedMonth}.csv`)
        setMessage('CSVファイルを生成しました。')
      }
    } catch (error) {
      console.error('Export failed', error)
      setMessage('エクスポート中にエラーが発生しました。')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="d-flex flex-column gap-3">
      <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
        <div>
          <h2 className="h5 fw-bold mb-1">勤怠データ エクスポート</h2>
          <p className="text-muted small mb-0">月次サマリーと日次データをExcelまたはCSV形式で出力できます。</p>
        </div>
        <Form.Group className="d-flex align-items-center gap-2 mb-0">
          <Form.Label className="mb-0">対象月</Form.Label>
          <Form.Select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
            {Array.from({ length: 12 }).map((_, index) => {
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
        </Form.Group>
      </div>

      <Card className="shadow-sm">
        <Card.Body className="d-flex flex-wrap gap-4">
          <div>
            <p className="text-muted small mb-1">社員数</p>
            <h3 className="h5 mb-0">{mergedSummaries.length}</h3>
          </div>
          <div>
            <p className="text-muted small mb-1">勤務時間合計</p>
            <h3 className="h5 mb-0">{minutesToDuration(totals.totalMinutes)}</h3>
          </div>
          <div>
            <p className="text-muted small mb-1">残業時間合計</p>
            <h3 className="h5 mb-0">{minutesToDuration(totals.overtimeMinutes)}</h3>
          </div>
          <div className="ms-auto">
            <ButtonGroup>
              <Button variant="outline-primary" disabled={exporting || loading} onClick={() => handleExport('csv')}>
                CSV出力
              </Button>
              <Button variant="primary" disabled={exporting || loading} onClick={() => handleExport('xlsx')}>
                Excel出力
              </Button>
            </ButtonGroup>
          </div>
        </Card.Body>
      </Card>

      {message && (
        <div className="alert alert-info py-2 mb-0" role="alert">
          {message}
        </div>
      )}

      <Card className="shadow-sm">
        <Card.Body className="p-0">
          <Table responsive hover className="mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th>社員</th>
                <th>部署</th>
                <th className="text-end">勤務時間</th>
                <th className="text-end">残業時間</th>
              </tr>
            </thead>
            <tbody>
              {mergedSummaries.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-muted py-4">
                    対象月の集計データがありません。
                  </td>
                </tr>
              )}
              {mergedSummaries.map((row) => (
                <tr key={row.userId}>
                  <td>{row.name}</td>
                  <td>{row.department}</td>
                  <td className="text-end">{minutesToDuration(row.totalMinutes)}</td>
                  <td className="text-end">{minutesToDuration(row.overtimeMinutes)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </div>
  )
}

export default AdminExportPage
