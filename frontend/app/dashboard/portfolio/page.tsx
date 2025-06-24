"use client";
import { useState } from "react";
import {
  Wallet,
  TrendingUp,
  DollarSign,
  Clock,
  Plus,
  Minus,
} from "lucide-react";
import { Modal } from "@/components";

export default function Portfolio() {
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  const portfolioStats = {
    totalDeposited: "$45,892",
    totalProfit: "$3,847",
    roi: "8.38%",
    activeDays: 47,
  };

  const holdings = [
    {
      token: "SOL",
      amount: 523.45,
      value: "$12,847",
      allocation: "28%",
      profit: "+$892",
      apy: "12.4%",
    },
    {
      token: "USDC",
      amount: 15000,
      value: "$15,000",
      allocation: "33%",
      profit: "+$450",
      apy: "8.2%",
    },
    {
      token: "RAY",
      amount: 2847.23,
      value: "$8,294",
      allocation: "18%",
      profit: "+$623",
      apy: "15.7%",
    },
    {
      token: "JUP",
      amount: 8492.1,
      value: "$9,751",
      allocation: "21%",
      profit: "+$1,882",
      apy: "24.1%",
    },
  ];

  return (
    <div className="py-6 sm:py-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Portfolio</h1>
        <p className="text-gray-400 text-sm sm:text-base">
          Manage your deposits and track performance
        </p>
      </div>

      {/* Portfolio Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div className="card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <Wallet className="text-purple-500" size={20} />
            <span className="text-xs text-gray-400">Total</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold">
            {portfolioStats.totalDeposited}
          </p>
          <p className="text-xs sm:text-sm text-gray-400">Deposited</p>
        </div>

        <div className="card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="text-green-500" size={20} />
            <span className="text-xs text-gray-400">Lifetime</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-green-400">
            {portfolioStats.totalProfit}
          </p>
          <p className="text-xs sm:text-sm text-gray-400">Profit Earned</p>
        </div>

        <div className="card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="text-blue-500" size={20} />
            <span className="text-xs text-gray-400">Performance</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold">{portfolioStats.roi}</p>
          <p className="text-xs sm:text-sm text-gray-400">ROI</p>
        </div>

        <div className="card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-2">
            <Clock className="text-yellow-500" size={20} />
            <span className="text-xs text-gray-400">Duration</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold">
            {portfolioStats.activeDays}
          </p>
          <p className="text-xs sm:text-sm text-gray-400">Active Days</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6 sm:mb-8">
        <button
          onClick={() => setShowDepositModal(true)}
          className="btn-primary flex items-center justify-center space-x-2 flex-1 sm:flex-none"
        >
          <Plus size={20} />
          <span>Deposit</span>
        </button>
        <button
          onClick={() => setShowWithdrawModal(true)}
          className="btn-secondary flex items-center justify-center space-x-2 flex-1 sm:flex-none"
        >
          <Minus size={20} />
          <span>Withdraw</span>
        </button>
      </div>

      {/* Holdings Table - Mobile */}
      <div className="block sm:hidden space-y-4 mb-6">
        {holdings.map((holding) => (
          <div key={holding.token} className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                  <span className="text-xs font-bold">{holding.token[0]}</span>
                </div>
                <div>
                  <p className="font-medium">{holding.token}</p>
                  <p className="text-xs text-gray-400">
                    {holding.amount.toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium">{holding.value}</p>
                <p className="text-xs text-green-400">{holding.profit}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2">
                <span className="text-gray-400">Allocation:</span>
                <span>{holding.allocation}</span>
              </div>
              <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded">
                {holding.apy} APY
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Holdings Table - Desktop */}
      <div className="hidden sm:block card p-4 sm:p-6">
        <h3 className="text-lg sm:text-xl font-semibold mb-4">Your Holdings</h3>
        <div className="overflow-x-auto -mx-4 sm:-mx-6">
          <div className="inline-block min-w-full align-middle px-4 sm:px-6">
            <table className="min-w-full">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="pb-3 text-sm">Token</th>
                  <th className="pb-3 text-sm">Amount</th>
                  <th className="pb-3 text-sm">Value</th>
                  <th className="pb-3 text-sm">Allocation</th>
                  <th className="pb-3 text-sm">Profit</th>
                  <th className="pb-3 text-sm">APY</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((holding) => (
                  <tr
                    key={holding.token}
                    className="border-b border-gray-700/50"
                  >
                    <td className="py-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                          <span className="text-xs font-bold">
                            {holding.token[0]}
                          </span>
                        </div>
                        <span className="font-medium">{holding.token}</span>
                      </div>
                    </td>
                    <td className="py-4">{holding.amount.toLocaleString()}</td>
                    <td className="py-4 font-medium">{holding.value}</td>
                    <td className="py-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-16 bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-purple-500 h-2 rounded-full"
                            style={{ width: holding.allocation }}
                          ></div>
                        </div>
                        <span className="text-sm">{holding.allocation}</span>
                      </div>
                    </td>
                    <td className="py-4 text-green-400">{holding.profit}</td>
                    <td className="py-4">
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-sm">
                        {holding.apy}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Deposit Modal */}
      {showDepositModal && (
        <Modal onClose={() => setShowDepositModal(false)}>
          <h2 className="text-xl sm:text-2xl font-bold mb-4">Deposit Funds</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Select Token
              </label>
              <select className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg">
                <option>SOL</option>
                <option>USDC</option>
                <option>RAY</option>
                <option>JUP</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Amount</label>
              <input
                type="number"
                placeholder="0.00"
                className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg"
              />
            </div>
            <button className="w-full btn-primary">Confirm Deposit</button>
          </div>
        </Modal>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <Modal onClose={() => setShowWithdrawModal(false)}>
          <h2 className="text-xl sm:text-2xl font-bold mb-4">Withdraw Funds</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Select Token
              </label>
              <select className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg">
                <option>SOL - Available: 523.45</option>
                <option>USDC - Available: 15,000</option>
                <option>RAY - Available: 2,847.23</option>
                <option>JUP - Available: 8,492.10</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Amount</label>
              <input
                type="number"
                placeholder="0.00"
                className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg"
              />
            </div>
            <button className="w-full btn-primary">Confirm Withdrawal</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
