'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Flag, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
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

interface CountryOption {
  code: string;
  name: string;
  flag: string;
  phoneCode: string;
}

const countries: CountryOption[] = [
  { code: 'BR', name: 'Brasil', flag: '🇧🇷', phoneCode: '+55' },
  { code: 'US', name: 'Estados Unidos', flag: '🇺🇸', phoneCode: '+1' },
  { code: 'ES', name: 'Espanha', flag: '🇪🇸', phoneCode: '+34' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹', phoneCode: '+351' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷', phoneCode: '+54' },
  { code: 'MX', name: 'México', flag: '🇲🇽', phoneCode: '+52' },
];

const LoginPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [language, setLanguage] = useState<Language>('pt');
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const languageDropdownRef = useRef<HTMLDivElement>(null);
  
  // Form states
  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(countries[0]);
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [selectedPhoneCountry, setSelectedPhoneCountry] = useState<CountryOption>(countries[0]);
  const [showPhoneCountryDropdown, setShowPhoneCountryDropdown] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const countryDropdownRef = useRef<HTMLDivElement>(null);
  const phoneCountryDropdownRef = useRef<HTMLDivElement>(null);
  
  const { login, register, loading } = useAuth();
  const router = useRouter();
  const [returnUrl, setReturnUrl] = useState<string | null>(null);
  const [brokerLogo, setBrokerLogo] = useState<string | null>(null);
  const [brokerName, setBrokerName] = useState<string>('VALOREN');

  const selectedLanguage = languages.find(lang => lang.code === language) || languages[0];

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
  
  // Ler returnUrl da URL ao montar o componente
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const url = params.get('returnUrl');
      setReturnUrl(url);
    }
  }, []);

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (languageDropdownRef.current && !languageDropdownRef.current.contains(event.target as Node)) {
        setShowLanguageDropdown(false);
      }
      if (countryDropdownRef.current && !countryDropdownRef.current.contains(event.target as Node)) {
        setShowCountryDropdown(false);
      }
      if (phoneCountryDropdownRef.current && !phoneCountryDropdownRef.current.contains(event.target as Node)) {
        setShowPhoneCountryDropdown(false);
      }
    };

    if (showLanguageDropdown || showCountryDropdown || showPhoneCountryDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showLanguageDropdown, showCountryDropdown, showPhoneCountryDropdown]);

  const handleLogin = async (email: string, password: string) => {
    const success = await login({ email, password });
    if (success) {
      // Redirecionar para a URL de retorno se existir, senão para dashboard/trading
      router.push(returnUrl || '/dashboard/trading');
    }
  };

  const handleRegister = async (firstName: string, lastName: string, email: string, password: string, phoneNumber?: string) => {
    const fullName = `${firstName} ${lastName}`.trim();
    const success = await register({ name: fullName, email, password, confirmPassword: password });
    if (success) {
      // Salvar telefone se fornecido
      if (phoneNumber) {
        const phoneWithCode = phoneNumber.startsWith('+') ? phoneNumber : `${selectedPhoneCountry.phoneCode} ${phoneNumber}`;
        localStorage.setItem('user_phone', phoneWithCode);
      }
      // Salvar nome e sobrenome separados
      localStorage.setItem('user_firstName', firstName);
      localStorage.setItem('user_lastName', lastName);
      router.push('/profile');
    }
  };

  return (
    <div className="min-h-screen bg-white overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-center p-6">
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
          
          <button 
            onClick={() => setIsLogin(false)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Registrar-se
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-md">
          {isLogin ? (
            <div className="bg-white">
              <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Entrar</h2>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const email = formData.get('email') as string;
                const password = formData.get('password') as string;
                handleLogin(email, password);
              }} className="space-y-4">
                <div>
                  <input
                    type="email"
                    name="email"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                    placeholder="E-mail"
                  />
                </div>
                
                <div>
                  <input
                    type="password"
                    name="password"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                    placeholder="Senha"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {loading ? 'Entrando...' : 'Entrar'}
                </button>
              </form>

              {/* Separator */}
              <div className="flex items-center my-6">
                <div className="flex-1 border-t border-gray-300"></div>
                <span className="px-4 text-sm text-gray-500">ou use uma conta social</span>
                <div className="flex-1 border-t border-gray-300"></div>
              </div>

              {/* Google Login Button */}
              <button
                type="button"
                className="w-full flex items-center justify-center space-x-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors bg-white"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span className="text-gray-700 font-medium">Entrar com Google</span>
              </button>

              {/* Forgot Password Link */}
              <div className="mt-6 text-center">
                <button
                  type="button"
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                >
                  Esqueceu a senha?
                </button>
              </div>

              {/* Register Link */}
              <div className="mt-4 text-center">
                <p className="text-gray-600 text-sm">
                  Ainda não possui uma conta?{' '}
                  <button
                    type="button"
                    onClick={() => setIsLogin(false)}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Inscrever-se
                  </button>
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-white">
              <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">Registrar-se</h2>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                if (!acceptedTerms) {
                  alert('Por favor, aceite os termos e condições para continuar.');
                  return;
                }
                const formData = new FormData(e.currentTarget);
                const firstName = formData.get('firstName') as string;
                const lastName = formData.get('lastName') as string;
                const email = formData.get('email') as string;
                const password = formData.get('password') as string;
                const phone = formData.get('phone') as string;
                const phoneWithCode = phone ? `${selectedPhoneCountry.phoneCode} ${phone}` : undefined;
                handleRegister(firstName, lastName, email, password, phoneWithCode);
              }} className="space-y-4">
                <div>
                  <input
                    type="text"
                    name="firstName"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                    placeholder="Nome"
                  />
                </div>
                
                <div>
                  <input
                    type="text"
                    name="lastName"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                    placeholder="Sobrenome"
                  />
                </div>
                
                <div className="relative" ref={countryDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                    className="w-full flex items-center justify-between px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{selectedCountry.flag}</span>
                      <span>{selectedCountry.name}</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showCountryDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showCountryDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
                      {countries.map((country) => (
                        <button
                          key={country.code}
                          type="button"
                          onClick={() => {
                            setSelectedCountry(country);
                            setShowCountryDropdown(false);
                          }}
                          className={`w-full flex items-center space-x-2 px-4 py-2 text-sm hover:bg-gray-100 transition-colors ${
                            selectedCountry.code === country.code ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                          }`}
                        >
                          <span className="text-lg">{country.flag}</span>
                          <span className="font-medium">{country.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                <p className="text-xs text-gray-500 -mt-2">
                  Certifique-se de que este é seu país de residência permanente
                </p>
                
                <div>
                  <input
                    type="email"
                    name="email"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                    placeholder="E-mail"
                  />
                </div>
                
                <div>
                  <input
                    type="password"
                    name="password"
                    required
                    minLength={6}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 placeholder-gray-500"
                    placeholder="Senha"
                  />
                </div>
                
                <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                  <div className="relative flex-shrink-0" ref={phoneCountryDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setShowPhoneCountryDropdown(!showPhoneCountryDropdown)}
                      className="flex items-center space-x-1 px-3 py-3 border-r border-gray-300 bg-white focus:outline-none hover:bg-gray-50"
                    >
                      <span className="text-base">{selectedPhoneCountry.flag}</span>
                      <span className="text-sm text-gray-700">{selectedPhoneCountry.phoneCode}</span>
                      <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${showPhoneCountryDropdown ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {showPhoneCountryDropdown && (
                      <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto min-w-[120px]">
                        {countries.map((country) => (
                          <button
                            key={country.code}
                            type="button"
                            onClick={() => {
                              setSelectedPhoneCountry(country);
                              setShowPhoneCountryDropdown(false);
                            }}
                            className={`w-full flex items-center space-x-2 px-3 py-2 text-sm hover:bg-gray-100 transition-colors ${
                              selectedPhoneCountry.code === country.code ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
                            }`}
                          >
                            <span className="text-base">{country.flag}</span>
                            <span className="font-medium">{country.phoneCode}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    type="tel"
                    name="phone"
                    className="flex-1 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500"
                    placeholder="Número de telefone"
                  />
                </div>
                
                <div className="flex items-start space-x-2">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="terms" className="text-sm text-gray-700">
                    Confirmo que tenho 18 anos ou mais e aceito os{' '}
                    <a href="#" className="text-blue-600 hover:underline">Termos e Condições</a>, a{' '}
                    <a href="#" className="text-blue-600 hover:underline">Política de Privacidade</a> e a{' '}
                    <a href="#" className="text-blue-600 hover:underline">Política de Execução de Ordens</a>
                  </label>
                </div>
                
                <button
                  type="submit"
                  disabled={loading || !acceptedTerms}
                  className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {loading ? 'Registrando...' : 'Abrir uma conta gratis'}
                </button>
              </form>

              {/* Login Link */}
              <div className="mt-6 text-center">
                <p className="text-gray-600 text-sm">
                  Já possui uma conta?{' '}
                  <button
                    type="button"
                    onClick={() => setIsLogin(true)}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Entrar
                  </button>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Risk Warning */}
      <div className="mt-8 px-6 pb-6">
        <div className="max-w-md mx-auto border border-gray-300 rounded-lg p-4 bg-gray-50">
          <p className="text-sm text-gray-700">
            <span className="font-bold">AVISO DE RISCO:</span> Toda negociação envolve risco. 
            Apenas arrisque o capital que você está preparado para perder.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

