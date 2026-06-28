'use client';

import React from 'react';
import { ChartLoadingScreen } from '@/components/ui/ChartLoadingScreen';

interface LoadingScreenProps {
  message?: string;
}

/** Tela de carregamento global — usa a animação da logo (sem spinner). */
export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Carregando...',
}) => (
  <ChartLoadingScreen fullScreen variant="full" message={message} />
);
