import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import authStyles from '@/components/auth/auth.module.css';
import styles from '@/components/auth/terms.module.css';
import { AuthBrand } from '@/components/auth/AuthBrand';
import { AuthBackLink, AuthLink } from '@/components/auth/parts';
import { cx } from '@/components/auth/cx';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: t('terms.title') };
}

/**
 * P3F-3 - Điều khoản sử dụng. Công khai và TĨNH: không đọc dữ liệu dự án, không gọi `requireUser`
 * (xem `middleware.ts` `PUBLIC_PATHS`). Nội dung là bản nháp chờ chủ dự án duyệt.
 */
export default async function TermsPage() {
  const t = await getTranslations();
  const sections = [
    { title: t('terms.s1Title'), body: t('terms.s1Body') },
    { title: t('terms.s2Title'), body: t('terms.s2Body') },
    { title: t('terms.s3Title'), body: t('terms.s3Body') },
    { title: t('terms.s4Title'), body: t('terms.s4Body') },
    { title: t('terms.s5Title'), body: t('terms.s5Body') },
    { title: t('terms.s6Title'), body: t('terms.s6Body') },
  ];

  return (
    <div className={authStyles.shell} data-auth="terms-shell">
      <main className={cx(authStyles.glass, styles.card)} data-auth="terms-card">
        <AuthBrand size="sm" />
        <h1 className={styles.title}>{t('terms.title')}</h1>
        <p className={styles.updated}>{t('terms.updated')}</p>
        <p className={styles.intro}>{t('terms.intro')}</p>
        {sections.map((s) => (
          <section key={s.title} className={styles.section}>
            <h2 className={styles.sectionTitle}>{s.title}</h2>
            <p className={styles.sectionBody}>{s.body}</p>
          </section>
        ))}
        <div className={styles.links}>
          <AuthBackLink href="/login">{t('authSecurity.backToLogin')}</AuthBackLink>
          <AuthLink href="/dang-ky">{t('authPage.createAccount')}</AuthLink>
        </div>
      </main>
    </div>
  );
}
