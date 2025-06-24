'use client'
import { ArrowUpRight, ArrowDownRight, Activity, DollarSign, Percent, Clock } from 'lucide-react'
import dynamic from 'next/dynamic'

const Chart = dynamic(() => import('@/components/chart'), { ssr: false })

export default function Dashboard() {
  const stats = [
    { label: 'Total Value Locked', value: '$2,847,293', change: '+12.5%', positive: true, icon: DollarSign },
    { label: 'Total Profit (24h)', value: '$18,492', change: '+8.2%', positive: true, icon: ArrowUpRight },
    { label: 'Success Rate', value: '94.7%', change: '-0.3%', positive: false, icon: Percent },
    { label: 'Active Trades', value: '127', change: '+15', positive: true, icon: Activity },
  ]
  
  const recentTrades = [
    { id: 1, pair: 'SOL/USDC', profit: 127.45, timestamp: '2 min ago', pool: 'Meteora', status: 'success' },
    { id: 2, pair: 'RAY/USDC', profit: 89.23, timestamp: '5 min ago', pool: 'Meteora', status: 'success' },
    { id: 3, pair: 'BONK/SOL', profit: -12.10, timestamp: '8 min ago', pool: 'Meteora', status: 'failed' },
    { id: 4, pair: 'JUP/USDC', profit: 234.90, timestamp: '12 min ago', pool: 'Meteora', status: 'success' },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-gray-400">Monitor your arbitrage performance in real-time</p>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <div key={index} className="card">
            <div className="flex items-center justify-between mb-4">
              <stat.icon className="w-8 h-8 text-purple-500" />
              <span className={`text-sm flex items-center ${stat.positive ? 'text-green-400' : 'text-red-400'}`}>
                {stat.positive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                {stat.change}
              </span>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">{stat.label}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h3 className="text-xl font-semibold mb-4">Profit Over Time</h3>
          <Chart type="line" />
        </div>
        <div className="card">
          <h3 className="text-xl font-semibold mb-4">Trade Volume by Pool</h3>
          <Chart type="bar" />
        </div>
      </div>
      
      {/* Recent Trades */}
      <div className="card">
        <h3 className="text-xl font-semibold mb-4">Recent Trades</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="pb-3">Pair</th>
                <th className="pb-3">Pool</th>
                <th className="pb-3">Profit</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Time</th>
              </tr>
            </thead>
            <tbody>
              {recentTrades.map((trade) => (
                <tr key={trade.id} className="border-b border-gray-700/50">
                  <td className="py-3 font-medium">{trade.pair}</td>
                  <td className="py-3 text-gray-400">{trade.pool}</td>
                  <td className={`py-3 ${trade.profit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${Math.abs(trade.profit).toFixed(2)}
                  </td>
                  <td className="py-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      trade.status === 'success' 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {trade.status}
                    </span>
                  </td>
                  <td className="py-3 text-gray-400 flex items-center">
                    <Clock size={14} className="mr-1" />
                    {trade.timestamp}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}