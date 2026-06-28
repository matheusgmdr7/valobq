/**
 * Liquidação de trades — preço de saída (IMA), resultado e impacto no saldo.
 */

export type OutcomeControl = 'off' | 'ima_win' | 'ima_loss';

export interface TradeSettlementInput {
  entryPrice: number;
  marketExitPrice: number;
  type: 'call' | 'put';
  amount: number;
  payoutPercent: number;
  outcomeControl?: OutcomeControl;
}

export interface TradeSettlementResult {
  exitPrice: number;
  isDraw: boolean;
  isWin: boolean;
  result: 'win' | 'loss' | null;
  profit: number;
  /** Ajuste no saldo ao fechar (após débito na abertura) */
  balanceDeltaAtClose: number;
}

/** Offset mínimo para fechar a favor/contra a linha de entrada */
function imaOffset(entryPrice: number): number {
  return Math.max(entryPrice * 0.00001, 0.00000001);
}

/**
 * Aplica IMA WIN / IMA LOSS ao preço de mercado.
 * IMA define o preço de fechamento relativo à entrada.
 */
export function applyOutcomeControl(
  entryPrice: number,
  marketExitPrice: number,
  type: 'call' | 'put',
  control: OutcomeControl = 'off',
): number {
  if (control === 'off' || !entryPrice || !isFinite(entryPrice)) {
    return marketExitPrice;
  }

  const eps = imaOffset(entryPrice);

  if (control === 'ima_win') {
    return type === 'call' ? entryPrice + eps : entryPrice - eps;
  }

  return type === 'call' ? entryPrice - eps : entryPrice + eps;
}

/** Janela antes da expiração em que o preço converge para o fechamento (IMA) */
export const SETTLEMENT_SNAP_WINDOW_MS = 3000;

export interface SettlementSnapState {
  targetPrice: number;
  /** 0 = preço de mercado, 1 = preço de fechamento alvo */
  blend: number;
  tradeId: string;
}

/**
 * Calcula alvo de snap visual para convergir o gráfico ao fechamento da operação.
 * Retorna null se IMA desligado ou fora da janela de fechamento.
 */
export function getSettlementSnap(input: {
  tradeId: string;
  entryPrice: number;
  marketPrice: number;
  type: 'call' | 'put';
  outcomeControl?: OutcomeControl;
  msUntilExpiration: number;
  snapWindowMs?: number;
}): SettlementSnapState | null {
  const {
    tradeId,
    entryPrice,
    marketPrice,
    type,
    outcomeControl = 'off',
    msUntilExpiration,
    snapWindowMs = SETTLEMENT_SNAP_WINDOW_MS,
  } = input;

  if (outcomeControl === 'off' || !entryPrice || !marketPrice) {
    return null;
  }

  const targetPrice = applyOutcomeControl(entryPrice, marketPrice, type, outcomeControl);

  if (msUntilExpiration <= 0) {
    return { targetPrice, blend: 1, tradeId };
  }

  if (msUntilExpiration > snapWindowMs) {
    return null;
  }

  const linear = 1 - msUntilExpiration / snapWindowMs;
  const blend = linear * linear * (3 - 2 * linear);

  return { targetPrice, blend, tradeId };
}

/** Escolhe o snap da operação que expira primeiro no ativo atual */
export function pickNearestSettlementSnap(
  trades: Array<{
    id: string;
    entryPrice: number;
    expiration: number;
    type: 'call' | 'put';
    result?: 'win' | 'loss';
    symbol?: string;
  }>,
  symbol: string,
  marketPrice: number,
  outcomeControl: OutcomeControl,
  nowMs: number = Date.now(),
): SettlementSnapState | null {
  if (!marketPrice || outcomeControl === 'off') return null;

  let best: SettlementSnapState | null = null;
  let bestMs = Infinity;

  for (const trade of trades) {
    if (trade.result) continue;
    if (trade.symbol && trade.symbol !== symbol) continue;

    const msLeft = trade.expiration - nowMs;
    if (msLeft > SETTLEMENT_SNAP_WINDOW_MS) continue;

    const snap = getSettlementSnap({
      tradeId: trade.id,
      entryPrice: trade.entryPrice,
      marketPrice,
      type: trade.type,
      outcomeControl,
      msUntilExpiration: msLeft,
    });

    if (!snap) continue;

    const priority = msLeft <= 0 ? -1 : msLeft;
    if (priority < bestMs) {
      bestMs = priority;
      best = snap;
    }
  }

  return best;
}

/** Calcula resultado financeiro e delta de saldo no fechamento */
export function settleTrade(input: TradeSettlementInput): TradeSettlementResult {
  const {
    entryPrice,
    marketExitPrice,
    type,
    amount,
    payoutPercent,
    outcomeControl = 'off',
  } = input;

  const exitPrice = applyOutcomeControl(entryPrice, marketExitPrice, type, outcomeControl);

  const priceDiff = exitPrice - entryPrice;
  const epsilon = entryPrice * 0.000001;
  const isDraw = Math.abs(priceDiff) < epsilon;
  const isWin = isDraw ? false : type === 'call' ? priceDiff > 0 : priceDiff < 0;

  const profitAmount = amount * (payoutPercent / 100);

  if (isDraw) {
    return {
      exitPrice,
      isDraw: true,
      isWin: false,
      result: null,
      profit: 0,
      balanceDeltaAtClose: amount,
    };
  }

  if (isWin) {
    return {
      exitPrice,
      isDraw: false,
      isWin: true,
      result: 'win',
      profit: profitAmount,
      balanceDeltaAtClose: amount + profitAmount,
    };
  }

  return {
    exitPrice,
    isDraw: false,
    isWin: false,
    result: 'loss',
    profit: -amount,
    balanceDeltaAtClose: 0,
  };
}
