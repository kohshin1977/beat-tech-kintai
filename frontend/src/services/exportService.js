import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import { minutesToDuration, minutesToHourMinute } from '../utils/time.js'

const buildMonthlySummarySheet = (summaries) => {
  const header = ['社員名', '部署', '勤務時間合計', '残業時間合計']
  const rows = summaries.map((summary) => [
    summary.name,
    summary.department,
    minutesToDuration(summary.totalMinutes),
    minutesToDuration(summary.overtimeMinutes),
  ])

  return [header, ...rows]
}

const buildDailySheet = (records) => {
  const header = ['日付', '出勤', '退勤', '休憩', '勤務時間', '残業時間', '勤務内容']
  const rows = records.map((record) => [
    record.workDate,
    record.clockInLabel,
    record.clockOutLabel,
    minutesToHourMinute(record.breakMinutes),
    minutesToDuration(record.totalMinutes),
    minutesToDuration(record.overtimeMinutes),
    record.workDescription ?? '',
  ])

  return [header, ...rows]
}

const normaliseDailyItem = (item) => ({
  workDate: item.workDate,
  clockInLabel: item.clockInLabel ?? item.clockIn,
  clockOutLabel: item.clockOutLabel ?? item.clockOut,
  breakMinutes: item.breakMinutes ?? 0,
  totalMinutes: item.totalMinutes ?? 0,
  overtimeMinutes: item.overtimeMinutes ?? 0,
  workDescription: item.workDescription ?? '',
})

export const buildAttendanceWorkbook = ({ monthLabel, summaries, dailyDetails }) => {
  const workbook = XLSX.utils.book_new()
  workbook.Props = {
    Title: `勤怠月次サマリー_${monthLabel}`,
  }

  const summarySheetData = buildMonthlySummarySheet(summaries)
  const summarySheet = XLSX.utils.aoa_to_sheet(summarySheetData)
  XLSX.utils.book_append_sheet(workbook, summarySheet, '月次サマリー')

  dailyDetails.forEach((records, sheetName) => {
    const sheetRows = buildDailySheet(records.map(normaliseDailyItem))
    const worksheet = XLSX.utils.aoa_to_sheet(sheetRows)
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31))
  })

  return workbook
}

export const downloadWorkbook = (workbook, filename) => {
  const wbout = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  const blob = new Blob([wbout], { type: 'application/octet-stream' })
  saveAs(blob, filename)
}

export const buildCsvContent = (records) => {
  const header = ['社員ID', '社員名', '部署', '日付', '出勤', '退勤', '休憩', '勤務時間(分)', '残業時間(分)', '勤務内容']
  const rows = records.map((item) => [
    item.userId,
    item.name,
    item.department,
    item.workDate,
    item.clockInLabel ?? item.clockIn,
    item.clockOutLabel ?? item.clockOut,
    minutesToHourMinute(item.breakMinutes),
    item.totalMinutes ?? 0,
    item.overtimeMinutes ?? 0,
    item.workDescription ?? '',
  ])

  return [header, ...rows]
    .map((columns) =>
      columns
        .map((value) => {
          if (value === null || value === undefined) return ''
          const stringValue = String(value)
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`
          }
          return stringValue
        })
        .join(','),
    )
    .join('\n')
}

export const downloadCsv = (csv, filename) => {
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' })
  saveAs(blob, filename)
}
