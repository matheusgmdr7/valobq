'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function TitleManager() {
  useEffect(() => {
    const loadBrokerName = async () => {
      let brokerName: string | null = null;
      
      // Primeiro, tentar carregar do Supabase
      if (supabase) {
        try {
          const { data: nameData } = await supabase
            .from('platform_settings')
            .select('value')
            .eq('key', 'broker_name')
            .single();
          
          if (nameData?.value) {
            brokerName = nameData.value as string;
            localStorage.setItem('broker_name', brokerName);
          }
        } catch (error) {
          // Fallback para localStorage
        }
      }
      
      // Se não encontrou no Supabase, usar localStorage
      if (!brokerName) {
        brokerName = localStorage.getItem('broker_name');
      }
      
      // Atualizar título da página
      if (brokerName) {
        document.title = `${brokerName} - Plataforma de Negociação de Ativos`;
      } else {
        document.title = 'VALOREN - Plataforma de Negociação de Ativos';
      }
    };
    
    // Carregar imediatamente
    loadBrokerName();
    
    // Verificar mudanças periodicamente (a cada 3 segundos)
    const interval = setInterval(() => {
      loadBrokerName();
    }, 3000);
    
    // Também escutar eventos de storage (dispara em outras abas)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'broker_name') {
        loadBrokerName();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return null;
}






