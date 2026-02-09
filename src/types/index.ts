export interface User {
  id: string;
  email: string;
  name: string;
  balance: number;
  demoBalance: number;
  isDemo: boolean;
  role?: 'user' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}

export type AccountType = 'demo' | 'real';

export interface AuthResponse {
  user: User;
  token: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface Asset {
  id: string;
  symbol: string;
  name: string;
  category: 'forex' | 'crypto' | 'stocks' | 'commodities' | 'indices';
  currentPrice: number;
  change24h: number;
  changePercent24h: number;
  lastUpdate: Date;
}

export interface BinaryOption {
  id: string;
  userId: string;
  assetId: string;
  assetSymbol: string;
  direction: 'call' | 'put';
  amount: number;
  payout: number;
  expiryTime: Date;
  status: 'pending' | 'won' | 'lost' | 'expired';
  resultPrice?: number;
  createdAt: Date;
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'deposit' | 'withdrawal' | 'trade_win' | 'trade_loss';
  amount: number;
  description: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
}

export interface PriceUpdate {
  assetId: string;
  price: number;
  timestamp: Date;
}

export interface TradingStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfit: number;
  totalLoss: number;
  netProfit: number;
}
