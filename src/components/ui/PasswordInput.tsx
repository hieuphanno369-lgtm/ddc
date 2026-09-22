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

  const colors = ['bg-slate-200', 'bg-red-500', 'bg-amber-500', 'bg-emerald-500'];
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
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
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
                className={`h-1 w-6 rounded-full ${i <= strength ? colors[strength] : 'bg-slate-200 dark:bg-slate-700'}`}
              />
            ))}
          </div>
          <span className="text-[11px] text-slate-500">{t(`auth.${labels[strength]}`)}</span>
        </div>
      )}
    </div>
  );
}
