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

    // Debug logging
    console.log('Profit & Loss Report Structure:', JSON.stringify(profitLoss, null, 2))
    console.log('Balance Sheet Report Structure:', JSON.stringify(balanceSheet, null, 2))

    // Process P&L data
    const revenue = extractAccountValue(profitLoss, ['Sales', 'Revenue', 'Income', 'Total Income'])
    const expenses = extractAccountValue(profitLoss, ['Total Operating Expenses', 'Total Expenses', 'Expenses', 'Operating Expenses'])
    const netProfit = extractAccountValue(profitLoss, ['NET PROFIT', 'Net Profit', 'Net Income', 'Profit'])
    
    // If we don't have net profit directly, calculate it
    const calculatedNetProfit = revenue - expenses
    const finalNetProfit = netProfit !== 0 ? netProfit : calculatedNetProfit
    const netMargin = revenue > 0 ? (finalNetProfit / revenue) * 100 : 0

    // Process Balance Sheet data
    const cashBalance = extractAccountValue(balanceSheet, ['Business Bank Account', 'Business Savings Account', 'Total Bank', 'Cash', 'Bank', 'Current Assets'])

    // Process expense breakdown
    const expenseBreakdown = extractExpenseBreakdown(profitLoss)

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

function extractExpenseBreakdown(report: any): Array<{name: string, value: number, percentage: number}> {
  const expenses: Array<{name: string, value: number}> = []
  let totalExpenses = 0

  if (!report?.reports || !Array.isArray(report.reports)) {
    return []
  }

  for (const reportData of report.reports) {
    if (reportData.rows) {
      for (const row of reportData.rows) {
        // Check if this is an expense section
        if (row.rowType === 'Section' && row.title && 
            (row.title.toLowerCase().includes('expense') || 
             row.title.toLowerCase().includes('cost'))) {
          
          if (row.rows && Array.isArray(row.rows)) {
            for (const expenseRow of row.rows) {
              if (expenseRow.rowType === 'Row' && expenseRow.cells && expenseRow.cells.length >= 2) {
                const name = expenseRow.cells[0]?.value
                const value = expenseRow.cells[1]?.value

                if (name && value) {
                  const expenseName = name.toString()
                  const numericValue = typeof value === 'string' ? parseFloat(value) : value
                  
                  if (!isNaN(numericValue) && numericValue < 0) {
                    const expenseValue = Math.abs(numericValue)
                    
                    // Filter out main categories and focus on subcategories
                    if (!expenseName.toLowerCase().includes('total') && 
                        !expenseName.toLowerCase().includes('expenses') &&
                        expenseValue > 0) {
                      expenses.push({ name: expenseName, value: expenseValue })
                      totalExpenses += expenseValue
                    }
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
