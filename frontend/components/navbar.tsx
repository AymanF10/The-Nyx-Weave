'use client'
import { Bell, ChevronDown, Copy, Check, Menu } from 'lucide-react'
import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'

interface TopBarProps {
  onMenuClick: () => void
  sidebarCollapsed: boolean
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const { publicKey } = useWallet()
  const [copied, setCopied] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  const copyAddress = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toString())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="h-16 bg-gray-900 border-b border-gray-700 flex items-center justify-between px-4 sm:px-6">
      <div className="flex items-center space-x-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden text-gray-400 hover:text-white"
        >
          <Menu size={24} />
        </button>
        <h2 className="text-lg font-semibold hidden sm:block">Welcome back!</h2>
      </div>
      
      <div className="flex items-center space-x-2 sm:space-x-4">
        <button className="text-gray-400 hover:text-white relative">
          <Bell size={20} />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-purple-600 rounded-full"></span>
        </button>
        
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center space-x-2 bg-gray-800 rounded-lg px-3 sm:px-4 py-2 hover:bg-gray-700"
          >
            <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-purple-800 rounded-full hidden sm:block"></div>
            <span className="text-sm">
              {publicKey ? `${publicKey.toString().slice(0, 4)}...${publicKey.toString().slice(-4)}` : 'Not Connected'}
            </span>
            <ChevronDown size={16} className="hidden sm:block" />
          </button>
          
          {showDropdown && publicKey && (
            <div className="absolute right-0 mt-2 w-64 bg-gray-800 rounded-lg shadow-lg border border-gray-700 py-2 z-50">
              <div className="px-4 py-2 border-b border-gray-700">
                <p className="text-sm text-gray-400">Connected Wallet</p>
                <div className="flex items-center space-x-2 mt-1">
                  <code className="text-xs">{publicKey.toString().slice(0, 8)}...{publicKey.toString().slice(-8)}</code>
                  <button
                    onClick={copyAddress}
                    className="text-gray-400 hover:text-white"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
              <button
                onClick={() => setShowDropdown(false)}
                className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm"
              >
                Account Settings
              </button>
              <a
                href={`https://explorer.solana.com/address/${publicKey.toString()}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowDropdown(false)}
                className="w-full text-left px-4 py-2 hover:bg-gray-700 text-sm block"
              >
                View on Explorer
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}