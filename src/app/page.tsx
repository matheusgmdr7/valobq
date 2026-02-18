'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { 
  ChevronRight, Play, Shield, Zap, BarChart3, Users, 
  Trophy, BookOpen, Globe, Lock, ArrowRight,
  ChevronDown, CheckCircle, Smartphone, Monitor,
  Bell, Wallet, Menu, X, MessageCircle
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ============================================================
// Animated counter hook
// ============================================================
function useCountUp(target: number, duration: number = 2000, startOnView: boolean = true) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  useEffect(() => {
    if (!startOnView) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          const start = Date.now()
          const tick = () => {
            const elapsed = Date.now() - start
            const progress = Math.min(elapsed / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setCount(Math.floor(eased * target))
            if (progress < 1) requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        }
      },
      { threshold: 0.3 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target, duration, startOnView])

  return { count, ref }
}

// ============================================================
// Fade-in on scroll component
// ============================================================
function FadeInSection({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setVisible(true), delay)
        }
      },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [delay])

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
    >
      {children}
    </div>
  )
}

// ============================================================
// FAQ Item
// ============================================================
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-white/10 rounded-xl overflow-hidden transition-colors hover:border-white/20">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left"
      >
        <span className="text-white font-medium pr-4">{question}</span>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-96 pb-5 px-5' : 'max-h-0'}`}>
        <p className="text-gray-400 text-sm leading-relaxed">{answer}</p>
      </div>
    </div>
  )
}

// ============================================================
// Testimonial Card
// ============================================================
function TestimonialCard({ quote, name, role }: { quote: string; name: string; role: string }) {
  return (
    <div className="bg-gradient-to-br from-white/[0.06] to-white/[0.02] border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300 hover:-translate-y-1 flex flex-col min-w-[300px]">
      <div className="text-white/20 text-3xl font-serif mb-3">&ldquo;</div>
      <p className="text-gray-300 text-sm leading-relaxed flex-1 mb-4">{quote}</p>
      <div>
        <p className="text-white font-medium text-sm">{name}</p>
        <p className="text-gray-500 text-xs">{role}</p>
      </div>
    </div>
  )
}

// ============================================================
// Feature Card (Ecosystem)
// ============================================================
function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="relative group rounded-2xl p-6 border border-white/[0.07] bg-white/[0.02] overflow-hidden hover:border-white/15 transition-all duration-300 hover:-translate-y-1">
      <div className="relative z-10">
        <div className="mb-4 text-gray-400 group-hover:text-white/80 transition-colors">{icon}</div>
        <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
        <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  )
}

// ============================================================
// Main Landing Page
// ============================================================
// Barras determinísticas do mock chart (sem Math.random para evitar hydration mismatch)
const MOCK_CHART_BARS = Array.from({ length: 40 }).map((_, i) => {
  const seed = Math.sin(i * 127.1 + 311.7) * 43758.5453
  const pseudoRandom = (seed - Math.floor(seed)) * 40
  const h = 20 + Math.sin(i * 0.3) * 30 + pseudoRandom
  const isGreen = Math.sin(i * 0.3 + 1) > 0
  return { h: Math.max(5, Math.min(95, h)), isGreen }
})

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [brokerLogo, setBrokerLogo] = useState<string | null>(null)
  const [brokerName, setBrokerName] = useState<string>('VALOREN')

  const investorsCounter = useCountUp(150000, 2500)
  const assetsCounter = useCountUp(200, 2000)
  const countriesCounter = useCountUp(45, 1800)

  // Carregar logo e nome da broker (logo para fundo escuro)
  useEffect(() => {
    const loadBrokerData = async () => {
      try {
        let logoUrl: string | null = null
        let brokerNameValue: string | null = null

        if (supabase) {
          try {
            // Priorizar logo dark para fundo escuro
            const { data: logoDarkData } = await supabase
              .from('platform_settings')
              .select('value')
              .eq('key', 'broker_logo_dark')
              .single()

            if (logoDarkData?.value) {
              logoUrl = logoDarkData.value as string
              localStorage.setItem('broker_logo_dark', logoUrl)
            } else {
              const { data: logoData } = await supabase
                .from('platform_settings')
                .select('value')
                .eq('key', 'broker_logo')
                .single()
              if (logoData?.value) {
                logoUrl = logoData.value as string
                localStorage.setItem('broker_logo', logoUrl)
              }
            }

            const { data: nameData } = await supabase
              .from('platform_settings')
              .select('value')
              .eq('key', 'broker_name')
              .single()
            if (nameData?.value) {
              brokerNameValue = nameData.value as string
              localStorage.setItem('broker_name', brokerNameValue)
            }
          } catch (error) {
            // Fallback para localStorage
          }
        }

        if (!logoUrl) {
          logoUrl = localStorage.getItem('broker_logo_dark') || localStorage.getItem('broker_logo')
        }
        if (!brokerNameValue) {
          brokerNameValue = localStorage.getItem('broker_name')
        }

        if (logoUrl) setBrokerLogo(logoUrl)
        if (brokerNameValue) setBrokerName(brokerNameValue)
      } catch (error) {
        void error;
      }
    }
    loadBrokerData()
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const handleScroll = () => setScrolled(el.scrollTop > 50)
    el.addEventListener('scroll', handleScroll)
    return () => el.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div ref={scrollRef} className="h-screen w-full overflow-y-auto overflow-x-hidden bg-[#060b18] text-white scroll-smooth" style={{ scrollBehavior: 'smooth' }}>

      {/* ========== TOP PROMO BANNER ========== */}
      <div className="w-full bg-gradient-to-r from-sky-600/20 via-sky-500/10 to-sky-600/20 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-center gap-2 text-sm text-gray-300">
          <span>Negocie com precisão,</span>
          <span className="text-sky-400 font-medium underline underline-offset-2 cursor-pointer">comece agora</span>
          <span>e acelere seus resultados.</span>
          <ChevronRight className="w-4 h-4 text-gray-500" />
        </div>
      </div>

      {/* ========== NAVIGATION ========== */}
      <nav className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#060b18]/90 backdrop-blur-xl border-b border-white/5 shadow-lg' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5">
              {brokerLogo && <img src={brokerLogo} alt={brokerName} className="h-8 object-contain" />}
              {!brokerLogo && <span className="text-xl font-bold tracking-tight text-white">{brokerName}</span>}
            </Link>

            {/* Desktop Nav Links */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#inicio" className="text-sm text-gray-300 hover:text-white transition-colors">Início</a>
              <a href="#ecossistema" className="text-sm text-gray-300 hover:text-white transition-colors">Plataforma</a>
              <a href="#depoimentos" className="text-sm text-gray-300 hover:text-white transition-colors">Depoimentos</a>
              <a href="#faq" className="text-sm text-gray-300 hover:text-white transition-colors">Dúvidas</a>
            </div>

            {/* CTA Buttons */}
            <div className="hidden md:flex items-center gap-3">
              <Link
                href="/login"
                className="px-5 py-2.5 text-sm text-gray-300 hover:text-white transition-colors flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                Entrar
              </Link>
              <Link
                href="/auth"
                className="px-6 py-2.5 bg-sky-500 hover:bg-sky-400 text-white text-sm font-medium rounded-full transition-all duration-200 flex items-center gap-2 shadow-lg shadow-sky-500/25"
              >
                Começar Agora
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Mobile menu button */}
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-white p-2">
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0a1628]/95 backdrop-blur-xl border-t border-white/5">
            <div className="px-4 py-4 space-y-3">
              <a href="#inicio" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-gray-300 hover:text-white text-sm">Início</a>
              <a href="#ecossistema" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-gray-300 hover:text-white text-sm">Plataforma</a>
              <a href="#depoimentos" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-gray-300 hover:text-white text-sm">Depoimentos</a>
              <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-gray-300 hover:text-white text-sm">Dúvidas</a>
              <div className="pt-3 border-t border-white/10 flex flex-col gap-2">
                <Link href="/login" className="py-2.5 text-center text-gray-300 hover:text-white text-sm">Entrar</Link>
                <Link href="/auth" className="py-2.5 text-center bg-sky-500 text-white text-sm font-medium rounded-full">Começar Agora</Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ========== HERO SECTION ========== */}
      <section id="inicio" className="relative min-h-[90vh] flex flex-col items-center justify-center px-4 overflow-hidden">
        {/* Floating background glows - animados */}
        <div className="absolute top-[10%] left-[15%] w-[600px] h-[600px] rounded-full blur-[130px] animate-float-glow" style={{ background: 'radial-gradient(circle, rgba(14,165,233,0.08) 0%, transparent 70%)' }} />
        <div className="absolute bottom-[15%] right-[10%] w-[500px] h-[500px] rounded-full blur-[110px] animate-float-glow-delay" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-sky-400/10 rounded-full blur-[80px]" />
        
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }} />

        <div className="relative z-10 text-center max-w-4xl mx-auto">
          {/* Badge with animated border glow */}
          <FadeInSection>
            <div className="relative inline-flex items-center gap-2 px-5 py-2.5 rounded-full mb-8 bg-white/5 overflow-hidden">
              {/* Rotating border glow */}
              <div className="absolute inset-0 rounded-full">
                <div className="absolute inset-[-1px] rounded-full animate-spin-slow" style={{
                  background: 'conic-gradient(from 0deg, transparent 0%, #0ea5e9 20%, transparent 40%, transparent 100%)',
                }} />
                <div className="absolute inset-[1px] rounded-full bg-[#060b18]" />
              </div>
              {/* Content */}
              <div className="relative z-10 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                <span className="text-sm text-gray-300">+150.000 Investidores</span>
                <span className="text-xs px-2 py-0.5 bg-sky-500/20 text-sky-400 rounded-full font-medium">ATIVOS</span>
              </div>
            </div>
          </FadeInSection>

          {/* Headline */}
          <FadeInSection delay={100}>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight mb-6">
              Seu próximo nível no{' '}
              <span className="bg-gradient-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent">
                mercado financeiro
              </span>
            </h1>
          </FadeInSection>

          {/* Subtitle */}
          <FadeInSection delay={200}>
            <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              Uma plataforma construída para quem busca resultados reais.
              Negocie ativos globais com agilidade e confiança.
            </p>
          </FadeInSection>

          {/* CTA Buttons */}
          <FadeInSection delay={300}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/auth"
                className="group px-8 py-4 bg-sky-500 hover:bg-sky-400 text-white font-semibold rounded-full transition-all duration-300 flex items-center gap-2 shadow-xl shadow-sky-500/30 hover:shadow-sky-400/40 hover:scale-105"
              >
                Criar Conta
                <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="/login"
                className="group px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-medium rounded-full border border-white/15 transition-all duration-300 flex items-center gap-2 hover:scale-105"
              >
                Ver Demonstração
                <Play className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors" />
              </Link>
            </div>
          </FadeInSection>
        </div>

        {/* Globe/Earth glow at bottom */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
          <div className="w-[600px] sm:w-[800px] h-[300px] sm:h-[400px] rounded-[50%] bg-gradient-to-t from-sky-500/20 via-sky-400/5 to-transparent blur-sm border-t border-sky-400/20" />
        </div>
      </section>

      {/* ========== PARTNERS BAR ========== */}
      <section className="relative py-12 border-y border-white/5 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-center text-sm text-gray-500 mb-8">Negocie os ativos mais relevantes do mercado global.</p>
        </div>
        {/* Marquee container */}
        <div className="relative">
          {/* Fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[#060b18] to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#060b18] to-transparent z-10" />
          <div className="flex animate-marquee" style={{ width: 'max-content' }}>
            {[...Array(2)].map((_, setIdx) => (
              <div key={setIdx} className="flex items-center gap-12 sm:gap-20 px-6 sm:px-10">
                {['Apple', 'Ethereum', 'Google', 'Tesla', 'HSBC', 'Santander', 'Bitcoin', 'Amazon', 'Meta', 'Petrobras', 'Ouro', 'EUR/USD'].map((brand) => (
                  <span key={`${setIdx}-${brand}`} className="text-gray-500/50 text-sm sm:text-base font-medium tracking-wider whitespace-nowrap select-none">{brand}</span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== GLOBAL PRESENCE ========== */}
      <section className="relative py-20 sm:py-32 overflow-hidden">
        {/* Dot grid background */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, #0ea5e9 1px, transparent 0)',
          backgroundSize: '24px 24px'
        }} />

        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left: Text */}
            <FadeInSection>
              <div>
                <span className="text-sky-400 text-sm font-semibold tracking-widest uppercase mb-4 block">Alcance Global</span>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-4">
                  Mais de <span ref={investorsCounter.ref} className="text-sky-400">{investorsCounter.count.toLocaleString('pt-BR')}</span> traders
                </h2>
                <p className="text-xl text-gray-400 mb-8">
                  em dezenas de países já escolheram a {brokerName}.
                </p>
                <p className="text-gray-500 leading-relaxed max-w-md">
                  Construímos uma infraestrutura robusta e transparente
                  para quem leva o mercado financeiro a sério. Velocidade,
                  segurança e uma experiência de negociação sem igual.
                </p>
                <div className="flex gap-4 mt-8">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/[0.07] rounded-xl">
                    <Bell className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-300">Alertas Inteligentes</span>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/[0.07] rounded-xl">
                    <Wallet className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-300">Saques Rápidos</span>
                  </div>
                </div>
              </div>
            </FadeInSection>

            {/* Right: Stats */}
            <FadeInSection delay={200}>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-6 text-center">
                  <Globe className="w-7 h-7 text-gray-500 mx-auto mb-3" />
                  <div ref={countriesCounter.ref} className="text-3xl font-bold text-white mb-1">{countriesCounter.count}+</div>
                  <p className="text-gray-500 text-sm">Países</p>
                </div>
                <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-6 text-center">
                  <BarChart3 className="w-7 h-7 text-gray-500 mx-auto mb-3" />
                  <div ref={assetsCounter.ref} className="text-3xl font-bold text-white mb-1">{assetsCounter.count}+</div>
                  <p className="text-gray-500 text-sm">Ativos</p>
                </div>
                <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-6 text-center">
                  <Shield className="w-7 h-7 text-gray-500 mx-auto mb-3" />
                  <div className="text-3xl font-bold text-white mb-1">100%</div>
                  <p className="text-gray-500 text-sm">Seguro</p>
                </div>
                <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-6 text-center">
                  <Zap className="w-7 h-7 text-gray-500 mx-auto mb-3" />
                  <div className="text-3xl font-bold text-white mb-1">&lt;1s</div>
                  <p className="text-gray-500 text-sm">Execução</p>
                </div>
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* ========== ECOSYSTEM ========== */}
      <section id="ecossistema" className="relative py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4">
          <FadeInSection>
            <div className="text-center mb-16">
              <span className="text-sky-400 text-sm font-semibold tracking-widest uppercase mb-4 block">Ecossistema</span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
                Tudo o que você precisa em <span className="text-sky-400">um só lugar</span>
              </h2>
              <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                A {brokerName} reúne tecnologia, educação e competição para você evoluir como trader.
              </p>
            </div>
          </FadeInSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <FadeInSection delay={0}>
              <FeatureCard
                icon={<Lock className="w-9 h-9" />}
                title="Segurança Total"
                description="Criptografia avançada em cada transação. Seus dados e fundos protegidos 24 horas por dia."
              />
            </FadeInSection>
            <FadeInSection delay={100}>
              <FeatureCard
                icon={<BarChart3 className="w-9 h-9" />}
                title="+200 Ativos"
                description="Ações, forex, cripto e commodities — diversifique sua carteira em poucos cliques."
              />
            </FadeInSection>
            <FadeInSection delay={200}>
              <FeatureCard
                icon={<BookOpen className="w-9 h-9" />}
                title="Educação Financeira"
                description="Conteúdos práticos e gratuitos para você dominar o mercado e operar com confiança."
              />
            </FadeInSection>
            <FadeInSection delay={300}>
              <FeatureCard
                icon={<Trophy className="w-9 h-9" />}
                title="Torneios e Premiações"
                description="Desafie outros traders em competições reais com rankings e prêmios exclusivos."
              />
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* ========== PLATFORM FEATURES ========== */}
      <section className="relative py-20 sm:py-32 overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-sky-500/5 rounded-full blur-[100px]" />
        
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <FadeInSection>
            <div className="text-center mb-16">
              <span className="text-sky-400 text-sm font-semibold tracking-widest uppercase mb-4 block">Plataforma</span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
                Tecnologia feita para <span className="text-sky-400">traders exigentes</span>
              </h2>
            </div>
          </FadeInSection>

          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left: Feature List */}
            <FadeInSection>
              <div className="space-y-6">
                <div className="flex items-start gap-4 p-4 rounded-xl hover:bg-white/[0.03] transition-colors">
                  <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center flex-shrink-0">
                    <Monitor className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Gráficos Profissionais</h3>
                    <p className="text-gray-500 text-sm">Análise técnica de alto nível com candlestick, indicadores e ferramentas de desenho em tempo real.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-xl hover:bg-white/[0.03] transition-colors">
                  <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center flex-shrink-0">
                    <Zap className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Execução Instantânea</h3>
                    <p className="text-gray-500 text-sm">Ordens processadas em milissegundos. Sem travamentos, sem atrasos — performance máxima.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-xl hover:bg-white/[0.03] transition-colors">
                  <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center flex-shrink-0">
                    <Bell className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Notificações de Mercado</h3>
                    <p className="text-gray-500 text-sm">Fique por dentro de cada movimento relevante com alertas personalizados de preço.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 rounded-xl hover:bg-white/[0.03] transition-colors">
                  <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center justify-center flex-shrink-0">
                    <Smartphone className="w-5 h-5 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Acesso em Qualquer Lugar</h3>
                    <p className="text-gray-500 text-sm">Opere de qualquer dispositivo — desktop, tablet ou celular, com a mesma fluidez.</p>
                  </div>
                </div>
              </div>
            </FadeInSection>

            {/* Right: Platform preview mockup */}
            <FadeInSection delay={200}>
              <div className="relative">
                <div className="bg-gradient-to-br from-[#0c1829] to-[#0a1220] border border-white/10 rounded-2xl p-4 shadow-2xl">
                  {/* Mock header */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500/60" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                      <div className="w-3 h-3 rounded-full bg-green-500/60" />
                    </div>
                    <div className="flex-1 h-6 bg-white/5 rounded-md mx-8" />
                  </div>
                  {/* Mock chart area */}
                  <div className="bg-[#0a1424] rounded-xl p-4 h-64 flex items-end gap-1">
                    {MOCK_CHART_BARS.map((bar, i) => (
                      <div
                        key={i}
                        className={`flex-1 rounded-sm ${bar.isGreen ? 'bg-emerald-500/60' : 'bg-red-500/60'}`}
                        style={{ height: `${bar.h}%` }}
                      />
                    ))}
                  </div>
                  {/* Mock bottom bar */}
                  <div className="flex items-center justify-between mt-3 px-2">
                    <div className="flex gap-2">
                      <div className="h-8 w-20 bg-emerald-500/20 rounded-md" />
                      <div className="h-8 w-20 bg-red-500/20 rounded-md" />
                    </div>
                    <div className="text-right">
                      <div className="text-emerald-400 text-sm font-mono font-bold">R$ 10.000,00</div>
                      <div className="text-gray-500 text-xs">Saldo disponível</div>
                    </div>
                  </div>
                </div>
                {/* Glow effect behind */}
                <div className="absolute -inset-4 bg-sky-500/5 rounded-3xl blur-xl -z-10" />
              </div>
            </FadeInSection>
          </div>

          {/* Bottom feature pills */}
          <FadeInSection delay={100}>
            <div className="flex flex-wrap justify-center gap-4 mt-16">
              {[
                { icon: <Zap className="w-4 h-4" />, label: 'Alta performance' },
                { icon: <BarChart3 className="w-4 h-4" />, label: '+200 Ativos disponíveis' },
                { icon: <Shield className="w-4 h-4" />, label: 'Operações seguras' },
                { icon: <Monitor className="w-4 h-4" />, label: 'Interface profissional' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 px-5 py-2.5 bg-white/[0.02] border border-white/[0.07] rounded-full text-sm text-gray-500">
                  <span className="text-gray-500">{item.icon}</span>
                  {item.label}
                </div>
              ))}
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ========== TESTIMONIALS ========== */}
      <section id="depoimentos" className="relative py-20 sm:py-32 overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/3 left-0 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px]" />

        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <FadeInSection>
            <div className="text-center mb-16">
              <span className="text-sky-400 text-sm font-semibold tracking-widest uppercase mb-4 block">Depoimentos</span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">Quem opera, recomenda</h2>
              <p className="text-gray-400 text-lg">Histórias reais de traders que confiam na {brokerName}</p>
            </div>
          </FadeInSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <FadeInSection delay={0}>
              <TestimonialCard
                quote="Comecei pela conta demo e em poucas semanas já me sentia confiante para operar de verdade."
                name="Lucas M."
                role="Engenheiro de Software"
              />
            </FadeInSection>
            <FadeInSection delay={100}>
              <TestimonialCard
                quote="A interface é limpa e profissional. Não preciso de nada além da plataforma para tomar minhas decisões."
                name="Ana R."
                role="Gestora de Projetos"
              />
            </FadeInSection>
            <FadeInSection delay={200}>
              <TestimonialCard
                quote="Os torneios são viciantes! Compito com outros traders e ainda ganho prêmios reais."
                name="Pedro S."
                role="Day Trader"
              />
            </FadeInSection>
            <FadeInSection delay={300}>
              <TestimonialCard
                quote="Depois de testar várias corretoras, essa é a que tem a execução mais rápida e estável que já usei."
                name="Roberto L."
                role="Analista Financeiro"
              />
            </FadeInSection>
            <FadeInSection delay={400}>
              <TestimonialCard
                quote="O que me conquistou foi a simplicidade. Não tem enrolação — abri a conta e já estava operando."
                name="Carla T."
                role="Empreendedora"
              />
            </FadeInSection>
            <FadeInSection delay={500}>
              <TestimonialCard
                quote="O suporte resolve tudo muito rápido. Me sinto segura operando aqui, e o payout é justo."
                name="Juliana F."
                role="Advogada"
              />
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* ========== SUPPORT & TRUST ========== */}
      <section className="relative py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <FadeInSection>
              <div>
                <span className="text-sky-400 text-sm font-semibold tracking-widest uppercase mb-4 block">Suporte</span>
                <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                  Atendimento ágil,<br />
                  <span className="text-sky-400">24 horas por dia.</span>
                </h2>
                <p className="text-gray-500 leading-relaxed mb-8 max-w-md">
                  Para quem opera no mercado, cada segundo importa. Por isso, nossa equipe 
                  de suporte está disponível a qualquer momento para resolver suas dúvidas 
                  e garantir que nada atrapalhe suas operações.
                </p>
                <div className="space-y-3">
                  {[
                    'Suporte humanizado via chat',
                    'Tempo de resposta reduzido',
                    'Atendimento em português',
                    'Ajuda com depósitos e saques',
                    'Orientação para iniciantes',
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-gray-500 flex-shrink-0" />
                      <span className="text-gray-300 text-sm">{item}</span>
                    </div>
                  ))}
                </div>
                <Link
                  href="/auth"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-sky-500 hover:bg-sky-400 text-white font-semibold rounded-full transition-all duration-300 mt-8 shadow-lg shadow-sky-500/25"
                >
                  Começar Agora
                  <ChevronRight className="w-5 h-5" />
                </Link>
              </div>
            </FadeInSection>

            <FadeInSection delay={200}>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-6">
                  <MessageCircle className="w-7 h-7 text-gray-500 mb-3" />
                  <h4 className="text-white font-semibold mb-1">Chat ao Vivo</h4>
                  <p className="text-gray-500 text-sm">Respostas imediatas para suas dúvidas.</p>
                </div>
                <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-6">
                  <Shield className="w-7 h-7 text-gray-500 mb-3" />
                  <h4 className="text-white font-semibold mb-1">Dados Protegidos</h4>
                  <p className="text-gray-500 text-sm">Criptografia em todas as transações.</p>
                </div>
                <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-6">
                  <Zap className="w-7 h-7 text-gray-500 mb-3" />
                  <h4 className="text-white font-semibold mb-1">Saques Rápidos</h4>
                  <p className="text-gray-500 text-sm">Processamento ágil de retiradas.</p>
                </div>
                <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-6">
                  <Globe className="w-7 h-7 text-gray-500 mb-3" />
                  <h4 className="text-white font-semibold mb-1">Multilíngue</h4>
                  <p className="text-gray-500 text-sm">Suporte em diversos idiomas.</p>
                </div>
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* ========== FAQ ========== */}
      <section id="faq" className="relative py-20 sm:py-32">
        <div className="max-w-3xl mx-auto px-4">
          <FadeInSection>
            <div className="text-center mb-12">
              <span className="text-sky-400 text-sm font-semibold tracking-widest uppercase mb-4 block">FAQ</span>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Perguntas Frequentes</h2>
              <p className="text-gray-400">Respostas rápidas para as dúvidas mais comuns.</p>
            </div>
          </FadeInSection>

          <FadeInSection delay={100}>
            <div className="space-y-3">
              <FAQItem
                question={`Como criar uma conta na ${brokerName}?`}
                answer="É rápido: clique em 'Começar Agora', preencha seus dados e em menos de 2 minutos você já estará dentro da plataforma com acesso à conta demo."
              />
              <FAQItem
                question="Qual o depósito mínimo para começar?"
                answer={`O depósito mínimo na ${brokerName} é de R$60,00. Você pode começar com valores acessíveis e aumentar conforme ganha confiança e experiência.`}
              />
              <FAQItem
                question="A conta demo é gratuita?"
                answer="Totalmente gratuita! Você recebe R$10.000 virtuais para treinar, com recargas ilimitadas. Ideal para testar estratégias sem nenhum risco."
              />
              <FAQItem
                question="Como funciona o saque?"
                answer={`Os saques na ${brokerName} são processados de forma rápida e segura. Basta solicitar a retirada na plataforma e o valor será enviado para sua conta em poucos instantes.`}
              />
              <FAQItem
                question="Quais ativos posso negociar?"
                answer={`A ${brokerName} oferece mais de 200 ativos para negociação, incluindo criptomoedas (Bitcoin, Ethereum), forex (EUR/USD, GBP/USD), ações (Apple, Tesla) e commodities (Ouro, Petróleo).`}
              />
              <FAQItem
                question="A plataforma é segura?"
                answer="Absolutamente. Todas as transações são protegidas com criptografia de ponta. Seus dados pessoais e financeiros estão seguros em nossa infraestrutura."
              />
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ========== FINAL CTA ========== */}
      <section className="relative py-20 sm:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-sky-600/10 to-transparent" />
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <FadeInSection>
            {brokerLogo && <img src={brokerLogo} alt={brokerName} className="h-10 object-contain mx-auto mb-8 opacity-80" />}
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
              Pronto para operar no próximo nível?
            </h2>
            <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto">
              Junte-se a milhares de traders que já estão transformando seus resultados com a {brokerName}.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/auth"
                className="group px-8 py-4 bg-sky-500 hover:bg-sky-400 text-white font-semibold rounded-full transition-all duration-300 flex items-center gap-2 shadow-xl shadow-sky-500/30 hover:shadow-sky-400/40 hover:scale-105"
              >
                Criar Conta Gratuita
                <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="/login"
                className="px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-medium rounded-full border border-white/15 transition-all duration-300 flex items-center gap-2 hover:scale-105"
              >
                Já tenho conta
              </Link>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="border-t border-white/5 bg-[#040810]">
        <div className="max-w-7xl mx-auto px-4 py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-12">
            {/* Brand */}
            <div className="col-span-2 md:col-span-4 lg:col-span-1 mb-4 lg:mb-0">
              <Link href="/" className="flex items-center gap-2.5 mb-4">
                {brokerLogo && <img src={brokerLogo} alt={brokerName} className="h-7 object-contain" />}
                {!brokerLogo && <span className="text-lg font-bold text-white">{brokerName}</span>}
              </Link>
              <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
                Negocie ativos globais com tecnologia, velocidade e segurança.
              </p>
            </div>

            {/* Menu */}
            <div>
              <h4 className="text-white font-semibold text-sm mb-4">Menu</h4>
              <ul className="space-y-2.5">
                <li><a href="#inicio" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">Sobre</a></li>
                <li><a href="#faq" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">Dúvidas</a></li>
                <li><a href="#depoimentos" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">Depoimentos</a></li>
              </ul>
            </div>

            {/* Plataforma */}
            <div>
              <h4 className="text-white font-semibold text-sm mb-4">Plataforma</h4>
              <ul className="space-y-2.5">
                <li><Link href="/auth" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">Criar Conta</Link></li>
                <li><Link href="/login" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">Login</Link></li>
                <li><a href="#ecossistema" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">Recursos</a></li>
              </ul>
            </div>

            {/* Institucional */}
            <div>
              <h4 className="text-white font-semibold text-sm mb-4">Institucional</h4>
              <ul className="space-y-2.5">
                <li><Link href="/terms" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">Termos e Condições</Link></li>
                <li><Link href="/privacy-policy" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">Política de Privacidade</Link></li>
                <li><Link href="/risk-disclosure" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">Divulgação de Risco</Link></li>
              </ul>
            </div>

            {/* Suporte */}
            <div>
              <h4 className="text-white font-semibold text-sm mb-4">Suporte</h4>
              <ul className="space-y-2.5">
                <li className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-gray-500" />
                  <a href="#" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">Chat ao Vivo</a>
                </li>
                <li className="text-gray-500 text-sm">suporte@valorenbroker.com</li>
              </ul>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="border-t border-white/5 pt-8 mb-8">
            <p className="text-gray-600 text-[11px] leading-relaxed max-w-5xl">
              <strong>Aviso de Risco:</strong> Operações com derivativos envolvem alto grau de risco e podem resultar na perda total do capital investido. 
              Resultados passados não garantem retornos futuros. A volatilidade dos mercados pode gerar variações significativas entre períodos. 
              Antes de operar, certifique-se de compreender os riscos envolvidos. A {brokerName} não se responsabiliza por decisões de investimento 
              tomadas com base em informações disponibilizadas na plataforma.
            </p>
          </div>

          {/* Bottom bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-gray-600 text-sm">{brokerName} &copy; 2025 Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
