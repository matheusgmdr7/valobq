/**
 * TradingViewChart - Componente de Gráfico usando TradingView Lightweight Charts
 * 
 * Substitui o motor WebGL customizado por uma solução profissional e testada
 */

'use client';

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData as TVCandlestickData } from 'lightweight-charts';
import { useRealtimeStream } from '@/hooks/useRealtimeStream';
import { logger } from '@/utils/logger';

export type Timeframe = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';

export interface TradingViewChartProps {
  symbol: string;
  timeframe?: Timeframe;
  width?: number;
  height?: number;
  className?: string;
  onPriceUpdate?: (price: number) => void;
}

export interface TradingViewChartRef {
  getChart: () => IChartApi | null;
  getSeries: () => ISeriesApi<'Candlestick'> | null;
  exportAsImage: (format: 'png' | 'jpeg' | 'svg') => Promise<string | null>;
  exportAsCSV: () => string;
  exportAsJSON: () => string;
  copyToClipboard: () => Promise<boolean>;
  print: () => void;
}

/**
 * Converte CandlestickData do nosso formato para formato TradingView
 */
function convertToTradingViewFormat(
  candles: Array<{ timestamp: number; open: number; high: number; low: number; close: number; volume?: number }>
): TVCandlestickData[] {
  return candles.map(candle => ({
    time: (candle.timestamp / 1000) as any, // TradingView espera timestamp em segundos
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    ...(candle.volume && { volume: candle.volume })
  }));
}

/**
 * Helper para verificar se o chart está disponível e não foi disposed
 * Retorna true se o chart pode ser usado com segurança
 */
function isChartAvailable(chart: IChartApi | null, series: ISeriesApi<'Candlestick'> | null): boolean {
  if (!chart || !series) {
    return false;
  }
  
  try {
    // Tentar acessar uma propriedade do chart para verificar se não foi disposed
    // Se o chart foi disposed, isso lançará um erro
    chart.timeScale();
    return true;
  } catch (error: any) {
    // Se o erro contém "disposed" ou "null", o chart não está mais disponível
    if (error?.message?.includes('disposed') || error?.message?.includes('null')) {
      return false;
    }
    // Outros erros podem ser válidos, então assumimos que o chart está disponível
    return true;
  }
}

/**
 * Helper para forçar atualização de candle usando setData() para garantir renderização visual
 * Esta função sempre usa setData() que força re-render completo do canvas
 */
function forceUpdateCandle(
  series: ISeriesApi<'Candlestick'>,
  candle: TVCandlestickData
): void {
  try {
    const allData = series.data();
    if (allData.length > 0) {
      // Verificar se é o último candle (mesmo timestamp) ou um novo candle
      const lastCandle = allData[allData.length - 1];
      const isLastCandle = lastCandle && (lastCandle.time === candle.time);
      
      let newData: TVCandlestickData[];
      if (isLastCandle) {
        // Atualizar último candle
        newData = allData.map((c, index) => {
          if (index === allData.length - 1) {
            return { ...candle };
          }
          return { ...c };
        });
      } else {
        // Adicionar novo candle
        newData = [...allData, { ...candle }];
      }
      
      // CRÍTICO: Usar setData() para forçar re-render completo
      series.setData(newData);
    } else {
      // Primeiro candle - usar setData() com array contendo apenas este candle
      series.setData([{ ...candle }]);
    }
  } catch (error) {
    // Fallback: usar update() se setData() falhar
    series.update(candle);
  }
}

/**
 * TAREFA 1: Função utilitária para calcular o tempo do bar (início do período em segundos)
 * Garante que o time seja sempre o início do período (minuto, hora, etc) como inteiro em segundos
 */
function getBarTime(timestampMs: number, timeframe: Timeframe = '1m'): number {
  // Converter timeframe para milissegundos
  const timeframeMs: Record<Timeframe, number> = {
    '1m': 60000,      // 1 minuto
    '5m': 300000,     // 5 minutos
    '15m': 900000,    // 15 minutos
    '30m': 1800000,   // 30 minutos
    '1h': 3600000,    // 1 hora
    '4h': 14400000,   // 4 horas
    '1d': 86400000,   // 1 dia
  };
  
  const periodMs = timeframeMs[timeframe];
  // Arredonda para o início do período (floor)
  const periodStartMs = Math.floor(timestampMs / periodMs) * periodMs;
  // Converte para SEGUNDOS (inteiro) - TradingView espera inteiro em segundos
  return Math.floor(periodStartMs / 1000);
}

/**
 * Componente de Gráfico TradingView
 */
export const TradingViewChart = forwardRef<TradingViewChartRef, TradingViewChartProps>(
  ({ symbol, timeframe = '1m', width, height, className = '', onPriceUpdate }, ref) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
    const lastCandleTimeRef = useRef<number | null>(null);
    const historicalDataLoadedRef = useRef(false);
    const lastCandleDataRef = useRef<{ time?: number; open: number; high: number; low: number; close: number } | null>(null);
    const lastProcessedTickRef = useRef<{ timestamp: number; price: number; processTime?: number } | null>(null);
    const isLastCandleHistoricalRef = useRef<boolean>(true); // Flag para indicar se o último candle é histórico

    // Hook para dados em tempo real via WebSocket
    const { isConnected, lastTick, error } = useRealtimeStream({
      symbol,
      wsUrl: process.env.NEXT_PUBLIC_MARKET_DATA_WS_URL || 'ws://localhost:8080'
    });

    // Inicializar gráfico - recriar quando símbolo ou timeframe mudar
    useEffect(() => {
      if (!chartContainerRef.current) {
        return;
      }

      // Limpar gráfico anterior se existir (importante quando símbolo ou timeframe muda)
      if (chartRef.current) {
        logger.log('🧹 [TradingViewChart] Limpando gráfico anterior para', symbol, 'timeframe:', timeframe);
        try {
          chartRef.current.remove();
        } catch (error) {
          // Ignorar erros se o chart já foi removido/disposed
          logger.debug('⚠️ [TradingViewChart] Chart já removido ou disposed');
        }
        chartRef.current = null;
        seriesRef.current = null;
        // Resetar todas as referências
        lastCandleTimeRef.current = null;
        lastCandleDataRef.current = null;
        historicalDataLoadedRef.current = false;
        lastProcessedTickRef.current = null;
        isLastCandleHistoricalRef.current = true;
      }

      logger.log('📊 [TradingViewChart] Inicializando gráfico para', symbol);

      // Aguardar um frame para garantir que o container tenha dimensões
      requestAnimationFrame(() => {
        if (!chartContainerRef.current) return;

        // Obter dimensões do container
        const containerWidth = chartContainerRef.current.clientWidth || chartContainerRef.current.offsetWidth || width || 800;
        const containerHeight = chartContainerRef.current.clientHeight || chartContainerRef.current.offsetHeight || height || 600;

        logger.debug(`📐 [TradingViewChart] Dimensões do container: ${containerWidth}x${containerHeight}`);

        // Criar gráfico com design melhorado e animação fluida
        const chart = createChart(chartContainerRef.current, {
          width: containerWidth,
          height: containerHeight,
          autoSize: false, // CRÍTICO: Desabilitar autoSize quando especificamos width/height explicitamente
          // CRÍTICO: Configurações para garantir animação fluida e contínua
          // O TradingView usa requestAnimationFrame internamente, mas podemos forçar atualizações mais frequentes
          layout: {
            background: { type: 'solid', color: '#000000' }, // Fundo preto sólido
            textColor: '#9ca3af', // Texto cinza claro
            fontSize: 12,
          },
          // CRÍTICO: Desabilitar otimizações que podem impedir animação fluida
          // Isso força o TradingView a renderizar mais frequentemente
          crosshair: {
            mode: 0, // Normal crosshair
            vertLine: {
              color: '#6b7280',
              width: 1,
              style: 0,
              labelBackgroundColor: '#1f2937',
            },
            horzLine: {
              color: '#6b7280',
              width: 1,
              style: 0,
              labelBackgroundColor: '#1f2937',
            },
          },
          handleScroll: {
            mouseWheel: true,
            pressedMouseMove: true,
            horzTouchDrag: true,
            vertTouchDrag: true,
          },
          handleScale: {
            axisPressedMouseMove: true,
            mouseWheel: true,
            pinch: true,
          },
          grid: {
            vertLines: { 
              visible: false, // Remover linhas verticais
            },
            horzLines: { 
              visible: false, // Remover linhas horizontais
            },
          },
          crosshair: {
            mode: 1, // Modo normal
            vertLine: {
              color: '#4b5563',
              width: 1,
              style: 2, // Linha tracejada
              labelBackgroundColor: '#1f2937',
            },
            horzLine: {
              color: '#4b5563',
              width: 1,
              style: 2, // Linha tracejada
              labelBackgroundColor: '#1f2937',
            },
          },
          rightPriceScale: {
            borderColor: '#1f2937',
            scaleMargins: {
              top: 0.1,
              bottom: 0.1,
            },
            autoScale: true, // CRÍTICO: Forçar auto-scale para garantir atualização visual
          },
          timeScale: {
            borderColor: '#1f2937',
            timeVisible: true,
            secondsVisible: false,
            rightOffset: 5, // Pequeno offset para garantir que o último candle seja visível
            barSpacing: 3,
            minBarSpacing: 0.5,
            rightBarStaysOnScroll: true, // Manter último candle visível ao scroll
            fixLeftEdge: false,
            fixRightEdge: false,
            allowBoldLabels: true,
            lockVisibleTimeRangeOnResize: false, // Permitir ajuste automático
            // CRÍTICO: Configurações para garantir scroll automático e atualização visual
            shiftVisibleRangeOnNewBar: true, // Mover viewport automaticamente quando novo candle é criado
            autoScale: true, // CRÍTICO: Forçar auto-scale para garantir atualização visual
          },
        });

        // Criar série de candlesticks com cores melhoradas
        const candlestickSeries = chart.addCandlestickSeries({
          upColor: '#10b981', // Verde mais suave
          downColor: '#ef4444', // Vermelho mais suave
          borderVisible: false,
          wickUpColor: '#10b981',
          wickDownColor: '#ef4444',
          priceFormat: {
            type: 'price',
            precision: 5,
            minMove: 0.00001,
          },
        });

        chartRef.current = chart;
        seriesRef.current = candlestickSeries;

        // Carregar dados históricos iniciais (simulado) - sempre recarregar para o novo símbolo
        loadHistoricalData(candlestickSeries, symbol).then(() => {
          // CRÍTICO: Forçar atualização completa do gráfico após carregar dados históricos
          // Isso garante que a escala seja recalculada corretamente quando o símbolo ou timeframe muda
          setTimeout(() => {
            if (chartRef.current && candlestickSeries) {
              const timeScale = chartRef.current.timeScale();
              const now = Date.now() / 1000; // Timestamp atual em segundos
              
              try {
                // Obter o último candle histórico
                const allData = candlestickSeries.data();
                const lastCandle = allData[allData.length - 1];
                const lastCandleTime = lastCandle ? (lastCandle.time as number) : now;
                
                // CRÍTICO: Forçar recálculo da escala de preço ANTES de ajustar o viewport
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    if (chartRef.current && candlestickSeries) {
                      try {
                        // 1. Forçar recálculo da escala de preço
                        const priceScale = chartRef.current.priceScale('right');
                        if (priceScale) {
                          priceScale.applyOptions({ autoScale: true });
                          logger.log(`  🔄 [TradingViewChart] Escala de preço forçada a recalcular após carregar dados históricos`);
                        }
                        
                        // 2. Ajustar o range visível para mostrar os últimos períodos
                        const timeScale = chartRef.current.timeScale();
                        const timeframeMs: Record<Timeframe, number> = {
                          '1m': 60000, '5m': 300000, '15m': 900000, '30m': 1800000,
                          '1h': 3600000, '4h': 14400000, '1d': 86400000,
                        };
                        const periodMs = timeframeMs[timeframe];
                        const periodSeconds = periodMs / 1000;
                        const newFrom = lastCandleTime - (periodSeconds * 20); // 20 períodos antes do último candle
                        const newTo = lastCandleTime + periodSeconds; // Um período depois do último candle
                        
                        timeScale.setVisibleRange({
                          from: newFrom,
                          to: newTo,
                        }, { applyRightMargin: true });
                        
                        // 3. Forçar scroll para tempo real
                        timeScale.scrollToRealTime();
                        
                        logger.debug(`📊 [TradingViewChart] Viewport inicial ajustado:`, {
                          from: new Date(newFrom * 1000).toISOString(),
                          to: new Date(newTo * 1000).toISOString(),
                          ultimoCandle: new Date(lastCandleTime * 1000).toISOString()
                        });
                      } catch (error: any) {
                        // Ignorar erros de "Object is disposed" ou "Value is null"
                        if (error?.message?.includes('disposed') || error?.message?.includes('null')) {
                          logger.debug('⚠️ [TradingViewChart] Chart não disponível para ajustar viewport');
                        } else {
                          logger.warn('⚠️ [TradingViewChart] Erro ao ajustar viewport inicial:', error);
                        }
                      }
                    }
                  });
                });
              } catch (error: any) {
                // Ignorar erros de "Object is disposed"
                if (error?.message?.includes('disposed')) {
                  logger.debug('⚠️ [TradingViewChart] Chart foi disposed, ignorando ajuste de viewport');
                } else {
                  logger.warn('⚠️ [TradingViewChart] Erro ao ajustar viewport inicial:', error);
                }
              }
            }
          }, 200); // Aumentar delay para garantir que os dados foram carregados
        });

        logger.log('✅ [TradingViewChart] Gráfico inicializado');
      });

      return () => {
        // CRÍTICO: Limpar todas as referências e operações pendentes
        logger.debug('🧹 [TradingViewChart] Limpando gráfico no cleanup');
        
        // Marcar como disposed para evitar operações futuras
        const chart = chartRef.current;
        const series = seriesRef.current;
        
        // Limpar referências primeiro para evitar operações assíncronas
        chartRef.current = null;
        seriesRef.current = null;
        
        // Resetar todas as referências
        lastCandleTimeRef.current = null;
        lastCandleDataRef.current = null;
        historicalDataLoadedRef.current = false;
        lastProcessedTickRef.current = null;
        isLastCandleHistoricalRef.current = true;
        
        // Remover chart apenas se ainda existir e não foi disposed
        if (chart) {
          try {
            // Verificar se o chart ainda está disponível antes de remover
            if (isChartAvailable(chart, series)) {
              chart.remove();
            }
          } catch (error: any) {
            // Ignorar erros de "Object is disposed" - é esperado durante cleanup
            if (!error?.message?.includes('disposed') && !error?.message?.includes('null')) {
              logger.debug('⚠️ [TradingViewChart] Erro ao remover chart:', error);
            }
          }
        }
      };
    }, [symbol, timeframe, width, height]); // CRÍTICO: Incluir timeframe nas dependências

    // CRÍTICO: Quando o símbolo ou timeframe mudar, resetar COMPLETAMENTE todas as referências
    // Isso força recriação completa do gráfico como se recarregasse a página
    useEffect(() => {
      logger.log(`🔄 [TradingViewChart] Símbolo mudou para ${symbol} ou timeframe mudou para ${timeframe} - resetando completamente`);
      
      // Resetar todas as referências
      lastProcessedTickRef.current = null;
      lastCandleTimeRef.current = null;
      lastCandleDataRef.current = null;
      historicalDataLoadedRef.current = false;
      isLastCandleHistoricalRef.current = true;
      
      // CRÍTICO: Forçar recriação completa do gráfico
      // O useEffect de inicialização (que depende de symbol e timeframe) vai recriar o gráfico
      // Não precisamos fazer nada aqui, apenas resetar as referências
      // O key prop no componente pai já força a remontagem completa
    }, [symbol, timeframe]);

    // Atualização periódica para forçar re-render visual e scroll para tempo real
    // Usar técnicas que não interferem com a animação natural, mas garantem renderização
    useEffect(() => {
      if (!chartRef.current || !seriesRef.current) {
        return;
      }
      
      let frameCount = 0;
      const interval = setInterval(() => {
        if (!chartRef.current || !seriesRef.current) {
          return;
        }
        
        try {
          frameCount++;
          
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (chartRef.current && seriesRef.current) {
                try {
                  // 1. Forçar scroll para tempo real
                  const timeScale = chartRef.current.timeScale();
                  timeScale.scrollToRealTime();
                  
                  // 2. Forçar atualização do price scale
                  const priceScale = chartRef.current.priceScale('right');
                  if (priceScale) {
                    priceScale.applyOptions({ autoScale: true });
                  }
                  
                  // 3. A cada 10 segundos (10 iterações), forçar re-render completo usando setData()
                  // Isso garante que o canvas seja completamente re-renderizado periodicamente
                  // sem ser muito agressivo (a cada 10 segundos)
                  if (frameCount >= 10) {
                    frameCount = 0;
                    const allData = seriesRef.current.data();
                    if (allData.length > 0) {
                      // Criar novo array com novas referências para forçar re-render
                      const newData = allData.map(candle => ({ ...candle }));
                      seriesRef.current.setData(newData);
                    }
                  }
                  
                  // 4. Forçar resize do canvas (mesmo tamanho) para invalidar e re-renderizar
                  const container = chartContainerRef.current;
                  if (container) {
                    const width = container.clientWidth;
                    const height = container.clientHeight;
                    chartRef.current.resize(width, height);
                  }
                } catch (error) {
                  // Ignorar erros silenciosamente
                }
              }
            });
          });
        } catch (error) {
          // Ignorar erros silenciosamente
        }
      }, 1000); // A cada 1 segundo
      
      return () => clearInterval(interval);
    }, [symbol, timeframe]);

    /**
     * Carrega dados históricos iniciais (simulado)
     * TODO: Substituir por chamada real à API de histórico
     */
    /**
     * Busca dados históricos reais via API route do Next.js
     * A API key fica no servidor, não exposta no cliente
     */
    const fetchHistoricalData = async (symbol: string, limit: number = 500): Promise<TVCandlestickData[]> => {
      try {
        const url = `/api/market/historical?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}&limit=${limit}`;
        
        logger.log(`📡 [TradingViewChart] Buscando dados históricos REAIS: ${symbol} (${timeframe})`);
        
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        
        if (!response.ok) {
          let errorMessage = `API error: ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch {
            // Se não conseguir parsear JSON, usar texto da resposta
            const errorText = await response.text().catch(() => '');
            errorMessage = errorText || errorMessage;
          }
          logger.error(`❌ [TradingViewChart] Erro ao buscar dados históricos: ${errorMessage}`);
          throw new Error(errorMessage);
        }
        
        const data = await response.json();
        
        // Verificar se há erro na resposta (mesmo com status 200)
        if (data.error) {
          logger.error(`❌ [TradingViewChart] Erro na resposta da API: ${data.error}`);
          throw new Error(data.error);
        }
        
        if (!data.candles || data.candles.length === 0) {
          logger.warn(`⚠️ [TradingViewChart] Nenhum candle histórico retornado para ${symbol}`);
          return [];
        }
        
        // Converter timestamps para formato TradingView (início do período em segundos)
        const candles: TVCandlestickData[] = data.candles.map((candle: any) => {
          const timestampMs = candle.time * 1000; // Converter de segundos para milissegundos
          const candleTime = getBarTime(timestampMs, timeframe); // Normalizar para início do período
          
          return {
            time: candleTime as any,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          };
        });
        
        logger.log(`✅ [TradingViewChart] ${candles.length} candles históricos REAIS recebidos para ${symbol}`);
        return candles;
      } catch (error: any) {
        logger.error(`❌ [TradingViewChart] Erro ao buscar dados históricos:`, error);
        return [];
      }
    };

    const loadHistoricalData = async (series: ISeriesApi<'Candlestick'>, currentSymbol: string): Promise<void> => {
      // Sempre recarregar quando o símbolo mudar (não verificar historicalDataLoadedRef)
      return new Promise(async (resolve) => {
        try {
          logger.log(`📊 [TradingViewChart] Carregando dados históricos REAIS para ${currentSymbol}`);
          
          // Limpar dados anteriores
          series.setData([]);
          
          // Buscar dados históricos reais via API route
          const candles = await fetchHistoricalData(currentSymbol, 500);
          
          // Se não conseguiu buscar dados reais, usar array vazio (não simular)
          if (candles.length === 0) {
            logger.warn(`⚠️ [TradingViewChart] Não foi possível carregar dados históricos para ${currentSymbol}. O gráfico será preenchido com dados em tempo real.`);
            // Inicializar com array vazio - os dados virão em tempo real
            series.setData([]);
            // CRÍTICO: Resetar referências quando não há histórico
            lastCandleTimeRef.current = null;
            lastCandleDataRef.current = null;
            isLastCandleHistoricalRef.current = false;
            historicalDataLoadedRef.current = true; // Marcar como carregado para permitir processamento de ticks
            resolve();
            return;
          }

          series.setData(candles);
          historicalDataLoadedRef.current = true;
          
          logger.log(`  📊 [TradingViewChart] ${candles.length} candles históricos carregados na série`);
          logger.log(`  📊 [TradingViewChart] Primeiro candle:`, candles[0]);
          logger.log(`  📊 [TradingViewChart] Último candle:`, candles[candles.length - 1]);
          
          // Inicializar referência do último candle histórico
          if (candles.length > 0) {
            const lastCandle = candles[candles.length - 1];
            // Converter timestamp de segundos (TradingView) para milissegundos
            const lastCandleTimeMs = (lastCandle.time as number) * 1000;
            lastCandleTimeRef.current = lastCandleTimeMs;
            // CRÍTICO: Incluir o time no lastCandleDataRef para uso posterior
            lastCandleDataRef.current = {
              time: lastCandle.time, // Incluir time em segundos
              open: lastCandle.open,
              high: lastCandle.high,
              low: lastCandle.low,
              close: lastCandle.close,
            };
            logger.log(`📌 [TradingViewChart] Último candle histórico: ${lastCandle.close.toFixed(5)} (time: ${new Date(lastCandleTimeMs).toISOString()}, timestamp: ${lastCandleTimeMs})`);
            isLastCandleHistoricalRef.current = true; // Marcar como histórico
          }
          
          logger.log(`✅ [TradingViewChart] ${candles.length} candles históricos carregados`);
          
          // CRÍTICO: Forçar atualização completa do gráfico após carregar dados históricos
          // Isso garante que a escala seja recalculada corretamente quando o símbolo muda
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              // Verificar se o componente ainda está montado e o chart existe
              if (!chartRef.current || !seriesRef.current || !chartContainerRef.current) {
                logger.debug('⚠️ [TradingViewChart] Chart não disponível, pulando atualização');
                return;
              }
              
              try {
                // Forçar recálculo da escala de preço usando chart.applyOptions
                // Isso força uma atualização completa do gráfico
                chartRef.current.applyOptions({
                  rightPriceScale: {
                    autoScale: true,
                    scaleMargins: {
                      top: 0.1,
                      bottom: 0.1,
                    },
                  },
                });
                
                logger.log(`  🔄 [TradingViewChart] Escala de preço forçada a recalcular via chart.applyOptions`);
                
                // Forçar atualização do viewport
                const timeScale = chartRef.current.timeScale();
                timeScale.scrollToRealTime();
                
                logger.log(`  🔄 [TradingViewChart] Atualização forçada do gráfico após carregar dados históricos`);
              } catch (error: any) {
                // Ignorar erros de "Object is disposed" - chart foi removido
                if (error?.message?.includes('disposed')) {
                  logger.debug('⚠️ [TradingViewChart] Chart foi disposed, ignorando atualização');
                } else {
                  logger.warn('⚠️ [TradingViewChart] Erro ao forçar atualização após carregar dados históricos:', error);
                }
              }
            });
          });
          
          resolve();
        } catch (error) {
          logger.error('❌ [TradingViewChart] Erro ao carregar dados históricos:', error);
          resolve(); // Resolver mesmo em caso de erro para não travar
        }
      });
    };

    // Atualizar gráfico com dados em tempo real
    useEffect(() => {
      if (!seriesRef.current) {
        logger.log('⚠️ [TradingViewChart] seriesRef.current é null, aguardando inicialização...');
        return;
      }
      
      // CRÍTICO: NÃO processar ticks até que dados históricos sejam carregados
      // Isso garante que o gráfico tenha contexto correto antes de receber dados em tempo real
      if (!historicalDataLoadedRef.current) {
        logger.log('⏭️ [TradingViewChart] Aguardando carregamento de dados históricos antes de processar ticks...');
        return;
      }
      
      if (!lastTick) {
        // Normal durante inicialização
        return;
      }
      
      if (!isConnected) {
        logger.log('⚠️ [TradingViewChart] Não conectado, aguardando conexão...');
        return;
      }

      // CRÍTICO: Filtrar apenas ticks do símbolo correto
      if (lastTick.symbol !== symbol) {
        // Ignorar silenciosamente - ticks de outros símbolos são esperados
        logger.log(`⏭️ [TradingViewChart] Ignorando tick de símbolo diferente: ${lastTick.symbol} (esperado: ${symbol})`);
        return;
      }
      
      // CRÍTICO: Log detalhado do tick recebido para rastrear discrepâncias
      logger.log(`✅ [TradingViewChart] Processando tick para ${symbol}:`);
      logger.log(`   📥 Preço recebido: ${lastTick.price.toFixed(5)}`);
      logger.log(`   📅 Timestamp original: ${lastTick.timestamp} (${new Date(lastTick.timestamp).toISOString()})`);

      // Evitar processar o mesmo tick múltiplas vezes
      // CRÍTICO: Converter timestamp de segundos para milissegundos se necessário
      // Twelve Data retorna timestamps em segundos (Unix timestamp)
      // Binance retorna timestamps em milissegundos
      // Se o timestamp for menor que 1e12, está em segundos e precisa ser convertido
      let tickTimestamp = lastTick.timestamp || Date.now();
      const originalTimestamp = tickTimestamp;
      if (tickTimestamp < 1e12) {
        // Timestamp está em segundos, converter para milissegundos
        tickTimestamp = tickTimestamp * 1000;
        logger.log(`   🔄 Timestamp convertido de segundos para milissegundos: ${originalTimestamp} -> ${tickTimestamp}`);
      } else {
        logger.log(`   ✅ Timestamp já está em milissegundos: ${tickTimestamp}`);
      }
      logger.log(`   📅 Timestamp final: ${tickTimestamp} (${new Date(tickTimestamp).toISOString()})`);
      
      // CRÍTICO: Detecção de duplicados mais inteligente para Binance
      // Binance pode enviar o mesmo preço várias vezes, mas devemos atualizar o candle periodicamente
      // Apenas ignorar se for EXATAMENTE o mesmo tick (mesmo timestamp E mesmo preço) E se foi processado há menos de 50ms
      const now = Date.now();
      if (lastProcessedTickRef.current) {
        // Comparar timestamp do tick (não o timestamp de processamento)
        const isSameTimestamp = Math.abs(lastProcessedTickRef.current.timestamp - tickTimestamp) < 1000; // Tolerância de 1 segundo
        const isSamePrice = Math.abs(lastProcessedTickRef.current.price - lastTick.price) < 0.00001;
        const timeSinceLastProcess = now - (lastProcessedTickRef.current.processTime || lastProcessedTickRef.current.timestamp);
        
        // Se for exatamente o mesmo tick (mesmo timestamp e mesmo preço) E foi processado há menos de 50ms, ignorar
        // Isso permite atualizações periódicas mesmo com o mesmo preço (útil para manter o candle "vivo")
        if (isSameTimestamp && isSamePrice && timeSinceLastProcess < 50) {
          logger.log(`  ⏭️ [TradingViewChart] Tick duplicado ignorado (processado há ${timeSinceLastProcess}ms): ${tickTimestamp} = ${lastTick.price.toFixed(5)}`);
          return;
        }
        
        // Se o preço mudou, sempre processar
        if (!isSamePrice) {
          logger.log(`  🔄 [TradingViewChart] Preço mudou de ${lastProcessedTickRef.current.price.toFixed(5)} para ${lastTick.price.toFixed(5)}, processando...`);
        }
      }
      
      logger.log(`  🔍 [TradingViewChart] Tick não é duplicado, continuando processamento...`);

      // TAREFA 3: CRÍTICO - Verificar se seriesRef.current não é null antes de usar
      if (!seriesRef.current) {
        logger.log('⚠️ [TradingViewChart] seriesRef.current é null, aguardando inicialização...');
        return;
      }

      const series = seriesRef.current;
      const tick = lastTick;
      
      // TAREFA 1: CRÍTICO - Calcular o tempo do bar corretamente (início do minuto em segundos)
      // tickTimestamp está em milissegundos
      // Calcular o início do período atual baseado no timeframe
      const timeframeMs: Record<Timeframe, number> = {
        '1m': 60000, '5m': 300000, '15m': 900000, '30m': 1800000,
        '1h': 3600000, '4h': 14400000, '1d': 86400000,
      };
      const periodMs = timeframeMs[timeframe];
      const currentPeriodMs = Math.floor(tickTimestamp / periodMs) * periodMs; // Início do período atual (em ms)
      const currentPeriodSeconds = getBarTime(tickTimestamp, timeframe); // Início do período em SEGUNDOS (inteiro)

      // Calcular o período do último candle (arredondado para início do período)
      const lastCandlePeriod = lastCandleTimeRef.current 
        ? Math.floor(lastCandleTimeRef.current / periodMs) * periodMs 
        : null;

      // Marcar este tick como processado (armazenar timestamp do tick e tempo de processamento)
      lastProcessedTickRef.current = { 
        timestamp: tickTimestamp, 
        price: tick.price,
        processTime: now // Tempo de processamento para detecção de duplicados
      };

      // Log detalhado para debug
      logger.log(`📈 [TradingViewChart] Processando tick: ${tick.symbol} = ${tick.price.toFixed(5)} (timeframe: ${timeframe})`);
      if (tick.open !== undefined || tick.high !== undefined || tick.low !== undefined || tick.close !== undefined) {
        logger.log(`  📊 OHLC completo recebido: O=${tick.open?.toFixed(5) ?? 'N/A'} H=${tick.high?.toFixed(5) ?? 'N/A'} L=${tick.low?.toFixed(5) ?? 'N/A'} C=${tick.close?.toFixed(5) ?? 'N/A'}`);
        logger.log(`  📊 Candle ${tick.isClosed ? 'FECHADO' : 'EM FORMAÇÃO'}`);
      }
      logger.log(`  - tick.timestamp: ${tickTimestamp} (${new Date(tickTimestamp).toISOString()})`);
      logger.log(`  - currentPeriodMs: ${currentPeriodMs} (${new Date(currentPeriodMs).toISOString()})`);
      logger.log(`  - currentPeriodSeconds: ${currentPeriodSeconds} (${new Date(currentPeriodSeconds * 1000).toISOString()})`);
      logger.log(`  - lastCandlePeriod: ${lastCandlePeriod} (${lastCandlePeriod ? new Date(lastCandlePeriod).toISOString() : 'null'})`);
      logger.log(`  - isLastCandleHistoricalRef: ${isLastCandleHistoricalRef.current}`);
      logger.log(`  - lastCandleDataRef:`, lastCandleDataRef.current);

      // Lógica simplificada:
      // 1. Se não há último candle, criar novo
      // 2. Se período atual < último período, ignorar (dados antigos)
      // 3. Se período atual === último período, atualizar candle existente
      // 4. Se período atual > último período, criar novo candle

        if (lastCandlePeriod === null) {
          // Primeiro candle após histórico - verificar se há candle histórico no mesmo período
          logger.log(`  ✅ [TradingViewChart] Criando primeiro candle em tempo real (lastCandlePeriod é null)`);
          try {
            // TAREFA 3: CRÍTICO - Verificar se seriesRef.current não é null antes de usar
            if (!seriesRef.current) {
              logger.error('❌ [TradingViewChart] seriesRef.current é null ao criar primeiro candle');
              return;
            }
            
            // Obter o último candle histórico
            const allData = seriesRef.current.data();
            const lastHistoricalCandle = allData[allData.length - 1];
            const lastHistoricalTime = lastHistoricalCandle ? (lastHistoricalCandle.time as number) : 0;
            const lastHistoricalTimeInt = Math.floor(lastHistoricalTime);
            
            // CRÍTICO: Se o período atual é igual ao histórico, SUBSTITUIR o candle histórico
            // Se o período atual é maior, criar novo candle
            let finalCandle: TVCandlestickData;
            
            if (currentPeriodSeconds === lastHistoricalTimeInt) {
              // Mesmo período - usar update() para substituir o candle histórico
              logger.log(`  🔄 [TradingViewChart] Período igual ao histórico, substituindo candle histórico via update()`);
              finalCandle = {
                time: lastHistoricalTimeInt as any,
                open: tick.open ?? tick.price,
                high: tick.high ?? tick.price,
                low: tick.low ?? tick.price,
                close: tick.close ?? tick.price,
              };
              // Usar setData() para forçar renderização visual
              forceUpdateCandle(seriesRef.current, finalCandle);
              logger.log(`  ✅ [TradingViewChart] Candle histórico substituído: ${tick.price.toFixed(5)}`);
            } else {
              // Novo período - criar novo candle usando update()
              logger.log(`  🆕 [TradingViewChart] Novo período, criando novo candle via update()`);
              finalCandle = {
                time: currentPeriodSeconds as any,
                open: tick.open ?? tick.price,
                high: tick.high ?? tick.price,
                low: tick.low ?? tick.price,
                close: tick.close ?? tick.price,
              };
              // Usar update() - o TradingView detecta automaticamente que é um novo candle (timestamp diferente)
              seriesRef.current.update(finalCandle);
              logger.log(`  ✅ [TradingViewChart] Novo candle criado: ${tick.price.toFixed(5)}`);
            }
            
            lastCandleTimeRef.current = currentPeriodSeconds * 1000;
            lastCandleDataRef.current = { ...finalCandle };
            isLastCandleHistoricalRef.current = false;
            
            logger.log(`🆕 [TradingViewChart] Primeiro candle criado: ${tick.symbol} = ${tick.price.toFixed(5)}`);
            logger.log(`  📊 [TradingViewChart] Dados do candle:`, finalCandle);
            if (seriesRef.current) {
              logger.log(`  📊 [TradingViewChart] Total de candles na série:`, seriesRef.current.data().length);
            }
        } catch (error) {
          logger.error('❌ [TradingViewChart] Erro ao criar primeiro candle:', error);
        }
      } else if (currentPeriodMs < lastCandlePeriod!) {
        // Dados antigos - ignorar
        logger.log(`  ⏭️ [TradingViewChart] Ignorando tick antigo (período anterior ao último candle)`);
      } else if (currentPeriodMs === lastCandlePeriod) {
        // Mesmo minuto - atualizar candle existente APENAS se não for histórico
        if (isLastCandleHistoricalRef.current) {
          // CRÍTICO: Se o último candle é histórico e o minuto atual é igual, SUBSTITUIR o candle histórico pelo real
          // O update() do TradingView substitui o candle se o timestamp for o mesmo
          logger.log(`  ✅ [TradingViewChart] Último candle é histórico, SUBSTITUINDO pelo candle real`);
          try {
            // TAREFA 3: CRÍTICO - Verificar se seriesRef.current não é null antes de usar
            if (!seriesRef.current) {
              logger.error('❌ [TradingViewChart] seriesRef.current é null ao substituir candle histórico');
              return;
            }
            
            // Obter o último candle histórico para usar o mesmo timestamp
            const allData = seriesRef.current.data();
            const lastHistoricalCandle = allData[allData.length - 1];
            const lastHistoricalTime = lastHistoricalCandle ? (lastHistoricalCandle.time as number) : currentPeriodSeconds;
            
            // CRÍTICO: Usar o timestamp do último candle histórico (mesmo período) para SUBSTITUIR
            // O update() do TradingView substitui o candle se o timestamp for o mesmo
            const replaceCandleTime = Math.floor(lastHistoricalTime);
            
            // CRÍTICO: Criar novo candle com preço REAL para substituir o histórico
            // Usar dados OHLC completos se disponíveis, senão usar price para todos
            const realCandle: TVCandlestickData = {
              time: replaceCandleTime as any, // TradingView espera timestamp em SEGUNDOS (inteiro) - mesmo do histórico
              open: tick.open ?? tick.price, // Usar open do kline se disponível
              high: tick.high ?? tick.price, // Usar high do kline se disponível
              low: tick.low ?? tick.price, // Usar low do kline se disponível
              close: tick.close ?? tick.price, // Usar close do kline se disponível
            };
            
          logger.log(`  🔄 [TradingViewChart] Substituindo candle histórico:`, {
            histórico: lastHistoricalCandle,
            real: realCandle,
            timestamp: replaceCandleTime,
            preçoHistórico: lastHistoricalCandle?.close,
            preçoReal: tick.price.toFixed(5),
            diferença: lastHistoricalCandle ? (tick.price - lastHistoricalCandle.close).toFixed(5) : 'N/A'
          });
            
          // TAREFA 3: CRÍTICO - Verificar se seriesRef.current não é null antes de atualizar
          if (!seriesRef.current) {
            logger.error('❌ [TradingViewChart] seriesRef.current é null ao substituir candle histórico');
            return;
          }
          
          // CRÍTICO: Usar update() para substituir candle histórico pelo real - esta é a API correta do TradingView
          // O TradingView detecta automaticamente quando o timestamp é o mesmo e substitui o candle, animando naturalmente
          const lastHistoricalCandleData = allData.length > 0 ? allData[allData.length - 1] : null;
          
          logger.log(`  🔄 [TradingViewChart] Substituindo candle histórico pelo real via update():`);
          logger.log(`     📊 Candle histórico:`, lastHistoricalCandleData);
          logger.log(`     📊 Candle real:`, realCandle);
          logger.log(`     💰 Preço histórico: ${lastHistoricalCandleData?.close?.toFixed(5) || 'N/A'}`);
          logger.log(`     💰 Preço real: ${realCandle.close.toFixed(5)}`);
          
          // Usar setData() para forçar renderização visual
          forceUpdateCandle(seriesRef.current, realCandle);
          
          // Atualizar referências
          lastCandleTimeRef.current = currentPeriodSeconds * 1000;
          lastCandleDataRef.current = { ...realCandle };
          isLastCandleHistoricalRef.current = false;
          
          logger.log(`  ✅ [TradingViewChart] Candle histórico substituído pelo real: ${tick.price.toFixed(5)}`);
          if (seriesRef.current) {
            logger.log(`  📊 [TradingViewChart] Total de candles após substituição: ${seriesRef.current.data().length}`);
          }
          } catch (error) {
            logger.error('❌ [TradingViewChart] Erro ao criar primeiro candle em tempo real:', error);
          }
          return;
        }
        
        // Se não é histórico, podemos atualizar normalmente
        if (!lastCandleDataRef.current) {
          logger.error('  ❌ [TradingViewChart] lastCandleDataRef.current é null!');
          return;
        }
        
        try {
          // TAREFA 1: CRÍTICO - Usar o time do último candle (já em segundos) ou calcular o início do minuto atual
          // lastCandleDataRef.current.time já está em segundos (início do período)
          // Se não existir, usar currentPeriodSeconds que também é o início do período em segundos
          // Garantir que seja sempre um inteiro (início do período)
          const lastCandleTimeSeconds = lastCandleDataRef.current?.time 
            ? Math.floor(lastCandleDataRef.current.time as number) // Garantir inteiro
            : currentPeriodSeconds;
          
          // CRÍTICO: Criar um NOVO objeto a cada atualização para garantir que o TradingView detecte a mudança
          // Reutilizar o mesmo objeto pode fazer o TradingView não detectar mudanças
          // Se temos dados OHLC completos do tick, usar eles; senão, atualizar high/low/close baseado no price
          const updatedCandle: TVCandlestickData = {
            time: lastCandleTimeSeconds as any, // TradingView espera timestamp em SEGUNDOS (inteiro) - início do minuto
            open: tick.open ?? lastCandleDataRef.current.open, // Usar open do tick se disponível, senão manter original
            high: tick.high ?? Math.max(lastCandleDataRef.current.high, tick.price), // Usar high do tick se disponível
            low: tick.low ?? Math.min(lastCandleDataRef.current.low, tick.price), // Usar low do tick se disponível
            close: tick.close ?? tick.price, // Usar close do tick se disponível, senão usar price
          };
          
          // TAREFA 3: CRÍTICO - Verificar se seriesRef.current não é null antes de atualizar
          if (!seriesRef.current) {
            logger.error('❌ [TradingViewChart] seriesRef.current é null ao atualizar candle');
            return;
          }
          
          // Log para debug: confirmar que o timestamp está em segundos
          if (Math.random() < 0.1) { // Log apenas 10% das vezes para não poluir
            logger.log(`  🔍 [TradingViewChart] Atualizando candle com timestamp em SEGUNDOS: ${lastCandleTimeSeconds}`);
          }
          
            // CRÍTICO: Usar update() para atualizar candle existente - esta é a API correta do TradingView
            // O TradingView Lightweight Charts anima naturalmente quando update() é chamado com novos valores
            // NÃO usar setData() aqui pois isso reseta o estado interno e interfere com animações
            try {
              if (!seriesRef.current) {
                logger.error('❌ [TradingViewChart] seriesRef.current é null ao atualizar candle');
                return;
              }
              
              // CRÍTICO: Criar um NOVO objeto literal para garantir que o TradingView detecte a mudança
              // Reutilizar referências pode fazer o TradingView não detectar mudanças
              // IMPORTANTE: Criar um objeto completamente novo com valores primitivos para garantir detecção
              const candleToUpdate: TVCandlestickData = {
                time: Number(updatedCandle.time), // Garantir que é um número primitivo
                open: Number(updatedCandle.open),
                high: Number(updatedCandle.high),
                low: Number(updatedCandle.low),
                close: Number(updatedCandle.close),
              };
              
              // SOLUÇÃO AGRESSIVA: Usar setData() a cada atualização para FORÇAR re-render completo
              // O update() não está renderizando visualmente, então vamos usar setData() que força re-render completo
              forceUpdateCandle(seriesRef.current, candleToUpdate);
              
              // Forçar atualizações visuais após setData()
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  if (chartRef.current) {
                    try {
                      // 1. Forçar atualização do price scale
                      const priceScale = chartRef.current.priceScale('right');
                      if (priceScale) {
                        priceScale.applyOptions({ 
                          autoScale: true,
                          scaleMargins: {
                            top: 0.1,
                            bottom: 0.1,
                          },
                        });
                      }
                      
                      // 2. Forçar scroll para tempo real
                      const timeScale = chartRef.current.timeScale();
                      timeScale.scrollToRealTime();
                      
                      // 3. Forçar resize do canvas (mesmo tamanho) para invalidar
                      const container = chartContainerRef.current;
                      if (container) {
                        const width = container.clientWidth;
                        const height = container.clientHeight;
                        chartRef.current.resize(width, height);
                      }
                    } catch (error) {
                      // Ignorar erros
                    }
                  }
                });
              });
              
              const lastPrice = lastCandleDataRef.current?.close || tick.price;
              const priceChangePercent = Math.abs((tick.price - lastPrice) / lastPrice) * 100;
              
              // Log detalhado para debug (reduzir frequência para não poluir)
              if (Math.random() < 0.05) { // Log apenas 5% das vezes
                logger.log(`  🔄 [TradingViewChart] Candle atualizado via update():`);
                logger.log(`     💰 Preço anterior: ${lastPrice.toFixed(5)}`);
                logger.log(`     💰 Preço novo: ${tick.price.toFixed(5)}`);
                logger.log(`     📈 Mudança: ${priceChangePercent.toFixed(4)}%`);
                logger.log(`     📊 Candle data:`, candleToUpdate);
                logger.log(`     ⏰ Timestamp: ${candleToUpdate.time} (${new Date((candleToUpdate.time as number) * 1000).toISOString()})`);
              }
            
            // Atualizar a referência APÓS a atualização bem-sucedida
            lastCandleDataRef.current = { ...candleToUpdate };
            
            // TAREFA 3: CRÍTICO - Verificar novamente antes de usar series.data()
            if (!seriesRef.current) {
              logger.error('❌ [TradingViewChart] seriesRef.current é null ao logar dados do candle atualizado');
              return;
            }
            
            // Log sempre para debug (mas reduzir frequência para não poluir)
            if (Math.random() < 0.2) { // Log apenas 20% das vezes
              logger.log(`🔄 [TradingViewChart] Candle atualizado: ${tick.symbol} = ${tick.price.toFixed(5)} (H: ${updatedCandle.high.toFixed(5)}, L: ${updatedCandle.low.toFixed(5)})`);
              logger.log(`  📊 [TradingViewChart] Total de candles na série:`, seriesRef.current.data().length);
              const lastCandle = seriesRef.current.data()[seriesRef.current.data().length - 1];
              logger.log(`  📊 [TradingViewChart] Último candle na série:`, lastCandle);
              logger.log(`  📊 [TradingViewChart] Candle atualizado:`, updatedCandle);
            }
          } catch (error) {
            if (Math.random() < 0.2) { // Log apenas 20% das vezes para não poluir
              logger.error('❌ [TradingViewChart] Erro ao atualizar candle:', error);
            }
          }
        } catch (error) {
          logger.error('❌ [TradingViewChart] Erro ao atualizar candle:', error);
        }
      } else if (currentPeriodMs > lastCandlePeriod!) {
        // Novo período - criar novo candle
        logger.log(`  ✅ [TradingViewChart] Criando novo candle (novo minuto)`);
        try {
          // TAREFA 3: CRÍTICO - Verificar se seriesRef.current não é null antes de usar
          if (!seriesRef.current) {
            logger.error('❌ [TradingViewChart] seriesRef.current é null ao criar novo candle');
            return;
          }
          
          // Garantir que o timestamp seja maior que o último candle
          const allData = seriesRef.current.data();
          const lastCandle = allData[allData.length - 1];
          const lastCandleTime = lastCandle ? (lastCandle.time as number) : 0;
          
          // TAREFA 1: CRÍTICO - Usar currentPeriodSeconds diretamente (já é início do período em segundos inteiros)
          // SEMPRE usar currentPeriodSeconds (início do período atual do tick), não o próximo período
          const lastCandleTimeInt = Math.floor(lastCandleTime);
          const periodSeconds = periodMs / 1000;
          // CRÍTICO: Sempre usar currentPeriodSeconds (período atual), não o próximo período
          const newCandleTime = currentPeriodSeconds >= lastCandleTimeInt 
            ? currentPeriodSeconds // Usar o início do período atual do tick
            : currentPeriodSeconds; // Mesmo se menor, usar o período atual (dados antigos serão ignorados depois)
          
          // Usar dados OHLC completos se disponíveis, senão usar price para todos
          const newCandle = {
            time: newCandleTime as any, // TradingView espera timestamp em SEGUNDOS (inteiro) - início do minuto
            open: tick.open ?? tick.price,
            high: tick.high ?? tick.price,
            low: tick.low ?? tick.price,
            close: tick.close ?? tick.price,
          };
          
          // TAREFA 3: CRÍTICO - Verificar novamente antes de atualizar
          if (!seriesRef.current) {
            logger.error('❌ [TradingViewChart] seriesRef.current é null ao criar novo candle (segunda verificação)');
            return;
          }
          
          // CRÍTICO: Usar setData() para forçar renderização visual ao criar novo candle
          forceUpdateCandle(seriesRef.current, newCandle);
          
          logger.log(`  🆕 [TradingViewChart] Novo candle criado via update():`, newCandle);
          
          // TAREFA 2: CRÍTICO - Reforçar lastCandleDataRef com o novo candle completo
          // CRÍTICO: Usar currentPeriodSeconds * 1000 (período atual), não newCandleTime que pode estar errado
          lastCandleTimeRef.current = currentPeriodSeconds * 1000; // Converter de segundos para ms - usar período ATUAL
          lastCandleDataRef.current = newCandle; // Armazenar o objeto completo do candle
          isLastCandleHistoricalRef.current = false; // Marcar como não histórico
          
          logger.log(`  📊 [TradingViewChart] Total de candles na série após criar novo:`, seriesRef.current.data().length);
          logger.log(`  📊 [TradingViewChart] Último candle na série:`, seriesRef.current.data()[seriesRef.current.data().length - 1]);
          logger.log(`  📊 [TradingViewChart] Novo candle criado:`, newCandle);
          
          // CRÍTICO: Ajustar viewport de forma agressiva para garantir que o novo candle seja visível
          // O shiftVisibleRangeOnNewBar pode não estar funcionando corretamente, então forçamos o ajuste
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (chartRef.current) {
                try {
                  const timeScale = chartRef.current.timeScale();
                  const timeframeMs: Record<Timeframe, number> = {
                    '1m': 60000, '5m': 300000, '15m': 900000, '30m': 1800000,
                    '1h': 3600000, '4h': 14400000, '1d': 86400000,
                  };
                  const periodMs = timeframeMs[timeframe];
                  const periodSeconds = periodMs / 1000;
                  const visiblePeriods = Math.max(20, periodSeconds * 2);
                  
                  // Forçar ajuste do viewport para mostrar o novo candle
                  timeScale.setVisibleRange({
                    from: currentPeriodSeconds - visiblePeriods,
                    to: currentPeriodSeconds + periodSeconds,
                  }, { applyRightMargin: true });
                  
                  // Verificar se o ajuste funcionou
                  const visibleRange = timeScale.getVisibleRange();
                  logger.log(`  📊 [TradingViewChart] Viewport ajustado para novo candle:`, {
                    solicitado: { from: new Date((currentPeriodSeconds - visiblePeriods) * 1000).toISOString(), to: new Date((currentPeriodSeconds + periodSeconds) * 1000).toISOString() },
                    atual: visibleRange ? { from: new Date(visibleRange.from * 1000).toISOString(), to: new Date(visibleRange.to * 1000).toISOString() } : null,
                    novoCandle: new Date(currentPeriodMs).toISOString()
                  });
                } catch (error) {
                  logger.warn('⚠️ [TradingViewChart] Erro ao ajustar viewport:', error);
                }
              }
            });
          });
          
          logger.log(`🆕 [TradingViewChart] Novo candle criado: ${tick.symbol} = ${tick.price.toFixed(5)} (time: ${new Date(currentPeriodMs).toISOString()}, timeframe: ${timeframe})`);
        } catch (error) {
          logger.error('❌ [TradingViewChart] Erro ao criar novo candle:', error);
          logger.error('  - currentPeriodMs:', currentPeriodMs);
          logger.error('  - currentPeriodSeconds:', currentPeriodSeconds);
          logger.error('  - lastCandleTimeRef.current:', lastCandleTimeRef.current);
          logger.error('  - tick.timestamp:', tick.timestamp);
        }
      }

      // Notificar atualização de preço
      if (onPriceUpdate) {
        onPriceUpdate(tick.price);
      }
    }, [lastTick, isConnected, onPriceUpdate, symbol, timeframe]);

    // Expor métodos via ref
    useImperativeHandle(ref, () => ({
      getChart: () => chartRef.current,
      getSeries: () => seriesRef.current,
      exportAsImage: async (format: 'png' | 'jpeg' | 'svg'): Promise<string | null> => {
        if (!chartRef.current || !chartContainerRef.current) {
          return null;
        }

        try {
          const chart = chartRef.current;
          const container = chartContainerRef.current;
          
          if (format === 'svg') {
            // Para SVG, usar html2canvas ou similar
            // Por enquanto, retornar null (pode ser implementado com html2canvas)
            return null;
          }

          // Para PNG/JPEG, usar html2canvas ou canvas API
          // Como TradingView Charts renderiza em canvas, precisamos capturar o canvas
          const canvas = container.querySelector('canvas');
          if (!canvas) {
            return null;
          }

          // Converter canvas para blob
          return new Promise((resolve) => {
            canvas.toBlob((blob) => {
              if (!blob) {
                resolve(null);
                return;
              }
              const url = URL.createObjectURL(blob);
              resolve(url);
            }, format === 'jpeg' ? 'image/jpeg' : 'image/png', 0.95);
          });
        } catch (error) {
          logger.error('Erro ao exportar gráfico:', error);
          return null;
        }
      },
      exportAsCSV: (): string => {
        if (!seriesRef.current) {
          return '';
        }

        const data = seriesRef.current.data();
        const csvHeader = 'Timestamp,Open,High,Low,Close,Volume\n';
        const csvRows = data.map(candle => {
          const time = typeof candle.time === 'number' 
            ? new Date(candle.time * 1000).toISOString()
            : candle.time.toString();
          return `${time},${candle.open},${candle.high},${candle.low},${candle.close},${candle.volume || 0}`;
        });

        return csvHeader + csvRows.join('\n');
      },
      exportAsJSON: (): string => {
        if (!seriesRef.current) {
          return '[]';
        }

        const data = seriesRef.current.data();
        const jsonData = data.map(candle => ({
          time: typeof candle.time === 'number' 
            ? new Date(candle.time * 1000).toISOString()
            : candle.time.toString(),
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume || 0,
        }));

        return JSON.stringify(jsonData, null, 2);
      },
      copyToClipboard: async (): Promise<boolean> => {
        if (!chartRef.current || !chartContainerRef.current) {
          return false;
        }

        try {
          const canvas = chartContainerRef.current.querySelector('canvas');
          if (!canvas) {
            return false;
          }

          return new Promise((resolve) => {
            canvas.toBlob(async (blob) => {
              if (!blob) {
                resolve(false);
                return;
              }

              try {
                await navigator.clipboard.write([
                  new ClipboardItem({ [blob.type]: blob })
                ]);
                resolve(true);
              } catch (error) {
                logger.error('Erro ao copiar para clipboard:', error);
                resolve(false);
              }
            }, 'image/png');
          });
        } catch (error) {
          logger.error('Erro ao copiar gráfico:', error);
          return false;
        }
      },
      print: (): void => {
        if (!chartContainerRef.current) {
          return;
        }

        const canvas = chartContainerRef.current.querySelector('canvas');
        if (!canvas) {
          return;
        }

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
          return;
        }

        const img = canvas.toDataURL('image/png');
        printWindow.document.write(`
          <html>
            <head>
              <title>Gráfico - ${symbol}</title>
              <style>
                body { margin: 0; padding: 20px; text-align: center; }
                img { max-width: 100%; height: auto; }
              </style>
            </head>
            <body>
              <h2>${symbol} - ${timeframe}</h2>
              <img src="${img}" alt="Gráfico ${symbol}" />
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      },
    }));

    // Ajustar tamanho do gráfico quando container mudar
    useEffect(() => {
      if (!chartRef.current || !chartContainerRef.current) {
        return;
      }

      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (chartRef.current && entry.contentRect.width > 0 && entry.contentRect.height > 0) {
            chartRef.current.applyOptions({
              width: entry.contentRect.width,
              height: entry.contentRect.height,
            });
          }
        }
      });

      if (chartContainerRef.current) {
        resizeObserver.observe(chartContainerRef.current);
      }

      return () => {
        resizeObserver.disconnect();
      };
    }, []);

    return (
      <div 
        className={`tradingview-chart-container ${className}`} 
        style={{ 
          width: width || '100%', 
          height: height || '100%',
          position: 'relative',
          minHeight: height || 400,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <div
          ref={chartContainerRef}
          style={{ 
            width: '100%', 
            height: '100%',
            flex: 1,
            minHeight: 0
          }}
        />
        {error && (
          <div className="absolute top-2 right-2 bg-red-600 text-white px-3 py-1 rounded text-sm">
            Erro de conexão: {error}
          </div>
        )}
        {!isConnected && (
          <div className="absolute top-2 right-2 bg-yellow-600 text-white px-3 py-1 rounded text-sm">
            Conectando...
          </div>
        )}
      </div>
    );
  }
);

TradingViewChart.displayName = 'TradingViewChart';

