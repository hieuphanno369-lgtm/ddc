import { redirect } from 'next/navigation';
import { getCurrentUser, homeForRole } from '@/lib/session';
import { AuthCard } from '@/components/auth/AuthCard';
import { LoginForm } from '@/components/auth/LoginForm';

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

  return (
    <AuthCard width={452}>
      <LoginForm googleEnabled={googleEnabled} initialError={initialError} />
    </AuthCard>
  );
}
