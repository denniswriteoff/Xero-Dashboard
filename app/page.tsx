'use client'

import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  BarChart3, 
  PieChart, 
  Download,
  Settings,
  LogOut,
  RefreshCw
} from 'lucide-react'
import ThemeToggle from './components/ThemeToggle'
import logoWhite from '/public/logo_long_white.png'
import logoBlack from '/public/logo_long_black.png'

interface DashboardData {
  organisation: {
    name: string
    shortCode: string
  }
  kpis: {
    revenue: number
    expenses: number
    netProfit: number
    netMargin: number
    cashBalance: number
  }
  expenseBreakdown: Array<{
    name: string
    value: number
    percentage: number
  }>
  timeframe: {
    from: string
    to: string
    type: string
  }
}

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeframe, setTimeframe] = useState<'YEAR' | 'MONTH'>('YEAR')
  const [refreshing, setRefreshing] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'authenticated') {
      fetchData()
    }
  }, [status, timeframe])

  // Handle URL parameters for success/error messages
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const success = urlParams.get('success')
    const error = urlParams.get('error')
    
    if (success === 'xero_connected') {
      setSuccessMessage('Xero connected successfully!')
      setError(null)
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname)
    } else if (error) {
      setError(`Connection failed: ${error}`)
      setSuccessMessage(null)
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/dashboard/data?timeframe=${timeframe}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch data')
      }
      
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const handleConnectXero = async () => {
    try {
      window.location.href = '/api/auth/xero/connect'
    } catch (err) {
      console.error('Failed to connect to Xero:', err)
    }
  }

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const response = await fetch(`/api/dashboard/export?format=${format}&timeframe=${timeframe}`)
      
      if (!response.ok) {
        throw new Error('Export failed')
      }
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `financial-report-${timeframe.toLowerCase()}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Export failed:', err)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  if (status === 'loading') {
    return (
      <div className="mobile-viewport-height overflow-hidden bg-white text-black dark:bg-black dark:text-white flex items-center justify-center zoom-container">
        <div className="text-sm text-gray-600 dark:text-gray-400">Loading…</div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="mobile-viewport-height overflow-hidden bg-white text-black dark:bg-black dark:text-white flex items-center justify-center zoom-container">
        <div className="text-center space-y-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">You are not signed in.</div>
          <button 
            onClick={() => router.push('/login')}
            className="inline-block h-9 px-4 rounded-md bg-black text-white dark:bg-white dark:text-black hover:opacity-90 transition-opacity"
          >
            Go to login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mobile-viewport-height overflow-hidden bg-white text-black dark:bg-black dark:text-white flex flex-col zoom-container">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-black/60 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="inline-flex">
                <Image
                  src={logoBlack}
                  alt="Writeoff Logo"
                  height={20}
                  width={120}
                  className="h-5 w-auto object-contain block dark:hidden"
                  priority
                />
                <Image
                  src={logoWhite}
                  alt="Writeoff Logo"
                  height={20}
                  width={120}
                  className="h-5 w-auto object-contain hidden dark:block"
                  priority
                />
              </span>
              <h1 className="text-[20px] leading-none font-semibold tracking-tight">| Dashboard</h1>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
                aria-label="Refresh data"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
              
              <ThemeToggle />
              
              <button
                onClick={() => router.push('/profile')}
                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                aria-label="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto min-h-0 main-content">
        <div className="max-w-7xl mx-auto px-4 py-6">
        {successMessage && (
          <div className="mb-6 p-4 rounded-md bg-green-50 dark:bg-[#2A2D31] border border-green-200 dark:border-green-800">
            <div className="text-sm text-green-800 dark:text-green-200">
              {successMessage}
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-md bg-red-50 dark:bg-[#2A2D31] border border-red-200 dark:border-red-800">
            <div className="flex items-center justify-between">
              <div className="text-sm text-red-800 dark:text-red-200">
                {error === 'No Xero connection found' ? (
                  <div>
                    <p className="font-medium">Xero not connected</p>
                    <p className="text-xs mt-1">Connect your Xero account to view financial data</p>
                  </div>
                ) : (
                  <p>{error}</p>
                )}
              </div>
              {error === 'No Xero connection found' && (
                <button
                  onClick={handleConnectXero}
                  className="px-3 py-1 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                >
                  Connect Xero
                </button>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-sm text-gray-600 dark:text-gray-400">Loading dashboard data…</div>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Timeframe Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-medium">
                  {data.organisation.name} Dashboard
                </h2>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {data.timeframe.from} to {data.timeframe.to}
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setTimeframe('MONTH')}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    timeframe === 'MONTH'
                      ? 'bg-black text-white dark:bg-white dark:text-black'
                      : 'bg-gray-100 text-gray-700 dark:bg-[#2A2D31] dark:text-gray-300'
                  }`}
                >
                  MTD
                </button>
                <button
                  onClick={() => setTimeframe('YEAR')}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    timeframe === 'YEAR'
                      ? 'bg-black text-white dark:bg-white dark:text-black'
                      : 'bg-gray-100 text-gray-700 dark:bg-[#2A2D31] dark:text-gray-300'
                  }`}
                >
                  YTD
                </button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-[#2A2D31] border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Revenue</p>
                    <p className="text-2xl font-semibold">{formatCurrency(data.kpis.revenue)}</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-green-600" />
                </div>
              </div>

              <div className="bg-white dark:bg-[#2A2D31] border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Expenses</p>
                    <p className="text-2xl font-semibold">{formatCurrency(data.kpis.expenses)}</p>
                  </div>
                  <TrendingDown className="w-8 h-8 text-red-600" />
                </div>
              </div>

              <div className="bg-white dark:bg-[#2A2D31] border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Net Profit</p>
                    <p className="text-2xl font-semibold">{formatCurrency(data.kpis.netProfit)}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-blue-600" />
                </div>
              </div>

              <div className="bg-white dark:bg-[#2A2D31] border border-gray-200 dark:border-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Cash Balance</p>
                    <p className="text-2xl font-semibold">{formatCurrency(data.kpis.cashBalance)}</p>
                  </div>
                  <Wallet className="w-8 h-8 text-purple-600" />
                </div>
              </div>
            </div>

            {/* Net Margin */}
            <div className="bg-white dark:bg-[#2A2D31] border border-gray-200 dark:border-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Net Margin</p>
                  <p className="text-2xl font-semibold">{formatPercentage(data.kpis.netMargin)}</p>
                </div>
                <BarChart3 className="w-8 h-8 text-indigo-600" />
              </div>
            </div>

            {/* Expense Breakdown */}
            <div className="bg-white dark:bg-[#2A2D31] border border-gray-200 dark:border-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Expense Breakdown</h3>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => handleExport('csv')}
                    className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <Download className="w-4 h-4" />
                    <span>CSV</span>
                  </button>
                  <button 
                    onClick={() => handleExport('json')}
                    className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <Download className="w-4 h-4" />
                    <span>JSON</span>
                  </button>
                </div>
              </div>
              
              <div className="space-y-3">
                {data.expenseBreakdown.map((expense, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{expense.name}</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {formatCurrency(expense.value)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-[#2A2D31] rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(expense.percentage, 100)}%` }}
                        />
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {formatPercentage(expense.percentage)} of total expenses
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">No data available</div>
              <button
                onClick={handleConnectXero}
                className="px-4 py-2 bg-black text-white dark:bg-white dark:text-black rounded-md hover:opacity-90 transition-opacity"
              >
                Connect Xero
              </button>
            </div>
          </div>
        )}
        </div>
      </main>
    </div>
  )
}