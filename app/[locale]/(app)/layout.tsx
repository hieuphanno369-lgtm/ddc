import { requireUser } from '@/lib/require-user';
import { currentMonth } from '@/lib/clock';
import { missingRateCurrencies } from '@/lib/fx';
import { repo } from '@/server/repo';
import { runDueJobs } from '@/server/jobs';
import { AppShell } from '@/components/layout/AppShell';
import { RateReminder } from '@/components/layout/RateReminder';
import { TopProgressBar } from '@/components/layout/TopProgressBar';

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const user = await requireUser(locale);

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
