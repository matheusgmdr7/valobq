'use client'

import React, { useState } from 'react'

interface TradingPanelProps {
  currentPrice: number
  onTrade: (type: 'call' | 'put', amount: number, duration: number) => void
}

const TradingPanel: React.FC<TradingPanelProps> = ({ currentPrice, onTrade }) => {
  const [amount, setAmount] = useState(100)
  const [duration, setDuration] = useState(60)
  const [isTrading, setIsTrading] = useState(false)

  const handleTrade = async (type: 'call' | 'put') => {
    setIsTrading(true)
    // Simular delay de trading
    await new Promise(resolve => setTimeout(resolve, 1000))
    onTrade(type, amount, duration)
    setIsTrading(false)
  }

  const amounts = [50, 100, 200, 500, 1000]
  const durations = [30, 60, 120, 300, 600] // em segundos

  return (
    <div className="bg-gray-900 rounded-lg p-6 w-80">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-white text-lg font-bold mb-2">Trading</h3>
        <div className="text-gray-400 text-sm">
          Preço atual: <span className="text-green-400 font-bold">{currentPrice.toFixed(5)}</span>
        </div>
      </div>

      {/* Valor da Aposta */}
      <div className="mb-4">
        <label className="block text-gray-300 text-sm mb-2">Valor da Aposta (R$)</label>
        <div className="flex space-x-2 mb-2">
          {amounts.map((value) => (
            <button
              key={value}
              onClick={() => setAmount(value)}
              className={`px-3 py-1 rounded text-sm ${
                amount === value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {value}
            </button>
          ))}
        </div>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
          min="10"
          max="10000"
        />
      </div>

      {/* Duração */}
      <div className="mb-6">
        <label className="block text-gray-300 text-sm mb-2">Duração</label>
        <div className="flex space-x-2 mb-2">
          {durations.map((dur) => (
            <button
              key={dur}
              onClick={() => setDuration(dur)}
              className={`px-3 py-1 rounded text-sm ${
                duration === dur
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {dur < 60 ? `${dur}s` : `${dur / 60}min`}
            </button>
          ))}
        </div>
        <input
          type="number"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
          min="10"
          max="3600"
        />
      </div>

      {/* Botões de Trading */}
      <div className="space-y-3">
        <button
          onClick={() => handleTrade('call')}
          disabled={isTrading}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
        >
          {isTrading ? 'Processando...' : 'CALL (ALTA)'}
        </button>
        
        <button
          onClick={() => handleTrade('put')}
          disabled={isTrading}
          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
        >
          {isTrading ? 'Processando...' : 'PUT (BAIXA)'}
        </button>
      </div>

      {/* Informações da Aposta */}
      <div className="mt-6 p-4 bg-gray-800 rounded-lg">
        <div className="text-gray-300 text-sm space-y-1">
          <div className="flex justify-between">
            <span>Valor:</span>
            <span className="text-white">R$ {amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Duração:</span>
            <span className="text-white">
              {duration < 60 ? `${duration}s` : `${(duration / 60).toFixed(1)}min`}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Lucro Potencial:</span>
            <span className="text-green-400">+{amount * 0.8}R$</span>
          </div>
          <div className="flex justify-between">
            <span>Payout:</span>
            <span className="text-green-400">80%</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TradingPanel


