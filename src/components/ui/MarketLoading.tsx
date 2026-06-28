'use client';

import React from 'react';
import { ChartLoadingScreen } from './ChartLoadingScreen';

interface MarketLoadingProps {
  message?: string;
  className?: string;
  logoUrl?: string | null;
}

/** Wrapper de carregamento de mercado. */
export const MarketLoading: React.FC<MarketLoadingProps> = ({
  message = 'Carregando dados do mercado...',
  className = '',
  logoUrl,
}) => (
  <ChartLoadingScreen
    message={message}
    className={className}
    logoUrl={logoUrl}
    fullScreen={false}
    variant="compact"
  />
);
