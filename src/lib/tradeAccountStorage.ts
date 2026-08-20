import type { AccountType } from '@/types';

const STORAGE_KEY = 'trade_account_types';

function readMap(): Record<string, AccountType> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, AccountType>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, AccountType>) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

/** Registra em qual conta (demo/real) a operação foi aberta. */
export function saveTradeAccountType(tradeId: string, accountType: AccountType): void {
  const map = readMap();
  map[tradeId] = accountType;
  writeMap(map);
}

export function getTradeAccountType(tradeId: string): AccountType | null {
  const map = readMap();
  return map[tradeId] ?? null;
}

export function clearTradeAccountType(tradeId: string): void {
  const map = readMap();
  if (!(tradeId in map)) return;
  delete map[tradeId];
  writeMap(map);
}

/** Resolve demo/real: DB → localStorage → fallback. */
export function resolveTradeAccountType(
  trade: { id: string; accountType?: AccountType },
  fallback: AccountType = 'real',
): AccountType {
  return trade.accountType ?? getTradeAccountType(trade.id) ?? fallback;
}

export function isTradeForAccount(
  trade: { id: string; accountType?: AccountType },
  account: AccountType,
): boolean {
  return resolveTradeAccountType(trade) === account;
}
