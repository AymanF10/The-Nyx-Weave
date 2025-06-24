import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import {WalletProvider} from '@/components'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Solana Arbitrage Platform',
  description: 'Automated intra-pool arbitrage on Solana',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-900 text-white`}>
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  )
}