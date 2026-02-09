'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'

interface CandlestickData {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface ProfessionalChartProps {
  data: CandlestickData[]
  width: number
  height: number
  symbol: string
  timeframe: string
}

const ProfessionalChart: React.FC<ProfessionalChartProps> = ({ 
  data, 
  width, 
  height, 
  symbol, 
  timeframe 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [hoveredCandle, setHoveredCandle] = useState<number | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  const drawChart = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Verificar se estamos no cliente
    if (typeof window === 'undefined') return

    // Configurar canvas
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    // Limpar canvas
    ctx.clearRect(0, 0, width, height)

    // Fundo principal
    ctx.fillStyle = '#0d1117'
    ctx.fillRect(0, 0, width, height)

    // Área do gráfico (deixar espaço para eixos)
    const chartPadding = { top: 20, right: 60, bottom: 40, left: 80 }
    const chartWidth = width - chartPadding.left - chartPadding.right
    const chartHeight = height - chartPadding.top - chartPadding.bottom
    const chartX = chartPadding.left
    const chartY = chartPadding.top

    // Fundo da área do gráfico
    ctx.fillStyle = '#161b22'
    ctx.fillRect(chartX, chartY, chartWidth, chartHeight)

    if (data.length === 0) {
      setIsLoaded(true)
      return
    }

    // Calcular preços min/max
    const prices = data.flatMap(d => [d.open, d.high, d.low, d.close])
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const priceRange = maxPrice - minPrice
    const pricePadding = priceRange * 0.1

    const actualMinPrice = minPrice - pricePadding
    const actualMaxPrice = maxPrice + pricePadding
    const actualPriceRange = actualMaxPrice - actualMinPrice

    // Desenhar grid horizontal
    ctx.strokeStyle = '#21262d'
    ctx.lineWidth = 1
    ctx.setLineDash([1, 1])
    
    for (let i = 0; i <= 10; i++) {
      const y = chartY + (chartHeight / 10) * i
      ctx.beginPath()
      ctx.moveTo(chartX, y)
      ctx.lineTo(chartX + chartWidth, y)
      ctx.stroke()
    }

    // Desenhar grid vertical
    for (let i = 0; i <= 20; i++) {
      const x = chartX + (chartWidth / 20) * i
      ctx.beginPath()
      ctx.moveTo(x, chartY)
      ctx.lineTo(x, chartY + chartHeight)
      ctx.stroke()
    }

    ctx.setLineDash([])

    // Desenhar candlesticks
    const candleWidth = Math.max(2, chartWidth / data.length * 0.8)
    
    data.forEach((candle, index) => {
      const x = chartX + (index / data.length) * chartWidth
      
      // Calcular posições Y
      const openY = chartY + chartHeight - ((candle.open - actualMinPrice) / actualPriceRange) * chartHeight
      const closeY = chartY + chartHeight - ((candle.close - actualMinPrice) / actualPriceRange) * chartHeight
      const highY = chartY + chartHeight - ((candle.high - actualMinPrice) / actualPriceRange) * chartHeight
      const lowY = chartY + chartHeight - ((candle.low - actualMinPrice) / actualPriceRange) * chartHeight

      const isGreen = candle.close > candle.open
      const color = isGreen ? '#00d4aa' : '#ff6b6b'
      const bodyColor = isGreen ? '#00d4aa' : '#ff6b6b'

      // Linha alta-baixa (wick)
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, highY)
      ctx.lineTo(x, lowY)
      ctx.stroke()

      // Corpo da vela
      const bodyTop = Math.min(openY, closeY)
      const bodyHeight = Math.abs(closeY - openY)
      
      if (bodyHeight > 0) {
        ctx.fillStyle = bodyColor
        ctx.fillRect(x - candleWidth/2, bodyTop, candleWidth, bodyHeight)
      } else {
        // Linha horizontal para doji
        ctx.strokeStyle = color
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x - candleWidth/2, openY)
        ctx.lineTo(x + candleWidth/2, openY)
        ctx.stroke()
      }

      // Borda da vela
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.strokeRect(x - candleWidth/2, bodyTop, candleWidth, bodyHeight)
    })

    // Desenhar eixos Y (preços)
    ctx.fillStyle = '#7d8590'
    ctx.font = '11px Inter, sans-serif'
    ctx.textAlign = 'right'
    
    for (let i = 0; i <= 10; i++) {
      const price = actualMinPrice + (actualPriceRange / 10) * i
      const y = chartY + (chartHeight / 10) * i
      ctx.fillText(price.toFixed(5), chartX - 10, y + 4)
    }

    // Desenhar eixos X (tempo)
    ctx.textAlign = 'center'
    const timeLabels = data.filter((_, i) => i % Math.ceil(data.length / 10) === 0)
    
    timeLabels.forEach((candle, index) => {
      const x = chartX + (data.indexOf(candle) / data.length) * chartWidth
      const time = new Date(candle.time).toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
      ctx.fillText(time, x, chartY + chartHeight + 20)
    })

    // Desenhar informações do hover
    if (hoveredCandle !== null && data[hoveredCandle]) {
      const candle = data[hoveredCandle]
      const x = chartX + (hoveredCandle / data.length) * chartWidth
      
      // Linha vertical
      ctx.strokeStyle = '#f0f6fc'
      ctx.lineWidth = 1
      ctx.setLineDash([2, 2])
      ctx.beginPath()
      ctx.moveTo(x, chartY)
      ctx.lineTo(x, chartY + chartHeight)
      ctx.stroke()
      ctx.setLineDash([])

      // Tooltip
      const tooltipWidth = 200
      const tooltipHeight = 120
      const tooltipX = Math.min(x + 10, width - tooltipWidth - 10)
      const tooltipY = Math.max(10, chartY + 10)

      // Fundo do tooltip
      ctx.fillStyle = '#161b22'
      ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight)

      // Borda do tooltip
      ctx.strokeStyle = '#30363d'
      ctx.lineWidth = 1
      ctx.strokeRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight)

      // Texto do tooltip
      ctx.fillStyle = '#f0f6fc'
      ctx.font = '12px Inter, sans-serif'
      ctx.textAlign = 'left'
      
      const time = new Date(candle.time).toLocaleString('pt-BR')
      ctx.fillText(`Tempo: ${time}`, tooltipX + 10, tooltipY + 20)
      ctx.fillText(`Abertura: ${candle.open.toFixed(5)}`, tooltipX + 10, tooltipY + 40)
      ctx.fillText(`Máxima: ${candle.high.toFixed(5)}`, tooltipX + 10, tooltipY + 60)
      ctx.fillText(`Mínima: ${candle.low.toFixed(5)}`, tooltipX + 10, tooltipY + 80)
      ctx.fillText(`Fechamento: ${candle.close.toFixed(5)}`, tooltipX + 10, tooltipY + 100)
    }

    setIsLoaded(true)
  }, [data, width, height, hoveredCandle])

  useEffect(() => {
    // Garantir que estamos no cliente antes de desenhar
    if (typeof window !== 'undefined') {
      drawChart()
    }
  }, [drawChart])

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setMousePos({ x, y })

    // Calcular qual candlestick está sendo hovered
    const chartPadding = { left: 80, right: 60 }
    const chartWidth = width - chartPadding.left - chartPadding.right
    const chartX = chartPadding.left

    if (x >= chartX && x <= chartX + chartWidth) {
      const candleIndex = Math.floor(((x - chartX) / chartWidth) * data.length)
      setHoveredCandle(Math.max(0, Math.min(data.length - 1, candleIndex)))
    } else {
      setHoveredCandle(null)
    }
  }

  const handleMouseLeave = () => {
    setHoveredCandle(null)
  }

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        className="cursor-crosshair"
        style={{
          width: width,
          height: height,
        }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      
      {/* Header do gráfico */}
      <div className="absolute top-0 left-0 right-0 bg-gray-900 px-4 py-2 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <span className="text-white font-bold text-lg">{symbol}</span>
          <span className="text-gray-400 text-sm">{timeframe}</span>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-green-400 text-sm">
            {data.length > 0 ? data[data.length - 1].close.toFixed(5) : '0.00000'}
          </div>
          <div className="text-gray-400 text-xs">
            {data.length > 0 ? new Date(data[data.length - 1].time).toLocaleTimeString('pt-BR') : ''}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ProfessionalChart
