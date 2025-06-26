'use client'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface ChartProps {
  type: 'line' | 'bar'
}

export default function Chart({ type }: ChartProps) {
  const lineData = [
    { time: '00:00', profit: 450 },
    { time: '04:00', profit: 892 },
    { time: '08:00', profit: 1247 },
    { time: '12:00', profit: 1892 },
    { time: '16:00', profit: 2341 },
    { time: '20:00', profit: 2847 },
    { time: '24:00', profit: 3293 },
  ]
  
  const barData = [
    { pool: 'Meteora SOL', volume: 892 },
    { pool: 'Meteora USDC', volume: 1247 },
    { pool: 'Meteora RAY', volume: 623 },
    { pool: 'Meteora JUP', volume: 1482 },
  ]
  
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
          <p className="text-sm">{`${payload[0].value}`}</p>
        </div>
      )
    }
    return null
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      {type === 'line' ? (
        <LineChart data={lineData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="time" stroke="#9CA3AF" />
          <YAxis stroke="#9CA3AF" />
          <Tooltip content={<CustomTooltip />} />
          <Line 
            type="monotone" 
            dataKey="profit" 
            stroke="#8B5CF6" 
            strokeWidth={2}
            dot={{ fill: '#8B5CF6', r: 4 }}
          />
        </LineChart>
      ) : (
        <BarChart data={barData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="pool" stroke="#9CA3AF" />
          <YAxis stroke="#9CA3AF" />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="volume" fill="#8B5CF6" radius={[8, 8, 0, 0]} />
        </BarChart>
      )}
    </ResponsiveContainer>
  )
}