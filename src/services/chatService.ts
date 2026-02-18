/**
 * Serviço para gerenciar chat e suporte
 * Usa API route server-side com service_role para evitar problemas de RLS
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
  if (!isValidUUID(userId)) {
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
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create-chat', userId, subject }),
    });

    const json = await res.json();
    if (!res.ok) {
      console.error('[ChatService] Error creating chat:', json.error);
      return null;
    }

    const data = json.data;
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
  if (!isValidUUID(userId)) {
    return [];
  }

  try {
    const res = await fetch(`/api/chat?userId=${userId}`);
    const json = await res.json();

    if (!res.ok) {
      console.error('[ChatService] Error loading chats:', json.error);
      return [];
    }

    return (json.data || []).map((chat: any) => ({
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
  if (!isValidUUID(userId)) {
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
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send-message', chatId, userId, message }),
    });

    const json = await res.json();
    if (!res.ok) {
      console.error('[ChatService] Error sending message:', json.error);
      return null;
    }

    const data = json.data;
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
  if (!isValidUUID(chatId)) {
    return [];
  }

  try {
    const res = await fetch(`/api/chat?chatId=${chatId}`);
    const json = await res.json();

    if (!res.ok) {
      console.error('[ChatService] Error loading messages:', json.error);
      return [];
    }

    return (json.data || []).map((msg: any) => ({
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
