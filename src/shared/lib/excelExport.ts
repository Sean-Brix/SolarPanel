type PrimitiveCell = string | number | boolean | null | undefined

type ExportRow = Record<string, PrimitiveCell>

type DaySheet<Row extends ExportRow> = {
  dayStart: Date
  rows: Row[]
}

type WorkbookExportPayload<Row extends ExportRow> = {
  fileName: string
  overviewRows: ExportRow[]
  daySheets: DaySheet<Row>[]
}

const EXCEL_INVALID_CHARS = /[\\/?*:]|\[|\]/g

function sanitizeSheetName(name: string) {
  const cleaned = name.replace(EXCEL_INVALID_CHARS, '-').trim()
  return cleaned.length > 31 ? cleaned.slice(0, 31) : cleaned
}

function localDayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function localDayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function localDayLabel(date: Date) {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
}

function ensureUniqueSheetName(baseName: string, usedNames: Set<string>) {
  const initial = sanitizeSheetName(baseName) || 'Sheet'

  if (!usedNames.has(initial)) {
    usedNames.add(initial)
    return initial
  }

  let suffix = 2
  while (suffix < 1000) {
    const suffixLabel = ` (${suffix})`
    const candidate = sanitizeSheetName(
      `${initial.slice(0, Math.max(0, 31 - suffixLabel.length))}${suffixLabel}`,
    )
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate)
      return candidate
    }
    suffix += 1
  }

  const fallback = `${Date.now()}`
  usedNames.add(fallback)
  return fallback
}

function toCellText(value: PrimitiveCell) {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return ''
}

function applyAutoColumnWidths(sheet: unknown, rows: ExportRow[]) {
  if (!rows.length || typeof sheet !== 'object' || sheet === null) {
    return
  }

  const keys = Object.keys(rows[0])
  const widths = keys.map((key) => {
    let maxLength = key.length

    for (const row of rows) {
      const valueLength = toCellText(row[key]).length
      if (valueLength > maxLength) {
        maxLength = valueLength
      }
    }

    return {
      wch: Math.min(Math.max(maxLength + 2, 12), 80),
    }
  })

  ;(sheet as { '!cols'?: Array<{ wch: number }> })['!cols'] = widths
}

export function buildDaySheets<Row extends ExportRow>(
  rows: Row[],
  getDate: (row: Row) => Date,
): DaySheet<Row>[] {
  const grouped = new Map<string, DaySheet<Row>>()

  for (const row of rows) {
    const at = getDate(row)
    const key = localDayKey(at)
    const existing = grouped.get(key)

    if (existing) {
      existing.rows.push(row)
      continue
    }

    grouped.set(key, {
      dayStart: localDayStart(at),
      rows: [row],
    })
  }

  return [...grouped.values()]
    .sort((left, right) => right.dayStart.getTime() - left.dayStart.getTime())
    .map((sheet) => ({
      ...sheet,
      rows: [...sheet.rows].sort((left, right) => {
        const leftAt = getDate(left)
        const rightAt = getDate(right)
        return rightAt.getTime() - leftAt.getTime()
      }),
    }))
}

export async function exportWorkbookByDay<Row extends ExportRow>({
  fileName,
  overviewRows,
  daySheets,
}: WorkbookExportPayload<Row>) {
  const xlsx = await import('xlsx')
  const workbook = xlsx.utils.book_new()
  const usedNames = new Set<string>()

  const safeOverviewRows: ExportRow[] = overviewRows.length
    ? overviewRows
    : [{ Metric: 'Status', Value: 'No data' }]
  const overviewSheet = xlsx.utils.json_to_sheet(safeOverviewRows)
  applyAutoColumnWidths(overviewSheet, safeOverviewRows)
  const overviewName = ensureUniqueSheetName('Overview', usedNames)
  xlsx.utils.book_append_sheet(workbook, overviewSheet, overviewName)

  for (const daySheet of daySheets) {
    const sheetName = ensureUniqueSheetName(localDayLabel(daySheet.dayStart), usedNames)
    const rows: ExportRow[] = daySheet.rows.length ? daySheet.rows : [{ Status: 'No records' }]
    const sheet = xlsx.utils.json_to_sheet(rows)
    applyAutoColumnWidths(sheet, rows)
    xlsx.utils.book_append_sheet(workbook, sheet, sheetName)
  }

  xlsx.writeFile(workbook, fileName)
}
