import { useState, useEffect } from 'react'
import { X, FileSpreadsheet } from 'lucide-react'
import * as XLSX from 'xlsx'

interface FindingsModalProps {
  isOpen: boolean
  onClose: () => void
  excelUrl: string
  title: string
}

export function FindingsModal({ isOpen, onClose, excelUrl, title }: FindingsModalProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sheets, setSheets] = useState<string[]>([])
  const [activeSheet, setActiveSheet] = useState<string>('')
  const [sheetData, setSheetData] = useState<Record<string, any[][]>>({})

  useEffect(() => {
    setSheets([])
    setSheetData({})
    setError(null)
  }, [excelUrl])

  useEffect(() => {
    if (isOpen && excelUrl && !sheets.length && !error) {
      setLoading(true)
      fetch(excelUrl)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
          return res.arrayBuffer()
        })
        .then((ab) => {
          try {
            const wb = XLSX.read(ab, { type: 'array', cellDates: true })
            const newSheetData: Record<string, any[][]> = {}
            let sheetNames = wb.SheetNames

            // Sort sheets: Overview first, ANN elements last
            sheetNames.sort((a, b) => {
              const aLower = a.toLowerCase()
              const bLower = b.toLowerCase()
              if (aLower === 'overview') return -1
              if (bLower === 'overview') return 1
              if (aLower.includes('ann') && !bLower.includes('ann')) return 1
              if (!aLower.includes('ann') && bLower.includes('ann')) return -1
              return 0
            })

            sheetNames.forEach((name) => {
              const ws = wb.Sheets[name]
              const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false }) as any[][]
              newSheetData[name] = data
            })
            setSheetData(newSheetData)
            setSheets(sheetNames)
            if (sheetNames.length > 0) {
              setActiveSheet(sheetNames[0])
            }
            setLoading(false)
          } catch (e: any) {
            console.error("Excel parse error:", e)
            setError(e.message || "Failed to parse Excel file")
            setLoading(false)
          }
        })
        .catch((err) => {
          console.error("Error fetching Excel file:", err)
          setError(err.message || "Failed to load Excel file")
          setLoading(false)
        })
    }
  }, [isOpen, excelUrl, sheets.length, error])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 transition-all bg-black/50 backdrop-blur-sm">
      <div className="bg-background rounded-xl shadow-2xl border w-full max-w-7xl max-h-[90vh] flex flex-col overflow-hidden opacity-100">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b shrink-0 bg-background">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-primary/10 rounded-lg shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold truncate">{title} Findings Data</h2>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">
                 Raw Excel Data View
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0 bg-background">
          {loading ? (
            <div className="flex items-center justify-center p-12 h-full">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="text-muted-foreground">Loading Excel data...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center p-12 h-full">
              <div className="bg-destructive/10 text-destructive px-6 py-4 rounded-lg flex flex-col items-center gap-2 text-center max-w-md">
                <p className="font-bold">Error loading data</p>
                <p className="text-sm">{error}</p>
                <button 
                  onClick={() => { setError(null); setLoading(true); }}
                  className="mt-4 px-4 py-2 bg-background border rounded-md text-foreground hover:bg-muted transition"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex overflow-x-auto border-b px-2 sm:px-4 shrink-0 bg-muted/10">
                {sheets.map((sheet) => {
                  const isActive = activeSheet === sheet;
                  return (
                    <button
                      key={sheet}
                      onClick={() => setActiveSheet(sheet)}
                      className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors focus:outline-none ${
                        isActive
                          ? 'border-primary text-primary'
                          : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
                      }`}
                    >
                      {sheet}
                    </button>
                  );
                })}
              </div>

              {/* Data Table */}
              <div className="flex-1 overflow-hidden p-4 flex flex-col bg-muted/5 relative">
                {sheetData[activeSheet] && sheetData[activeSheet].length > 0 ? (
                  <div className="bg-card border rounded-lg overflow-hidden flex-1 flex flex-col shadow-sm">
                    <div className="overflow-auto flex-1">
                      <table className="w-full text-sm text-left border-collapse min-w-max">
                        <thead className="bg-muted text-muted-foreground uppercase sticky top-0 z-10 shadow-sm border-b">
                          <tr>
                            {sheetData[activeSheet][0].map((header: any, idx: number) => (
                              <th key={idx} className="px-4 py-3 font-semibold border-r last:border-r-0 max-w-[300px] truncate bg-muted">
                                {header?.toString() || ''}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y relative z-0">
                          {sheetData[activeSheet].slice(1).map((row: any[], rowIdx: number) => {
                            if (!row || row.length === 0 || row.every(cell => cell === undefined || cell === null || cell === '')) {
                              return null;
                            }
                            return (
                              <tr key={rowIdx} className="hover:bg-muted/30 transition-colors group">
                                {Array.from({ length: sheetData[activeSheet][0].length }).map((_, colIdx) => {
                                  const cellValue = row[colIdx];
                                  const displayValue = cellValue?.toString() || '';
                                  return (
                                    <td key={colIdx} className="px-4 py-2 border-r last:border-r-0 whitespace-nowrap overflow-hidden text-ellipsis max-w-[400px] group-hover:text-foreground text-muted-foreground">
                                      {displayValue}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center p-12 text-muted-foreground bg-card border rounded-lg">
                    No data found in this sheet.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
