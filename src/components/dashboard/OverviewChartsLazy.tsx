'use client';

import dynamic from 'next/dynamic';
import { CardSkeleton } from '@/components/ui/Skeleton';

/**
 * Next 15 cấm `dynamic({ ssr: false })` trong Server Component: các chart Recharts của trang
 * Tổng quan nạp lười ở đây (client component), OverviewWidgets.tsx (server) chỉ import lại.
 */
export const CapacityBar = dynamic(() => import('./charts').then((m) => m.CapacityBar), { ssr: false, loading: () => <CardSkeleton h={220} /> });
export const SCurve = dynamic(() => import('./charts').then((m) => m.SCurve), { ssr: false, loading: () => <CardSkeleton h={240} /> });
export const SpiCpiLine = dynamic(() => import('./charts').then((m) => m.SpiCpiLine), { ssr: false, loading: () => <CardSkeleton h={200} /> });
export const DrillDonut = dynamic(() => import('./DrillCharts').then((m) => m.DrillDonut), { ssr: false, loading: () => <CardSkeleton h={200} /> });
export const GroupByCard = dynamic(() => import('./DrillCharts').then((m) => m.GroupByCard), { ssr: false, loading: () => <CardSkeleton h={260} /> });
