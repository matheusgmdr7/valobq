'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Save, Upload, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { uploadImageToStorage, removeImageFromStorage, isSupabaseStorageUrl } from '@/lib/supabaseStorage';
import toast from 'react-hot-toast';
import { ImageCropper } from '@/components/ImageCropper';

export default function BrokerDataPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [cropperImage, setCropperImage] = useState<string | null>(null);
  const [cropperType, setCropperType] = useState<'logo' | 'logoDark' | 'logoLight' | 'favicon' | 'watermark' | null>(null);
  const [brokerData, setBrokerData] = useState({
    name: '',
    supportEmail: '',
    logo: null as string | null,
    logoDark: null as string | null, // Logo para fundo preto (trading)
    logoLight: null as string | null, // Logo para fundo branco (profile/login)
    favicon: null as string | null,
    watermark: null as string | null // Marca d'água para o gráfico
  });

  useEffect(() => {
    loadBrokerData();
  }, []);

  const loadBrokerData = async () => {
    setLoading(true);
    try {
      if (!supabase) {
        // Fallback para localStorage
        const savedName = localStorage.getItem('broker_name') || '';
        const savedEmail = localStorage.getItem('broker_support_email') || 'support@supportpolarium.com';
        const savedLogo = localStorage.getItem('broker_logo') || null;
        const savedLogoDark = localStorage.getItem('broker_logo_dark') || null;
        const savedLogoLight = localStorage.getItem('broker_logo_light') || null;
        const savedFavicon = localStorage.getItem('broker_favicon') || null;
        
        setBrokerData({
          name: savedName,
          supportEmail: savedEmail,
          logo: savedLogo,
          logoDark: savedLogoDark,
          logoLight: savedLogoLight,
          favicon: savedFavicon
        });
        setLoading(false);
        return;
      }

      // Buscar dados da broker da tabela platform_settings
      const { data: nameData } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'broker_name')
        .single();

      const { data: emailData } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'broker_support_email')
        .single();

      const { data: logoData } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'broker_logo')
        .single();

      const { data: logoDarkData } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'broker_logo_dark')
        .single();

      const { data: logoLightData } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'broker_logo_light')
        .single();

      const { data: faviconData } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'broker_favicon')
        .single();

      const { data: watermarkData } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'broker_watermark')
        .single();

      setBrokerData({
        name: (nameData?.value as string) || '',
        supportEmail: (emailData?.value as string) || 'support@supportpolarium.com',
        logo: (logoData?.value as string) || null,
        logoDark: (logoDarkData?.value as string) || null,
        logoLight: (logoLightData?.value as string) || null,
        favicon: (faviconData?.value as string) || null,
        watermark: (watermarkData?.value as string) || null
      });
    } catch (error) {
      console.error('Erro ao carregar dados da broker:', error);
      // Fallback para localStorage
      const savedName = localStorage.getItem('broker_name') || '';
      const savedEmail = localStorage.getItem('broker_support_email') || 'support@supportpolarium.com';
      const savedLogo = localStorage.getItem('broker_logo') || null;
      const savedLogoDark = localStorage.getItem('broker_logo_dark') || null;
      const savedLogoLight = localStorage.getItem('broker_logo_light') || null;
      const savedFavicon = localStorage.getItem('broker_favicon') || null;
      const savedWatermark = localStorage.getItem('broker_watermark') || null;
      
      setBrokerData({
        name: savedName,
        supportEmail: savedEmail,
        logo: savedLogo,
        logoDark: savedLogoDark,
        logoLight: savedLogoLight,
        favicon: savedFavicon,
        watermark: savedWatermark
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (!supabase) {
        // Fallback para localStorage
        localStorage.setItem('broker_name', brokerData.name);
        localStorage.setItem('broker_support_email', brokerData.supportEmail);
        if (brokerData.logo) {
          localStorage.setItem('broker_logo', brokerData.logo);
        }
        if (brokerData.logoDark) {
          localStorage.setItem('broker_logo_dark', brokerData.logoDark);
        }
        if (brokerData.logoLight) {
          localStorage.setItem('broker_logo_light', brokerData.logoLight);
        }
        if (brokerData.favicon) {
          localStorage.setItem('broker_favicon', brokerData.favicon);
          // Atualizar favicon na página
          updateFavicon(brokerData.favicon);
        }
        if (brokerData.watermark) {
          localStorage.setItem('broker_watermark', brokerData.watermark);
        }
        localStorage.setItem('platform_contact_email', brokerData.supportEmail);
        toast.success('Dados da broker salvos com sucesso!');
        setSaving(false);
        return;
      }

      // Salvar no Supabase
      const settingsToSave = [
        { key: 'broker_name', value: brokerData.name, updated_at: new Date().toISOString() },
        { key: 'broker_support_email', value: brokerData.supportEmail, updated_at: new Date().toISOString() }
      ];

      if (brokerData.logo) {
        settingsToSave.push({ key: 'broker_logo', value: brokerData.logo, updated_at: new Date().toISOString() });
      }
      if (brokerData.logoDark) {
        settingsToSave.push({ key: 'broker_logo_dark', value: brokerData.logoDark, updated_at: new Date().toISOString() });
      }
      if (brokerData.logoLight) {
        settingsToSave.push({ key: 'broker_logo_light', value: brokerData.logoLight, updated_at: new Date().toISOString() });
      }
      if (brokerData.favicon) {
        settingsToSave.push({ key: 'broker_favicon', value: brokerData.favicon, updated_at: new Date().toISOString() });
      }
      if (brokerData.watermark) {
        settingsToSave.push({ key: 'broker_watermark', value: brokerData.watermark, updated_at: new Date().toISOString() });
      }

      await supabase
        .from('platform_settings')
        .upsert(settingsToSave, {
          onConflict: 'key'
        });

      // Também salvar no localStorage para acesso rápido
      localStorage.setItem('broker_name', brokerData.name);
      localStorage.setItem('broker_support_email', brokerData.supportEmail);
      localStorage.setItem('platform_contact_email', brokerData.supportEmail);
      if (brokerData.logo) {
        localStorage.setItem('broker_logo', brokerData.logo);
      }
      if (brokerData.logoDark) {
        localStorage.setItem('broker_logo_dark', brokerData.logoDark);
      }
      if (brokerData.logoLight) {
        localStorage.setItem('broker_logo_light', brokerData.logoLight);
      }
      if (brokerData.favicon) {
        localStorage.setItem('broker_favicon', brokerData.favicon);
        // Atualizar favicon na página
        updateFavicon(brokerData.favicon);
      }
      if (brokerData.watermark) {
        localStorage.setItem('broker_watermark', brokerData.watermark);
      }

      toast.success('Dados da broker salvos com sucesso!');
    } catch (error: any) {
      console.error('Erro ao salvar dados da broker:', error);
      toast.error(error.message || 'Erro ao salvar dados');
    } finally {
      setSaving(false);
    }
  };


  const handleRemoveLogo = () => {
    setBrokerData(prev => ({ ...prev, logo: null }));
    localStorage.removeItem('broker_logo');
  };

  const handleLogoUpload = (type: 'logo' | 'logoDark' | 'logoLight' | 'favicon' | 'watermark') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const logoUrl = event.target?.result as string;
        // Abrir cropper
        setCropperImage(logoUrl);
        setCropperType(type);
        setShowCropper(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = async (croppedImage: string) => {
    if (cropperType) {
      try {
        // Fazer upload para o Supabase Storage
        const fileName = `broker-${cropperType}-${Date.now()}.png`;
        const imageUrl = await uploadImageToStorage(croppedImage, fileName);
        
        if (imageUrl) {
          // Remover imagem antiga do storage se existir
          const oldImage = brokerData[cropperType];
          if (oldImage && isSupabaseStorageUrl(oldImage)) {
            const oldFileName = oldImage.split('/').pop()?.split('?')[0];
            if (oldFileName) {
              await removeImageFromStorage(oldFileName);
            }
          }
          
          setBrokerData(prev => ({ ...prev, [cropperType]: imageUrl }));
          toast.success(`${cropperType === 'logo' ? 'Logo' : cropperType === 'logoDark' ? 'Logo (Fundo Preto)' : cropperType === 'logoLight' ? 'Logo (Fundo Branco)' : cropperType === 'favicon' ? 'Favicon' : 'Marca d\'água'} recortado e carregado com sucesso!`);
          
          // Se for favicon, atualizar imediatamente
          if (cropperType === 'favicon') {
            updateFavicon(imageUrl);
          }
        } else {
          // Fallback: salvar como base64 se upload falhar
          setBrokerData(prev => ({ ...prev, [cropperType]: croppedImage }));
          toast.success(`${cropperType === 'logo' ? 'Logo' : cropperType === 'logoDark' ? 'Logo (Fundo Preto)' : cropperType === 'logoLight' ? 'Logo (Fundo Branco)' : cropperType === 'favicon' ? 'Favicon' : 'Marca d\'água'} recortado e carregado (modo local)!`);
          
          if (cropperType === 'favicon') {
            updateFavicon(croppedImage);
          }
        }
      } catch (error) {
        console.error('Erro ao fazer upload:', error);
        // Fallback: salvar como base64
        setBrokerData(prev => ({ ...prev, [cropperType]: croppedImage }));
        toast.error('Erro ao fazer upload. Imagem salva localmente.');
      }
    }
    setShowCropper(false);
    setCropperImage(null);
    setCropperType(null);
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setCropperImage(null);
    setCropperType(null);
  };

  const handleRemoveLogoType = (type: 'logo' | 'logoDark' | 'logoLight' | 'favicon' | 'watermark') => async () => {
    const currentImage = brokerData[type];
    
    // Remover do storage se for URL do Supabase
    if (currentImage && isSupabaseStorageUrl(currentImage)) {
      const fileName = currentImage.split('/').pop()?.split('?')[0];
      if (fileName) {
        await removeImageFromStorage(fileName);
      }
    }
    
    setBrokerData(prev => ({ ...prev, [type]: null }));
    const key = type === 'logo' ? 'broker_logo' : type === 'logoDark' ? 'broker_logo_dark' : type === 'logoLight' ? 'broker_logo_light' : type === 'favicon' ? 'broker_favicon' : 'broker_watermark';
    localStorage.removeItem(key);
    
    // Se for favicon, remover da página
    if (type === 'favicon') {
      const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement;
      if (link) {
        link.href = '/favicon.ico'; // Voltar para o padrão
      }
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

  if (loading) {
    return (
      <div className="bg-black text-white min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
      </div>
    );
  }

  return (
    <div className="bg-black text-white min-h-screen">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Building2 className="w-5 h-5 text-gray-400" />
            <div>
              <h1 className="text-lg font-semibold text-gray-200">Dados da Broker</h1>
              <p className="text-xs text-gray-500 mt-0.5 uppercase tracking-wide">Configurar informações da broker</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/admin')}
            className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded text-xs font-medium text-gray-300 transition-colors"
          >
            Voltar
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="p-6">
        <div className="bg-gray-900 border border-gray-800 rounded p-5 space-y-6">
          {/* Nome da Broker */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2 uppercase tracking-wide">
              Nome da Broker
            </label>
            <input
              type="text"
              value={brokerData.name}
              onChange={(e) => setBrokerData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ex: Polarium Broker"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            <p className="text-xs text-gray-500 mt-1.5">Nome que será exibido na plataforma</p>
          </div>

          {/* E-mail de Suporte */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2 uppercase tracking-wide">
              E-mail de Suporte
            </label>
            <input
              type="email"
              value={brokerData.supportEmail}
              onChange={(e) => setBrokerData(prev => ({ ...prev, supportEmail: e.target.value }))}
              placeholder="support@supportpolarium.com"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
            <p className="text-xs text-gray-500 mt-1.5">E-mail que será exibido como contato da plataforma</p>
          </div>

          {/* Logo Padrão */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2 uppercase tracking-wide">
              Logo da Broker (Padrão)
            </label>
            {brokerData.logo ? (
              <div className="space-y-3">
                <div className="relative inline-block">
                  <img
                    src={brokerData.logo}
                    alt="Logo da Broker"
                    className="max-w-xs max-h-32 object-contain border border-gray-700 rounded"
                  />
                  <button
                    onClick={handleRemoveLogoType('logo')}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center transition-colors"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
                <div>
                  <label className="inline-flex items-center px-4 py-2 bg-gray-800 border border-gray-700 rounded cursor-pointer hover:bg-gray-700 transition-colors">
                    <Upload className="w-4 h-4 mr-2 text-gray-400" />
                    <span className="text-xs text-gray-300">Trocar Logo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload('logo')}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <label className="inline-flex items-center px-4 py-2 bg-gray-800 border border-gray-700 rounded cursor-pointer hover:bg-gray-700 transition-colors">
                <Upload className="w-4 h-4 mr-2 text-gray-400" />
                <span className="text-xs text-gray-300">Carregar Logo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload('logo')}
                  className="hidden"
                />
              </label>
            )}
            <p className="text-xs text-gray-500 mt-1.5">Logo padrão (recomendado: PNG ou SVG transparente)</p>
          </div>

          {/* Logo para Fundo Preto (Trading) */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2 uppercase tracking-wide">
              Logo para Fundo Preto (Página Trading)
            </label>
            {brokerData.logoDark ? (
              <div className="space-y-3">
                <div className="relative inline-block bg-black p-2 rounded">
                  <img
                    src={brokerData.logoDark}
                    alt="Logo Fundo Preto"
                    className="max-w-xs max-h-32 object-contain"
                  />
                  <button
                    onClick={handleRemoveLogoType('logoDark')}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center transition-colors"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
                <div>
                  <label className="inline-flex items-center px-4 py-2 bg-gray-800 border border-gray-700 rounded cursor-pointer hover:bg-gray-700 transition-colors">
                    <Upload className="w-4 h-4 mr-2 text-gray-400" />
                    <span className="text-xs text-gray-300">Trocar Logo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload('logoDark')}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <label className="inline-flex items-center px-4 py-2 bg-gray-800 border border-gray-700 rounded cursor-pointer hover:bg-gray-700 transition-colors">
                <Upload className="w-4 h-4 mr-2 text-gray-400" />
                <span className="text-xs text-gray-300">Carregar Logo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload('logoDark')}
                  className="hidden"
                />
              </label>
            )}
            <p className="text-xs text-gray-500 mt-1.5">Logo otimizado para fundo preto (usado na página /dashboard/trading)</p>
          </div>

          {/* Logo para Fundo Branco (Profile/Login) */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2 uppercase tracking-wide">
              Logo para Fundo Branco (Páginas Profile/Login)
            </label>
            {brokerData.logoLight ? (
              <div className="space-y-3">
                <div className="relative inline-block bg-white p-2 rounded border border-gray-700">
                  <img
                    src={brokerData.logoLight}
                    alt="Logo Fundo Branco"
                    className="max-w-xs max-h-32 object-contain"
                  />
                  <button
                    onClick={handleRemoveLogoType('logoLight')}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center transition-colors"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
                <div>
                  <label className="inline-flex items-center px-4 py-2 bg-gray-800 border border-gray-700 rounded cursor-pointer hover:bg-gray-700 transition-colors">
                    <Upload className="w-4 h-4 mr-2 text-gray-400" />
                    <span className="text-xs text-gray-300">Trocar Logo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload('logoLight')}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <label className="inline-flex items-center px-4 py-2 bg-gray-800 border border-gray-700 rounded cursor-pointer hover:bg-gray-700 transition-colors">
                <Upload className="w-4 h-4 mr-2 text-gray-400" />
                <span className="text-xs text-gray-300">Carregar Logo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload('logoLight')}
                  className="hidden"
                />
              </label>
            )}
            <p className="text-xs text-gray-500 mt-1.5">Logo otimizado para fundo branco (usado nas páginas /profile e /login)</p>
          </div>

          {/* Favicon */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2 uppercase tracking-wide">
              Favicon
            </label>
            {brokerData.favicon ? (
              <div className="space-y-3">
                <div className="relative inline-block">
                  <img
                    src={brokerData.favicon}
                    alt="Favicon"
                    className="w-16 h-16 object-contain border border-gray-700 rounded"
                  />
                  <button
                    onClick={handleRemoveLogoType('favicon')}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center transition-colors"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
                <div>
                  <label className="inline-flex items-center px-4 py-2 bg-gray-800 border border-gray-700 rounded cursor-pointer hover:bg-gray-700 transition-colors">
                    <Upload className="w-4 h-4 mr-2 text-gray-400" />
                    <span className="text-xs text-gray-300">Trocar Favicon</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload('favicon')}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <label className="inline-flex items-center px-4 py-2 bg-gray-800 border border-gray-700 rounded cursor-pointer hover:bg-gray-700 transition-colors">
                <Upload className="w-4 h-4 mr-2 text-gray-400" />
                <span className="text-xs text-gray-300">Carregar Favicon</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload('favicon')}
                  className="hidden"
                />
              </label>
            )}
            <p className="text-xs text-gray-500 mt-1.5">Favicon da plataforma (recomendado: 32x32 ou 16x16 pixels, formato ICO ou PNG)</p>
          </div>

          {/* Marca d'água para Gráfico */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2 uppercase tracking-wide">
              Marca d'água (Gráfico)
            </label>
            {brokerData.watermark ? (
              <div className="space-y-3">
                <div className="relative inline-block bg-black p-2 rounded border border-gray-700">
                  <img
                    src={brokerData.watermark}
                    alt="Marca d'água"
                    className="max-w-xs max-h-32 object-contain"
                  />
                  <button
                    onClick={handleRemoveLogoType('watermark')}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center transition-colors"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
                <div>
                  <label className="inline-flex items-center px-4 py-2 bg-gray-800 border border-gray-700 rounded cursor-pointer hover:bg-gray-700 transition-colors">
                    <Upload className="w-4 h-4 mr-2 text-gray-400" />
                    <span className="text-xs text-gray-300">Trocar Marca d'água</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload('watermark')}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <label className="inline-flex items-center px-4 py-2 bg-gray-800 border border-gray-700 rounded cursor-pointer hover:bg-gray-700 transition-colors">
                <Upload className="w-4 h-4 mr-2 text-gray-400" />
                <span className="text-xs text-gray-300">Carregar Marca d'água</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload('watermark')}
                  className="hidden"
                />
              </label>
            )}
            <p className="text-xs text-gray-500 mt-1.5">Imagem que será exibida como marca d'água no fundo do gráfico (formato PNG ou SVG transparente recomendado)</p>
          </div>

          {/* Botão Salvar */}
          <div className="pt-4 border-t border-gray-800">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 rounded text-xs font-medium text-gray-300 transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Salvando...' : 'Salvar Alterações'}</span>
            </button>
          </div>
        </div>
      </main>

      {/* Image Cropper Modal */}
      {showCropper && cropperImage && (
        <ImageCropper
          imageSrc={cropperImage}
          onCrop={handleCropComplete}
          onCancel={handleCropCancel}
          aspectRatio={cropperType === 'favicon' ? 1 : undefined}
        />
      )}
    </div>
  );
}

