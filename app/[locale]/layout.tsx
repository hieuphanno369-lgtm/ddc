import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import { routing } from '@/i18n/routing';
import { NONCE_HEADER } from '@/lib/security-headers';
import '../tokens.css';
import '../globals.css';

const inter = Inter({ subsets: ['latin', 'vietnamese'], variable: '--font-inter', display: 'swap' });

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return {
    title: `${t('app.headerTitle')} - ${t('app.name')}`,
    icons: { icon: '/favicon.svg' },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  const messages = await getMessages();
  // Nonce CSP do middleware sinh mỗi request (P5-B), để script chọn giao diện chạy được khi CSP có nonce.
  const nonce = (await headers()).get(NONCE_HEADER) ?? undefined;
  return (
    <html lang={locale} className={inter.variable} suppressHydrationWarning>
      <head>
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('ddc-theme')||'system';var r=document.documentElement;if(t==='light'||t==='dark'){r.setAttribute('data-theme',t)}else{r.removeAttribute('data-theme')}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-sans">
        <div className="wall" aria-hidden="true"><b/><b/><b/><b/></div>
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
