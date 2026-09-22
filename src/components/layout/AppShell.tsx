'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import type { CurrentUser } from '@/lib/session';
import type { Role } from '@/server/repo/types';
import { SettingsMenu } from './SettingsMenu';
import { TopProgressBar } from './TopProgressBar';
import { SyncProgressBar } from './SyncProgressBar';
import {
  IconAdmin,
  IconBell,
  IconBook,
  IconChecklist,
  IconClose,
  IconDataEntry,
  IconHistory,
  IconMenu,
  IconOverview,
  IconProject,
  IconReport,
  IconSchema,
  IconSearch,
  IconUpload,
} from '@/components/icons';

interface NavItem {
  href: string;
  labelKey: string;
  icon: (p: { size?: number; className?: string }) => React.ReactNode;
  roles: Role[];
}

const NAV: NavItem[] = [
  { href: '/overview', labelKey: 'nav.overview', icon: IconOverview, roles: ['admin', 'bod', 'viewer'] },
  { href: '/projects', labelKey: 'nav.projectDetail', icon: IconProject, roles: ['admin', 'bod', 'viewer', 'data-entry'] },
  { href: '/nhap-lieu', labelKey: 'nav.dataEntry', icon: IconDataEntry, roles: ['admin', 'data-entry'] },
];

const OPERATIONS_NAV: NavItem[] = [
  { href: '/report', labelKey: 'nav.report', icon: IconReport, roles: ['admin', 'bod'] },
  { href: '/alerts', labelKey: 'nav.alerts', icon: IconBell, roles: ['admin', 'bod'] },
  { href: '/compliance', labelKey: 'nav.compliance', icon: IconChecklist, roles: ['admin', 'bod'] },
];

const ADMIN_NAV: NavItem[] = [
  { href: '/audit', labelKey: 'nav.audit', icon: IconHistory, roles: ['admin'] },
  { href: '/import', labelKey: 'nav.import', icon: IconUpload, roles: ['admin'] },
  { href: '/data-dictionary', labelKey: 'nav.dataDictionary', icon: IconBook, roles: ['admin'] },
  { href: '/data-schema', labelKey: 'nav.dataSchema', icon: IconSchema, roles: ['admin'] },
  { href: '/admin', labelKey: 'nav.admin', icon: IconAdmin, roles: ['admin'] },
];

const ROLE_LABEL: Record<Role, string> = {
  admin: 'role.admin',
  bod: 'role.bod',
  'data-entry': 'role.dataEntry',
  viewer: 'role.viewer',
};

export function AppShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  const t = useTranslations();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const navItems = NAV.filter((n) => n.roles.includes(user.role));
  const operationsItems = OPERATIONS_NAV.filter((n) => n.roles.includes(user.role));
  const adminItems = ADMIN_NAV.filter((n) => n.roles.includes(user.role));

  const allNav = [...NAV, ...OPERATIONS_NAV, ...ADMIN_NAV];
  const activeNav = allNav.find((n) => pathname === n.href || pathname.startsWith(n.href + '/'));
  const pageTitle = activeNav ? t(activeNav.labelKey) : t('app.headerTitle');

  const navItemCls = `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
    collapsed ? 'lg:justify-center' : ''
  }`;

  function renderNavItem(item: NavItem) {
    const active = pathname === item.href || pathname.startsWith(item.href + '/');
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        title={t(item.labelKey)}
        onClick={() => setOpen(false)}
        className={`${navItemCls} ${active ? 'bg-white/15 text-gold' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
      >
        <Icon size={20} className="shrink-0" />
        <span className={`truncate ${collapsed ? 'lg:hidden' : ''}`}>{t(item.labelKey)}</span>
      </Link>
    );
  }

  return (
    <div className="flex min-h-screen">
      <TopProgressBar />
      <SyncProgressBar />
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-[#B91C1C] text-white transition-[width,transform] duration-200 ease-out ${
          collapsed ? 'lg:w-[68px]' : 'lg:w-60'
        } ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className={`flex h-16 items-center gap-3 border-b border-white/10 px-5 ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/95">
            <Image src="/logo.png" alt="DDC" width={40} height={40} className="h-full w-full object-cover" />
          </div>
          <div className={`min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
            <div className="truncate text-sm font-semibold leading-tight">{t('app.headerTitle')}</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <nav className="space-y-1 px-3 py-4">
            {navItems.map(renderNavItem)}
          </nav>

          {operationsItems.length > 0 && (
            <div className="mt-2 border-t border-white/10 pt-3">
              <p className={`px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-white/50 ${collapsed ? 'lg:hidden' : ''}`}>
                {t('nav.operations')}
              </p>
              <nav className="space-y-1 px-3 pb-3">{operationsItems.map(renderNavItem)}</nav>
            </div>
          )}

          {adminItems.length > 0 && (
            <div className="mt-2 border-t border-white/10 pt-3">
              <p className={`px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-white/50 ${collapsed ? 'lg:hidden' : ''}`}>
                {t('nav.administration')}
              </p>
              <nav className="space-y-1 px-3 pb-3">{adminItems.map(renderNavItem)}</nav>
            </div>
          )}
        </div>

        <div className={`flex items-center justify-between border-t border-white/10 px-5 py-4 ${collapsed ? 'lg:justify-center lg:px-0' : ''}`}>
          <p className={`text-[11px] text-yellow-200/70 ${collapsed ? 'lg:hidden' : ''}`}>{t('app.builtBy')}</p>
          <SettingsMenu user={user} />
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-30 bg-navy-950/40 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Main */}
      <div className={`flex min-h-screen w-full flex-col transition-[padding] duration-200 ${collapsed ? 'lg:pl-[68px]' : 'lg:pl-60'}`}>
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 bg-[#B91C1C] px-4 text-white shadow-md sm:px-6">
          <button
            onClick={() => (typeof window !== 'undefined' && window.innerWidth >= 1024 ? setCollapsed((v) => !v) : setOpen((v) => !v))}
            className="rounded-lg p-2 text-white hover:bg-white/15"
            aria-label={t('common.filter')}
          >
            {open ? <IconClose size={20} /> : <IconMenu size={20} />}
          </button>
          <h1 className="truncate text-base font-bold tracking-tight text-white">{pageTitle}</h1>
          <SearchBox />
          <div className="ml-auto flex shrink-0 items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-white/20 text-xs font-bold text-white">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="hidden text-right leading-tight sm:block">
              <div className="truncate text-xs font-medium text-white">{user.name}</div>
              <div className="text-[11px] font-semibold text-gold">{t(ROLE_LABEL[user.role])}</div>
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

function SearchBox() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [v, setV] = useState(searchParams.get('search') ?? '');
  useEffect(() => {
    const id = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (!v) params.delete('search');
      else params.set('search', v);
      params.delete('page');
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : '?', { scroll: false });
    }, 300);
    return () => clearTimeout(id);
  }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="mx-auto hidden w-full max-w-md items-center gap-2 rounded-[10px] border border-white/25 bg-white/15 px-3 py-2 text-white/70 md:flex">
      <IconSearch size={15} className="text-white/60" />
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={t('common.searchProject')}
        className="w-full bg-transparent text-sm text-white placeholder:text-white/55 focus:outline-none"
      />
    </div>
  );
}
// TODO: Cần kiểm tra lại đoạn logic này
