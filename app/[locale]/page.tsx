import { redirect } from 'next/navigation';
import { getCurrentUser, homeForRole } from '@/lib/session';

export default async function RootPage({ params: { locale } }: { params: { locale: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);
  redirect(`/${locale}${homeForRole(user.role)}`);
}
