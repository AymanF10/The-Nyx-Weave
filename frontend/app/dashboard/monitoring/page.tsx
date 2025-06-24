'use client'
import { useState } from 'react'
import { Activity, Clock } from 'lucide-react'

export default function MonitoringDashboard() {
  const [autoRefresh, setAutoRefresh] = useState(true)
  
  const botStatus = {
    status: 'operational',
    uptime: '99.87%',
    lastRestart: '3 days ago',
    version: 'v2.1.4'
  }
  
  const pools = [
    { name: 'Meteora USDC/SOL', status: 'active', volume24h: '$1.2M', lastCheck: '5s ago', health: 100 },
    { name: 'Meteora RAY/USDC', status: 'active', volume24h: '$892K', lastCheck: '8s ago', health: 98 },
    { name: 'Meteora JUP/SOL', status: 'active', volume24h: '$2.1M', lastCheck: '3s ago', health: 100 },
  ]

  return (
    <div className="py-6 sm:py-8">
      <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Monitoring Dashboard</h1>
          <p className="text-gray-400 text-sm sm:text-base">Real-time system performance and health monitoring</p>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-400">Auto-refresh</span>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full ${
              autoRefresh ? 'bg-purple-600' : 'bg-gray-600'
            }`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
              autoRefresh ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </div>
      
      {/* Bot Status */}
      <div className="card p-4 sm:p-6 mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-4">
          <h3 className="text-lg sm:text-xl font-semibold">Execution Bot Status</h3>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-green-400">Operational</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-gray-400 text-xs sm:text-sm">Uptime</p>
            <p className="text-lg sm:text-xl font-semibold">{botStatus.uptime}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs sm:text-sm">Last Restart</p>
            <p className="text-lg sm:text-xl font-semibold">{botStatus.lastRestart}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs sm:text-sm">Version</p>
            <p className="text-lg sm:text-xl font-semibold">{botStatus.version}</p>
          </div>
          <div>
            <p className="text-gray-400 text-xs sm:text-sm">Status</p>
            <p className="text-lg sm:text-xl font-semibold capitalize">{botStatus.status}</p>
          </div>
        </div>
      </div>
      
      {/* Monitored Pools */}
      <div className="card p-4 sm:p-6 mb-6 sm:mb-8">
        <h3 className="text-lg sm:text-xl font-semibold mb-4">Monitored Pools</h3>
        <div className="space-y-3">
          {pools.map((pool, index) => (
            <div key={index} className="bg-gray-700/50 rounded-lg p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <Activity className="text-purple-500 flex-shrink-0" size={20} />
                  <div className="min-w-0">
                    <p className="font-medium text-sm sm:text-base truncate">{pool.name}</p>
                    <p className="text-xs sm:text-sm text-gray-400">Volume 24h: {pool.volume24h}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end sm:space-x-4">
                  <div className="text-left sm:text-right">
                    <p className="text-xs sm:text-sm text-gray-400">Last Check</p>
                    <p className="text-xs sm:text-sm flex items-center">
                      <Clock size={12} className="mr-1" />
                      {pool.lastCheck}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-16 sm:w-20 bg-gray-600 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${pool.health}%` }}
                      ></div>
                    </div>
                    <span className="text-xs sm:text-sm text-green-400">{pool.health}%</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}