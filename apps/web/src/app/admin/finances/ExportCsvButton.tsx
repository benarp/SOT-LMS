'use client'

export type FinanceRow = {
  name: string
  email: string
  status: string
  depositPaid: string
  collected: string
  outstanding: string
  cyclesPaid: string
}

export default function ExportCsvButton({ rows, yearName }: { rows: FinanceRow[]; yearName: string }) {
  function download() {
    const header = ['Student', 'Email', 'Status', 'Deposit paid', 'Collected', 'Outstanding', 'Months paid']
    const lines = [
      header.join(','),
      ...rows.map(r =>
        [r.name, r.email, r.status, r.depositPaid, r.collected, r.outstanding, r.cyclesPaid]
          .map(v => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      ),
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `sot-billing-${yearName.replace(/[^\w-]+/g, '-')}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <button
      onClick={download}
      className="text-xs text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:border-gray-400 transition-colors"
    >
      Export CSV
    </button>
  )
}
