'use client';

import hotToast, { type Toast, type ToastOptions } from 'react-hot-toast';
import { CheckCircle2, Info, Loader2, XCircle } from 'lucide-react';

export const ADMIN_TOASTER_ID = 'admin';

type ToastType = 'success' | 'error' | 'info' | 'loading';

const TOAST_CONFIG: Record<
  ToastType,
  { Icon: typeof CheckCircle2; iconClass: string; wrapClass: string; accent: string }
> = {
  success: {
    Icon: CheckCircle2,
    iconClass: 'text-emerald-400',
    wrapClass: 'bg-emerald-500/10',
    accent: 'border-emerald-500/20',
  },
  error: {
    Icon: XCircle,
    iconClass: 'text-red-400',
    wrapClass: 'bg-red-500/10',
    accent: 'border-red-500/20',
  },
  info: {
    Icon: Info,
    iconClass: 'text-white/45',
    wrapClass: 'bg-white/[0.06]',
    accent: 'border-white/[0.08]',
  },
  loading: {
    Icon: Loader2,
    iconClass: 'text-blue-400 animate-spin',
    wrapClass: 'bg-blue-500/10',
    accent: 'border-blue-500/20',
  },
};

function AdminToastCard({ t, message, type }: { t: Toast; message: string; type: ToastType }) {
  const { Icon, iconClass, wrapClass, accent } = TOAST_CONFIG[type];

  return (
    <div
      className={`${t.visible ? 'animate-enter' : 'animate-leave'} pointer-events-auto flex items-center gap-3 min-w-[260px] max-w-[380px] rounded-[10px] border ${accent} bg-[#111113]/95 backdrop-blur-xl px-3.5 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.5)]`}
    >
      <div className={`flex-shrink-0 w-7 h-7 rounded-lg ${wrapClass} flex items-center justify-center`}>
        <Icon className={`w-3.5 h-3.5 ${iconClass}`} />
      </div>
      <p className="text-[13px] font-medium text-white/80 leading-snug flex-1">{message}</p>
    </div>
  );
}

function show(type: ToastType, message: string, options?: ToastOptions) {
  return hotToast.custom((t) => <AdminToastCard t={t} message={message} type={type} />, {
    toasterId: ADMIN_TOASTER_ID,
    duration: type === 'error' ? 4000 : 3000,
    ...options,
  });
}

function adminToast(message: string, options?: ToastOptions) {
  return show('info', message, options);
}

adminToast.success = (message: string, options?: ToastOptions) => show('success', message, options);
adminToast.error = (message: string, options?: ToastOptions) => show('error', message, options);
adminToast.loading = (message: string, options?: ToastOptions) => show('loading', message, options);
adminToast.dismiss = hotToast.dismiss;

export default adminToast;
