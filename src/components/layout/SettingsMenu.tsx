'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { signOut } from 'next-auth/react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import type { CurrentUser } from '@/lib/session';
import type { Role } from '@/server/repo/types';
import {
  IconAdmin,
  IconBook,
  IconChevronDown,
  IconConfig,
  IconGear,
  IconGlobe,
  IconLogout,
  IconMoon,
  IconSchema,
  IconSun,
  IconUpload,
  IconUser,
} from '@/components/icons';
import { ChangePasswordModal } from './ChangePasswordModal';

type Theme = 'light' | 'dark' | 'system';

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
  else root.removeAttribute('data-theme');
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', dark); // di san, Task 12 xoa
  window.dispatchEvent(new Event('ddc:theme')); // chart doc lai mau token
}

const THEMES = [
  { key: 'light', icon: IconSun },
  { key: 'dark', icon: IconMoon },
  { key: 'system', icon: IconGear },
] as const;

const LOCALES = ['vi', 'en'] as const;

const ROLE_LABEL: Record<Role, string> = {
  admin: 'role.admin',
  bod: 'role.bod',
  'data-entry': 'role.dataEntry',
  viewer: 'role.viewer',
};

interface ConfigItem {
  href: string;
  labelKey: string;
  icon: (p: { size?: number; className?: string }) => React.ReactNode;
  roles: Role[];
}

const CONFIG: ConfigItem[] = [
  { href: '/admin', labelKey: 'nav.admin', icon: IconAdmin, roles: ['admin'] },
  { href: '/data-dictionary', labelKey: 'nav.dataDictionary', icon: IconBook, roles: ['admin', 'bod', 'data-entry', 'viewer'] },
  { href: '/data-schema', labelKey: 'nav.dataSchema', icon: IconSchema, roles: ['admin', 'data-entry'] },
  { href: '/import', labelKey: 'nav.import', icon: IconUpload, roles: ['admin', 'data-entry'] },
];

type CatKey = 'config' | 'theme' | 'language' | 'user';

function Section({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-slate-100 dark:border-slate-700">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium uppercase text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
      >
        <span className="flex-1 text-left">{label}</span>
        <IconChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="pb-1">{children}</div>}
    </div>
  );
}

export function SettingsMenu({ user }: { user: CurrentUser }) {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>('system');
  const [open, setOpen] = useState(false);
  const [openCat, setOpenCat] = useState<CatKey | null>(null);
  const [showPw, setShowPw] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = (localStorage.getItem('ddc-theme') as Theme) || 'system';
    setTheme(saved);
    applyTheme(saved);
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  function toggleCat(key: CatKey) {
    setOpenCat((cur) => (cur === key ? null : key));
  }

  function choose(next: Theme) {
    setTheme(next);
    localStorage.setItem('ddc-theme', next);
    applyTheme(next);
    setOpen(false);
  }

  function chooseLocale(next: (typeof LOCALES)[number]) {
    router.replace(pathname, { locale: next });
    setOpen(false);
  }

  function logout() {
    signOut({ redirect: true, callbackUrl: '/login' });
  }

  const itemCls = 'flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700';
  const activeCls = 'text-accent';
  const idleCls = 'text-navy-800 dark:text-slate-200';

  const configItems = CONFIG.filter((n) => n.roles.includes(user.role));

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg p-2 text-navy-300 hover:bg-white/10 hover:text-white"
        title={t('settings.title')}
      >
        <IconConfig size={19} />
      </button>

      {open && (
        <div className="absolute bottom-full right-0 z-50 mb-1 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {/* User */}
          <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-3 dark:border-slate-700">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-800 text-sm font-semibold text-white">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-navy-900 dark:text-slate-100">{user.name}</div>
              <div className="text-[11px] text-slate-500">{t(ROLE_LABEL[user.role])}</div>
            </div>
          </div>

          {/* CONFIG */}
          <Section label={t('settings.config')} open={openCat === 'config'} onToggle={() => toggleCat('config')}>
            {configItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`${itemCls} ${active ? activeCls : idleCls}`}
                >
                  <Icon size={16} />
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </Section>

          {/* THEME */}
          <Section label={t('settings.theme')} open={openCat === 'theme'} onToggle={() => toggleCat('theme')}>
            {THEMES.map(({ key, icon: Icon }) => (
              <button
                key={key}
                onClick={() => choose(key)}
                className={`${itemCls} ${theme === key ? activeCls : idleCls}`}
              >
                <Icon size={16} />
                {t(`settings.${key}`)}
                {theme === key && <span className="ml-auto text-xs">✓</span>}
              </button>
            ))}
          </Section>

          {/* LANGUAGE */}
          <Section label={t('settings.language')} open={openCat === 'language'} onToggle={() => toggleCat('language')}>
            {LOCALES.map((l) => (
              <button
                key={l}
                onClick={() => chooseLocale(l)}
                className={`${itemCls} ${locale === l ? activeCls : idleCls}`}
              >
                <IconGlobe size={16} />
                {t(`settings.locale.${l}`)}
                {locale === l && <span className="ml-auto text-xs">✓</span>}
              </button>
            ))}
          </Section>

          {/* USER */}
          <Section label={t('settings.user')} open={openCat === 'user'} onToggle={() => toggleCat('user')}>
            <button
              onClick={() => {
                setShowPw(true);
                setOpen(false);
              }}
              className={`${itemCls} text-navy-800 dark:text-slate-200`}
            >
              <IconUser size={16} />
              {t('auth.changePassword')}
            </button>
          </Section>

          <div className="pt-1">
            <button onClick={logout} className={`${itemCls} text-red-600 dark:text-red-400`}>
              <IconLogout size={16} />
              {t('auth.signOut')}
            </button>
          </div>
        </div>
      )}

      {showPw && <ChangePasswordModal onClose={() => setShowPw(false)} />}
    </div>
  );
}
