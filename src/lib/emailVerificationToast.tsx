import { toast } from 'react-hot-toast';

const TOAST_ID = 'email-verification-required';

type EmailToastVariant = 'info' | 'success';

function EmailVerificationToast({
  visible,
  title,
  subtitle,
  variant,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  variant: EmailToastVariant;
}) {
  const isSuccess = variant === 'success';
  return (
    <div
      className={`${visible ? 'animate-enter' : 'animate-leave'} pointer-events-auto max-w-sm w-full`}
      style={{
        background: isSuccess
          ? 'linear-gradient(145deg, #ecfdf5 0%, #d1fae5 100%)'
          : 'linear-gradient(145deg, #eff6ff 0%, #dbeafe 100%)',
        border: `1px solid ${isSuccess ? 'rgba(16,185,129,0.35)' : 'rgba(59,130,246,0.35)'}`,
        borderRadius: '14px',
        padding: '14px 16px',
        boxShadow: '0 10px 40px rgba(15,23,42,0.12), 0 2px 8px rgba(15,23,42,0.06)',
      }}
    >
      <div className="flex gap-3 items-start">
        <div
          className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg"
          style={{
            background: isSuccess ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.12)',
          }}
        >
          {isSuccess ? '✓' : '✉️'}
        </div>
        <div className="min-w-0 pt-0.5">
          <p
            className="text-sm font-semibold leading-snug"
            style={{ color: isSuccess ? '#065f46' : '#1e3a8a', margin: 0 }}
          >
            {title}
          </p>
          {subtitle && (
            <p className="text-xs mt-1 leading-relaxed" style={{ color: isSuccess ? '#047857' : '#1d4ed8', margin: 0 }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function showEmailVerificationRequiredToast() {
  toast.custom(
    (t) => (
      <EmailVerificationToast
        visible={t.visible}
        variant="info"
        title="Confirme seu email"
        subtitle="Verifique sua caixa de entrada ou reenvie o link no perfil para acessar o trading."
      />
    ),
    { id: TOAST_ID, duration: 5000, position: 'top-right' },
  );
}

export function showEmailConfirmedToast() {
  toast.custom(
    (t) => (
      <EmailVerificationToast
        visible={t.visible}
        variant="success"
        title="Email confirmado!"
        subtitle="Faça login para continuar."
      />
    ),
    { id: 'email-confirmed', duration: 4500, position: 'top-right' },
  );
}

export function showVerificationEmailSentToast(magicLink: boolean) {
  toast.custom(
    (t) => (
      <EmailVerificationToast
        visible={t.visible}
        variant="info"
        title="Email enviado"
        subtitle={
          magicLink
            ? 'Abra o link que enviamos para concluir a verificação.'
            : 'Confira sua caixa de entrada e o spam.'
        }
      />
    ),
    { id: 'verification-email-sent', duration: 4500, position: 'top-right' },
  );
}
