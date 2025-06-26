'use client'
import { ArrowRight, Zap, Shield, TrendingUp, BarChart3, Wallet, ChevronRight } from 'lucide-react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LandingPage() {
  const { connected } = useWallet()
  const { setVisible } = useWalletModal()
  const router = useRouter()

  useEffect(() => {
    if (connected) {
      router.push('/dashboard')
    }
  }, [connected, router])

  const handleConnect = () => {
    setVisible(true)
  }

  const features = [
    {
      icon: Zap,
      title: 'Lightning Fast Execution',
      description: 'Automated arbitrage bot executes trades in milliseconds across Solana pools'
    },
    {
      icon: Shield,
      title: 'Secure & Transparent',
      description: 'Your funds are secured in individual PDAs with full on-chain transparency'
    },
    {
      icon: TrendingUp,
      title: 'Optimized Profits',
      description: 'Advanced algorithms maximize profit while minimizing gas costs and slippage'
    },
    {
      icon: BarChart3,
      title: 'Real-time Analytics',
      description: 'Monitor performance, track profits, and analyze trades in real-time'
    }
  ]

  const stats = [
    { label: 'Total Volume', value: '$12.8M+' },
    { label: 'Active Users', value: '2,847' },
    { label: 'Success Rate', value: '94.7%' },
    { label: 'Avg. APY', value: '18.4%' }
  ]

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full bg-gray-900/80 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-purple-800 rounded-lg"></div>
              <span className="font-bold text-xl">Nyx Weave</span>
            </div>
            <button
              onClick={handleConnect}
              className="btn-primary flex items-center space-x-2"
            >
              <Wallet size={20} />
              <span>Connect Wallet</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Automated Arbitrage on Solana
          </h1>
          <p className="text-xl text-gray-400 mb-8 max-w-3xl mx-auto">
            Maximize your returns with our advanced intra-pool arbitrage bot. 
            Deposit your assets and let our algorithms work 24/7 to capture profit opportunities.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleConnect}
              className="btn-primary text-lg px-8 py-3 flex items-center justify-center space-x-2"
            >
              <span>Start Earning</span>
              <ArrowRight size={20} />
            </button>
            <Link href="#features" className="btn-secondary text-lg px-8 py-3">
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 border-t border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <p className="text-3xl md:text-4xl font-bold text-purple-400">{stat.value}</p>
                <p className="text-gray-400 mt-2">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Why Choose Our Platform?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="card hover:border-purple-500/50 transition-colors">
                <feature.icon className="w-12 h-12 text-purple-500 mb-4" />
                <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-4 bg-gray-800/30">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Connect & Deposit</h3>
              <p className="text-gray-400">Connect your wallet and deposit SOL or SPL tokens into the arbitrage vault</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Bot Executes Trades</h3>
              <p className="text-gray-400">Our bot monitors pools 24/7 and executes profitable arbitrage trades</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-2">Earn Profits</h3>
              <p className="text-gray-400">Profits are automatically distributed to your account after each trade</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Start Earning?
          </h2>
          <p className="text-xl text-gray-400 mb-8">
            Join thousands of users already earning passive income through automated arbitrage
          </p>
          <button
            onClick={handleConnect}
            className="btn-primary text-lg px-8 py-3 flex items-center justify-center space-x-2 mx-auto"
          >
            <Wallet size={24} />
            <span>Connect Wallet to Start</span>
            <ChevronRight size={20} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 px-4">
        <div className="max-w-7xl mx-auto text-center text-gray-400">
          <p>&copy; 2024 Nyx Weave. Built on Solana.</p>
        </div>
      </footer>
    </div>
  )
}