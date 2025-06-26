'use client'
import { useState } from 'react'
import { Search, Filter, ExternalLink, Copy, Check } from 'lucide-react'

export default function VaultExplorer() {
  const [searchTerm, setSearchTerm] = useState('')
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null)
  
  const vaults = [
    {
      id: 1,
      name: 'Arbitrage Vault',
      address: '7xKXtanKJfwGHxjGAwP4sNVqPpFGYnLjYQvngPVpump',
      type: 'Main',
      balance: '$1,847,293',
      tokens: ['SOL', 'USDC', 'RAY', 'JUP'],
      lastActivity: '2 minutes ago',
      status: 'active'
    },
    {
      id: 2,
      name: 'Treasury Vault',
      address: '9fKexGPrjPqUXvdPBvCaGAwP4sNVqPpFGYnLjYQv',
      type: 'Treasury',
      balance: '$482,910',
      tokens: ['USDC', 'SOL'],
      lastActivity: '5 minutes ago',
      status: 'active'
    },
    {
      id: 3,
      name: 'User PDA Vault',
      address: 'Cw3xGPrjPqUXvdPBvCaGAwP4sNVqPpFGYnLj9fKL',
      type: 'User',
      balance: '$12,847',
      tokens: ['SOL', 'USDC'],
      lastActivity: '1 hour ago',
      status: 'active'
    }
  ]
  
  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address)
    setCopiedAddress(address)
    setTimeout(() => setCopiedAddress(null), 2000)
  }
  
  const filteredVaults = vaults.filter(vault => 
    vault.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vault.address.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="py-6 sm:py-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Vault Explorer</h1>
        <p className="text-gray-400 text-sm sm:text-base">Explore and monitor all platform vaults</p>
      </div>
      
      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by vault name or address..."
            className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500 text-sm sm:text-base"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="btn-secondary flex items-center justify-center space-x-2">
          <Filter size={20} />
          <span>Filter</span>
        </button>
      </div>
      
      {/* Vault Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        {filteredVaults.map((vault) => (
          <div key={vault.id} className="card p-4 sm:p-6 hover:border-purple-500/50 transition-colors">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 gap-4">
              <div>
                <h3 className="text-lg sm:text-xl font-semibold mb-1">{vault.name}</h3>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded text-xs ${
                    vault.type === 'Main' ? 'bg-purple-500/20 text-purple-400' :
                    vault.type === 'Treasury' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {vault.type}
                  </span>
                  <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-400">
                    {vault.status}
                  </span>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xl sm:text-2xl font-bold">{vault.balance}</p>
                <p className="text-xs sm:text-sm text-gray-400">Total Balance</p>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <span className="text-gray-400 text-sm">Address</span>
                <div className="flex items-center space-x-2">
                  <code className="text-xs sm:text-sm">{vault.address.slice(0, 8)}...{vault.address.slice(-8)}</code>
                  <button
                    onClick={() => copyAddress(vault.address)}
                    className="text-gray-400 hover:text-white"
                  >
                    {copiedAddress === vault.address ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                  <a
                    href={`https://explorer.solana.com/address/${vault.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white"
                  >
                    <ExternalLink size={16} />
                  </a>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <span className="text-gray-400 text-sm">Tokens</span>
                <div className="flex flex-wrap gap-2">
                  {vault.tokens.map((token) => (
                    <span key={token} className="px-2 py-1 bg-gray-700 rounded text-xs">
                      {token}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">Last Activity</span>
                <span className="text-xs sm:text-sm">{vault.lastActivity}</span>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-700">
              <button className="w-full btn-primary">View Details</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}