/**
 * Utilitário de logging condicional
 * - debug/log/info/warn: apenas em desenvolvimento
 * - error: sempre loga, mas sanitiza stack traces em produção
 */

const isDev = process.env.NODE_ENV !== 'production';

export const logger = {
  /** Apenas em dev */
  log: (...args: unknown[]) => { if (isDev) console.log(...args); },
  /** Apenas em dev */
  debug: (...args: unknown[]) => { if (isDev) console.debug(...args); },
  /** Apenas em dev */
  info: (...args: unknown[]) => { if (isDev) console.info(...args); },
  /** Apenas em dev */
  warn: (...args: unknown[]) => { if (isDev) console.warn(...args); },
  /** Sempre loga, mas sem stack em produção */
  error: (...args: unknown[]) => {
    if (isDev) {
      console.error(...args);
    } else {
      // Em produção, logar apenas a mensagem (sem stack trace / paths internos)
      const sanitized = args.map(a => {
        if (a instanceof Error) return a.message;
        if (typeof a === 'object' && a !== null && 'stack' in a) {
          const { stack, ...rest } = a as Record<string, unknown>;
          return rest;
        }
        return a;
      });
      console.error(...sanitized);
    }
  },
};
