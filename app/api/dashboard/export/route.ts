import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getXeroTokens } from '@/lib/xero'
import { getProfitAndLossReport, getBalanceSheetReport } from '@/lib/xero-api'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv'
    const timeframe = searchParams.get('timeframe') || 'YEAR'
    const fromDate = searchParams.get('fromDate')
    const toDate = searchParams.get('toDate')

    // Get user's Xero tokens
    const tokens = await getXeroTokens(session.user.id)
    
    if (!tokens || (Array.isArray(tokens) && tokens.length === 0)) {
      return NextResponse.json({ error: 'No Xero connection found' }, { status: 400 })
    }

    const token = Array.isArray(tokens) ? tokens[0] : tokens
    const tenantId = token.tenantId

    // Get current date for calculations
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1

    // Calculate date ranges
    let fromDateStr = fromDate
    let toDateStr = toDate

    if (!fromDateStr || !toDateStr) {
      if (timeframe === 'YEAR') {
        fromDateStr = `${currentYear}-01-01`
        toDateStr = `${currentYear}-12-31`
      } else if (timeframe === 'MONTH') {
        const monthStart = new Date(currentYear, currentMonth - 1, 1)
        const monthEnd = new Date(currentYear, currentMonth, 0)
        fromDateStr = monthStart.toISOString().split('T')[0]
        toDateStr = monthEnd.toISOString().split('T')[0]
      }
    }

    // Fetch data from Xero
    const [profitLoss, balanceSheet] = await Promise.all([
      getProfitAndLossReport(session.user.id, tenantId, {
        fromDate: fromDateStr || undefined,
        toDate: toDateStr || undefined,
        standardLayout: true
      }),
      getBalanceSheetReport(session.user.id, tenantId, {
        date: toDateStr || undefined,
        standardLayout: true
      })
    ])

    // Process data for export
    const exportData = processDataForExport(profitLoss, balanceSheet, fromDateStr || '', toDateStr || '')

    if (format === 'csv') {
      const csv = generateCSV(exportData)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="financial-report-${fromDateStr}-to-${toDateStr}.csv"`
        }
      })
    } else if (format === 'json') {
      return NextResponse.json(exportData, {
        headers: {
          'Content-Disposition': `attachment; filename="financial-report-${fromDateStr}-to-${toDateStr}.json"`
        }
      })
    }

    return NextResponse.json({ error: 'Unsupported format' }, { status: 400 })

  } catch (error) {
    console.error('Error exporting data:', error)
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 })
  }
}

function processDataForExport(profitLoss: any, balanceSheet: any, fromDate: string, toDate: string) {
  const revenue = extractAccountValue(profitLoss, ['Sales', 'Revenue', 'Income', 'Total Income'])
  const expenses = extractTotalOperatingExpenses(profitLoss)
  const netProfit = extractNetProfit(profitLoss)
  
  // If we don't have net profit directly, calculate it
  const calculatedNetProfit = revenue - expenses
  const finalNetProfit = netProfit !== 0 ? netProfit : calculatedNetProfit
  const netMargin = revenue > 0 ? (finalNetProfit / revenue) * 100 : 0
  const cashBalance = extractAccountValue(balanceSheet, ['Business Bank Account', 'Business Savings Account', 'Total Bank', 'Cash', 'Bank', 'Current Assets'])
  const expenseBreakdown = extractExpenseBreakdown(profitLoss)

  return {
    period: {
      from: fromDate,
      to: toDate
    },
    summary: {
      revenue,
      expenses,
      netProfit: finalNetProfit,
      netMargin,
      cashBalance
    },
    expenseBreakdown,
    rawData: {
      profitLoss,
      balanceSheet
    }
  }
}

function extractAccountValue(report: any, accountNames: string[]): number {
  if (!report?.reports || !Array.isArray(report.reports)) {
    return 0
  }

  for (const reportData of report.reports) {
    if (reportData.rows) {
      for (const row of reportData.rows) {
        if (row.rowType === 'Row' && row.cells) {
          const name = row.cells[0]?.value
          const value = row.cells[1]?.value

          if (name && accountNames.some(accountName => 
            name.toLowerCase().includes(accountName.toLowerCase())
          )) {
            const numericValue = typeof value === 'string' ? parseFloat(value) : value
            if (!isNaN(numericValue)) {
              return Math.abs(numericValue)
            }
          }
        }
        
        // Check nested rows in sections
        if (row.rows && Array.isArray(row.rows)) {
          for (const nestedRow of row.rows) {
            if (nestedRow.rowType === 'Row' && nestedRow.cells) {
              const name = nestedRow.cells[0]?.value
              const value = nestedRow.cells[1]?.value

              if (name && accountNames.some(accountName => 
                name.toLowerCase().includes(accountName.toLowerCase())
              )) {
                const numericValue = typeof value === 'string' ? parseFloat(value) : value
                if (!isNaN(numericValue)) {
                  return Math.abs(numericValue)
                }
              }
            }
          }
        }
      }
    }
  }
  return 0
}

function extractTotalOperatingExpenses(report: any): number {
  if (!report?.reports || !Array.isArray(report.reports)) {
    return 0
  }

  for (const reportData of report.reports) {
    if (reportData.rows) {
      for (const row of reportData.rows) {
        // Check if this is the "Less Operating Expenses" section
        if (row.rowType === 'Section' && row.title && 
            row.title.toLowerCase().includes('less operating expenses')) {
          
          if (row.rows && Array.isArray(row.rows)) {
            for (const expenseRow of row.rows) {
              // Look for the "Total Operating Expenses" summary row
              if (expenseRow.rowType === 'SummaryRow' && expenseRow.cells && expenseRow.cells.length >= 2) {
                const name = expenseRow.cells[0]?.value
                const value = expenseRow.cells[1]?.value

                if (name && name.toString().toLowerCase().includes('total operating expenses')) {
                  const numericValue = typeof value === 'string' ? parseFloat(value) : value
                  if (!isNaN(numericValue)) {
                    return Math.abs(numericValue)
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  return 0
}

function extractNetProfit(report: any): number {
  if (!report?.reports || !Array.isArray(report.reports)) {
    return 0
  }

  for (const reportData of report.reports) {
    if (reportData.rows) {
      for (const row of reportData.rows) {
        // Look for the final "Net Profit" row
        if (row.rowType === 'Row' && row.cells && row.cells.length >= 2) {
          const name = row.cells[0]?.value
          const value = row.cells[1]?.value

          if (name && name.toString().toLowerCase().includes('net profit')) {
            const numericValue = typeof value === 'string' ? parseFloat(value) : value
            if (!isNaN(numericValue)) {
              return numericValue // Don't use Math.abs here as net profit can be negative
            }
          }
        }
      }
    }
  }
  return 0
}

function extractExpenseBreakdown(report: any): Array<{name: string, value: number, percentage: number}> {
  const expenses: Array<{name: string, value: number}> = []
  let totalExpenses = 0

  if (!report?.reports || !Array.isArray(report.reports)) {
    return []
  }

  for (const reportData of report.reports) {
    if (reportData.rows) {
      for (const row of reportData.rows) {
        // Check if this is the "Less Operating Expenses" section
        if (row.rowType === 'Section' && row.title && 
            row.title.toLowerCase().includes('less operating expenses')) {
          
          if (row.rows && Array.isArray(row.rows)) {
            for (const expenseRow of row.rows) {
              if (expenseRow.rowType === 'Row' && expenseRow.cells && expenseRow.cells.length >= 2) {
                const name = expenseRow.cells[0]?.value
                const value = expenseRow.cells[1]?.value

                if (name && value) {
                  const expenseName = name.toString()
                  const numericValue = typeof value === 'string' ? parseFloat(value) : value
                  
                  // Skip the "Total Operating Expenses" summary row
                  if (!expenseName.toLowerCase().includes('total operating expenses') && 
                      !isNaN(numericValue) && numericValue > 0) {
                    expenses.push({ name: expenseName, value: numericValue })
                    totalExpenses += numericValue
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  // Calculate percentages and sort by value
  return expenses
    .map(expense => ({
      ...expense,
      percentage: totalExpenses > 0 ? (expense.value / totalExpenses) * 100 : 0
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10) // Top 10 expenses
}

function escapeCSVField(field: string): string {
  // If the field contains commas, quotes, or newlines, wrap it in quotes
  if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
    // Escape any existing quotes by doubling them
    const escapedField = field.replace(/"/g, '""')
    return `"${escapedField}"`
  }
  return field
}

function generateCSV(data: any): string {
  const lines: string[] = []
  
  // Header
  lines.push('Financial Report')
  lines.push(`Period: ${data.period.from} to ${data.period.to}`)
  lines.push('')
  
  // Summary
  lines.push('Summary')
  lines.push('Metric,Amount')
  lines.push(`Revenue,${data.summary.revenue}`)
  lines.push(`Expenses,${data.summary.expenses}`)
  lines.push(`Net Profit,${data.summary.netProfit}`)
  lines.push(`Net Margin (%),${data.summary.netMargin.toFixed(2)}`)
  lines.push(`Cash Balance,${data.summary.cashBalance}`)
  lines.push('')
  
  // Expense Breakdown
  lines.push('Expense Breakdown')
  lines.push('Category,Amount,Percentage')
  data.expenseBreakdown.forEach((expense: any) => {
    // Properly escape CSV fields
    const escapedName = escapeCSVField(expense.name)
    lines.push(`${escapedName},${expense.value},${expense.percentage.toFixed(2)}`)
  })
  
  return lines.join('\n')
}
