import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getXeroTokens } from '@/lib/xero'
import { getProfitAndLossReport, getBalanceSheetReport, getOrganisation } from '@/lib/xero-api'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
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
    const [profitLoss, balanceSheet, organisation] = await Promise.all([
      getProfitAndLossReport(session.user.id, tenantId, {
        fromDate: fromDateStr || undefined,
        toDate: toDateStr || undefined,
        standardLayout: true
      }),
      getBalanceSheetReport(session.user.id, tenantId, {
        date: toDateStr || undefined,
        standardLayout: true
      }),
      getOrganisation(session.user.id, tenantId)
    ])

    // Process P&L data
    const revenue = extractAccountValue(profitLoss, ['Total Income'])
    const expenses = extractTotalOperatingExpenses(profitLoss)
    const netProfit = extractNetProfit(profitLoss)
    
    // If we don't have net profit directly, calculate it
    const calculatedNetProfit = revenue - expenses
    const finalNetProfit = netProfit !== 0 ? netProfit : calculatedNetProfit
    const netMargin = revenue > 0 ? (finalNetProfit / revenue) * 100 : 0

    // Process Balance Sheet data
    const cashBalance = extractAccountValue(balanceSheet, ['Total Bank'])

    // Process expense breakdown
    const expenseBreakdown = extractExpenseBreakdown(profitLoss)

    // Generate monthly trend data
    const trendData = await generateMonthlyTrendData(session.user.id, tenantId, currentYear)

    // Get previous period data for comparison
    const previousPeriodData = await getPreviousPeriodData(session.user.id, tenantId, timeframe, fromDateStr || '', toDateStr || '')

    return NextResponse.json({
      organisation: {
        name: organisation?.name || 'Unknown',
        shortCode: organisation?.shortCode || ''
      },
      kpis: {
        revenue,
        expenses,
        netProfit: finalNetProfit,
        netMargin,
        cashBalance
      },
      expenseBreakdown,
      trendData,
      previousPeriodData,
      timeframe: {
        from: fromDateStr,
        to: toDateStr,
        type: timeframe
      }
    })

  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }
}

function extractAccountValue(report: any, accountNames: string[]): number {
  if (!report?.reports || !Array.isArray(report.reports)) {
    return 0
  }

  for (const reportData of report.reports) {
    if (reportData.rows) {
      for (const row of reportData.rows) {
        if ((row.rowType === 'Row' || row.rowType === 'SummaryRow') && row.cells) {
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
            if ((nestedRow.rowType === 'Row' || nestedRow.rowType === 'SummaryRow') && nestedRow.cells) {
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

async function generateMonthlyTrendData(userId: string, tenantId: string, year: number): Promise<Array<{month: string, revenue: number, expenses: number}>> {
  const trendData = []
  
  try {
    // Get data for each month of the current year
    for (let month = 1; month <= 12; month++) {
      const monthStart = new Date(year, month - 1, 1)
      const monthEnd = new Date(year, month, 0)
      const fromDate = monthStart.toISOString().split('T')[0]
      const toDate = monthEnd.toISOString().split('T')[0]
      
      try {
        const profitLoss = await getProfitAndLossReport(userId, tenantId, {
          fromDate,
          toDate,
          standardLayout: true
        })
        
        const revenue = extractAccountValue(profitLoss, ['Total Income'])
        const expenses = extractTotalOperatingExpenses(profitLoss)
        
        trendData.push({
          month: monthStart.toLocaleDateString('en-US', { month: 'short' }),
          revenue: Math.abs(revenue),
          expenses: Math.abs(expenses)
        })
      } catch (error) {
        console.error(`Error fetching data for ${month}/${year}:`, error)
        // Add zero values for months with errors
        trendData.push({
          month: monthStart.toLocaleDateString('en-US', { month: 'short' }),
          revenue: 0,
          expenses: 0
        })
      }
    }
  } catch (error) {
    console.error('Error generating trend data:', error)
  }
  
  return trendData
}

async function getPreviousPeriodData(userId: string, tenantId: string, timeframe: string, fromDate: string, toDate: string): Promise<Array<{name: string, value: number}>> {
  try {
    let previousFromDate: string
    let previousToDate: string

    if (timeframe === 'YEAR') {
      // Get previous year data
      const currentYear = new Date(fromDate).getFullYear()
      const previousYear = currentYear - 1
      previousFromDate = `${previousYear}-01-01`
      previousToDate = `${previousYear}-12-31`
    } else {
      // Get previous month data
      const currentDate = new Date(fromDate)
      const previousMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
      const previousMonthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth(), 0)
      previousFromDate = previousMonth.toISOString().split('T')[0]
      previousToDate = previousMonthEnd.toISOString().split('T')[0]
    }

    const previousProfitLoss = await getProfitAndLossReport(userId, tenantId, {
      fromDate: previousFromDate,
      toDate: previousToDate,
      standardLayout: true
    })

    return extractExpenseBreakdown(previousProfitLoss)
  } catch (error) {
    console.error('Error fetching previous period data:', error)
    return []
  }
}
