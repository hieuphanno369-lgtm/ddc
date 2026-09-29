'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { IconAlert, IconArrowLeft, IconArrowRight, IconCheck, IconEye, IconEyeOff, IconMail } from '@/components/icons';
import { NutSpinner } from '@/components/ui/NutSpinner';
import s from './auth.module.css';
import { cx } from './cx';

/** Tiêu đề khối form: eyebrow + h1 + đoạn giới thiệu. `hideOnMobile` ẩn eyebrow và intro ở màn nhỏ (theo Mobile.dc.html). */
export function AuthHeading({
  eyebrow,
  title,
  intro,
  hideOnMobile = false,
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  hideOnMobile?: boolean;
}) {
  return (
    <div className={s.heading}>
      {eyebrow && <span className={cx(s.eyebrow, hideOnMobile && s.hideOnMobile)}>{eyebrow}</span>}
      <h1 className={s.title}>{title}</h1>
      {intro && <p className={cx(s.intro, hideOnMobile && s.hideOnMobile)}>{intro}</p>}
    </div>
  );
}

export function AuthField({
  id,
  label,
  children,
  aside,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className={s.field}>
      <div className={s.fieldHead}>
        <label htmlFor={id} className={s.label}>{label}</label>
        {aside}
      </div>
      {children}
    </div>
  );
}

export function AuthInput({
  dense = false,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { dense?: boolean }) {
  return <input {...props} className={cx(s.inp, dense && s.inpDense, className)} />;
}

export function AuthSelect({
  dense = false,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { dense?: boolean }) {
  return <select {...props} className={cx(s.inp, s.select, dense && s.inpDense, className)} />;
}

export function AuthPasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  placeholder,
  dense = false,
  required = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  placeholder?: string;
  dense?: boolean;
  required?: boolean;
}) {
  const t = useTranslations();
  const [show, setShow] = useState(false);
  return (
    <div className={s.pwWrap}>
      <AuthInput
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        dense={dense}
      />
      <button
        type="button"
        className={s.eye}
        onClick={() => setShow((v) => !v)}
        aria-label={show ? t('auth.hidePassword') : t('auth.showPassword')}
      >
        {show ? <IconEyeOff size={20} /> : <IconEye size={20} />}
      </button>
    </div>
  );
}

export function AuthPrimaryButton({
  busy,
  busyLabel,
  children,
  arrow = false,
  ref,
}: {
  busy: boolean;
  busyLabel: string;
  children: React.ReactNode;
  arrow?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type="submit"
      className={cx(s.btn, s.btnPrimary)}
      disabled={busy}
      aria-busy={busy ? 'true' : undefined}
    >
      {busy ? (
        <>
          <NutSpinner size={20} />
          {busyLabel}
        </>
      ) : (
        <>
          {children}
          {arrow && <IconArrowRight size={18} strokeWidth={2} className={s.arr} />}
        </>
      )}
    </button>
  );
}

/** Nút phụ nền nhạt. Có `href` thì là liên kết trông như nút. */
export function AuthGhostButton({
  href,
  children,
  ...props
}: { href?: string; children: React.ReactNode } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className'>) {
  if (href) {
    return (
      <Link href={href} className={cx(s.btn, s.btnGhost)}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" {...props} className={cx(s.btn, s.btnGhost)}>
      {children}
    </button>
  );
}

export function GoogleButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  const t = useTranslations();
  return (
    <AuthGhostButton onClick={onClick} disabled={busy}>
      {busy ? <NutSpinner size={18} /> : <GoogleLogo />}
      {t('authPage.continueGoogle')}
    </AuthGhostButton>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function AuthDivider({ label }: { label: string }) {
  return <div className={s.divider}><span>{label}</span></div>;
}

const NOTICE = {
  error: { cls: s.noticeError, Icon: IconAlert, role: 'alert' },
  info: { cls: s.noticeInfo, Icon: IconMail, role: 'status' },
  success: { cls: s.noticeSuccess, Icon: IconCheck, role: 'status' },
} as const;

export function AuthNotice({
  tone,
  children,
}: {
  tone: 'error' | 'info' | 'success';
  children: React.ReactNode;
}) {
  const { cls, Icon, role } = NOTICE[tone];
  return (
    <div className={cx(s.notice, cls)} role={role} data-auth={`notice-${tone}`}>
      <Icon size={18} />
      <span>{children}</span>
    </div>
  );
}

/** Liên kết chữ 600 13px; vùng bấm nới lên 44px bằng padding dọc + margin âm (không đổi bố cục). */
export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className={s.link}>{children}</Link>;
}

/** Liên kết "quay lại" có mũi tên trái. */
export function AuthBackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={cx(s.link, s.linkBack)}>
      <IconArrowLeft size={16} strokeWidth={2} />
      {children}
    </Link>
  );
}

/** Ô vuông 56x56 nền nút chính chứa icon vàng (màn "Kiểm tra hộp thư", "Chào mừng"). */
export function AuthIconTile({ children }: { children: React.ReactNode }) {
  return <div className={s.iconTile}>{children}</div>;
}
