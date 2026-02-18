'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';

export function FaviconManager() {
  useEffect(() => {
    const loadFaviconFromStorage = async () => {
      let faviconUrl: string | null = null;
      
      // Primeiro, tentar carregar do Supabase (banco de dados)
      if (supabase) {
        try {
          const { data: faviconData } = await supabase
            .from('platform_settings')
            .select('value')
            .eq('key', 'broker_favicon')
            .single();
          
          if (faviconData?.value) {
            faviconUrl = faviconData.value as string;
            // Atualizar localStorage para cache
            localStorage.setItem('broker_favicon', faviconUrl);
          }
        } catch (error) {
          // Fallback para localStorage
        }
      }
      
      // Se não encontrou no Supabase, usar localStorage
      if (!faviconUrl) {
        faviconUrl = localStorage.getItem('broker_favicon');
      }
      
      return faviconUrl;
    };
    
    const loadFavicon = async () => {
      try {
        const faviconUrl = await loadFaviconFromStorage();
        
        if (faviconUrl) {
          updateFavicon(faviconUrl);
        }
      } catch (error) {
        logger.error('Erro ao carregar favicon:', error);
      }
    };
    
    const updateFavicon = (faviconUrl: string) => {
      let link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = faviconUrl;
    };
    
    // Carregar imediatamente
    loadFavicon();
    
    // Verificar mudanças no localStorage e Supabase periodicamente (a cada 3 segundos)
    const interval = setInterval(() => {
      loadFavicon();
    }, 3000);
    
    // Também escutar eventos de storage (dispara em outras abas)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'broker_favicon') {
        loadFavicon();
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

