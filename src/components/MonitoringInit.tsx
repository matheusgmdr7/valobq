'use client';

/**
 * Componente para inicializar monitoramento
 * Deve ser usado no layout principal
 */

import { useEffect } from 'react';
import { initMonitoring } from '@/utils/monitoring';
import { initAnalytics } from '@/utils/analytics';

export function MonitoringInit() {
  useEffect(() => {
    // Inicializar monitoramento
    const sentryDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
    initMonitoring(sentryDsn);

    // Inicializar analytics
    const analyticsEnabled = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== 'false';
    initAnalytics(analyticsEnabled);
  }, []);

  return null; // Componente não renderiza nada
}

