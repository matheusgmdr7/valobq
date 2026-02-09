'use client'

import React, { useState, useEffect } from 'react'

interface MarketInfoProps {
  symbol: string
  currentPrice: number
  change: number
  changePercent: number
}

const MarketInfo: React.FC<MarketInfoProps> = ({ 
  symbol, 
  currentPrice, 
  change, 
  changePercent 
}) => {
  const [time, setTime] = useState<Date | null>(null)
  const [volume, setVolume] = useState(0)
  const [high24h, setHigh24h] = useState(0)
  const [low24h, setLow24h] = useState(0)

  useEffect(() => {
    // Gerar dados aleatórios apenas no cliente
    setVolume(Math.random() * 1000000 + 500000)
    setHigh24h(currentPrice * 1.02)
    setLow24h(currentPrice * 0.98)
    
    // Inicializar tempo no cliente
    setTime(new Date())

    const timer = setInterval(() => {
      setTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [currentPrice])

  const isPositive = change >= 0

  return (
    <div className="bg-gray-900 rounded-lg p-4 mb-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-white text-xl font-bold">{symbol}</h2>
          <p className="text-gray-400 text-sm">Over-the-Counter</p>
        </div>
        <div className="text-right">
          <div className="text-gray-400 text-sm">
            {time ? time.toLocaleTimeString('pt-BR') : '--:--:--'}
          </div>
          <div className="text-gray-500 text-xs">
            {time ? time.toLocaleDateString('pt-BR') : '--/--/----'}
          </div>
        </div>
      </div>

      {/* Preço e Variação */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-gray-400 text-sm mb-1">Preço Atual</div>
          <div className="text-white text-2xl font-bold">
            {currentPrice.toFixed(5)}
          </div>
        </div>
        <div>
          <div className="text-gray-400 text-sm mb-1">Variação</div>
          <div className={`text-lg font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{change.toFixed(5)}
          </div>
          <div className={`text-sm ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Estatísticas Adicionais */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-gray-400 text-xs mb-1">Máxima 24h</div>
            <div className="text-green-400 text-sm font-semibold">
              {high24h.toFixed(5)}
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-xs mb-1">Mínima 24h</div>
            <div className="text-red-400 text-sm font-semibold">
              {low24h.toFixed(5)}
            </div>
          </div>
          <div>
            <div className="text-gray-400 text-xs mb-1">Volume</div>
            <div className="text-white text-sm font-semibold">
              {volume.toFixed(0)}
            </div>
          </div>
        </div>
      </div>

      {/* Status do Mercado */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-green-400 text-sm">Mercado Aberto</span>
        </div>
        <div className="text-gray-400 text-xs">
          Próxima atualização em 1s
        </div>
      </div>
    </div>
  )
}

export default MarketInfo
