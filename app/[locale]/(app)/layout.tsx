import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { AppShell } from '@/components/layout/AppShell';
import { TopProgressBar } from '@/components/layout/TopProgressBar';

export default async function AppLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  return (
    <>
      <TopProgressBar />
      <AppShell user={user}>
        {children}
      </AppShell>
    </>
  );
}
