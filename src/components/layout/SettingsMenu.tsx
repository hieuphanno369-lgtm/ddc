'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { signOut } from 'next-auth/react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import type { CurrentUser } from '@/lib/session';
import type { Role } from '@/server/repo/types';
import { nextActiveIndex } from '@/lib/list-nav';
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
    <div className="border-b border-sep">
      <button
        onClick={onToggle}
        role="menuitem"
        tabIndex={-1}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-caption2 font-bold uppercase tracking-[.06em] text-label3 hover:bg-fill"
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
  const [focusOnOpen, setFocusOnOpen] = useState<'first' | 'last'>('first');
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  useEffect(() => {
    const saved = (localStorage.getItem('ddc-theme') as Theme) || 'system';
    setTheme(saved);
    applyTheme(saved);
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) close(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Danh sach menuitem doc dong (Section co the dang mo/dong lam doi danh sach).
  const items = () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  useEffect(() => {
    if (!open) return;
    const list = items();
    (focusOnOpen === 'last' ? list.at(-1) : list[0])?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function toggleCat(key: CatKey) {
    setOpenCat((cur) => (cur === key ? null : key));
  }

  function choose(next: Theme) {
    setTheme(next);
    localStorage.setItem('ddc-theme', next);
    applyTheme(next);
    close(true);
  }

  function chooseLocale(next: (typeof LOCALES)[number]) {
    router.replace(pathname, { locale: next });
    close(true);
  }

  function logout() {
    signOut({ redirect: true, callbackUrl: '/login' });
  }

  const itemCls =
    'flex w-full items-center gap-2 px-3 py-2 text-footnote transition-colors duration-fast ease-std hover:bg-fill';
  const activeCls = 'text-brand font-semibold';
  const idleCls = 'text-label2';

  const configItems = CONFIG.filter((n) => n.roles.includes(user.role));

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        onClick={() => {
          setFocusOnOpen('first');
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setFocusOnOpen('first');
            setOpen(true);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFocusOnOpen('last');
            setOpen(true);
          }
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        className="rounded-sm p-2 text-label3 transition-colors duration-fast ease-std hover:bg-fill hover:text-label"
        title={t('settings.title')}
      >
        <IconConfig size={19} />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          ref={panelRef}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              const list = items();
              const i = list.indexOf(document.activeElement as HTMLElement);
              list[nextActiveIndex(i, e.key, list.length)]?.focus();
              e.preventDefault();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              close(true);
            } else if (e.key === 'Tab') {
              close(false);
            }
          }}
          className="mat mat-chrome absolute bottom-full right-0 z-50 mb-1 w-56 overflow-hidden rounded-md"
        >
          {/* User */}
          <div className="flex items-center gap-3 border-b border-sep px-3 py-3">
            <div className="avatar" style={{ width: 36, height: 36, flex: '0 0 36px' }}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-footnote font-medium text-label">{user.name}</div>
              <div className="text-caption2 text-label3">{t(ROLE_LABEL[user.role])}</div>
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
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => close(false)}
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
                role="menuitem"
                tabIndex={-1}
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
                role="menuitem"
                tabIndex={-1}
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
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                setShowPw(true);
                close(true);
              }}
              className={`${itemCls} text-label2`}
            >
              <IconUser size={16} />
              {t('auth.changePassword')}
            </button>
          </Section>

          <div className="pt-1">
            <button role="menuitem" tabIndex={-1} onClick={logout} className={`${itemCls} text-danger`}>
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
