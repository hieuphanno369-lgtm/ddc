import { getTranslations } from 'next-intl/server';

/** P3F-3 (Q1 = a): dải nhắc đầu trang cho admin khi có đăng ký chờ bật, cùng kiểu `RateReminder`. */
export async function SignupReminder({ locale, count }: { locale: string; count: number }) {
  const t = await getTranslations();
  return (
    <div className="sumbar" data-signup-reminder="">
      <span>
        {t('signup.reminder', { n: count })}{' '}
        <a href={`/${locale}/admin#dang-ky-cho`} className="font-semibold underline underline-offset-2">{t('signup.reminderLink')}</a>
      </span>
    </div>
  );
}
