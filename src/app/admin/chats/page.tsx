'use client';

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Chat, ChatMessage } from '@/services/chatService';
import { Send, MessageSquare, Clock, CheckCircle2, XCircle, User } from 'lucide-react';
import toast from 'react-hot-toast';

interface ChatWithUser extends Chat {
  userName?: string;
  userEmail?: string;
}

export default function ChatsAdminPage() {
  const [chats, setChats] = useState<ChatWithUser[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatWithUser | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadChats();
  }, []);

  useEffect(() => {
    if (selectedChat) {
      loadMessages();
      // Polling para novas mensagens a cada 3 segundos
      const interval = setInterval(() => {
        loadMessages();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [selectedChat]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const loadChats = async () => {
    setLoading(true);
    try {
      if (!supabase) {
        toast.error('Banco de dados não configurado');
        return;
      }

      // Buscar todos os chats
      const { data: chatsData, error: chatsError } = await supabase
        .from('chats')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(100);

      if (chatsError) {
        throw chatsError;
      }

      if (!chatsData || chatsData.length === 0) {
        setChats([]);
        setLoading(false);
        return;
      }

      // Buscar informações dos usuários
      const userIds = [...new Set(chatsData.map((chat: any) => chat.user_id))];
      const { data: usersData } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', userIds);

      const usersMap = new Map(
        (usersData || []).map((user: any) => [user.id, { name: user.name, email: user.email }])
      );

      // Combinar chats com informações dos usuários
      const chatsWithUsers: ChatWithUser[] = chatsData.map((chat: any) => {
        const userInfo = usersMap.get(chat.user_id);
        return {
          id: chat.id,
          userId: chat.user_id,
          status: chat.status as 'open' | 'closed' | 'waiting',
          subject: chat.subject,
          createdAt: chat.created_at,
          updatedAt: chat.updated_at,
          userName: userInfo?.name || 'Usuário',
          userEmail: userInfo?.email || '',
        };
      });

      setChats(chatsWithUsers);

      // Selecionar o primeiro chat se houver
      if (chatsWithUsers.length > 0 && !selectedChat) {
        setSelectedChat(chatsWithUsers[0]);
      }
    } catch (error: any) {
      console.error('Erro ao carregar chats:', error);
      toast.error('Erro ao carregar chats');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    if (!selectedChat) return;

    try {
      if (!supabase) {
        return;
      }

      // Buscar mensagens diretamente do banco
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_id', selectedChat.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Erro ao buscar mensagens:', error);
        // Log detalhado apenas se as propriedades existirem
        if (error.message) {
          console.error('Mensagem de erro:', error.message);
        }
        if (error.details) {
          console.error('Detalhes:', error.details);
        }
        if (error.code) {
          console.error('Código:', error.code);
        }
        // Não retornar aqui, permitir que o código continue para mostrar mensagens vazias
        // ou tratar o erro de forma mais elegante
        toast.error('Erro ao carregar mensagens. Verifique o console para mais detalhes.');
        return;
      }

      if (data) {
        const formattedMessages: ChatMessage[] = data.map((msg: any) => ({
          id: msg.id,
          chatId: msg.chat_id,
          userId: msg.user_id,
          message: msg.message,
          isFromSupport: msg.is_from_support || false,
          createdAt: msg.created_at,
        }));
        setMessages(formattedMessages);
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedChat || !messageText.trim()) return;

    setSending(true);
    try {
      if (!supabase) {
        toast.error('Banco de dados não configurado');
        return;
      }

      // Enviar mensagem como suporte (is_from_support = true)
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          chat_id: selectedChat.id,
          user_id: selectedChat.userId, // Manter o user_id do chat
          message: messageText.trim(),
          is_from_support: true,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Atualizar status do chat para "open"
      await supabase
        .from('chats')
        .update({ status: 'open', updated_at: new Date().toISOString() })
        .eq('id', selectedChat.id);

      // Adicionar mensagem à lista
      const newMessage: ChatMessage = {
        id: data.id,
        chatId: data.chat_id,
        userId: data.user_id,
        message: data.message,
        isFromSupport: data.is_from_support,
        createdAt: data.created_at,
      };
      setMessages([...messages, newMessage]);
      setMessageText('');

      // Recarregar chats para atualizar updated_at
      loadChats();
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      toast.error('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const handleCloseChat = async (chatId: string) => {
    try {
      if (!supabase) return;

      await supabase
        .from('chats')
        .update({ status: 'closed', updated_at: new Date().toISOString() })
        .eq('id', chatId);

      // Recarregar chats
      loadChats();
      
      // Se o chat fechado for o selecionado, selecionar outro
      if (selectedChat?.id === chatId) {
        const updatedChats = chats.map(chat => 
          chat.id === chatId ? { ...chat, status: 'closed' as const } : chat
        );
        setChats(updatedChats);
        const otherChat = updatedChats.find(chat => chat.id !== chatId);
        if (otherChat) {
          setSelectedChat(otherChat);
        }
      }
    } catch (error: any) {
      console.error('Erro ao fechar chat:', error);
      toast.error('Erro ao fechar chat');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
      case 'closed':
        return <XCircle className="w-3.5 h-3.5 text-gray-500" />;
      case 'waiting':
        return <Clock className="w-3.5 h-3.5 text-yellow-500" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-gray-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open':
        return 'Aberto';
      case 'closed':
        return 'Fechado';
      case 'waiting':
        return 'Aguardando';
      default:
        return status;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}m atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    if (diffDays < 7) return `${diffDays}d atrás`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const unreadCount = chats.filter(chat => chat.status === 'waiting' || chat.status === 'open').length;

  return (
    <div className="bg-black text-white h-full flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-200">Chats e Suporte</h1>
            <p className="text-xs text-gray-500 mt-0.5 uppercase tracking-wide">Gerenciar conversas de suporte</p>
          </div>
          {unreadCount > 0 && (
            <div className="px-3 py-1 bg-blue-600 rounded text-xs font-medium text-white">
              {unreadCount} {unreadCount === 1 ? 'chat pendente' : 'chats pendentes'}
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Lista de chats */}
        <div className="w-80 border-r border-gray-800 bg-gray-900 flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-gray-800">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
              Conversas ({chats.length})
            </div>
            {loading ? (
              <div className="text-xs text-gray-500">Carregando...</div>
            ) : chats.length === 0 ? (
              <div className="text-xs text-gray-500">Nenhum chat encontrado</div>
            ) : null}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => setSelectedChat(chat)}
                className={`w-full px-4 py-3 text-left border-b border-gray-800 hover:bg-gray-800 transition-colors ${
                  selectedChat?.id === chat.id ? 'bg-gray-800' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-200 truncate">
                        {chat.userName || 'Usuário'}
                      </div>
                      <div className="text-xs text-gray-400 truncate">
                        {chat.userEmail || ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 flex-shrink-0">
                    {getStatusIcon(chat.status)}
                  </div>
                </div>
                {chat.subject && (
                  <div className="text-xs text-gray-400 truncate mt-1">{chat.subject}</div>
                )}
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-500">{formatTime(chat.updatedAt)}</span>
                  <span className="text-xs text-gray-500">{getStatusLabel(chat.status)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main - Área de mensagens */}
        <div className="flex-1 flex flex-col bg-black">
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="px-6 py-3 border-b border-gray-800 bg-gray-900 flex items-center justify-between flex-shrink-0">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium text-gray-200">
                        {selectedChat.userName || 'Usuário'}
                      </div>
                      <div className="text-xs text-gray-400">{selectedChat.userEmail || ''}</div>
                    </div>
                  </div>
                  {selectedChat.subject && (
                    <div className="text-xs text-gray-500 mt-1">{selectedChat.subject}</div>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1 px-2 py-1 bg-gray-800 rounded text-xs text-gray-300">
                    {getStatusIcon(selectedChat.status)}
                    <span>{getStatusLabel(selectedChat.status)}</span>
                  </div>
                  {selectedChat.status !== 'closed' && (
                    <button
                      onClick={() => handleCloseChat(selectedChat.id)}
                      className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs font-medium text-gray-300 transition-colors"
                    >
                      Fechar Chat
                    </button>
                  )}
                </div>
              </div>

              {/* Messages Area */}
              <div
                className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar"
                style={{ scrollbarWidth: 'thin', scrollbarColor: '#374151 #111827' }}
              >
                {messages.length === 0 ? (
                  <div className="text-center text-sm text-gray-500 py-8">
                    Nenhuma mensagem ainda. Inicie a conversa enviando uma mensagem.
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.isFromSupport ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg px-4 py-2 ${
                          message.isFromSupport
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-800 text-gray-200'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                        <p className="text-xs opacity-70 mt-1">{formatMessageTime(message.createdAt)}</p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              {selectedChat.status !== 'closed' && (
                <div className="px-6 py-4 border-t border-gray-800 bg-gray-900 flex-shrink-0">
                  <div className="flex items-center space-x-3">
                    <input
                      type="text"
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                      placeholder="Digite sua mensagem..."
                      className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gray-600"
                      disabled={sending}
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!messageText.trim() || sending}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                    >
                      <Send className="w-4 h-4" />
                      <span>{sending ? 'Enviando...' : 'Enviar'}</span>
                    </button>
                  </div>
                </div>
              )}
              {selectedChat.status === 'closed' && (
                <div className="px-6 py-4 border-t border-gray-800 bg-gray-900 flex-shrink-0">
                  <div className="text-center text-sm text-gray-500">
                    Este chat está fechado. Não é possível enviar novas mensagens.
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-sm text-gray-500">Selecione um chat para visualizar as mensagens</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
