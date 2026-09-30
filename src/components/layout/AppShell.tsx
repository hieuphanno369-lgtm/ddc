'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { SidebarBrandProvider, useSidebarBrand } from './SidebarBrand';
import type { CurrentUser } from '@/lib/session';
import type { Role } from '@/server/repo/types';
import { computeSearchNavParams } from '@/lib/search-box-nav';
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
  IconPlus,
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
  { href: '/ho-so-du-an', labelKey: 'projectForm.nav', icon: IconPlus, roles: ['admin', 'data-entry'] },
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

/**
 * Khoi ten app tren sidebar. Trang Chi tiet du an (7.10): dong dam = ten du an, dong mo = ma du an;
 * key theo ma de doi du an thi phan tu mount lai -> hieu ung chay lai (globals.css .nm.is-project).
 */
function BrandText() {
  const t = useTranslations();
  const project = useSidebarBrand();
  if (project) {
    return (
      <div key={project.code} className="nm is-project">
        <b title={project.name}>{project.name}</b>
        <span>{project.code}</span>
      </div>
    );
  }
  return (
    <div className="nm">
      {/* P7-C1 (5.4, fallback): "MANAGEMENT REPORTS" (en) xuong 2 dong o co chu goc (13px) -
          giam xuong var(--t-caption1) (12px), ap cho CA 2 locale de nhat quan. */}
      <b style={{ fontSize: 'var(--t-caption1)' }}>{t('app.headerTitle')}</b>
      <span>{t('app.name')}</span>
    </div>
  );
}

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

  function renderNavItem(item: NavItem) {
    const active = pathname === item.href || pathname.startsWith(item.href + '/');
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={item.href}
        title={t(item.labelKey)}
        onClick={() => setOpen(false)}
        className={`nav${active ? ' on' : ''}`}
      >
        <Icon size={19} />
        <span className="truncate">{t(item.labelKey)}</span>
      </Link>
    );
  }

  return (
    <SidebarBrandProvider>
    <div className="app">
      <TopProgressBar />
      <SyncProgressBar />
      {/* Sidebar */}
      <aside className={`side ${collapsed ? 'is-collapsed' : ''} ${open ? 'is-open' : ''}`}>
        <div className="brand">
          <div className="appicon is-brand overflow-hidden">
            <Image src="/logo.png" alt="DDC" width={38} height={38} className="h-full w-full object-cover" />
          </div>
          <BrandText />
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <nav className="space-y-1">{navItems.map(renderNavItem)}</nav>

          {operationsItems.length > 0 && (
            <>
              <div className="sgrp">{t('nav.operations')}</div>
              <nav className="space-y-1">{operationsItems.map(renderNavItem)}</nav>
            </>
          )}

          {adminItems.length > 0 && (
            <>
              <div className="sgrp">{t('nav.administration')}</div>
              <nav className="space-y-1">{adminItems.map(renderNavItem)}</nav>
            </>
          )}
        </div>

        <div className="foot flex items-center justify-between">
          <p>{t('app.builtBy')}</p>
          <SettingsMenu user={user} />
        </div>
      </aside>

      {open && <div className="side-scrim" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="main">
        <header className="topbar">
          <button
            onClick={() => (typeof window !== 'undefined' && window.innerWidth >= 1024 ? setCollapsed((v) => !v) : setOpen((v) => !v))}
            className="nav"
            style={{ width: 'auto', padding: '6px' }}
            aria-label={t('common.filter')}
          >
            {open ? <IconClose size={20} /> : <IconMenu size={20} />}
          </button>
          <div className="ttl">
            <h1>{pageTitle}</h1>
          </div>
          <SearchBox />
          <div className="flex shrink-0 items-center gap-2.5">
            <div className="avatar">{user.name.charAt(0).toUpperCase()}</div>
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-caption1 text-label">{user.name}</div>
              <div className="text-caption2 font-semibold text-brand">{t(ROLE_LABEL[user.role])}</div>
            </div>
          </div>
        </header>
        <main className="page">{children}</main>
      </div>
    </div>
    </SidebarBrandProvider>
  );
}

function SearchBox() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [v, setV] = useState(searchParams.get('search') ?? '');
  useEffect(() => {
    const id = setTimeout(() => {
      const qs = computeSearchNavParams(searchParams.toString(), v);
      if (qs === null) return; // không có gì thay đổi thật -> không đụng URL (bug 3.16)
      router.replace(qs ? `?${qs}` : '?', { scroll: false });
    }, 300);
    return () => clearTimeout(id);
  }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="search hidden md:flex">
      <IconSearch size={15} className="shrink-0" />
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder={t('common.searchProject')} />
    </div>
  );
}
