import type { Market, ProjectType, Priority, Status } from '@/server/repo/types';

/** Map enum → i18n key. Component dùng t(key) để hiển thị. */
export const statusKey: Record<Status, string> = {
  Chuan_bi: 'status.preparation',
  Dang_trien_khai: 'status.inProgress',
  Hoan_thanh: 'status.completed',
  Tam_dung: 'status.paused',
};

export const typeKey: Record<ProjectType, string> = {
  EPC: 'type.epc',
  San_van_dong: 'type.stadium',
  San_bay: 'type.airport',
  Nha_xuong: 'type.factory',
  Cau_cang: 'type.port',
  Cao_tang: 'type.highrise',
  Dong_tau: 'type.shipyard',
  Cau_giao_thong: 'type.bridge',
  Khac: 'type.other',
};

export const marketKey: Record<Market, string> = {
  TN: 'market.domestic',
  XK: 'market.export',
  NoiBo: 'market.internal',
};

export const priorityLabel: Record<Priority, string> = {
  P0: 'P0',
  P1: 'P1',
  P2: 'P2',
  P3: 'P3',
};
