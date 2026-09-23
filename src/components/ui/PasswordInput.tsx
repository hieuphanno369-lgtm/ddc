'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { IconEye, IconEyeOff } from '@/components/icons';
import { passwordStrength } from '@/lib/password';

export function PasswordInput({
  value,
  onChange,
  placeholder,
  className,
  showStrength = false,
  required = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  showStrength?: boolean;
  required?: boolean;
}) {
  const t = useTranslations();
  const [show, setShow] = useState(false);
  const strength = showStrength ? passwordStrength(value) : 0;

  const colors = ['var(--fill-2)', 'var(--danger)', 'var(--warn)', 'var(--ok)'];
  const labels = ['', 'strengthWeak', 'strengthMedium', 'strengthStrong'];

  return (
    <div>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={`${className} pr-10`}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-label3 transition-colors duration-fast hover:text-label"
          aria-label={show ? t('auth.hidePassword') : t('auth.showPassword')}
        >
          {show ? <IconEyeOff size={16} /> : <IconEye size={16} />}
        </button>
      </div>
      {showStrength && value.length > 0 && (
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex gap-1">
            {[1, 2, 3].map((i) => (
              <span
                key={i}
                className="h-1 w-6 rounded-full"
                style={{ background: i <= strength ? colors[strength] : 'var(--fill-2)' }}
              />
            ))}
          </div>
          <span className="text-caption2 text-label2">{t(`auth.${labels[strength]}`)}</span>
        </div>
      )}
    </div>
  );
}
