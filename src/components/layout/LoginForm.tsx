'use client';

import { useRef, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { usePressable } from '@/components/ui/motion';

export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  // CS-3: nut dang nhap chinh - "nut quan trong" duoc gan usePressable (co
  // lai khi bam roi bat ve bang spring, dung engine motion.ts, Q4=(a)).
  const submitRef = useRef<HTMLButtonElement>(null);
  usePressable(submitRef);

  const inputCls = 'inp';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signIn('credentials', { redirect: false, email, password });
    if (res?.error) {
      setError(t('auth.invalidCredentials'));
      setBusy(false);
    } else {
      router.replace('/overview');
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="field">
          <span className="lb">{t('auth.email')}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@daidung.com.vn"
            required
            className={inputCls}
          />
        </div>
        <div className="field">
          <span className="lb">{t('auth.password')}</span>
          <PasswordInput value={password} onChange={setPassword} className={inputCls} required />
        </div>
        {error && (
          <p className="sumbar bad">{error}</p>
        )}
        <button
          ref={submitRef}
          type="submit"
          disabled={busy}
          className="btn w-full justify-center"
        >
          {t('auth.signIn')}
        </button>
      </form>

      {googleEnabled && (
        <>
          <div className="authsep">
            <span>{t('auth.or')}</span>
          </div>

          <button
            onClick={() => {
              setBusy(true);
              signIn('google', { callbackUrl: `/${locale}` });
            }}
            disabled={busy}
            className="btn ghost w-full justify-center"
          >
            <GoogleIcon />
            {t('auth.signInGoogle')}
          </button>
        </>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.49 12c0-.73.13-1.44.35-2.1V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
