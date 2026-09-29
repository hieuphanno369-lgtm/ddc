'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';
import { IconCheck } from '@/components/icons';
import { Link, useRouter } from '@/i18n/navigation';
import { SIGNUP_NAME_MAX, SIGNUP_PASSWORD_MAX, SIGNUP_PASSWORD_MIN } from '@/lib/login-policy';
import { isCompanyEmail } from '@/lib/signup-policy';
import { submitSignupAction } from '@/server/actions-signup';
import s from './auth.module.css';
import { cx } from './cx';
import {
  AuthDivider,
  AuthField,
  AuthGhostButton,
  AuthHeading,
  AuthIconTile,
  AuthInput,
  AuthLink,
  AuthNotice,
  AuthPasswordInput,
  AuthPrimaryButton,
  AuthSelect,
  GoogleButton,
} from './parts';
import { PasswordStrength } from './PasswordStrength';

type FieldErrors = { name?: string; department?: string; email?: string; password?: string };

/**
 * P3F-3 - form đăng ký (chờ admin bật). Kiểm ở form chỉ là lớp phụ: server (`requestSignup`) kiểm lại toàn bộ.
 * Mật khẩu chỉ nằm trong state React, xoá ngay khi gửi xong; không vào URL, log hay localStorage.
 */
export function SignupForm({
  departments,
  googleEnabled,
}: {
  departments: { id: number; name: string }[];
  googleEnabled: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const hasDepartments = departments.length > 0;

  function validateLocal(): FieldErrors {
    const next: FieldErrors = {};
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > SIGNUP_NAME_MAX) next.name = t('signup.nameError');
    if (hasDepartments && !departmentId) next.department = t('signup.departmentError');
    if (!isCompanyEmail(email)) next.email = t('signup.emailDomainError');
    if (password.length < SIGNUP_PASSWORD_MIN) next.password = t('auth.passwordTooShort');
    else if (password.length > SIGNUP_PASSWORD_MAX) next.password = t('signup.passwordTooLong');
    return next;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setGeneral(null);
    const local = validateLocal();
    setErrors(local);
    if (Object.keys(local).length > 0) return;

    setBusy(true);
    const res = await submitSignupAction({
      name,
      departmentId: hasDepartments ? Number(departmentId) : null,
      email,
      password,
      locale,
    });
    if (res.status === 'accepted') {
      setPassword('');
      setDone(true);
      return;
    }
    setBusy(false);
    if (res.status === 'rate_limited') {
      setPassword('');
      setGeneral(t('signup.rateLimited'));
      return;
    }
    // invalid: hiện đúng ô. Phòng ban đổi giữa chừng (ẩn/thêm phòng ban đầu tiên) thì tải lại danh sách.
    if (res.field === 'department') {
      setDepartmentId('');
      setGeneral(t('signup.departmentChanged'));
      router.refresh();
    } else if (res.field === 'name') setErrors({ name: t('signup.nameError') });
    else if (res.field === 'email_domain') setErrors({ email: t('signup.emailDomainError') });
    else if (res.field === 'too_short') setErrors({ password: t('auth.passwordTooShort') });
    else setErrors({ password: t('signup.passwordTooLong') });
  }

  if (done) {
    return (
      <div className={s.stack20} data-auth="signup-done">
        <AuthIconTile>
          <IconCheck size={26} />
        </AuthIconTile>
        <div className={s.heading}>
          <h1 className={s.title}>{t('signup.doneTitle')}</h1>
          <p className={s.intro}>{t('signup.doneBody')}</p>
        </div>
        <AuthGhostButton href="/login">{t('authSecurity.backToLogin')}</AuthGhostButton>
      </div>
    );
  }

  const nameField = (
    <AuthField id="signup-name" label={t('signup.fullName')}>
      <AuthInput
        id="signup-name"
        dense
        autoComplete="name"
        maxLength={SIGNUP_NAME_MAX}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('signup.namePlaceholder')}
        aria-invalid={errors.name ? true : undefined}
        aria-describedby={errors.name ? 'signup-name-error' : undefined}
      />
      {errors.name && <span id="signup-name-error" className={s.fieldError}>{errors.name}</span>}
    </AuthField>
  );

  return (
    <form onSubmit={submit} className={s.form} noValidate>
      <AuthHeading eyebrow={t('signup.eyebrow')} title={t('signup.title')} intro={t('signup.intro')} />

      {googleEnabled && (
        <>
          <GoogleButton
            busy={busy}
            onClick={() => {
              setBusy(true);
              signIn('google', { callbackUrl: `/${locale}` });
            }}
          />
          <AuthDivider label={t('authPage.orEmail')} />
        </>
      )}

      {hasDepartments ? (
        <div className={s.grid2}>
          {nameField}
          <AuthField id="signup-department" label={t('signup.department')}>
            <AuthSelect
              id="signup-department"
              dense
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              aria-invalid={errors.department ? true : undefined}
              aria-describedby={errors.department ? 'signup-department-error' : undefined}
            >
              <option value="">{t('signup.departmentPlaceholder')}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </AuthSelect>
            {errors.department && <span id="signup-department-error" className={s.fieldError}>{errors.department}</span>}
          </AuthField>
        </div>
      ) : (
        nameField
      )}

      <AuthField id="signup-email" label={t('signup.companyEmail')}>
        <AuthInput
          id="signup-email"
          dense
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('authPage.emailPlaceholder')}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby="signup-email-note"
        />
        <span id="signup-email-note" className={errors.email ? s.fieldError : s.hint}>
          {errors.email ?? t('signup.emailHint')}
        </span>
      </AuthField>

      <div className={s.field}>
        <AuthField id="signup-password" label={t('auth.password')}>
          <AuthPasswordInput
            id="signup-password"
            dense
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            placeholder={t('signup.passwordPlaceholder')}
          />
          {errors.password && <span className={s.fieldError} role="alert">{errors.password}</span>}
        </AuthField>
        <PasswordStrength value={password} />
      </div>

      {general && <AuthNotice tone="error">{general}</AuthNotice>}

      <AuthPrimaryButton busy={busy} busyLabel={t('authPage.sending')} arrow>
        {t('signup.submit')}
      </AuthPrimaryButton>

      <p className={s.terms}>
        {t.rich('signup.terms', { link: (chunks) => <Link href="/dieu-khoan" className={s.link}>{chunks}</Link> })}
      </p>
      <p className={cx(s.linkRow)}>
        {t('signup.haveAccount')} <AuthLink href="/login">{t('auth.signIn')}</AuthLink>
      </p>
    </form>
  );
}
