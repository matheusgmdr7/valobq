import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { Toaster } from 'react-hot-toast'
import { ServiceWorkerRegistration } from '@/components/ServiceWorkerRegistration'
import { MonitoringInit } from '@/components/MonitoringInit'
import { FaviconManager } from '@/components/FaviconManager'
import { TitleManager } from '@/components/TitleManager'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'VALOREN - Plataforma de Negociação de Ativos',
  description: 'VALOREN - Plataforma profissional de negociação de ativos. Invista com segurança e praticidade.',
  applicationName: 'VALOREN',
  appleWebAppCapable: 'yes',
  appleWebAppTitle: 'VALOREN',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  userScalable: false,
  shrinkToFit: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className="macos desktop">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={inter.className}>
        <TitleManager />
        <FaviconManager />
        <ServiceWorkerRegistration />
        <MonitoringInit />
        <AuthProvider>
          {children}
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#111827',
                color: '#fff',
                border: '1px solid #ffffff',
                borderRadius: '8px',
                padding: '12px 16px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                animation: 'toast-slide-in 0.3s ease-out',
              },
              success: {
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff',
                },
                style: {
                  background: '#111827',
                  color: '#fff',
                  border: '1px solid #ffffff',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
                style: {
                  background: '#111827',
                  color: '#fff',
                  border: '1px solid #ffffff',
                },
              },
              loading: {
                iconTheme: {
                  primary: '#3b82f6',
                  secondary: '#fff',
                },
                style: {
                  background: '#111827',
                  color: '#fff',
                  border: '1px solid #ffffff',
                },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  )
}
