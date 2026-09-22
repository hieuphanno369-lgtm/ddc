import Image from 'next/image';
import { redirect } from 'next/navigation';
import { getCurrentUser, homeForRole } from '@/lib/session';
import { LoginForm } from '@/components/layout/LoginForm';

export default async function LoginPage({ params: { locale } }: { params: { locale: string } }) {
  const user = await getCurrentUser();
  if (user) redirect(`/${locale}${homeForRole(user.role)}`);

  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#B91C1C] p-4">
      <div className="w-full max-w-sm rounded-[20px] border border-slate-200/70 bg-white/70 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-navy-50">
            <Image src="/logo.png" alt="DDC" width={64} height={64} className="h-full w-full object-cover" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-navy-900">DDC Control Tower</h1>
        </div>
        <LoginForm googleEnabled={googleEnabled} />
        <p className="mt-6 text-center text-[11px] text-slate-400">Built by Buffalo Tech</p>
      </div>
    </div>
  );
}
