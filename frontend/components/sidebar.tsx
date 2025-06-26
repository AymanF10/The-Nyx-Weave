'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  Database, 
  Activity, 
  Wallet, 
  History,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react'
import { useWallet } from '@solana/wallet-adapter-react'

interface SidebarProps {
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
  mobileOpen: boolean
  setMobileOpen: (open: boolean) => void
}

export default function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }: SidebarProps) {
  const pathname = usePathname()
  const { disconnect } = useWallet()
  
  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/vault', label: 'Vault Explorer', icon: Database },
    { href: '/dashboard/monitoring', label: 'Monitoring', icon: Activity },
    { href: '/dashboard/portfolio', label: 'Portfolio', icon: Wallet },
    { href: '/dashboard/trades', label: 'Trade History', icon: History },
  ]

  const handleNavClick = () => {
    if (window.innerWidth < 1024) {
      setMobileOpen(false)
    }
  }

  return (
    <div className={`
      ${collapsed ? 'w-20' : 'w-64'} 
      ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
      lg:translate-x-0
      fixed lg:relative
      h-full
      bg-gray-800 
      border-r border-gray-700 
      flex flex-col
      transition-all duration-300
      z-50
    `}>
      <div className={`p-6 ${collapsed ? 'px-4' : ''}`}>
        <div className="flex items-center justify-between">
          <Link 
            href="/dashboard" 
            className={`flex items-center ${collapsed ? 'justify-center' : 'space-x-2'}`}
            onClick={handleNavClick}
          >
            <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-purple-800 rounded-lg flex-shrink-0"></div>
            {!collapsed && <span className="font-bold text-xl">Nyx Weave</span>}
          </Link>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>
      </div>
      
      <nav className="flex-1 px-4 pb-4">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={handleNavClick}
            className={`
              flex items-center 
              ${collapsed ? 'justify-center' : 'space-x-3'} 
              px-4 py-3 
              rounded-lg 
              text-gray-300 
              hover:text-white 
              hover:bg-gray-700 
              transition-all 
              duration-200 
              mb-2
              ${pathname === item.href ? 'bg-gray-700 text-white' : ''}
            `}
            title={collapsed ? item.label : undefined}
          >
            <item.icon size={20} className="flex-shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}
      </nav>
      
      <div className="p-4 border-t border-gray-700">
        <button
          onClick={disconnect}
          className={`
            flex items-center 
            ${collapsed ? 'justify-center' : 'space-x-3'} 
            px-4 py-3 
            rounded-lg 
            text-red-400 
            hover:text-red-300 
            hover:bg-gray-700 
            transition-all 
            duration-200 
            w-full
          `}
          title={collapsed ? 'Disconnect' : undefined}
        >
          <LogOut size={20} className="flex-shrink-0" />
          {!collapsed && <span>Disconnect</span>}
        </button>
      </div>

      {/* Collapse Toggle Button - Hidden on mobile */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="hidden lg:flex absolute -right-3 top-20 bg-gray-700 hover:bg-gray-600 text-white rounded-full p-1.5 transition-colors"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </div>
  )
}