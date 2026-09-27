'use client';

import dynamic from 'next/dynamic';

/**
 * Next 15 cấm `dynamic({ ssr: false })` trong Server Component: các chart/panel của trang Chi tiết dự án
 * nạp lười ở đây (client component), `page.tsx` (server) chỉ import lại.
 */
export const SCurve = dynamic(() => import('@/components/dashboard/charts').then((m) => m.SCurve), { ssr: false, loading: () => <div className="sk h-60" /> });
export const CountdownPanel = dynamic(() => import('@/components/project/CountdownPanel').then((m) => m.CountdownPanel), { ssr: false, loading: () => <div className="sk" style={{ width: 240, height: 88 }} /> });
export const ResourceBreakdownChart = dynamic(() => import('@/components/project/ResourceBreakdownChart').then((m) => m.ResourceBreakdownChart), { ssr: false, loading: () => <div className="sk h-60" /> });
export const WeeklyTrackingCard = dynamic(() => import('@/components/project/WeeklyTrackingCard').then((m) => m.WeeklyTrackingCard), { ssr: false, loading: () => <div className="sk h-60" /> });
export const KeyMilestoneChart = dynamic(() => import('@/components/project/KeyMilestoneChart').then((m) => m.KeyMilestoneChart), { ssr: false, loading: () => <div className="sk h-60" /> });
export const StageExplorer = dynamic(() => import('@/components/project/StageExplorer').then((m) => m.StageExplorer), { ssr: false, loading: () => <div className="sk h-60" /> });
export const SpiCpiLine = dynamic(() => import('@/components/dashboard/charts').then((m) => m.SpiCpiLine), { ssr: false, loading: () => <div className="sk h-60" /> });
export const ManpowerMonthChart = dynamic(
  () => import('@/components/project/ManpowerMonthChart').then((m) => m.ManpowerMonthChart),
  { ssr: false, loading: () => <div className="sk h-60" /> },
);
export const WeeklyManpowerStackChart = dynamic(
  () => import('@/components/project/WeeklyManpowerStackChart').then((m) => m.WeeklyManpowerStackChart),
  { ssr: false, loading: () => <div className="sk h-60" /> },
);
export const EquipmentPlanGantt = dynamic(
  () => import('@/components/project/EquipmentPlanGantt').then((m) => m.EquipmentPlanGantt),
  { ssr: false, loading: () => <div className="sk h-60" /> },
);
