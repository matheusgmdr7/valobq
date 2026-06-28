'use client';

import React, { useEffect, useState } from 'react';

export type ChartLoadingVariant = 'full' | 'compact';

interface ChartLoadingScreenProps {
  message?: string;
  className?: string;
  /** URL explícita; se omitida, usa broker_logo do localStorage */
  logoUrl?: string | null;
  /** Cobre viewport inteira (reload da página) */
  fullScreen?: boolean;
  /** full = animação completa; compact = só área do gráfico, mais discreta */
  variant?: ChartLoadingVariant;
}

function resolveLogoUrlFromStorage(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem('broker_logo_dark') ||
    localStorage.getItem('broker_logo') ||
    localStorage.getItem('broker_watermark') ||
    null
  );
}

function LogoMark({
  logoUrl,
  sizeClass,
  litClassName,
}: {
  logoUrl: string;
  sizeClass: string;
  litClassName?: string;
}) {
  return (
    <div className="relative inline-flex items-center justify-center">
      <img
        src={logoUrl}
        alt=""
        className={`${sizeClass} w-auto max-w-[200px] object-contain opacity-[0.18] brightness-0 invert select-none`}
        draggable={false}
      />
      <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
        <img
          src={logoUrl}
          alt=""
          className={`${litClassName ?? ''} ${sizeClass} w-auto max-w-[200px] object-contain brightness-0 invert select-none`}
          draggable={false}
        />
      </div>
    </div>
  );
}

/**
 * Loading do gráfico — variant "full" na recarga da página; "compact" ao trocar ativo.
 */
export const ChartLoadingScreen: React.FC<ChartLoadingScreenProps> = ({
  message = 'Carregando dados do mercado...',
  className = '',
  logoUrl: logoUrlProp,
  fullScreen = false,
  variant = 'full',
}) => {
  const [logoUrl, setLogoUrl] = useState<string | null>(logoUrlProp ?? null);
  const isCompact = variant === 'compact';

  useEffect(() => {
    if (logoUrlProp) {
      setLogoUrl(logoUrlProp);
    } else {
      setLogoUrl(resolveLogoUrlFromStorage());
    }
  }, [logoUrlProp]);

  return (
    <>
      <style>{`
        @keyframes cls-bg-drift {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.35; }
          50% { transform: translate(-12px, 8px) scale(1.03); opacity: 0.5; }
        }
        @keyframes cls-grid-pulse {
          0%, 100% { opacity: 0.04; }
          50% { opacity: 0.08; }
        }
        @keyframes cls-logo-reveal {
          0% { clip-path: inset(0 0 100% 0); filter: brightness(0.4); }
          35% { clip-path: inset(0 0 0 0); filter: brightness(1.15); }
          55% { clip-path: inset(0 0 0 0); filter: brightness(1); }
          100% { clip-path: inset(100% 0 0 0); filter: brightness(0.5); }
        }
        @keyframes cls-logo-beam {
          0% { top: -60%; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { top: 120%; opacity: 0; }
        }
        @keyframes cls-logo-glow {
          0%, 100% { opacity: 0.25; transform: scale(0.95); }
          50% { opacity: 0.55; transform: scale(1.05); }
        }
        @keyframes cls-logo-pulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 1; }
        }
        @keyframes cls-dot-bounce {
          0%, 80%, 100% { opacity: 0.25; transform: scale(0.85); }
          40% { opacity: 1; transform: scale(1); }
        }
        @keyframes cls-text-fade {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 0.85; }
        }
        @keyframes cls-bar-slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(250%); }
        }
        .cls-bg-candles { animation: cls-bg-drift 8s ease-in-out infinite; }
        .cls-bg-grid { animation: cls-grid-pulse 4s ease-in-out infinite; }
        .cls-logo-lit { animation: cls-logo-reveal 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
        .cls-logo-beam { animation: cls-logo-beam 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite; }
        .cls-logo-glow { animation: cls-logo-glow 2.4s ease-in-out infinite; }
        .cls-logo-pulse { animation: cls-logo-pulse 1.6s ease-in-out infinite; }
        .cls-dot-1 { animation: cls-dot-bounce 1.2s ease-in-out infinite; }
        .cls-dot-2 { animation: cls-dot-bounce 1.2s ease-in-out 0.15s infinite; }
        .cls-dot-3 { animation: cls-dot-bounce 1.2s ease-in-out 0.3s infinite; }
        .cls-text { animation: cls-text-fade 2s ease-in-out infinite; }
        .cls-bar-slide { animation: cls-bar-slide 1.4s ease-in-out infinite; }
      `}</style>

      <div
        className={`flex items-center justify-center overflow-hidden ${
          fullScreen ? 'fixed inset-0 z-[9999]' : 'absolute inset-0 z-20'
        } ${className}`}
        style={{
          background: isCompact
            ? 'rgba(3, 3, 5, 0.88)'
            : 'radial-gradient(ellipse 80% 60% at 50% 45%, rgba(30, 58, 138, 0.18) 0%, transparent 55%), radial-gradient(ellipse 60% 40% at 20% 80%, rgba(59, 130, 246, 0.08) 0%, transparent 50%), linear-gradient(165deg, #030305 0%, #0a0d14 40%, #050508 100%)',
        }}
        aria-live="polite"
        aria-busy="true"
      >
        {!isCompact && (
          <>
            <div
              className="cls-bg-grid absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `
                  linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)
                `,
                backgroundSize: '48px 48px',
                maskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, black 20%, transparent 75%)',
              }}
            />
            <svg
              className="cls-bg-candles absolute inset-0 w-full h-full pointer-events-none"
              preserveAspectRatio="xMidYMid slice"
              viewBox="0 0 400 200"
              aria-hidden
            >
              <defs>
                <linearGradient id="cls-candle-up" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(34,197,94,0.12)" />
                  <stop offset="100%" stopColor="rgba(34,197,94,0)" />
                </linearGradient>
                <linearGradient id="cls-candle-down" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(239,68,68,0.1)" />
                  <stop offset="100%" stopColor="rgba(239,68,68,0)" />
                </linearGradient>
              </defs>
              {[32, 68, 105, 142, 178, 215, 252, 288, 325, 362].map((x, i) => {
                const h = 28 + (i % 5) * 14;
                const y = 120 - h / 2;
                const up = i % 3 !== 0;
                return (
                  <g key={x} opacity={0.5 + (i % 3) * 0.1}>
                    <line x1={x + 6} y1={y - 8} x2={x + 6} y2={y + h + 8} stroke={up ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.12)'} strokeWidth="1" />
                    <rect x={x} y={y} width="12" height={h} rx="1" fill={up ? 'url(#cls-candle-up)' : 'url(#cls-candle-down)'} />
                  </g>
                );
              })}
              <path
                d="M 0 130 Q 80 110, 160 115 T 320 95 T 400 88"
                fill="none"
                stroke="rgba(59,130,246,0.12)"
                strokeWidth="1.5"
              />
            </svg>
          </>
        )}

        <div className={`relative z-10 flex flex-col items-center px-6 ${isCompact ? 'gap-4' : ''}`}>
          {logoUrl && (
            <div className={`relative ${isCompact ? 'mb-0' : 'mb-8'}`}>
              {!isCompact && (
                <div
                  className="cls-logo-glow absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 md:w-40 md:h-40 rounded-full blur-3xl pointer-events-none"
                  style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)' }}
                />
              )}

              {isCompact ? (
                <LogoMark
                  logoUrl={logoUrl}
                  sizeClass="h-8 md:h-10 text-lg md:text-xl"
                  litClassName="cls-logo-pulse"
                />
              ) : (
                <div className="relative inline-flex items-center justify-center">
                  <img
                    src={logoUrl}
                    alt=""
                    className="h-14 md:h-[72px] w-auto max-w-[200px] object-contain opacity-[0.18] brightness-0 invert select-none"
                    draggable={false}
                  />
                  <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                    <img
                      src={logoUrl}
                      alt=""
                      className="cls-logo-lit h-14 md:h-[72px] w-auto max-w-[200px] object-contain brightness-0 invert select-none"
                      draggable={false}
                    />
                  </div>
                  <div
                    className="cls-logo-beam absolute left-0 right-0 h-[45%] pointer-events-none"
                    style={{
                      background: 'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.35) 45%, rgba(255,255,255,0.08) 55%, transparent 100%)',
                      mixBlendMode: 'overlay',
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {isCompact ? (
            <div className="flex flex-col items-center gap-2.5 w-full max-w-[220px]">
              <div className="relative h-0.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className="cls-bar-slide absolute inset-y-0 left-0 w-2/5 rounded-full bg-white/50" />
              </div>
              <p className="text-[11px] text-white/45 font-medium tracking-wide text-center">
                {message}
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 cls-text">
              <div className="flex items-center gap-1">
                <span className="cls-dot-1 w-1.5 h-1.5 rounded-full bg-white/70" />
                <span className="cls-dot-2 w-1.5 h-1.5 rounded-full bg-white/70" />
                <span className="cls-dot-3 w-1.5 h-1.5 rounded-full bg-white/70" />
              </div>
              <p className="text-xs md:text-sm text-white/60 font-medium tracking-wide">
                {message}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
