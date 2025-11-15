'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { TrendingUp } from 'lucide-react'

interface ChartDataPoint {
  date: string
  cumulative_units: number
  daily_units: number
  wins: number
  losses: number
}

interface PerformanceChartProps {
  data: ChartDataPoint[]
  loading?: boolean
}

export function PerformanceChart({ data, loading }: PerformanceChartProps) {
  if (loading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            Performance Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-slate-700/50 rounded animate-pulse"></div>
        </CardContent>
      </Card>
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            Performance Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <TrendingUp className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No performance data yet</p>
            <p className="text-slate-500 text-sm mt-1">Chart will appear once you have graded picks</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Determine if overall performance is positive or negative
  const finalUnits = data[data.length - 1]?.cumulative_units || 0
  const isPositive = finalUnits >= 0

  // Create gradient colors
  const gradientColor = isPositive ? '#10b981' : '#ef4444'
  const gradientId = isPositive ? 'colorProfit' : 'colorLoss'

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <span className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            Performance Over Time
          </span>
          <span className={`text-lg font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{finalUnits.toFixed(2)}U
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={gradientColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={gradientColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
            <XAxis
              dataKey="date"
              stroke="#94a3b8"
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              tickFormatter={(value) => {
                const date = new Date(value)
                return `${date.getMonth() + 1}/${date.getDate()}`
              }}
            />
            <YAxis
              stroke="#94a3b8"
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              tickFormatter={(value) => `${value >= 0 ? '+' : ''}${value}U`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                padding: '12px'
              }}
              labelStyle={{ color: '#e2e8f0', fontWeight: 'bold', marginBottom: '8px' }}
              itemStyle={{ color: '#94a3b8' }}
              formatter={(value: any, name: string) => {
                if (name === 'cumulative_units') {
                  return [`${value >= 0 ? '+' : ''}${value.toFixed(2)}U`, 'Total Units']
                }
                return [value, name]
              }}
              labelFormatter={(label) => {
                const date = new Date(label)
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              }}
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload
                  return (
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-xl">
                      <p className="text-white font-semibold mb-2">
                        {new Date(label).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                      <div className="space-y-1 text-sm">
                        <p className={`font-medium ${data.cumulative_units >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          Total: {data.cumulative_units >= 0 ? '+' : ''}{data.cumulative_units.toFixed(2)}U
                        </p>
                        <p className={`${data.daily_units >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          Daily: {data.daily_units >= 0 ? '+' : ''}{data.daily_units.toFixed(2)}U
                        </p>
                        <p className="text-slate-400">
                          {data.wins}W - {data.losses}L
                        </p>
                      </div>
                    </div>
                  )
                }
                return null
              }}
            />
            <ReferenceLine y={0} stroke="#64748b" strokeDasharray="3 3" />
            <Line
              type="monotone"
              dataKey="cumulative_units"
              stroke={gradientColor}
              strokeWidth={3}
              dot={{ fill: gradientColor, r: 4 }}
              activeDot={{ r: 6, fill: gradientColor }}
              fill={`url(#${gradientId})`}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

