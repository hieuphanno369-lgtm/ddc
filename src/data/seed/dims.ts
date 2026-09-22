import type { Currency, Customer, Factory, ExchangeRate, TeamKd } from '@/server/repo/types';

export const customers: Customer[] = [
  { id: 1, name: 'VinGroup', group: 'VinGroup', aliases: ['Vingroup', 'Tập đoàn Vingroup', 'Tập Đoàn Vingroup'], isActive: true, mergedIntoId: null },
  { id: 2, name: 'SunGroup', group: 'SunGroup', aliases: ['Sungroup', 'Tập đoàn Sungroup'], isActive: true, mergedIntoId: null },
  { id: 3, name: 'Nutifood', group: 'Nutifood', aliases: [], isActive: true, mergedIntoId: null },
  { id: 4, name: 'Ban Giao thông', group: 'Nhà nước', aliases: ['Ban Giao Thông'], isActive: true, mergedIntoId: null },
  { id: 5, name: 'ACV', group: 'Nhà nước', aliases: ['Tổng công ty Cảng hàng không'], isActive: true, mergedIntoId: null },
  { id: 6, name: 'Vinhomes Hà Tĩnh', group: 'VinGroup', aliases: ['Vinhomes'], isActive: true, mergedIntoId: null },
  { id: 7, name: 'Pepsico Việt Nam', group: 'Pepsico', aliases: ['Pepsico', 'Pepsi'], isActive: true, mergedIntoId: null },
  { id: 8, name: 'Evapco', group: 'Xuất khẩu', aliases: [], isActive: true, mergedIntoId: null },
  { id: 9, name: 'JFE', group: 'Xuất khẩu', aliases: [], isActive: true, mergedIntoId: null },
  { id: 10, name: 'CTy CHK Quảng Trị', group: 'Nhà nước', aliases: [], isActive: true, mergedIntoId: null },
];

export const teams: TeamKd[] = [
  { id: 1, name: 'P.KD 01', picName: '-', aliases: [], isActive: true, mergedIntoId: null },
  { id: 2, name: 'P.KD 03', picName: 'Trương Xuân Cơ', aliases: [], isActive: true, mergedIntoId: null },
  { id: 3, name: 'P.KD 04', picName: '-', aliases: [], isActive: true, mergedIntoId: null },
  { id: 4, name: 'P.KD 05', picName: 'Nguyễn Trí Nhiên', aliases: [], isActive: true, mergedIntoId: null },
  { id: 5, name: 'P.KD 06', picName: '-', aliases: [], isActive: true, mergedIntoId: null },
  { id: 6, name: 'P.KD 08', picName: '-', aliases: [], isActive: true, mergedIntoId: null },
  { id: 7, name: 'P.KD 09', picName: '-', aliases: [], isActive: true, mergedIntoId: null },
  { id: 8, name: 'P.KD EPC', picName: '-', aliases: [], isActive: true, mergedIntoId: null },
  { id: 9, name: 'Công trình nội bộ', picName: '-', aliases: [], isActive: true, mergedIntoId: null },
];

export const factories: Factory[] = [
  { id: 1, name: 'Nhà máy Đồng Nai', region: 'Miền Nam', capacityTonPerYear: 60000 },
  { id: 2, name: 'Nhà máy Bà Rịa - Vũng Tàu', region: 'Miền Nam', capacityTonPerYear: 45000 },
  { id: 3, name: 'Nhà máy Hà Tĩnh', region: 'Miền Trung', capacityTonPerYear: 30000 },
];

export const currencies: Currency[] = [
  { code: 'VND', name: 'Việt Nam Đồng' },
  { code: 'USD', name: 'US Dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'AUD', name: 'Australian Dollar' },
  { code: 'SAR', name: 'Saudi Riyal' },
];

// Tỷ giá demo (VCB mua chuyển khoản cuối tháng) - tháng 09/2026, cập nhật thủ công bởi Admin
export const exchangeRates: ExchangeRate[] = [
  { currencyCode: 'VND', yearMonth: '2026-09', rateToVnd: 1 },
  { currencyCode: 'USD', yearMonth: '2026-09', rateToVnd: 25400 },
  { currencyCode: 'EUR', yearMonth: '2026-09', rateToVnd: 27500 },
  { currencyCode: 'AUD', yearMonth: '2026-09', rateToVnd: 16800 },
  { currencyCode: 'SAR', yearMonth: '2026-09', rateToVnd: 6770 },
];
