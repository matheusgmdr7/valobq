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

/** Offset de fechamento IMA — levemente acima/abaixo da entrada (menos óbvio que colar na linha) */
function imaOffset(entryPrice: number): number {
  if (!entryPrice || !isFinite(entryPrice)) return 0.00000001;
  const pct = entryPrice * 0.000025;
  if (entryPrice >= 1000) return Math.max(pct, entryPrice * 0.000008);
  if (entryPrice >= 10) return Math.max(pct, 0.03);
  if (entryPrice >= 1) return Math.max(pct, 0.00012);
  return Math.max(pct, entryPrice * 0.000035, 0.00000002);
}

function drawEpsilon(entryPrice: number): number {
  return entryPrice * 0.000001;
}

/** Mercado já favorece a ordem (CALL acima / PUT abaixo da entrada). */
export function isMarketFavorableToOrder(
  entryPrice: number,
  marketPrice: number,
  type: 'call' | 'put',
): boolean {
  if (!entryPrice || !marketPrice) return false;
  const eps = drawEpsilon(entryPrice);
  if (type === 'call') return marketPrice > entryPrice + eps;
  return marketPrice < entryPrice - eps;
}

/**
 * IMA só atua quando o preço está contra o resultado desejado:
 * - IMA WIN: manipula se a ordem ainda não está ganhando no mercado
 * - IMA LOSS: manipula se a ordem está ganhando no mercado
 */
export function shouldApplyOutcomeControl(
  entryPrice: number,
  marketPrice: number,
  type: 'call' | 'put',
  control: OutcomeControl,
): boolean {
  if (control === 'off' || !entryPrice || !marketPrice) return false;
  const favorable = isMarketFavorableToOrder(entryPrice, marketPrice, type);
  if (control === 'ima_win') return !favorable;
  return favorable;
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

  if (!shouldApplyOutcomeControl(entryPrice, marketExitPrice, type, control)) {
    return marketExitPrice;
  }

  const eps = imaOffset(entryPrice);

  if (control === 'ima_win') {
    return type === 'call' ? entryPrice + eps : entryPrice - eps;
  }

  return type === 'call' ? entryPrice - eps : entryPrice + eps;
}

/** Janela antes da expiração em que o preço converge para o fechamento (IMA) */
export const SETTLEMENT_SNAP_WINDOW_MS = 2000;

/** Após fechar a operação, quanto tempo o gráfico “solta” o preço IMA de volta ao mercado */
export const SETTLEMENT_RELEASE_MS = 6500;

/** 1 = ainda no preço IMA, 0 = totalmente no mercado (curva suave) */
export function getSettlementReleasePull(
  releaseStartMs: number,
  nowMs: number = Date.now(),
  releaseDurationMs: number = SETTLEMENT_RELEASE_MS,
): number {
  const elapsed = nowMs - releaseStartMs;
  if (elapsed <= 0) return 1;
  if (elapsed >= releaseDurationMs) return 0;
  const t = elapsed / releaseDurationMs;
  return 0.5 + 0.5 * Math.cos(Math.PI * t);
}

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

  if (!shouldApplyOutcomeControl(entryPrice, marketPrice, type, outcomeControl)) {
    return null;
  }

  const targetPrice = applyOutcomeControl(entryPrice, marketPrice, type, outcomeControl);

  if (msUntilExpiration <= 0) {
    return { targetPrice, blend: 1, tradeId };
  }

  if (msUntilExpiration > snapWindowMs) {
    return null;
  }

  const t = 1 - msUntilExpiration / snapWindowMs;
  /** Curva suave (seno): convergência distribuída nos ~2s, sem “puxão” só no último instante */
  const blend = 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));

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
