import Image from 'next/image';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser, homeForRole } from '@/lib/session';
import { LoginForm } from '@/components/layout/LoginForm';

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(`/${locale}${homeForRole(user.role)}`);

  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const initialError = sp.error === 'AccessDenied' ? 'googleDenied' : null;
  const t = await getTranslations();

  return (
    <div className="authwrap">
      <div className="authcard">
        <div className="brandbox">
          {/* Q1=(b): logo.png do that tren nen trang, khong dung glyph navy cua .appicon mock-up */}
          <div className="appicon is-brand overflow-hidden" style={{ width: 56, height: 56, flex: '0 0 56px' }}>
            <Image src="/logo.png" alt="DDC" width={56} height={56} className="h-full w-full object-cover" />
          </div>
          <h1>{t('app.headerTitle')}</h1>
          <p>{t('app.subtitle')}</p>
        </div>
        <LoginForm googleEnabled={googleEnabled} initialError={initialError} />
        <p className="hintline" style={{ textAlign: 'center', marginTop: 22 }}>
          Built by Buffalo Tech
        </p>
      </div>
    </div>
  );
}
