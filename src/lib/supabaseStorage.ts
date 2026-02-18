/**
 * Funções para upload de imagens no Supabase Storage
 */

import { supabase } from './supabase';
import { logger } from '@/utils/logger';

const BUCKET_NAME = 'broker-assets';

/**
 * Faz upload de uma imagem para o bucket do Supabase
 * @param file - Arquivo de imagem ou string base64
 * @param fileName - Nome do arquivo (ex: 'logo.png', 'watermark.png')
 * @returns URL pública da imagem ou null em caso de erro
 */
export async function uploadImageToStorage(
  file: File | string,
  fileName: string
): Promise<string | null> {
  try {
    if (!supabase) {
      logger.error('Supabase não configurado');
      return null;
    }

    // Nota: A aplicação usa autenticação customizada, não Supabase Auth
    // As políticas RLS do bucket verificam autenticação via auth.role()
    // Se o usuário não tiver permissão, o Supabase retornará erro de RLS

    // Converter base64 para File se necessário
    let fileToUpload: File;
    
    if (typeof file === 'string') {
      // É base64, converter para File
      // Remover o prefixo data:image/...;base64, se existir
      const base64Data = file.includes(',') ? file.split(',')[1] : file;
      const mimeType = file.match(/data:([^;]+);/)?.[1] || 'image/png';
      
      // Converter base64 para blob
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });
      
      fileToUpload = new File([blob], fileName, { type: mimeType });
    } else {
      fileToUpload = file;
    }

    // Remover arquivo antigo se existir (opcional - para evitar acúmulo)
    // await supabase.storage.from(BUCKET_NAME).remove([fileName]);

    // Fazer upload do arquivo
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, fileToUpload, {
        cacheControl: '3600',
        upsert: true // Substituir se já existir
      });

    if (error) {
      logger.error('Erro ao fazer upload:', error);
      return null;
    }

    // Obter URL pública
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error) {
    logger.error('Erro ao fazer upload da imagem:', error);
    return null;
  }
}

/**
 * Remove uma imagem do bucket
 * @param fileName - Nome do arquivo a ser removido
 */
export async function removeImageFromStorage(fileName: string): Promise<boolean> {
  try {
    if (!supabase) {
      return false;
    }

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([fileName]);

    if (error) {
      logger.error('Erro ao remover imagem:', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Erro ao remover imagem:', error);
    return false;
  }
}

/**
 * Verifica se uma URL é do Supabase Storage
 */
export function isSupabaseStorageUrl(url: string): boolean {
  return url.includes('supabase.co/storage') || url.includes('supabase.co/object');
}

/**
 * Carrega uma imagem do Supabase Storage ou do localStorage
 * Retorna a URL da imagem (pode ser URL do Supabase ou base64)
 */
export async function loadBrokerImage(
  storageKey: string,
  supabaseKey?: string
): Promise<string | null> {
  try {
    // Primeiro, tentar carregar do Supabase
    if (supabase && supabaseKey) {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', supabaseKey)
        .single();

      if (!error && data?.value) {
        // Se for URL do Supabase Storage, retornar diretamente
        if (isSupabaseStorageUrl(data.value)) {
          return data.value;
        }
        // Se for base64, salvar no localStorage e retornar
        localStorage.setItem(storageKey, data.value);
        return data.value;
      }
    }

    // Fallback: carregar do localStorage
    return localStorage.getItem(storageKey);
  } catch (error) {
    logger.error('Erro ao carregar imagem:', error);
    // Fallback: carregar do localStorage
    return localStorage.getItem(storageKey);
  }
}

