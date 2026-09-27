import { redirect } from 'next/navigation';
import { getCurrentUser, homeForRole } from '@/lib/session';

export default async function RootPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  redirect(`/${locale}${homeForRole(user.role)}`);
}
