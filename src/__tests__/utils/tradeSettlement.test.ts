import { describe, it, expect } from 'vitest';
import { settleTrade } from '../../utils/tradeSettlement';

describe('settleTrade — payout e saldo', () => {
  const base = {
    entryPrice: 100,
    marketExitPrice: 101,
    type: 'call' as const,
    amount: 100,
    payoutPercent: 90,
    outcomeControl: 'off' as const,
  };

  it('vitória: credita stake + payout (R$ 190) no fechamento após débito na abertura', () => {
    const result = settleTrade(base);
    expect(result.isWin).toBe(true);
    expect(result.profit).toBe(90);
    expect(result.balanceDeltaAtClose).toBe(190);
    expect(result.grossWinReturn).toBe(190);
    // Efeito líquido: -100 abertura + 190 fechamento = +90
    expect(-base.amount + result.balanceDeltaAtClose).toBe(90);
  });

  it('derrota: não debita de novo no fechamento (stake já foi debitado na abertura)', () => {
    const result = settleTrade({
      ...base,
      marketExitPrice: 99,
    });
    expect(result.isWin).toBe(false);
    expect(result.profit).toBe(-100);
    expect(result.balanceDeltaAtClose).toBe(0);
    expect(result.grossLossAmount).toBe(100);
    // Efeito líquido: -100 abertura + 0 fechamento = -100
    expect(-base.amount + result.balanceDeltaAtClose).toBe(-100);
  });

  it('empate: devolve o stake no fechamento', () => {
    const result = settleTrade({
      ...base,
      marketExitPrice: 100,
    });
    expect(result.isDraw).toBe(true);
    expect(result.balanceDeltaAtClose).toBe(100);
  });
});
