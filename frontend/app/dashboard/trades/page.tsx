'use client'
import { useState } from 'react'
import { TrendingUp, TrendingDown, ExternalLink, Download } from 'lucide-react'

export default function TradeHistory() {
  const [filter, setFilter] = useState('all')
  const [timeRange, setTimeRange] = useState('24h')
  
  const trades = [
    {
      id: '0x1234...5678',
      type: 'buy',
      tokenIn: 'USDC',
      tokenOut: 'SOL',
      amountIn: 1500,
      amountOut: 23.45,
      pool: 'Meteora',
      profit: 12.87,
      gasUsed: 0.003,
      timestamp: '2024-01-20 14:32:10',
      status: 'success',
      txHash: '7xKXtanKJfwGHxjGAwP4sNVqPpFGYnLjYQvngPVpump'
    },
    {
      id: '0x2345...6789',
      type: 'sell',
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amountIn: 15.23,
      amountOut: 982.45,
      pool: 'Meteora',
      profit: 8.92,
      gasUsed: 0.002,
      timestamp: '2024-01-20 14:28:45',
      status: 'success',
      txHash: '9fKexGPrjPqUXvdPBvCaGAwP4sNVqPpFGYnLjYQv'
    },
    {
      id: '0x3456...7890',
      type: 'buy',
      tokenIn: 'USDC',
      tokenOut: 'RAY',
      amountIn: 500,
      amountOut: 247.83,
      pool: 'Meteora',
      profit: -2.45,
      gasUsed: 0.004,
      timestamp: '2024-01-20 14:25:22',
      status: 'failed',
      txHash: 'Cw3xGPrjPqUXvdPBvCaGAwP4sNVqPpFGYnLj9fKL'
    },
    {
      id: '0x4567...8901',
      type: 'sell',
      tokenIn: 'JUP',
      tokenOut: 'USDC',
      amountIn: 892.34,
      amountOut: 1247.92,
      pool: 'Meteora',
      profit: 34.78,
      gasUsed: 0.003,
      timestamp: '2024-01-20 14:22:15',
      status: 'success',
      txHash: 'Dw4xGPrjPqUXvdPBvCaGAwP4sNVqPpFGYnLj0gLM'
    }
  ]
  
  const summary = {
    totalTrades: 487,
    successRate: '94.7%',
    totalProfit: '$18,492',
    avgProfit: '$37.96'
  }

  return (
    <div className="py-6 sm:py-8">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Trade History</h1>
          <p className="text-gray-400 text-sm sm:text-base">View all buy and sell transactions</p>
        </div>
        <button className="btn-secondary flex items-center space-x-2">
          <Download size={20} />
          <span>Export CSV</span>
        </button>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 sm:mb-8">
        <div className="card p-4 sm:p-6">
          <p className="text-gray-400 text-xs sm:text-sm mb-1">Total Trades</p>
          <p className="text-xl sm:text-2xl font-bold">{summary.totalTrades}</p>
        </div>
        <div className="card p-4 sm:p-6">
          <p className="text-gray-400 text-xs sm:text-sm mb-1">Success Rate</p>
          <p className="text-xl sm:text-2xl font-bold text-green-400">{summary.successRate}</p>
        </div>
        <div className="card p-4 sm:p-6">
          <p className="text-gray-400 text-xs sm:text-sm mb-1">Total Profit</p>
          <p className="text-xl sm:text-2xl font-bold text-green-400">{summary.totalProfit}</p>
        </div>
        <div className="card p-4 sm:p-6">
          <p className="text-gray-400 text-xs sm:text-sm mb-1">Avg Profit/Trade</p>
          <p className="text-xl sm:text-2xl font-bold">{summary.avgProfit}</p>
        </div>
      </div>
      
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex space-x-2 overflow-x-auto">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg whitespace-nowrap ${filter === 'all' ? 'bg-purple-600' : 'bg-gray-700'}`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('buy')}
            className={`px-4 py-2 rounded-lg whitespace-nowrap ${filter === 'buy' ? 'bg-purple-600' : 'bg-gray-700'}`}
          >
            Buys
          </button>
          <button
            onClick={() => setFilter('sell')}
            className={`px-4 py-2 rounded-lg whitespace-nowrap ${filter === 'sell' ? 'bg-purple-600' : 'bg-gray-700'}`}
          >
            Sells
          </button>
        </div>
        <select 
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="px-4 py-2 bg-gray-700 rounded-lg"
        >
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="all">All time</option>
        </select>
      </div>
      
      {/* Trade Cards - Mobile */}
      <div className="block sm:hidden space-y-4">
        {trades.map((trade) => (
          <div key={trade.id} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className={`flex items-center space-x-2 ${
                trade.type === 'buy' ? 'text-green-400' : 'text-red-400'
              }`}>
                {trade.type === 'buy' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                <span className="capitalize font-medium">{trade.type}</span>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs ${
                trade.status === 'success' 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {trade.status}
              </span>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Trade</span>
                <span>{trade.amountIn} {trade.tokenIn} → {trade.amountOut} {trade.tokenOut}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Profit</span>
                <span className={trade.profit > 0 ? 'text-green-400' : 'text-red-400'}>
                  ${Math.abs(trade.profit).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Time</span>
                <span>{trade.timestamp}</span>
              </div>
              <div className="pt-2 border-t border-gray-700">
                <a
                  href={`https://explorer.solana.com/tx/${trade.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 text-sm flex items-center space-x-1"
                >
                  <span>View Transaction</span>
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Trade Table - Desktop */}
      <div className="hidden sm:block card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-700">
                <th className="p-3 text-sm">Type</th>
                <th className="p-3 text-sm">Trade</th>
                <th className="p-3 text-sm">Pool</th>
                <th className="p-3 text-sm">Profit</th>
                <th className="p-3 text-sm">Gas</th>
                <th className="p-3 text-sm">Time</th>
                <th className="p-3 text-sm">Status</th>
                <th className="p-3 text-sm">TX</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => (
                <tr key={trade.id} className="border-b border-gray-700/50 hover:bg-gray-800/50">
                  <td className="p-3">
                    <div className={`flex items-center space-x-2 ${
                      trade.type === 'buy' ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {trade.type === 'buy' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                      <span className="capitalize">{trade.type}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <div>
                      <p className="font-medium">{trade.amountIn} {trade.tokenIn}</p>
                      <p className="text-sm text-gray-400">→ {trade.amountOut} {trade.tokenOut}</p>
                    </div>
                  </td>
                  <td className="p-3">{trade.pool}</td>
                  <td className={`p-3 font-medium ${trade.profit > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    ${Math.abs(trade.profit).toFixed(2)}
                  </td>
                  <td className="p-3 text-gray-400">{trade.gasUsed} SOL</td>
                  <td className="p-3 text-sm text-gray-400">{trade.timestamp}</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      trade.status === 'success' 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {trade.status}
                    </span>
                  </td>
                  <td className="p-3">
                    <a
                      href={`https://explorer.solana.com/tx/${trade.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:text-purple-300"
                    >
                      <ExternalLink size={16} />
                    </a>
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