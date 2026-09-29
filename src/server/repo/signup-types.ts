import type { Role } from './types';

/**
 * P3F-3 - kiểu dữ liệu cho danh mục Phòng ban và đăng ký chờ admin bật.
 * `SignupStore` là kho tiêm được (khuôn `AuthStore` của P3E): kho Prisma (`prisma-repo-signup.ts`) và kho bộ nhớ
 * (`mock-repo-signup.ts`) phải chạy cùng bộ ca (`signup-store-contract.ts`).
 */
export interface DepartmentRow {
  id: number;
  name: string;
  isActive: boolean;
  /** Số tài khoản (user_roles) đang thuộc phòng ban này. */
  userCount: number;
  /** Số đăng ký đang chờ chọn phòng ban này. */
  pendingCount: number;
}

export interface SignupRequestRow {
  id: number;
  email: string;
  name: string;
  departmentId: number | null;
  departmentName: string | null;
  locale: 'vi' | 'en';
  createdAt: string;
  /** IP lúc gửi đăng ký (thông tin phụ cho admin, S1). */
  requestIp: string;
}

export interface NewSignupRequest {
  email: string;
  name: string;
  departmentId: number | null;
  locale: 'vi' | 'en';
  requestIp: string;
  createdAtIso: string;
}

export type ApproveResult =
  | { email: string; name: string; locale: 'vi' | 'en' }
  | 'not_found'
  | 'duplicate_account';

export interface SignupStore {
  /** Mọi phòng ban, xếp theo tên (localeCompare 'vi'). */
  listDepartments(): Promise<DepartmentRow[]>;
  listActiveDepartments(): Promise<{ id: number; name: string }[]>;
  isActiveDepartment(id: number): Promise<boolean>;
  /** Tên đã `trim` và gộp khoảng trắng liên tiếp; trùng tên (không phân biệt hoa thường) -> 'duplicate_name'. */
  saveDepartment(
    input: { id?: number; name: string },
    by: string,
  ): Promise<{ id: number; name: string } | 'duplicate_name' | 'not_found'>;
  setDepartmentActive(id: number, isActive: boolean, by: string): Promise<boolean>;
  /** Có người dùng hoặc đăng ký chờ trỏ tới thì KHÔNG xoá, trả số lượng. */
  deleteDepartment(id: number): Promise<'ok' | 'not_found' | { inUse: number }>;
  /** Có trong user_roles HOẶC signup_request. */
  emailTaken(email: string): Promise<boolean>;
  createRequest(row: NewSignupRequest): Promise<'created' | 'duplicate'>;
  /** Cũ trước. */
  listPending(): Promise<SignupRequestRow[]>;
  countPending(): Promise<number>;
  /**
   * NGUYÊN TỬ: xoá đăng ký rồi tạo tài khoản trong 1 giao dịch. Gọi lần 2 cùng id -> 'not_found';
   * email đã có tài khoản -> 'duplicate_account' và đăng ký VẪN còn.
   */
  approveRequest(
    id: number,
    /** `passwordHash`: hash của một chuỗi ngẫu nhiên đã vứt bỏ, không ai biết. Người dùng đặt mật khẩu thật qua link (S1). */
    input: { role: Role; canViewFinance: boolean; passwordHash: string },
  ): Promise<ApproveResult>;
  rejectRequest(id: number): Promise<{ email: string } | 'not_found'>;
  /** S3: xoá đăng ký chờ có `createdAt` < `beforeIso`, trả số dòng đã xoá. */
  pruneStale(beforeIso: string): Promise<number>;
}

/** Chuẩn hoá tên phòng ban: bỏ khoảng trắng hai đầu và gộp khoảng trắng liên tiếp thành một dấu cách. */
export function normalizeDepartmentName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}
