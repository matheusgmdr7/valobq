'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { 
  User, 
  CheckCircle2,
  ArrowDownLeft,
  Info,
  Inbox,
  X,
  ArrowRight,
  DollarSign,
  RotateCcw,
  History,
  HelpCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';

type WithdrawalMethod = 'pix-email' | 'pix-phone' | 'pix-random' | 'picpay';

interface WithdrawalMethodOption {
  id: WithdrawalMethod;
  name: string;
  iconSrc?: string | null;
  icon: (props: { src?: string | null; className?: string }) => React.ReactNode;
  processingTime: string;
}

// Componente do ícone PIX usando imagem do Supabase Storage
const PIXIcon: React.FC<{ src?: string | null; className?: string }> = ({ src, className = "w-8 h-8" }) => {
  const [imgError, setImgError] = useState(false);

  if (!src || imgError) {
    return (
      <div className={`${className} bg-gray-200 rounded flex items-center justify-center`}>
        <span className="text-xs text-gray-400">PIX</span>
      </div>
    );
  }
  return (
    <img 
      src={src} 
      alt="PIX" 
      className={`${className} object-contain`}
      onError={() => setImgError(true)}
    />
  );
};

// Componente do ícone PicPay usando imagem do Supabase Storage
const PicPayIcon: React.FC<{ src?: string | null; className?: string }> = ({ src, className = "w-8 h-8" }) => {
  const [imgError, setImgError] = useState(false);

  if (!src || imgError) {
    return (
      <div className={`${className} bg-gray-200 rounded flex items-center justify-center`}>
        <span className="text-xs text-gray-400">PP</span>
      </div>
    );
  }
  return (
    <img 
      src={src} 
      alt="PicPay" 
      className={`${className} object-contain`}
      onError={() => setImgError(true)}
    />
  );
};

const WithdrawalPage: React.FC = () => {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<WithdrawalMethod>('pix-email');
  const [brokerLogo, setBrokerLogo] = useState<string | null>(null);
  const [brokerName, setBrokerName] = useState<string>('POLARIUM BROKER');
  const [pixIconUrl, setPixIconUrl] = useState<string | null>(null);
  const [picpayIconUrl, setPicpayIconUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    cpf: '',
    pixKey: '',
    email: '',
    phone: '',
    amount: '',
  });
  const [formattedAmount, setFormattedAmount] = useState<string>('');
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);

  // Função para formatar valor em reais
  const formatCurrency = (value: string): string => {
    // Remove tudo que não é dígito
    const numericValue = value.replace(/\D/g, '');
    
    if (!numericValue) return '';
    
    // Converte para número e divide por 100 para ter decimais
    const amount = parseFloat(numericValue) / 100;
    
    // Formata como moeda brasileira
    return amount.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // Função para remover formatação e retornar valor numérico
  const unformatCurrency = (value: string): string => {
    const numericValue = value.replace(/\D/g, '');
    if (!numericValue) return '';
    
    // Converte para número e divide por 100
    const amount = parseFloat(numericValue) / 100;
    return amount.toString();
  };

  // Handler para mudança no campo de valor
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const formatted = formatCurrency(inputValue);
    const unformatted = unformatCurrency(inputValue);
    
    setFormattedAmount(formatted);
    setFormData({ ...formData, amount: unformatted });
  };

  const [userPhoto, setUserPhoto] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('user_photo') || null;
    }
    return null;
  });

  // Carregar logo e nome da broker
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
              
              const { data: nameData } = await supabase
                .from('platform_settings')
                .select('value')
                .eq('key', 'broker_name')
                .single();
              
              if (nameData?.value) {
                brokerNameValue = nameData.value as string;
                localStorage.setItem('broker_name', brokerNameValue);
              }
            } catch (error) {
              // Fallback para localStorage
            }
        }
        
        // Se não encontrou no Supabase, usar localStorage
        if (!logoUrl) {
          logoUrl = typeof window !== 'undefined' 
            ? localStorage.getItem('broker_logo_light') || localStorage.getItem('broker_logo')
            : null;
        }
        if (!brokerNameValue) {
          brokerNameValue = typeof window !== 'undefined' 
            ? localStorage.getItem('broker_name')
            : null;
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

    // Carregar ícones dos métodos de pagamento do bucket "banks"
    const loadBankIcons = async () => {
      if (!supabase) return;

      try {
        // Carregar ícone PIX
        const { data: pixData } = supabase.storage
          .from('banks')
          .getPublicUrl('pix.png');
        
        if (pixData?.publicUrl) {
          setPixIconUrl(pixData.publicUrl);
        }

        // Carregar ícone PicPay
        const { data: picpayData } = supabase.storage
          .from('banks')
          .getPublicUrl('Picpay.jpeg');
        
        if (picpayData?.publicUrl) {
          setPicpayIconUrl(picpayData.publicUrl);
        }
      } catch (error) {
        logger.error('Erro ao carregar ícones dos bancos:', error);
      }
    };

    loadBankIcons();
  }, []);

  if (!user) return null;

  // Criar array de métodos com ícones dinâmicos
  const withdrawalMethodsWithIcons: WithdrawalMethodOption[] = [
    { id: 'pix-email', name: 'PIX (E-MAIL)', iconSrc: pixIconUrl, icon: PIXIcon, processingTime: '1-3 dias úteis' },
    { id: 'pix-phone', name: 'PIX (TELEFONE)', iconSrc: pixIconUrl, icon: PIXIcon, processingTime: '1-3 dias úteis' },
    { id: 'pix-random', name: 'PIX (CHAVE ALEATORIA)', iconSrc: pixIconUrl, icon: PIXIcon, processingTime: '1-3 dias úteis' },
    { id: 'picpay', name: 'PicPay', iconSrc: picpayIconUrl, icon: PicPayIcon, processingTime: '1-8 dias úteis' },
  ];

  const selectedMethodData = withdrawalMethodsWithIcons.find(m => m.id === selectedMethod);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar valor
    const amount = parseFloat(formData.amount);
    if (!amount || amount < 60 || amount > 25400) {
      toast.error('O valor deve estar entre R$ 60 e R$ 25.400');
      return;
    }

    // Validar saldo disponível
    if (amount > user.balance) {
      toast.error('Saldo insuficiente. Valor disponível: R$ ' + user.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
      return;
    }

    if (selectedMethod === 'pix-email') {
      if (!formData.firstName || !formData.lastName || !formData.cpf || !formData.pixKey || !formData.email) {
        toast.error('Preencha todos os campos obrigatórios');
        return;
      }
    } else if (selectedMethod === 'pix-phone') {
      if (!formData.pixKey || !formData.email || !formData.phone) {
        toast.error('Preencha todos os campos obrigatórios');
        return;
      }
    } else if (selectedMethod === 'pix-random') {
      if (!formData.pixKey) {
        toast.error('Preencha a chave PIX aleatória');
        return;
      }
    } else if (selectedMethod === 'picpay') {
      if (!formData.firstName || !formData.lastName || !formData.cpf || !formData.pixKey || !formData.email) {
        toast.error('Preencha todos os campos obrigatórios');
        return;
      }
    }

    // Salvar solicitação no banco
    try {
      if (!supabase) {
        toast.error('Banco de dados não configurado');
        return;
      }

      const { data, error } = await supabase
        .from('withdrawal_requests')
        .insert({
          user_id: user.id,
          method: selectedMethod,
          amount: amount,
          first_name: formData.firstName || null,
          last_name: formData.lastName || null,
          cpf: formData.cpf || null,
          pix_key: formData.pixKey || null,
          email: formData.email || null,
          phone: formData.phone || null,
          status: 'pending'
        })
        .select()
        .single();

      if (error) {
        logger.error('Erro ao salvar solicitação:', error);
        toast.error('Erro ao salvar solicitação: ' + error.message);
        return;
      }

      toast.success('Solicitação de retirada enviada com sucesso!');
      
      // Reset form
      setFormData({
        firstName: '',
        lastName: '',
        cpf: '',
        pixKey: '',
        email: '',
        phone: '',
        amount: '',
      });
      setFormattedAmount('');
      
      // Recarregar solicitações
      loadWithdrawalRequests();
    } catch (error: any) {
      logger.error('Erro ao salvar solicitação:', error);
      toast.error('Erro ao salvar solicitação');
    }
  };

  // Função para carregar solicitações de retirada
  const loadWithdrawalRequests = async () => {
    if (!supabase || !user) return;

    try {
      const { data, error } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWithdrawalRequests(data || []);
    } catch (error: any) {
      logger.error('Erro ao carregar solicitações:', error);
    }
  };

  // Carregar solicitações ao montar o componente
  useEffect(() => {
    if (user) {
      loadWithdrawalRequests();
    }
  }, [user]);

  const renderFormFields = () => {
    if (selectedMethod === 'pix-email') {
      return (
        <>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Nome
            </label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-900 bg-white hover:border-gray-300"
              placeholder="Digite seu nome"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Sobrenome
            </label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-900 bg-white hover:border-gray-300"
              placeholder="Digite seu sobrenome"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              CPF (Ex.: 12345678910) (11 dígitos)
            </label>
            <input
              type="text"
              value={formData.cpf}
              onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-900 bg-white hover:border-gray-300"
              placeholder="12345678910"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Chave PIX (E-mail)
            </label>
            <input
              type="email"
              value={formData.pixKey}
              onChange={(e) => setFormData({ ...formData, pixKey: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-900 bg-white hover:border-gray-300"
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              E-mail
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-900 bg-white hover:border-gray-300"
              placeholder="seu@email.com"
            />
          </div>
        </>
      );
    } else if (selectedMethod === 'pix-phone') {
      return (
        <>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Chave PIX (Telefone)
            </label>
            <input
              type="tel"
              value={formData.pixKey}
              onChange={(e) => setFormData({ ...formData, pixKey: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-900 bg-white hover:border-gray-300"
              placeholder="(11) 98765-4321"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              E-mail
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-900 bg-white hover:border-gray-300"
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Número de telefone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-900 bg-white hover:border-gray-300"
              placeholder="(11) 98765-4321"
            />
          </div>
        </>
      );
    } else if (selectedMethod === 'pix-random') {
      return (
        <>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Chave PIX (Chave Aleatória)
            </label>
            <input
              type="text"
              value={formData.pixKey}
              onChange={(e) => setFormData({ ...formData, pixKey: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-900 bg-white hover:border-gray-300"
              placeholder="Digite a chave PIX aleatória"
            />
          </div>
        </>
      );
    } else {
      // PicPay - Mesmos campos que PIX (E-MAIL)
      return (
        <>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Nome
            </label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-900 bg-white hover:border-gray-300"
              placeholder="Digite seu nome"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Sobrenome
            </label>
            <input
              type="text"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-900 bg-white hover:border-gray-300"
              placeholder="Digite seu sobrenome"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              CPF (Ex.: 12345678910) (11 dígitos)
            </label>
            <input
              type="text"
              value={formData.cpf}
              onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-900 bg-white hover:border-gray-300"
              placeholder="12345678910"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              Chave PIX (E-mail)
            </label>
            <input
              type="email"
              value={formData.pixKey}
              onChange={(e) => setFormData({ ...formData, pixKey: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-900 bg-white hover:border-gray-300"
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
              E-mail
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-900 bg-white hover:border-gray-300"
              placeholder="seu@email.com"
            />
          </div>
        </>
      );
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header - Mesma estrutura do /profile */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {brokerLogo && (
              <div className="flex items-center space-x-2">
                <img 
                  src={brokerLogo} 
                  alt={brokerName}
                  className="h-16 w-auto object-contain"
                />
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-4">
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
            
            {/* Botão Negociar */}
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

      {/* Main Content */}
      <div className="flex-1 overflow-auto discreet-scrollbar p-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Left Panel - Métodos de Retirada */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-5 sticky top-6">
                <h3 className="text-xs font-bold text-gray-700 mb-4 uppercase tracking-wider">Método de Pagamento</h3>
                <div className="space-y-3">
                  {withdrawalMethodsWithIcons.map((method) => {
                    const IconComponent = method.icon;
                    return (
                      <button
                        key={method.id}
                        onClick={() => setSelectedMethod(method.id)}
                        className={`w-full text-left px-5 py-4 rounded-xl transition-all duration-200 flex items-center space-x-4 group ${
                          selectedMethod === method.id
                            ? 'bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-500 shadow-lg transform scale-[1.02]'
                            : 'hover:bg-gray-50 border-2 border-gray-200 hover:border-gray-300 hover:shadow-md'
                        }`}
                      >
                        <div className={`flex-shrink-0 transition-transform duration-200 ${
                          selectedMethod === method.id ? 'scale-110' : 'group-hover:scale-105'
                        }`}>
                          <IconComponent src={method.iconSrc} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${
                            selectedMethod === method.id ? 'text-blue-700' : 'text-gray-900'
                          }`}>
                            {method.name}
                          </p>
                          <p className={`text-xs mt-1 ${
                            selectedMethod === method.id ? 'text-blue-600 font-medium' : 'text-gray-500'
                          }`}>
                            {method.processingTime}
                          </p>
                        </div>
                        {selectedMethod === method.id && (
                          <div className="flex-shrink-0">
                            <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Panel - Formulário de Retirada */}
            <div className="lg:col-span-2">
              {/* Title Section - Centralizado com o formulário */}
              <div className="text-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Retirada de fundos</h1>
                <div className="flex items-center justify-center space-x-2 text-gray-600">
                  <span className="text-sm">Você tem 1 retirada(s) gratuita(s) até o final do mês.</span>
                  <Info className="w-4 h-4 text-gray-400" />
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-6 pb-3 border-b border-gray-200">
                  {selectedMethodData?.name}
                </h2>
                
                <div className="mb-6 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wider mb-1">Saldo da conta</p>
                  <p className="text-2xl font-bold text-gray-900">
                    R$ {user.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {renderFormFields()}
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        Valor
                      </label>
                      <span className="text-xs font-medium text-gray-500">
                        Máx.: R$ {Math.min(25400, user.balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-sm font-semibold text-gray-600 z-10">
                        R$
                      </span>
                      <input
                        type="text"
                        value={formattedAmount}
                        onChange={handleAmountChange}
                        onBlur={() => {
                          // Garante que sempre tenha o formato completo ao sair do campo
                          if (formData.amount && parseFloat(formData.amount) > 0) {
                            const numValue = parseFloat(formData.amount);
                            setFormattedAmount(numValue.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }));
                          } else {
                            setFormattedAmount('');
                          }
                        }}
                        className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-gray-900 bg-white hover:border-gray-300"
                        placeholder="0,00"
                        maxLength={15}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-500">
                        De R$ 60,00 a R$ 25.400,00
                      </p>
                      <p className="text-xs font-semibold text-green-600">
                        Sem comissão
                      </p>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 px-6 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                  >
                    Retirar fundos
                  </button>
                  
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <span>Tempo necessário para processar sua solicitação: {selectedMethodData?.processingTime}</span>
                    <Info className="w-4 h-4 text-gray-400" />
                  </div>
                </form>

                {/* Seção de Solicitações de Retirada */}
                <div className="mt-6 bg-white rounded-xl border border-gray-200 shadow-lg p-6">
                  <div>
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                      <h3 className="text-lg font-bold text-gray-900">Solicitações de retirada</h3>
                      {withdrawalRequests.length > 0 && (
                        <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center shadow-md">
                          <span className="text-white text-xs font-bold">{withdrawalRequests.length}</span>
                        </div>
                      )}
                    </div>
                    
                    {withdrawalRequests.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8">
                        <div className="relative mb-4">
                          <Inbox className="w-16 h-16 text-blue-600" />
                        </div>
                        <p className="text-gray-500 text-sm font-medium">Nenhum pedido</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {withdrawalRequests.map((request) => {
                          const statusColors: { [key: string]: string } = {
                            pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
                            approved: 'bg-green-100 text-green-800 border-green-200',
                            rejected: 'bg-red-100 text-red-800 border-red-200',
                            completed: 'bg-blue-100 text-blue-800 border-blue-200'
                          };
                          const statusLabels: { [key: string]: string } = {
                            pending: 'Pendente',
                            approved: 'Aprovado',
                            rejected: 'Rejeitado',
                            completed: 'Concluído'
                          };
                          
                          return (
                            <div key={request.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-1">
                                    <span className="font-semibold text-gray-900">
                                      R$ {parseFloat(request.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded border ${statusColors[request.status] || statusColors.pending}`}>
                                      {statusLabels[request.status] || 'Pendente'}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500">
                                    {new Date(request.created_at).toLocaleDateString('pt-BR', {
                                      day: '2-digit',
                                      month: '2-digit',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                  <p className="text-xs text-gray-600 mt-1 capitalize">
                                    {request.method?.replace('-', ' ')}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

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

            {/* Seção de Conta Real */}
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-700">Conta real</span>
                <span className="text-lg font-bold text-green-600">
                  R$ {user.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                  router.push('/profile');
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
                  localStorage.setItem('profile_active_section', 'verification');
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
                  localStorage.setItem('open_chat_on_profile', 'true');
                  router.push('/profile');
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
    </div>
  );
};

export default WithdrawalPage;

