'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  Camera, ChevronDown, CheckCircle2, Bell, Settings, Shield, Calendar, MessageCircle, RotateCcw, Download, XCircle, Search, Lock, Key, Monitor, LogOut, ArrowRight, DollarSign, Wallet, Briefcase, HelpCircle, User, X, Mail, Phone, FileText, Upload, CheckCircle, Clock, History, ArrowLeft, Maximize2, Paperclip, Smile, Send, MessageSquare
} from 'lucide-react';
import { createChat, sendMessage, getChatMessages, getUserChats, Chat, ChatMessage } from '@/services/chatService';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';

type Language = 'pt' | 'en' | 'es';

interface LanguageOption {
  code: Language;
  name: string;
  flag: string;
}

const languages: LanguageOption[] = [
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
];

const ProfilePage: React.FC = () => {
  const { user, loading, logout, activeBalance, accountType } = useAuth();
  const router = useRouter();
  const [brokerLogo, setBrokerLogo] = useState<string | null>(null);
  const [brokerName, setBrokerName] = useState<string>('POLARIUM BROKER');
  const [language, setLanguage] = useState<Language>('pt');
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const languageDropdownRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState(() => {
    // Verificar se há uma seção ativa salva no localStorage (vindo de navegação externa)
    if (typeof window !== 'undefined') {
      const savedSection = localStorage.getItem('profile_active_section');
      if (savedSection) {
        localStorage.removeItem('profile_active_section'); // Limpar após usar
        return savedSection;
      }
    }
    return 'personal-data';
  });
  const [showUserMenu, setShowUserMenu] = useState(false); // Controla menu lateral do usuário
  const [showChatWindow, setShowChatWindow] = useState(() => {
    // Verificar se o chat deve abrir automaticamente (vindo de outra página)
    if (typeof window !== 'undefined') {
      const shouldOpenChat = localStorage.getItem('open_chat_on_profile');
      if (shouldOpenChat) {
        localStorage.removeItem('open_chat_on_profile');
        return true;
      }
    }
    return false;
  }); // Controla janela de chat
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  const [userPhoto, setUserPhoto] = useState<string | null>(() => {
    // Carregar foto do usuário do localStorage se existir
    if (typeof window !== 'undefined') {
      const savedPhoto = localStorage.getItem('user_photo');
      return savedPhoto || null;
    }
    return null;
  }); // Foto do usuário (pode ser URL ou base64)
  
  // Notification settings state
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [emailPromotions, setEmailPromotions] = useState(false);
  const [emailSystemNews, setEmailSystemNews] = useState(false);
  const [emailAnalytics, setEmailAnalytics] = useState(false);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [phoneCalls, setPhoneCalls] = useState(true);
  const [dataCommunication, setDataCommunication] = useState(true);
  
  // Account settings state
  const [publicProfile, setPublicProfile] = useState(true);
  const [platformName, setPlatformName] = useState('Owen Campbell');
  
  // Gerar nome aleatório para a plataforma
  const generateRandomName = () => {
    const firstNames = ['Owen', 'Lucas', 'Rafael', 'Carlos', 'Miguel', 'João', 'Pedro', 'Tiago', 'André', 'Felipe'];
    const lastNames = ['Campbell', 'Silva', 'Santos', 'Oliveira', 'Souza', 'Costa', 'Pereira', 'Alves', 'Ferreira', 'Rodrigues'];
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    setPlatformName(`${firstName} ${lastName}`);
  };
  
  
  // Security state
  const [showSessions, setShowSessions] = useState(false);
  
  // User profile data
  const [phone, setPhone] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('user_phone') || '';
    }
    return '';
  });
  const [birthDate, setBirthDate] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('user_birthdate') || '';
    }
    return '';
  });
  const [timezone, setTimezone] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('user_timezone') || 'America/Sao_Paulo';
    }
    return 'America/Sao_Paulo';
  });
  const [showPhoneEdit, setShowPhoneEdit] = useState(false);
  const [showEmailEdit, setShowEmailEdit] = useState(false);
  const [editingEmail, setEditingEmail] = useState(user?.email || '');
  const [platformContactEmail, setPlatformContactEmail] = useState<string>('support@supportpolarium.com');
  
  // KYC Verification states - inicializar com email e telefone aprovados se existirem
  const [verificationStatus, setVerificationStatus] = useState(() => {
    const hasEmail = user?.email && user.email.includes('@');
    const hasPhone = typeof window !== 'undefined' && localStorage.getItem('user_phone');
    return {
      email: hasEmail ? 'approved' as const : 'pending' as 'pending' | 'approved' | 'rejected',
      phone: hasPhone ? 'approved' as const : 'pending' as 'pending' | 'approved' | 'rejected',
      personalDetails: 'pending' as 'pending' | 'approved' | 'rejected',
      proofOfIdentity: 'pending' as 'pending' | 'approved' | 'rejected',
    };
  });
  
  // Estados para saber se os documentos foram enviados (em análise)
  const [documentsSubmitted, setDocumentsSubmitted] = useState({
    personalDetails: false,
    proofOfIdentity: false,
  });
  
  const [verificationData, setVerificationData] = useState(() => {
    const savedPhone = typeof window !== 'undefined' ? localStorage.getItem('user_phone') : null;
    return {
      email: user?.email || '',
      phone: phone || savedPhone || '',
      fullName: user?.name || '',
      birthDate: birthDate,
      documentType: 'cpf' as 'cpf' | 'rg' | 'passport',
      documentNumber: '',
      documentPhoto: null as string | null,
      selfiePhoto: null as string | null,
    };
  });
  
  const [submitting, setSubmitting] = useState(false);
  
  // Estados para modal de exclusão/encerramento
  const [showClosureModal, setShowClosureModal] = useState(false);
  const [closureType, setClosureType] = useState<'close' | 'delete' | null>(null);
  const [closureReason, setClosureReason] = useState('');
  const [submittingClosure, setSubmittingClosure] = useState(false);
  
  // Atualizar email e nome quando o usuário for carregado
  useEffect(() => {
    if (user?.email) {
      setVerificationData(prev => ({
        ...prev,
        email: user.email,
        fullName: user.name || prev.fullName,
      }));
    }
  }, [user?.email, user?.name]);
  
  // Carregar logo e nome da broker (logo para fundo branco)
  useEffect(() => {
    const loadBrokerData = async () => {
      try {
        let logoUrl: string | null = null;
        let brokerNameValue: string | null = null;
        
        // Primeiro, tentar carregar do Supabase (priorizar logoLight para fundo branco)
        if (supabase) {
          try {
            const { data: logoLightData } = await supabase
              .from('platform_settings')
              .select('value')
              .eq('key', 'broker_logo_light')
              .single();
            
            if (logoLightData?.value) {
              logoUrl = logoLightData.value as string;
              localStorage.setItem('broker_logo_light', logoUrl);
            } else {
              // Fallback: tentar logo padrão
              const { data: logoData } = await supabase
                .from('platform_settings')
                .select('value')
                .eq('key', 'broker_logo')
                .single();
              
              if (logoData?.value) {
                logoUrl = logoData.value as string;
                localStorage.setItem('broker_logo', logoUrl);
              }
            }
            
            // Buscar nome da broker
            const { data: nameData } = await supabase
              .from('platform_settings')
              .select('value')
              .eq('key', 'broker_name')
              .single();
            
            if (nameData?.value) {
              brokerNameValue = nameData.value as string;
              localStorage.setItem('broker_name', brokerNameValue);
            }

            // Buscar email de suporte
            const { data: emailData } = await supabase
              .from('platform_settings')
              .select('value')
              .eq('key', 'broker_support_email')
              .single();
            
            if (emailData?.value) {
              const supportEmail = emailData.value as string;
              localStorage.setItem('broker_support_email', supportEmail);
              localStorage.setItem('platform_contact_email', supportEmail);
              setPlatformContactEmail(supportEmail);
            }
          } catch (error) {
            // Fallback para localStorage
          }
        }
        
        // Se não encontrou no Supabase, usar localStorage
        if (!logoUrl) {
          logoUrl = localStorage.getItem('broker_logo_light') || localStorage.getItem('broker_logo');
        }
        if (!brokerNameValue) {
          brokerNameValue = localStorage.getItem('broker_name');
        }
        
        // Carregar email de suporte do localStorage se não foi carregado do Supabase
        const savedSupportEmail = localStorage.getItem('broker_support_email') || localStorage.getItem('platform_contact_email');
        if (savedSupportEmail) {
          setPlatformContactEmail(savedSupportEmail);
        }
        
        if (logoUrl) {
          setBrokerLogo(logoUrl);
        }
        if (brokerNameValue) {
          setBrokerName(brokerNameValue);
        }
      } catch (error) {
        logger.error('Erro ao carregar dados da broker:', error);
      }
    };
    
    loadBrokerData();
  }, []);
  
  // Load verification status
  useEffect(() => {
    if (user && typeof window !== 'undefined') {
      loadVerificationStatus();
    }
  }, [user]);

  // Chat functions
  useEffect(() => {
    if (user && showChatWindow) {
      loadChats();
    }
  }, [user, showChatWindow]);

  useEffect(() => {
    if (currentChat) {
      loadMessages();
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
    if (document.activeElement?.tagName !== 'INPUT') {
      scrollToBottom();
    }
  }, [messages]);

  const scrollToBottom = () => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
    setChatLoading(true);
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
      setChatLoading(false);
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
  
  const loadVerificationStatus = async () => {
    try {
      if (!user) return;
      
      // Email sempre aprovado se tiver email válido (vem do registro)
      const emailVerified = user.email && user.email.includes('@');
      if (emailVerified && user.email) {
        setVerificationStatus(prev => ({ ...prev, email: 'approved' }));
        setVerificationData(prev => ({ ...prev, email: user.email }));
      }
      
      // Telefone sempre aprovado se tiver telefone salvo (vem do registro)
      const savedPhone = localStorage.getItem('user_phone');
      if (savedPhone) {
        setVerificationStatus(prev => ({ ...prev, phone: 'approved' }));
        setVerificationData(prev => ({ ...prev, phone: savedPhone }));
        setPhone(savedPhone);
      }
      
      // Carregar nome completo do usuário (vem do registro)
      if (user.name) {
        setVerificationData(prev => ({ ...prev, fullName: user.name || '' }));
      }
      
      if (!supabase) return;
      
      // Verificar documentos KYC - só muda status se já foi enviado (status 'pending' = em análise, não 'pending' = não enviado)
      const { data: kycDocs } = await supabase
        .from('kyc_documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (kycDocs && kycDocs.length > 0) {
        const personalDetailsDoc = kycDocs.find(doc => doc.document_type === 'personal_details');
        const identityDoc = kycDocs.find(doc => doc.document_type === 'proof_of_identity');
        
        if (personalDetailsDoc) {
          // Se existe documento, foi enviado e está em análise/aprovado/rejeitado
          setDocumentsSubmitted(prev => ({ ...prev, personalDetails: true }));
          setVerificationStatus(prev => ({ 
            ...prev, 
            personalDetails: personalDetailsDoc.status as 'pending' | 'approved' | 'rejected' 
          }));
        }
        
        if (identityDoc) {
          // Se existe documento, foi enviado e está em análise/aprovado/rejeitado
          setDocumentsSubmitted(prev => ({ ...prev, proofOfIdentity: true }));
          setVerificationStatus(prev => ({ 
            ...prev, 
            proofOfIdentity: identityDoc.status as 'pending' | 'approved' | 'rejected' 
          }));
        }
      }
    } catch (error) {
      logger.error('Erro ao carregar status de verificação:', error);
    }
  };
  
  // Funções para validar se pode avançar para o próximo step
  const canAccessPhone = () => {
    return verificationData.email && verificationData.email.includes('@');
  };
  
  const canAccessPersonalDetails = () => {
    return canAccessPhone() && verificationData.phone && verificationData.phone.length > 0;
  };
  
  const canAccessProofOfIdentity = () => {
    return canAccessPersonalDetails() && 
           verificationData.fullName && 
           verificationData.birthDate && 
           verificationData.documentNumber;
  };
  
  const handleDocumentUpload = (type: 'document' | 'selfie') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const photoUrl = event.target?.result as string;
          if (type === 'document') {
            setVerificationData(prev => ({ ...prev, documentPhoto: photoUrl }));
          } else {
            setVerificationData(prev => ({ ...prev, selfiePhoto: photoUrl }));
          }
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };
  
  const handleSubmitVerification = async () => {
    if (!user) return;
    
    setSubmitting(true);
    try {
      if (!supabase) {
        toast.error('Banco de dados não configurado');
        setSubmitting(false);
        return;
      }
      
      // Criar documento combinado (documento + selfie)
      if (verificationData.documentPhoto && verificationData.selfiePhoto) {
        // Combinar as duas imagens em uma (ou salvar separadamente)
        const combinedData = {
          document: verificationData.documentPhoto,
          selfie: verificationData.selfiePhoto,
        };
        
        // Salvar como base64 no banco (em produção, usar storage)
        const { error: docError } = await supabase
          .from('kyc_documents')
          .insert({
            user_id: user.id,
            document_type: 'proof_of_identity',
            file_url: JSON.stringify(combinedData), // Em produção, usar URL de storage
            status: 'pending',
          });
        
        if (docError) throw docError;
        
        // Salvar dados pessoais
        if (verificationData.fullName && verificationData.birthDate && verificationData.documentNumber) {
          // Salvar data de nascimento no localStorage para aparecer em dados pessoais
          localStorage.setItem('user_birthdate', verificationData.birthDate);
          setBirthDate(verificationData.birthDate);
          
          const { error: personalError } = await supabase
            .from('kyc_documents')
            .insert({
              user_id: user.id,
              document_type: 'personal_details',
              file_url: JSON.stringify({
                fullName: verificationData.fullName,
                birthDate: verificationData.birthDate,
                documentType: verificationData.documentType,
                documentNumber: verificationData.documentNumber,
              }),
              status: 'pending',
            });
          
          if (personalError) throw personalError;
        }
        
        toast.success('Documentos enviados para análise!');
        setDocumentsSubmitted(prev => ({ 
          ...prev, 
          proofOfIdentity: true,
          personalDetails: true 
        }));
        setVerificationStatus(prev => ({ 
          ...prev, 
          proofOfIdentity: 'pending',
          personalDetails: 'pending' 
        }));
        // Limpar campos após envio
        setVerificationData(prev => ({
          ...prev,
          documentPhoto: null,
          selfiePhoto: null,
        }));
        loadVerificationStatus();
      } else {
        toast.error('Por favor, anexe o documento e a selfie');
      }
    } catch (error: any) {
      logger.error('Erro ao enviar verificação:', error);
      toast.error(error.message || 'Erro ao enviar documentos');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Timezone options
  const timezones = [
    { value: 'America/Sao_Paulo', label: 'America/Sao_Paulo (Brasília)' },
    { value: 'America/New_York', label: 'America/New_York (Nova York)' },
    { value: 'America/Los_Angeles', label: 'America/Los_Angeles (Los Angeles)' },
    { value: 'Europe/London', label: 'Europe/London (Londres)' },
    { value: 'Europe/Paris', label: 'Europe/Paris (Paris)' },
    { value: 'Asia/Tokyo', label: 'Asia/Tokyo (Tóquio)' },
  ];
  
  // Mock active sessions data
  const activeSessions = [
    {
      id: '1',
      browser: 'Chrome',
      ip: '189.115.207.1',
      country: 'Brazil',
      timestamp: 'Hoje às 01:10',
      isCurrent: true
    },
    {
      id: '2',
      browser: 'Safari',
      ip: '189.92.23.241',
      country: 'Brazil',
      timestamp: 'Ontem às 21:05',
      isCurrent: false
    },
    {
      id: '3',
      browser: 'Chrome',
      ip: '189.115.207.1',
      country: 'Brazil',
      timestamp: 'Última Sexta-feira às 21:23',
      isCurrent: false
    }
  ];
  
  const getBrowserIcon = (browser: string, isCurrent: boolean) => {
    if (browser === 'Chrome') {
      return (
        <div className="relative">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" fill="#4285F4"/>
            <circle cx="12" cy="12" r="6" fill="#34A853"/>
            <path d="M12 2C8.13 2 4.8 4.15 2.9 7.5L8.5 12L12 2Z" fill="#FBBC05"/>
            <path d="M2.9 7.5C1.4 9.8 0.5 12.5 0.5 15.5C0.5 19.37 2.65 22.7 6 24.6L12 12L2.9 7.5Z" fill="#EA4335"/>
            <path d="M12 22C15.87 22 19.2 19.85 21.1 16.5L15.5 12L12 22Z" fill="#4285F4"/>
            <path d="M21.1 16.5C22.6 14.2 23.5 11.5 23.5 8.5C23.5 4.63 21.35 1.3 18 0.6L12 12L21.1 16.5Z" fill="#34A853"/>
          </svg>
          {isCurrent && (
            <div className="absolute -bottom-0.5 -left-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
          )}
        </div>
      );
    } else if (browser === 'Safari') {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z" fill="#007AFF"/>
          <path d="M12 6L16 8L12 10L8 8L12 6Z" fill="#007AFF"/>
          <path d="M8 8L10 12L8 16L6 12L8 8Z" fill="#007AFF"/>
          <path d="M12 10L16 12L12 14L8 12L12 10Z" fill="#007AFF"/>
          <path d="M16 8L18 12L16 16L14 12L16 8Z" fill="#007AFF"/>
          <path d="M12 14L16 16L12 18L8 16L12 14Z" fill="#007AFF"/>
        </svg>
      );
    }
    return <Monitor className="w-6 h-6 text-gray-400" />;
  };

  const selectedLanguage = languages.find(lang => lang.code === language) || languages[0];

  useEffect(() => {
    if (!loading && !user) {
      // Salvar a URL atual para redirecionar após login
      const returnUrl = window.location.pathname;
      router.push(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
    }
  }, [user, loading, router]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(event.target as Node)) {
        setShowLanguageDropdown(false);
      }
    };

    if (showLanguageDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showLanguageDropdown]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const formatDate = (date: Date) => {
    const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    return `${day} de ${month}, ${year}`;
  };

  const menuSections = [
    { id: 'personal-data', name: 'Dados Pessoais' },
    { id: 'verification', name: 'Verificação' },
    { id: 'notifications', name: 'Definições de notificações' },
    { id: 'account', name: 'Definições da conta' },
    { id: 'security', name: 'Proteção e Segurança' },
  ];

  // Gerar ID de perfil baseado no ID do usuário
  const profileId = user.id.replace(/-/g, '').substring(0, 9) || '182290911';

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex justify-between items-center">
          {brokerLogo && (
            <div className="flex items-center space-x-2">
              <img 
                src={brokerLogo} 
                alt={brokerName}
                className="h-16 w-auto object-contain"
              />
            </div>
          )}
          
          <div className="flex items-center space-x-4">
            {/* Language Selector */}
            <div className="relative" ref={languageDropdownRef}>
              <button
                onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
                className="flex items-center justify-center w-10 h-10 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <span className="text-xl">{selectedLanguage.flag}</span>
              </button>
              
              {showLanguageDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-300 rounded-lg shadow-lg z-50">
                  <div className="py-1">
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => {
                          setLanguage(lang.code);
                          setShowLanguageDropdown(false);
                        }}
                        className={`w-full flex items-center space-x-3 px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${
                          language === lang.code ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                        }`}
                      >
                        <span className="text-lg">{lang.flag}</span>
                        <span className="font-medium">{lang.name}</span>
                        {language === lang.code && (
                          <span className="ml-auto text-blue-600">✓</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Avatar clicável */}
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="relative flex-shrink-0"
            >
              {userPhoto ? (
                <img
                  src={userPhoto}
                  alt={user.name}
                  className="w-10 h-10 rounded-full object-cover border-2 border-gray-300"
                />
              ) : (
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-gray-500" />
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center border-2 border-white">
                <CheckCircle2 className="w-3 h-3 text-white" />
              </div>
            </button>
            
            {/* Botão Negociar - Cantos quadrados e maior */}
            <button
              onClick={() => router.push('/dashboard/trading')}
              className="bg-blue-600 text-white px-6 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors"
              style={{ borderRadius: '0' }}
            >
              Negociar
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0 overflow-y-auto">
          <nav className="p-4">
            <div>
              {menuSections.map((section, index) => (
                <div key={section.id}>
                  <button
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors ${
                      activeSection === section.id
                        ? 'text-blue-600'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {section.name}
                  </button>
                  {index < menuSections.length - 1 && (
                    <div className="border-t border-dashed border-gray-300 my-1"></div>
                  )}
                </div>
              ))}
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {activeSection === 'personal-data' && (
            <div className="max-w-4xl mx-auto">
              {/* Profile Info Header */}
              <div className="flex justify-between items-start mb-8">
                <div></div>
                <div className="text-right text-sm text-gray-600">
                  <p>Data de registro: {formatDate(user.createdAt)}</p>
                  <p>ID de perfil: {profileId}</p>
                </div>
              </div>

              {/* Profile Picture Section */}
              <div className="flex flex-col items-center mb-8">
                <div className="relative mb-4">
                  {userPhoto ? (
                    <div className="relative">
                      <img
                        src={userPhoto}
                        alt={user.name}
                        className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
                      />
                      <button
                        onClick={() => {
                          setUserPhoto(null);
                          localStorage.removeItem('user_photo');
                          toast.success('Foto removida!');
                        }}
                        className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center shadow-lg transition-colors"
                        title="Remover foto"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-32 h-32 bg-gray-200 rounded-full flex items-center justify-center border-4 border-white shadow-lg">
                      <Camera className="w-12 h-12 text-gray-400" />
                    </div>
                  )}
                </div>
                
                <h2 className="text-2xl font-bold text-gray-900 mb-4">{user.name}</h2>
                
                <div className="flex items-center gap-3 mb-3">
                  {userPhoto ? (
                    <>
                      <button 
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/*';
                          input.onchange = (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                const photoUrl = event.target?.result as string;
                                setUserPhoto(photoUrl);
                                localStorage.setItem('user_photo', photoUrl);
                                toast.success('Foto atualizada!');
                              };
                              reader.readAsDataURL(file);
                            }
                          };
                          input.click();
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        Trocar foto
                      </button>
                      <button 
                        onClick={() => {
                          setUserPhoto(null);
                          localStorage.removeItem('user_photo');
                          toast.success('Foto removida!');
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm font-medium"
                      >
                        Remover foto
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const photoUrl = event.target?.result as string;
                              setUserPhoto(photoUrl);
                              localStorage.setItem('user_photo', photoUrl);
                              toast.success('Foto atualizada!');
                            };
                            reader.readAsDataURL(file);
                          }
                        };
                        input.click();
                      }}
                      className="px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-colors"
                    >
                      + Carregar uma foto
                    </button>
                  )}
                </div>
                
                <p className="text-sm text-gray-500 text-center max-w-md">
                  Sua foto será visualizada nas mensagens diretas, chats públicos e classificações
                </p>
              </div>

              {/* Phone Number Section */}
              <div className="mt-8 border-t border-gray-200 pt-6">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <p className="text-sm text-gray-600 mb-1">Número de telefone:</p>
                    {showPhoneEdit ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+55 (11) 99999-9999"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button
                          onClick={() => {
                            localStorage.setItem('user_phone', phone);
                            setShowPhoneEdit(false);
                            toast.success('Telefone atualizado!');
                          }}
                          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                          Salvar
                        </button>
                        <button
                          onClick={() => {
                            setPhone(localStorage.getItem('user_phone') || '');
                            setShowPhoneEdit(false);
                          }}
                          className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="text-base text-gray-900">
                          {phone ? phone.replace(/(\+\d{2})\s*(\d{2})\s*(\d{4,5})(\d{4})/, '$1 ... ... $4') : 'Não registrado'}
                        </p>
                        {phone && <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />}
                        {phone && (
                          <button
                            onClick={() => setShowPhoneEdit(true)}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium ml-2"
                          >
                            Alterar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Email Section */}
              <div className="mt-6 border-t border-gray-200 pt-6">
                <div className="flex items-start justify-between mb-3 flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <p className="text-sm text-gray-600 mb-1">Endereço de e-mail:</p>
                    {showEmailEdit ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="email"
                          value={editingEmail}
                          onChange={(e) => setEditingEmail(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button
                          onClick={() => {
                            // Aqui você pode adicionar lógica para atualizar o email no backend
                            localStorage.setItem('user_email', editingEmail);
                            setShowEmailEdit(false);
                            toast.success('Email atualizado!');
                          }}
                          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                          Salvar
                        </button>
                        <button
                          onClick={() => {
                            setEditingEmail(user?.email || '');
                            setShowEmailEdit(false);
                          }}
                          className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="text-base text-gray-900">{user.email}</p>
                        <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                      </div>
                    )}
                  </div>
                </div>
                {!showEmailEdit && (
                  <>
                    <p className="text-sm text-gray-600 mb-2">
                      Você pode alterar o endereço de e-mail associado à sua conta.
                    </p>
                    <button 
                      onClick={() => setShowEmailEdit(true)}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      Alterar e-mail
                    </button>
                  </>
                )}
              </div>

              {/* Contact Information Section */}
              <div className="mt-6 border-t border-gray-200 pt-6">
                <h3 className="text-base font-semibold text-gray-900 mb-4">Informações de contato:</h3>
                <div className="space-y-4 mb-4">
                  <div>
                    <label className="text-sm text-gray-600 mb-1 block">Data de nascimento:</label>
                    {birthDate || verificationData.birthDate ? (
                      <p className="text-sm text-gray-900 px-3 py-2 border border-gray-200 rounded-lg bg-gray-50">
                        {birthDate || verificationData.birthDate ? new Date(birthDate || verificationData.birthDate).toLocaleDateString('pt-BR') : 'Não informado'}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500">Preencha na seção de Verificação</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-900 flex items-center">
                      <span className="text-gray-600">País:</span>{' '}
                      <span className="ml-1">🇧🇷</span>
                      <span className="ml-1">Brazil</span>
                    </p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 mb-1 block">Fuso horário:</label>
                    <select
                      value={timezone}
                      onChange={(e) => {
                        setTimezone(e.target.value);
                        localStorage.setItem('user_timezone', e.target.value);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {timezones.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                          {tz.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  Se você deseja corrigir e/ou gerenciar seus dados, entre em contato com{' '}
                  <a href={`mailto:${platformContactEmail}`} className="text-blue-600 hover:text-blue-700">
                    {platformContactEmail}
                  </a>
                </p>
              </div>

              {/* Access My Data Section */}
              <div className="mt-6 border-t border-gray-200 pt-6">
                <h3 className="text-base font-semibold text-gray-900 mb-2">Acessar meus dados</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Você pode visualizar os dados pessoais que você nos forneceu por categoria.
                </p>
                <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  Exibir meus dados
                </button>
              </div>
            </div>
          )}

          {activeSection === 'verification' && (
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-8">Verificação de Conta</h2>
              
              <div className="flex gap-8">
                {/* Steps Verticais */}
                <div className="w-64 flex-shrink-0">
                  <div className="space-y-6">
                    {/* Step 1: Email */}
                    <div className="flex items-start space-x-3">
                      <div className="relative flex flex-col items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                          verificationStatus.email === 'approved' 
                            ? 'bg-blue-100 border-blue-500' 
                            : verificationStatus.email === 'rejected'
                            ? 'bg-red-100 border-red-500'
                            : 'bg-gray-100 border-gray-300'
                        }`}>
                          {verificationStatus.email === 'approved' ? (
                            <CheckCircle className="w-6 h-6 text-blue-600" />
                          ) : (
                            <Mail className={`w-5 h-5 ${
                              verificationStatus.email === 'rejected' ? 'text-red-600' : 'text-gray-400'
                            }`} />
                          )}
                        </div>
                        {verificationStatus.email !== 'approved' && (
                          <div className="absolute top-10 left-1/2 transform -translate-x-1/2 w-0.5 h-12 bg-blue-500"></div>
                        )}
                      </div>
                      <div className="flex-1 pt-1">
                        <p className={`text-sm ${verificationStatus.email === 'approved' ? 'text-gray-600' : verificationStatus.email === 'rejected' ? 'text-gray-600' : 'font-semibold text-gray-900'}`}>
                          Email confirmation
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {verificationStatus.email === 'approved' ? 'Done' : verificationStatus.email === 'rejected' ? 'Rejected' : 'Pending'}
                        </p>
                      </div>
                    </div>

                    {/* Step 2: Phone */}
                    <div className="flex items-start space-x-3">
                      <div className="relative flex flex-col items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                          verificationStatus.phone === 'approved' 
                            ? 'bg-blue-100 border-blue-500' 
                            : verificationStatus.phone === 'rejected'
                            ? 'bg-red-100 border-red-500'
                            : 'bg-gray-100 border-gray-300'
                        }`}>
                          {verificationStatus.phone === 'approved' ? (
                            <CheckCircle className="w-6 h-6 text-blue-600" />
                          ) : (
                            <Phone className={`w-5 h-5 ${
                              verificationStatus.phone === 'rejected' ? 'text-red-600' : 'text-gray-400'
                            }`} />
                          )}
                        </div>
                        {verificationStatus.phone !== 'approved' && (
                          <div className="absolute top-10 left-1/2 transform -translate-x-1/2 w-0.5 h-12 bg-blue-500"></div>
                        )}
                      </div>
                      <div className="flex-1 pt-1">
                        <p className={`text-sm ${verificationStatus.phone === 'approved' ? 'text-gray-600' : verificationStatus.phone === 'rejected' ? 'text-gray-600' : 'font-semibold text-gray-900'}`}>
                          Phone confirmation
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {verificationStatus.phone === 'approved' ? 'Done' : verificationStatus.phone === 'rejected' ? 'Rejected' : 'Pending'}
                        </p>
                      </div>
                    </div>

                    {/* Step 3: Personal Details */}
                    <div className="flex items-start space-x-3">
                      <div className="relative flex flex-col items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                          verificationStatus.personalDetails === 'approved' 
                            ? 'bg-blue-100 border-blue-500' 
                            : verificationStatus.personalDetails === 'rejected'
                            ? 'bg-red-100 border-red-500'
                            : 'bg-gray-100 border-gray-300'
                        }`}>
                          {verificationStatus.personalDetails === 'approved' ? (
                            <CheckCircle className="w-6 h-6 text-blue-600" />
                          ) : (
                            <User className={`w-5 h-5 ${
                              verificationStatus.personalDetails === 'rejected' ? 'text-red-600' : 'text-gray-400'
                            }`} />
                          )}
                        </div>
                        {verificationStatus.personalDetails !== 'approved' && (
                          <div className="absolute top-10 left-1/2 transform -translate-x-1/2 w-0.5 h-12 bg-blue-500"></div>
                        )}
                      </div>
                      <div className="flex-1 pt-1">
                        <p className={`text-sm ${verificationStatus.personalDetails === 'approved' ? 'text-gray-600' : verificationStatus.personalDetails === 'rejected' ? 'text-gray-600' : 'font-semibold text-gray-900'}`}>
                          Personal Details
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {verificationStatus.personalDetails === 'approved' ? 'Done' : verificationStatus.personalDetails === 'rejected' ? 'Rejected' : (documentsSubmitted.personalDetails && verificationStatus.personalDetails === 'pending') ? 'In Review' : (verificationData.fullName && verificationData.birthDate && verificationData.documentNumber) ? 'Fill in' : 'Pending'}
                        </p>
                      </div>
                    </div>

                    {/* Step 4: Proof of Identity */}
                    <div className="flex items-start space-x-3">
                      <div className="relative flex flex-col items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                          verificationStatus.proofOfIdentity === 'approved' 
                            ? 'bg-blue-100 border-blue-500' 
                            : verificationStatus.proofOfIdentity === 'rejected'
                            ? 'bg-red-100 border-red-500'
                            : 'bg-gray-100 border-gray-300'
                        }`}>
                          {verificationStatus.proofOfIdentity === 'approved' ? (
                            <CheckCircle className="w-6 h-6 text-blue-600" />
                          ) : (
                            <FileText className={`w-5 h-5 ${
                              verificationStatus.proofOfIdentity === 'rejected' ? 'text-red-600' : 'text-gray-400'
                            }`} />
                          )}
                        </div>
                      </div>
                      <div className="flex-1 pt-1">
                        <p className={`text-sm ${verificationStatus.proofOfIdentity === 'approved' ? 'text-gray-600' : verificationStatus.proofOfIdentity === 'rejected' ? 'text-gray-600' : 'font-semibold text-gray-900'}`}>
                          Proof of Identity
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {verificationStatus.proofOfIdentity === 'approved' ? 'Done' : verificationStatus.proofOfIdentity === 'rejected' ? 'Rejected' : (documentsSubmitted.proofOfIdentity && verificationStatus.proofOfIdentity === 'pending') ? 'In Review' : (verificationData.documentPhoto && verificationData.selfiePhoto) ? 'Fill in' : 'Pending'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Formulário */}
                <div className="flex-1 space-y-6">
                  {/* Email */}
                  <div className="border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirmação de E-mail</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-2">E-mail</label>
                        <input
                          type="email"
                          value={verificationData.email}
                          onChange={(e) => setVerificationData(prev => ({ ...prev, email: e.target.value }))}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                          disabled={verificationStatus.email === 'approved'}
                        />
                      </div>
                      {verificationStatus.email === 'approved' && (
                        <div className="flex items-center text-green-600 text-sm">
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          E-mail confirmado
                        </div>
                      )}
                      {!verificationStatus.email && verificationData.email && (
                        <button
                          onClick={() => {
                            setVerificationStatus(prev => ({ ...prev, email: 'approved' }));
                            toast.success('E-mail confirmado!');
                          }}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                          Confirmar E-mail
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Telefone */}
                  <div className={`border border-gray-200 rounded-lg p-6 ${!canAccessPhone() ? 'opacity-50' : ''}`}>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirmação de Telefone</h3>
                    {!canAccessPhone() && (
                      <p className="text-sm text-gray-500 mb-4">Complete a confirmação de e-mail primeiro</p>
                    )}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-2">Número de Telefone</label>
                        <input
                          type="tel"
                          value={verificationData.phone}
                          onChange={(e) => setVerificationData(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="+55 (11) 99999-9999"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                          disabled={verificationStatus.phone === 'approved' || !canAccessPhone()}
                        />
                      </div>
                      {verificationStatus.phone === 'approved' && (
                        <div className="flex items-center text-green-600 text-sm">
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Telefone confirmado
                        </div>
                      )}
                      {!verificationStatus.phone && canAccessPhone() && verificationData.phone && (
                        <button
                          onClick={() => {
                            localStorage.setItem('user_phone', verificationData.phone);
                            setPhone(verificationData.phone);
                            setVerificationStatus(prev => ({ ...prev, phone: 'approved' }));
                            toast.success('Telefone confirmado!');
                          }}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                          Confirmar Telefone
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Dados Pessoais */}
                  <div className={`border border-gray-200 rounded-lg p-6 ${!canAccessPersonalDetails() ? 'opacity-50' : ''}`}>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Dados Pessoais</h3>
                    {!canAccessPersonalDetails() && (
                      <p className="text-sm text-gray-500 mb-4">Complete a confirmação de telefone primeiro</p>
                    )}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-2">Nome Completo</label>
                        <input
                          type="text"
                          value={verificationData.fullName}
                          onChange={(e) => setVerificationData(prev => ({ ...prev, fullName: e.target.value }))}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                          disabled={verificationStatus.personalDetails === 'approved' || (documentsSubmitted.personalDetails && verificationStatus.personalDetails === 'pending') || !canAccessPersonalDetails()}
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-2">Data de Nascimento</label>
                        <input
                          type="date"
                          value={verificationData.birthDate}
                          onChange={(e) => setVerificationData(prev => ({ ...prev, birthDate: e.target.value }))}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                          disabled={verificationStatus.personalDetails === 'approved' || (documentsSubmitted.personalDetails && verificationStatus.personalDetails === 'pending') || !canAccessPersonalDetails()}
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-2">Tipo de Documento</label>
                        <select
                          value={verificationData.documentType}
                          onChange={(e) => setVerificationData(prev => ({ ...prev, documentType: e.target.value as 'cpf' | 'rg' | 'passport' }))}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          disabled={verificationStatus.personalDetails === 'approved' || (documentsSubmitted.personalDetails && verificationStatus.personalDetails === 'pending') || !canAccessPersonalDetails()}
                        >
                          <option value="cpf">CPF</option>
                          <option value="rg">RG</option>
                          <option value="passport">Passaporte</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-2">Número do Documento</label>
                        <input
                          type="text"
                          value={verificationData.documentNumber}
                          onChange={(e) => setVerificationData(prev => ({ ...prev, documentNumber: e.target.value }))}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                          disabled={verificationStatus.personalDetails === 'approved' || (documentsSubmitted.personalDetails && verificationStatus.personalDetails === 'pending') || !canAccessPersonalDetails()}
                        />
                      </div>
                      {verificationStatus.personalDetails === 'approved' && (
                        <div className="flex items-center text-green-600 text-sm">
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Dados pessoais aprovados
                        </div>
                      )}
                      {documentsSubmitted.personalDetails && verificationStatus.personalDetails === 'pending' && (
                        <div className="flex items-center text-yellow-600 text-sm">
                          <Clock className="w-4 h-4 mr-2" />
                          Em análise
                        </div>
                      )}
                      {verificationStatus.personalDetails === 'rejected' && (
                        <div className="flex items-center text-red-600 text-sm">
                          <XCircle className="w-4 h-4 mr-2" />
                          Rejeitado - Verifique os dados e tente novamente
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Prova de Identidade */}
                  <div className={`border border-gray-200 rounded-lg p-6 ${!canAccessProofOfIdentity() ? 'opacity-50' : ''}`}>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Prova de Identidade</h3>
                    {!canAccessProofOfIdentity() && (
                      <p className="text-sm text-gray-500 mb-4">Complete os dados pessoais primeiro</p>
                    )}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-gray-600 mb-2">Documento de Identificação</label>
                        <div className="space-y-2">
                          {verificationData.documentPhoto ? (
                            <div className="relative">
                              <img src={verificationData.documentPhoto} alt="Documento" className="w-full max-w-md border border-gray-300 rounded-lg" />
                              <button
                                onClick={() => setVerificationData(prev => ({ ...prev, documentPhoto: null }))}
                                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                                disabled={verificationStatus.proofOfIdentity === 'approved' || verificationStatus.proofOfIdentity === 'pending'}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleDocumentUpload('document')}
                              className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={verificationStatus.proofOfIdentity === 'approved' || (documentsSubmitted.proofOfIdentity && verificationStatus.proofOfIdentity === 'pending') || !canAccessProofOfIdentity()}
                            >
                              <Upload className="w-5 h-5" />
                              <span>Anexar Documento</span>
                            </button>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-2">Selfie com Documento</label>
                        <div className="space-y-2">
                          {verificationData.selfiePhoto ? (
                            <div className="relative">
                              <img src={verificationData.selfiePhoto} alt="Selfie" className="w-full max-w-md border border-gray-300 rounded-lg" />
                              <button
                                onClick={() => setVerificationData(prev => ({ ...prev, selfiePhoto: null }))}
                                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                                disabled={verificationStatus.proofOfIdentity === 'approved' || verificationStatus.proofOfIdentity === 'pending'}
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleDocumentUpload('selfie')}
                              className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={verificationStatus.proofOfIdentity === 'approved' || (documentsSubmitted.proofOfIdentity && verificationStatus.proofOfIdentity === 'pending') || !canAccessProofOfIdentity()}
                            >
                              <Camera className="w-5 h-5" />
                              <span>Anexar Selfie com Documento</span>
                            </button>
                          )}
                        </div>
                      </div>
                      {verificationStatus.proofOfIdentity === 'approved' && (
                        <div className="flex items-center text-green-600 text-sm">
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                          Identidade verificada
                        </div>
                      )}
                      {documentsSubmitted.proofOfIdentity && verificationStatus.proofOfIdentity === 'pending' && (
                        <div className="flex items-center text-yellow-600 text-sm">
                          <Clock className="w-4 h-4 mr-2" />
                          Em análise
                        </div>
                      )}
                      {verificationStatus.proofOfIdentity === 'rejected' && (
                        <div className="flex items-center text-red-600 text-sm">
                          <XCircle className="w-4 h-4 mr-2" />
                          Rejeitado - Verifique os documentos e tente novamente
                        </div>
                      )}
                      {(!documentsSubmitted.proofOfIdentity || verificationStatus.proofOfIdentity !== 'pending') && verificationStatus.proofOfIdentity !== 'approved' && canAccessProofOfIdentity() && (
                        <button
                          onClick={handleSubmitVerification}
                          disabled={submitting || !verificationData.documentPhoto || !verificationData.selfiePhoto || !verificationData.fullName || !verificationData.birthDate || !verificationData.documentNumber}
                          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                        >
                          {submitting ? 'Enviando...' : 'Enviar para Análise'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Definições de notificações</h2>
              
              <div className="max-w-2xl mx-auto space-y-6">
                {/* Email Notifications Section */}
                <div className="mb-8">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Notificações por E-mail</h3>
                      <p className="text-sm text-gray-600">
                        Receba e-mails sobre novos recursos da plataforma e grandes eventos
                      </p>
                    </div>
                    <button
                      onClick={() => setEmailNotifications(!emailNotifications)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                        emailNotifications ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          emailNotifications ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  
                  {emailNotifications && (
                    <div className="mt-4 space-y-3 pl-4">
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={emailPromotions}
                          onChange={(e) => setEmailPromotions(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-900">Promoções</span>
                      </label>
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={emailSystemNews}
                          onChange={(e) => setEmailSystemNews(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-900">Notícias do sistema</span>
                      </label>
                      <label className="flex items-center space-x-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={emailAnalytics}
                          onChange={(e) => setEmailAnalytics(e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-900">Relatórios analíticos</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Push Notifications Section */}
                <div className="mb-8 border-t border-gray-200 pt-8">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Notificações Push</h3>
                      <p className="text-sm text-gray-600">
                        Receba notificações por push sobre as últimas notícias de negociação.
                      </p>
                    </div>
                    <button
                      onClick={() => setPushNotifications(!pushNotifications)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                        pushNotifications ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          pushNotifications ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    Ao desativar as notificações push, você está perdendo alertas de notícias importantes sobre o mercado no Aplicativo para Dispositivos Móveis Polarium Broker.
                  </p>
                </div>

                {/* Phone Calls Section */}
                <div className="mb-8 border-t border-gray-200 pt-8">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Chamadas Telefônicas</h3>
                      <p className="text-sm text-gray-600">
                        Receba chamadas telefônicas da nossa equipe de suporte sobre ofertas especiais.
                      </p>
                    </div>
                    <button
                      onClick={() => setPhoneCalls(!phoneCalls)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                        phoneCalls ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          phoneCalls ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Data Communication Section */}
                <div className="border-t border-gray-200 pt-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Comunicação de dados</h3>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 pr-4">
                      <p className="text-sm text-gray-600">
                        Por meio deste, concordo com o processamento de minhas informações pessoais pela Polarium Broker e seus parceiros e entidades relacionadas para fins de marketing, que incluirão, em particular, a comunicação comigo para me informar sobre seus produtos e/ou serviços e/ou ofertas, conforme descrito acima, com a finalidade de obter uma experiência de marketing mais personalizada.
                      </p>
                    </div>
                    <button
                      onClick={() => setDataCommunication(!dataCommunication)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                        dataCommunication ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          dataCommunication ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'account' && (
            <div className="max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Definições da conta</h2>
              
              <div className="space-y-8">
                {/* Close Account Section */}
                <div className="border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Encerramento de conta</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Você pode fechar temporariamente sua conta. Depois que sua conta for fechada, você não poderá fazer login ou fazer transações. Você pode reabrir sua conta entrando em contato com nossa equipe de suporte.
                  </p>
                  <button 
                    onClick={() => {
                      setClosureType('close');
                      setShowClosureModal(true);
                    }}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Encerrar conta
                  </button>
                </div>

                {/* Delete Account Section */}
                <div className="border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Exclusão de Conta e Informações Pessoais</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    A exclusão da sua conta e de todos os dados pessoais é permanente. Você não poderá acessar sua conta, negociar ou utilizar nenhum dos serviços da Polarium Broker.
                  </p>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-gray-900">
                      <strong>OBSERVAÇÃO:</strong> antes de enviar sua solicitação de exclusão de dados pessoais, você precisa <strong>fechar todas as posições em aberto e ordens pendentes.</strong>
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      setClosureType('delete');
                      setShowClosureModal(true);
                    }}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Solicitar Exclusão
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'security' && (
            <div className="max-w-4xl">
              <h2 className="text-2xl font-bold text-gray-900 mb-8">Proteção e Segurança</h2>
              
              {/* Two-Step Authentication Section */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Autenticação em duas etapas</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Você receberá um código de confirmação adicional para fazer login em sua conta.
                </p>
                <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  Configurações
                </button>
              </div>

              {/* Change Password Section */}
              <div className="mb-8 border-t border-gray-200 pt-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Alterar sua senha</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Se notar qualquer atividade suspeita, recomendamos que altere sua senha.
                </p>
                <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  Alterar senha
                </button>
              </div>

              {/* Active Sessions Section */}
              <div className="border-t border-gray-200 pt-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Sessões ativas</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Informações sobre o uso de sua conta em outros dispositivos. Você pode encerrar todas as sessões para fazer logout da sua conta em todos os dispositivos ativos.
                </p>
                <button 
                  onClick={() => setShowSessions(!showSessions)}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-6"
                >
                  {showSessions ? 'Ocultar sessões' : 'Sair de todas as outras sessões'}
                </button>

                {showSessions && (
                  <div className="space-y-4">
                    {activeSessions.map((session) => (
                      <div key={session.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0">
                            {getBrowserIcon(session.browser, session.isCurrent)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              Navegador {session.browser}. Endereço IP - {session.ip}, {session.country}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">{session.timestamp}</p>
                          </div>
                        </div>
                        {!session.isCurrent && (
                          <button className="p-1 hover:bg-gray-200 rounded transition-colors">
                            <XCircle className="w-4 h-4 text-gray-400" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Session History Section */}
                <div className="mt-8 border-t border-gray-200 pt-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Histórico de sessões</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Esta seção mostra quais dispositivos você usou para fazer login e quando efetuou login no site. Se você suspeitar que outra pessoa tenha acesso ao seu perfil, considere a possibilidade de alterar sua senha.
                  </p>
                  <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                    Ver Histórico
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection !== 'personal-data' && activeSection !== 'verification' && activeSection !== 'notifications' && activeSection !== 'account' && activeSection !== 'security' && (
            <div className="max-w-4xl">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {menuSections.find(s => s.id === activeSection)?.name}
              </h2>
              <p className="text-gray-600">Conteúdo em desenvolvimento...</p>
            </div>
          )}
        </main>
      </div>

      {/* Floating Chat Button */}
      {!showChatWindow && (
        <div className="fixed bottom-6 right-6 z-50">
          <button 
            onClick={() => {
              setShowChatWindow(true);
              if (user) {
                loadChats();
              }
            }}
            className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 transition-colors"
          >
            <MessageCircle className="w-6 h-6 text-white" />
          </button>
        </div>
      )}

      {/* Chat Window - Bottom Right */}
      {showChatWindow && (
        <>
          <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-lg shadow-2xl overflow-hidden flex flex-col z-[100]">
            {/* Header - Dark Gray */}
            <div className="bg-gray-800 px-4 py-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowChatWindow(false)}
                  className="text-white hover:text-gray-300 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                  <MessageCircle className="w-6 h-6 text-white" />
                </div>
                <span className="text-white font-medium">On-line</span>
              </div>
              <div className="flex items-center space-x-3">
                <button className="text-white hover:text-gray-300 transition-colors">
                  <Maximize2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setShowChatWindow(false)}
                  className="text-white hover:text-gray-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content Area - White */}
            {!currentChat ? (
              <div className="flex-1 bg-white flex items-center justify-center p-4">
                <button
                  onClick={handleStartChat}
                  disabled={chatLoading}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>{chatLoading ? 'Iniciando...' : 'Iniciar Conversa'}</span>
                </button>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-4 bg-white space-y-3">
                  {messages.length === 0 ? (
                    <div className="text-center text-sm text-gray-500 py-4">
                      Nenhuma mensagem ainda. Envie uma mensagem para começar.
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.isFromSupport ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg px-3 py-2 ${
                            message.isFromSupport
                              ? 'bg-gray-100 text-gray-900'
                              : 'bg-blue-600 text-white'
                          }`}
                        >
                          <p className="text-sm">{message.message}</p>
                          <p className={`text-xs mt-1 ${message.isFromSupport ? 'text-gray-500' : 'text-blue-100'}`}>
                            {formatTime(message.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={chatMessagesEndRef} />
                </div>
                
                <div className="px-4 py-3 border-t border-gray-200 bg-white flex-shrink-0">
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Insira sua mensagem"
                        className="w-full px-4 py-2.5 pr-20 bg-gray-100 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                      <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
                        <button className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors">
                          <Smile className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors">
                          <Paperclip className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={handleSendMessage}
                      className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Floating Close Button - Bottom Right */}
          <button
            onClick={() => setShowChatWindow(false)}
            className="fixed bottom-[650px] right-6 w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 transition-colors z-[101]"
          >
            <X className="w-6 h-6 text-white" />
          </button>
        </>
      )}

      {/* Menu Lateral do Usuário */}
      {showUserMenu && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black/50 z-[100]"
            onClick={() => setShowUserMenu(false)}
          />
          
          {/* Menu Lateral */}
          <div className="fixed right-0 top-0 h-full w-80 bg-gray-50 z-[101] shadow-2xl overflow-y-auto">
            {/* Header do Menu */}
            <div className="bg-gray-50 p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {/* Avatar com verificação */}
                  <div className="relative">
                    {userPhoto ? (
                      <img
                        src={userPhoto}
                        alt={user.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-gray-400"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-400 rounded-full flex items-center justify-center">
                        <User className="w-7 h-7 text-gray-600" />
                      </div>
                    )}
                    <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center border-2 border-gray-50">
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>
                  <div>
                    <div className="text-base font-semibold text-gray-900">{user.name}</div>
                    <div className="text-sm text-gray-600">{user.email}</div>
                  </div>
                </div>
                <button
                  onClick={() => setShowUserMenu(false)}
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                >
                  <X className="w-5 h-5 text-gray-700" />
                </button>
              </div>
            </div>

            {/* Seção de Conta */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-700">{accountType === 'demo' ? 'Conta demo' : 'Conta real'}</span>
                <span className={`text-lg font-bold ${accountType === 'demo' ? 'text-blue-600' : 'text-green-600'}`}>
                  R$ {activeBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex space-x-2">
                <button 
                  onClick={() => {
                    router.push('/dashboard/trading');
                    setShowUserMenu(false);
                  }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 px-4 text-sm font-medium transition-colors"
                  style={{ borderRadius: '0' }}
                >
                  Depositar
                </button>
                <button 
                  onClick={() => {
                    router.push('/dashboard/trading');
                    setShowUserMenu(false);
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 text-sm font-medium transition-colors"
                  style={{ borderRadius: '0' }}
                >
                  Negociar
                </button>
              </div>
            </div>

            {/* Menu de Opções */}
            <div className="py-4">
              <button 
                onClick={() => {
                  setActiveSection('personal-data');
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center space-x-3 px-6 py-3 text-left hover:bg-gray-200 transition-colors border-b border-gray-300"
              >
                <User className="w-5 h-5 text-gray-700" />
                <span className="text-sm text-gray-900">Dados pessoais</span>
              </button>
              
              <button 
                onClick={() => {
                  router.push('/profile');
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center space-x-3 px-6 py-3 text-left hover:bg-gray-200 transition-colors border-b border-gray-300"
              >
                <CheckCircle2 className="w-5 h-5 text-gray-700" />
                <span className="text-sm text-gray-900">Verificação</span>
              </button>
              
              <button 
                onClick={() => {
                  router.push('/dashboard/withdrawal');
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center space-x-3 px-6 py-3 text-left hover:bg-gray-200 transition-colors border-b border-gray-300"
              >
                <DollarSign className="w-5 h-5 text-gray-700" />
                <span className="text-sm text-gray-900">Retirar fundos</span>
              </button>
              
              <button 
                onClick={() => {
                  router.push('/dashboard/transactions');
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center space-x-3 px-6 py-3 text-left hover:bg-gray-200 transition-colors border-b border-gray-300"
              >
                <RotateCcw className="w-5 h-5 text-gray-700" />
                <span className="text-sm text-gray-900">Histórico do saldo</span>
              </button>
              
              <button 
                onClick={() => {
                  router.push('/dashboard/trading-history');
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center space-x-3 px-6 py-3 text-left hover:bg-gray-200 transition-colors border-b border-gray-300"
              >
                <History className="w-5 h-5 text-gray-700" />
                <span className="text-sm text-gray-900">Histórico de trading</span>
              </button>
              
              <button 
                onClick={() => {
                  setShowChatWindow(true);
                  setShowUserMenu(false);
                }}
                className="w-full flex items-center space-x-3 px-6 py-3 text-left hover:bg-gray-200 transition-colors border-b border-gray-300"
              >
                <HelpCircle className="w-5 h-5 text-gray-700" />
                <span className="text-sm text-gray-900">Serviço de suporte</span>
              </button>
            </div>

            {/* Botão Sair */}
            <div className="mt-4 border-t border-gray-300 pt-4">
              <button 
                onClick={() => {
                  logout();
                  setShowUserMenu(false);
                  router.push('/login');
                }}
                className="w-full flex items-center space-x-3 px-6 py-3 text-left hover:bg-gray-200 transition-colors"
              >
                <ArrowRight className="w-5 h-5 text-gray-700" />
                <span className="text-sm text-gray-900">Sair</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modal de Solicitação de Encerramento/Exclusão */}
      {showClosureModal && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black/50 z-[200]"
            onClick={() => {
              setShowClosureModal(false);
              setClosureType(null);
              setClosureReason('');
            }}
          />
          
          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-[201] p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {closureType === 'close' ? 'Solicitar Encerramento de Conta' : 'Solicitar Exclusão de Conta'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowClosureModal(false);
                      setClosureType(null);
                      setClosureReason('');
                    }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="mb-6">
                  <p className="text-sm text-gray-600 mb-4">
                    {closureType === 'close' 
                      ? 'Você está solicitando o encerramento temporário da sua conta. Nossa equipe analisará sua solicitação e entrará em contato em até 7 dias úteis.'
                      : 'Você está solicitando a exclusão permanente da sua conta e de todos os seus dados pessoais. Esta ação é irreversível. Nossa equipe analisará sua solicitação e entrará em contato em até 7 dias úteis.'}
                  </p>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-blue-900">
                      <strong>Prazo de resposta:</strong> 7 dias úteis
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Motivo da solicitação <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={closureReason}
                      onChange={(e) => setClosureReason(e.target.value)}
                      placeholder="Descreva o motivo da sua solicitação..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white resize-none"
                      rows={5}
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowClosureModal(false);
                      setClosureType(null);
                      setClosureReason('');
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    disabled={submittingClosure}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={async () => {
                      if (!closureReason.trim()) {
                        toast.error('Por favor, informe o motivo da solicitação');
                        return;
                      }

                      setSubmittingClosure(true);
                      try {
                        if (!user || !supabase) {
                          toast.error('Erro ao processar solicitação');
                          return;
                        }

                        // Calcular data de resposta (7 dias úteis)
                        const calculateBusinessDays = (startDate: Date, days: number): Date => {
                          let currentDate = new Date(startDate);
                          let addedDays = 0;
                          
                          while (addedDays < days) {
                            currentDate.setDate(currentDate.getDate() + 1);
                            const dayOfWeek = currentDate.getDay();
                            if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Não é sábado nem domingo
                              addedDays++;
                            }
                          }
                          
                          return currentDate;
                        };

                        const responseDate = calculateBusinessDays(new Date(), 7);

                        // Salvar solicitação no banco de dados
                        const { error } = await supabase
                          .from('account_closure_requests')
                          .insert({
                            user_id: user.id,
                            request_type: closureType,
                            reason: closureReason.trim(),
                            status: 'pending',
                            response_deadline: responseDate.toISOString(),
                            created_at: new Date().toISOString(),
                          });

                        if (error) {
                          logger.error('Erro ao salvar solicitação:', error);
                          toast.error('Erro ao enviar solicitação. Tente novamente.');
                        } else {
                          toast.success('Solicitação enviada com sucesso! Nossa equipe entrará em contato em até 7 dias úteis.');
                          setShowClosureModal(false);
                          setClosureType(null);
                          setClosureReason('');
                        }
                      } catch (error) {
                        logger.error('Erro ao processar solicitação:', error);
                        toast.error('Erro ao processar solicitação. Tente novamente.');
                      } finally {
                        setSubmittingClosure(false);
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={submittingClosure || !closureReason.trim()}
                  >
                    {submittingClosure ? 'Enviando...' : 'Enviar Solicitação'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ProfilePage;

