import type { User } from '@/types';
import { isVerifiedFlag } from '@/lib/emailVerification';

/** Reidrata User salvo em localStorage (datas viram string no JSON). */
export function parseUserFromStorage(raw: unknown): User | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  if (typeof data.id !== 'string' || typeof data.email !== 'string') return null;

  const createdAt = data.createdAt ? new Date(data.createdAt as string | number | Date) : new Date();
  const updatedAt = data.updatedAt ? new Date(data.updatedAt as string | number | Date) : createdAt;

  return {
    id: data.id,
    email: data.email,
    name: typeof data.name === 'string' ? data.name : '',
    balance: parseFloat(String(data.balance ?? 0)),
    demoBalance: parseFloat(String(data.demo_balance ?? data.demoBalance ?? 10000)),
    isDemo: Boolean(data.isDemo ?? data.is_demo),
    role: (data.role as 'user' | 'admin') || 'user',
    outcomeControl:
      data.outcomeControl === 'ima_win' || data.outcomeControl === 'ima_loss'
        ? data.outcomeControl
        : 'off',
    emailVerified: isVerifiedFlag(data.emailVerified ?? data.email_verified),
    createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
    updatedAt: Number.isNaN(updatedAt.getTime()) ? createdAt : updatedAt,
  };
}
