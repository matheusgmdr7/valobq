import { supabase } from '@/lib/supabase';

/**
 * Serviço para gerenciar chat e suporte
 */

/**
 * Verifica se uma string é um UUID válido
 */
function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

export interface ChatMessage {
  id: string;
  chatId: string;
  userId: string;
  message: string;
  isFromSupport: boolean;
  createdAt: string;
}

export interface Chat {
  id: string;
  userId: string;
  status: 'open' | 'closed' | 'waiting';
  subject?: string;
  createdAt: string;
  updatedAt: string;
  lastMessage?: ChatMessage;
}

/**
 * Cria um novo chat/ticket de suporte
 */
export async function createChat(
  userId: string,
  subject?: string
): Promise<Chat | null> {
  // Se o userId não for UUID válido, usar modo local
  if (!supabase || !isValidUUID(userId)) {
    // Modo local - retornar chat fictício
    return {
      id: 'chat-' + Date.now(),
      userId,
      status: 'waiting',
      subject,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  try {
    const { data, error } = await supabase
      .from('chats')
      .insert({
        user_id: userId,
        status: 'waiting',
        subject: subject || 'Nova conversa',
      })
      .select()
      .single();

    if (error) {
      console.error('[ChatService] Error:', error instanceof Error ? error.message : 'Unknown error');
      
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      status: data.status as 'open' | 'closed' | 'waiting',
      subject: data.subject,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  } catch (error) {
    console.error('[ChatService] Error:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Busca chats do usuário
 */
export async function getUserChats(userId: string): Promise<Chat[]> {
  // Se o userId não for UUID válido, usar modo local
  if (!supabase || !isValidUUID(userId)) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[ChatService] Error:', error instanceof Error ? error.message : 'Unknown error');
      
      return [];
    }

    return (data || []).map(chat => ({
      id: chat.id,
      userId: chat.user_id,
      status: chat.status as 'open' | 'closed' | 'waiting',
      subject: chat.subject,
      createdAt: chat.created_at,
      updatedAt: chat.updated_at,
    }));
  } catch (error) {
    console.error('[ChatService] Error:', error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
}

/**
 * Envia mensagem no chat
 */
export async function sendMessage(
  chatId: string,
  userId: string,
  message: string
): Promise<ChatMessage | null> {
  // Se o userId não for UUID válido, usar modo local
  if (!supabase || !isValidUUID(userId)) {
    return {
      id: 'msg-' + Date.now(),
      chatId,
      userId,
      message,
      isFromSupport: false,
      createdAt: new Date().toISOString(),
    };
  }

  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        chat_id: chatId,
        user_id: userId,
        message,
        is_from_support: false,
      })
      .select()
      .single();

    if (error) {
      console.error('[ChatService] Error:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }

    return {
      id: data.id,
      chatId: data.chat_id,
      userId: data.user_id,
      message: data.message,
      isFromSupport: data.is_from_support,
      createdAt: data.created_at,
    };
  } catch (error) {
    console.error('[ChatService] Error:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

/**
 * Busca mensagens do chat
 */
export async function getChatMessages(chatId: string): Promise<ChatMessage[]> {
  // Se o chatId não for UUID válido, retornar array vazio (chat local)
  if (!supabase || !isValidUUID(chatId)) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[ChatService] Error:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }

    return (data || []).map(msg => ({
      id: msg.id,
      chatId: msg.chat_id,
      userId: msg.user_id,
      message: msg.message,
      isFromSupport: msg.is_from_support,
      createdAt: msg.created_at,
    }));
  } catch (error) {
    console.error('[ChatService] Error:', error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
}

