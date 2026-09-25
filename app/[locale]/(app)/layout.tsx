import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/session';
import { currentMonth } from '@/lib/clock';
import { missingRateCurrencies } from '@/lib/fx';
import { repo } from '@/server/repo';
import { runDueJobs } from '@/server/jobs';
import { AppShell } from '@/components/layout/AppShell';
import { RateReminder } from '@/components/layout/RateReminder';
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

  void runDueJobs('lazy'); // K4: chay job "luoi" khi co nguoi mo app - KHONG await.

  const missing = user.role === 'admin' ? missingRateCurrencies(await repo.getExchangeRates(), currentMonth()) : [];

  return (
    <>
      <TopProgressBar />
      <AppShell user={user}>
        {missing.length > 0 && <RateReminder locale={locale} month={currentMonth()} currencies={missing} />}
        {children}
      </AppShell>
    </>
  );
}
