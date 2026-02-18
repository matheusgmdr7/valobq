'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createChat, sendMessage, getChatMessages, getUserChats, Chat, ChatMessage } from '@/services/chatService';
import { Send, MessageSquare } from 'lucide-react';
import { logger } from '@/utils/logger';

interface ChatSupportProps {
  onClose: () => void;
}

export const ChatSupport: React.FC<ChatSupportProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      loadChats();
    }
  }, [user]);

  useEffect(() => {
    if (currentChat) {
      loadMessages();
      // Polling apenas para chats do banco (UUID válido)
      const isLocalChat = currentChat.id.startsWith('chat-');
      if (!isLocalChat) {
        const interval = setInterval(() => {
          loadMessages();
        }, 3000);
        return () => clearInterval(interval);
      }
    }
  }, [currentChat]);

  useEffect(() => {
    // Só fazer scroll se não houver input em foco
    if (document.activeElement?.tagName !== 'INPUT') {
      scrollToBottom();
    }
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const loadChats = async () => {
    if (!user) return;
    
    try {
      const data = await getUserChats(user.id);
      setChats(data);
      if (data.length > 0 && !currentChat) {
        setCurrentChat(data[0]);
      }
    } catch (error) {
      logger.error('Erro ao carregar chats:', error);
    }
  };

  const loadMessages = async () => {
    if (!currentChat) return;
    
    try {
      const data = await getChatMessages(currentChat.id);
      setMessages(data);
    } catch (error) {
      logger.error('Erro ao carregar mensagens:', error);
    }
  };

  const handleStartChat = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const newChat = await createChat(user.id, 'Nova conversa');
      if (newChat) {
        setCurrentChat(newChat);
        setChats([newChat, ...chats]);
        setMessages([]);
      }
    } catch (error) {
      logger.error('Erro ao criar chat:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!currentChat || !messageText.trim() || !user) return;
    
    try {
      const newMessage = await sendMessage(currentChat.id, user.id, messageText);
      if (newMessage) {
        setMessages([...messages, newMessage]);
        setMessageText('');
      }
    } catch (error) {
      logger.error('Erro ao enviar mensagem:', error);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="h-full flex flex-col bg-black relative" style={{ zIndex: 50 }}>
      <div className="px-4 py-2.5 bg-black flex items-center justify-between flex-shrink-0 border-b border-gray-700/30" style={{ paddingTop: '1.5rem' }}>
        <div className="text-xs font-semibold text-gray-200 uppercase tracking-wide">Chats e Suporte</div>
        <button 
          onClick={onClose}
          className="p-1 hover:bg-gray-700 rounded transition-colors"
        >
          <span className="text-gray-400 text-xs">✕</span>
        </button>
      </div>
      
      {!currentChat ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <button
            onClick={handleStartChat}
            disabled={loading}
            className="flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl text-sm font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl hover:scale-105 active:scale-100"
          >
            <MessageSquare className="w-5 h-5" />
            <span>{loading ? 'Iniciando...' : 'Iniciar Conversa'}</span>
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-4 bg-black space-y-3" style={{ scrollbarWidth: 'thin', scrollbarColor: '#374151 #111827' }}>
            {messages.length === 0 ? (
              <div className="text-center text-xs text-gray-400 py-4">
                Nenhuma mensagem ainda. Envie uma mensagem para começar.
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.isFromSupport ? 'justify-start' : 'justify-end'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-md ${
                      message.isFromSupport
                        ? 'bg-gray-800/90 text-white rounded-tl-sm'
                        : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-tr-sm'
                    }`}
                  >
                    <p className="text-xs leading-relaxed break-words">{message.message}</p>
                    <p className={`text-[10px] mt-1.5 ${message.isFromSupport ? 'text-gray-400' : 'text-blue-100'} opacity-80`}>
                      {formatTime(message.createdAt)}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <div className="px-3 pt-2 pb-2 border-t border-gray-700/30 bg-gray-900/50 flex-shrink-0" style={{ position: 'relative', zIndex: 100 }}>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                onFocus={(e) => {
                  // Prevenir scroll automático quando o input recebe foco
                  e.preventDefault();
                  e.stopPropagation();
                  // Prevenir scrollIntoView do navegador
                  const target = e.target as HTMLInputElement;
                  setTimeout(() => {
                    if (document.activeElement === target) {
                      window.scrollTo(window.scrollX, window.scrollY);
                    }
                  }, 0);
                }}
                placeholder="Digite sua mensagem..."
                className="flex-1 px-4 py-2.5 bg-gray-800/70 border border-gray-700/50 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-gray-800/90 transition-all duration-200"
              />
              <button
                onClick={handleSendMessage}
                disabled={!messageText.trim()}
                className="p-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg hover:scale-110 active:scale-100 disabled:hover:scale-100"
                title="Enviar mensagem"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

