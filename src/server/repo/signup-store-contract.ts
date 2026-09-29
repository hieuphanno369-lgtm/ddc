import { describe, expect, it, beforeEach } from 'vitest';
import type { Role } from './types';
import type { NewSignupRequest, SignupStore } from './signup-types';

/**
 * P3F-3 (Task 5) - bộ ca dùng chung cho kho bộ nhớ và kho Prisma (DB thật): cùng hành vi ở cả hai.
 * Mỗi bên tự dựng `SignupHarness`; dữ liệu test dùng tiền tố `test-p3f-` và được `reset()` dọn.
 */
export interface StoredAccount {
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  canViewFinance: boolean;
  isActive: boolean;
  departmentId: number | null;
}

export interface SignupHarness {
  store: SignupStore;
  /** Tạo sẵn 1 tài khoản (user_roles), tuỳ chọn thuộc 1 phòng ban. */
  addAccount(email: string, departmentId?: number | null): Promise<void>;
  findAccount(email: string): Promise<StoredAccount | null>;
  /** Xoá mọi dữ liệu test (đăng ký, tài khoản, phòng ban có tiền tố `test-p3f-`). */
  reset(): Promise<void>;
}

export const TEST_PREFIX = 'test-p3f-';
export const mail = (tag: string) => `${TEST_PREFIX}${tag}@daidung.vn`;
export const deptName = (tag: string) => `${TEST_PREFIX}pb-${tag}`;

function newRequest(email: string, over: Partial<NewSignupRequest> = {}): NewSignupRequest {
  return {
    email,
    name: 'Nguyen Van Test',
    departmentId: null,
    passwordHash: 'hash-test',
    locale: 'vi',
    requestIp: '203.0.113.9',
    createdAtIso: new Date().toISOString(),
    ...over,
  };
}

export function runSignupStoreContract(name: string, makeHarness: () => Promise<SignupHarness> | SignupHarness) {
  describe(name, () => {
    let h: SignupHarness;
    let store: SignupStore;

    beforeEach(async () => {
      h = await makeHarness();
      await h.reset();
      store = h.store;
    });

    it('saveDepartment: trim + gop khoang trang; trung ten khong phan biet hoa thuong -> duplicate_name', async () => {
      const a = await store.saveDepartment({ name: `  ${TEST_PREFIX}Ke   Toan  ` }, 'admin@x');
      expect(a).not.toBe('duplicate_name');
      expect(a).not.toBe('not_found');
      expect((a as { name: string }).name).toBe(`${TEST_PREFIX}Ke Toan`);
      expect(await store.saveDepartment({ name: `${TEST_PREFIX}KE TOAN` }, 'admin@x')).toBe('duplicate_name');
    });

    it('saveDepartment: doi ten theo id; id la -> not_found; doi sang ten cua phong ban khac -> duplicate_name', async () => {
      const a = (await store.saveDepartment({ name: deptName('a') }, 'admin@x')) as { id: number };
      const b = (await store.saveDepartment({ name: deptName('b') }, 'admin@x')) as { id: number };
      expect(await store.saveDepartment({ id: a.id, name: deptName('a2') }, 'admin@x')).toEqual({ id: a.id, name: deptName('a2') });
      expect(await store.saveDepartment({ id: a.id, name: deptName('b') }, 'admin@x')).toBe('duplicate_name');
      // doi lai chinh ten cua minh (khac hoa thuong) van duoc
      expect(await store.saveDepartment({ id: b.id, name: deptName('B') }, 'admin@x')).toEqual({ id: b.id, name: deptName('B') });
      expect(await store.saveDepartment({ id: 2_000_000_000, name: deptName('zzz') }, 'admin@x')).toBe('not_found');
    });

    it('listActiveDepartments bo phong ban an; isActiveDepartment theo dung trang thai', async () => {
      const a = (await store.saveDepartment({ name: deptName('hien') }, 'admin@x')) as { id: number };
      const b = (await store.saveDepartment({ name: deptName('an') }, 'admin@x')) as { id: number };
      expect(await store.setDepartmentActive(b.id, false, 'admin@x')).toBe(true);
      const active = (await store.listActiveDepartments()).filter((d) => d.name.startsWith(TEST_PREFIX));
      expect(active.map((d) => d.id)).toEqual([a.id]);
      expect(await store.isActiveDepartment(a.id)).toBe(true);
      expect(await store.isActiveDepartment(b.id)).toBe(false);
      expect(await store.isActiveDepartment(2_000_000_000)).toBe(false);
      expect(await store.setDepartmentActive(2_000_000_000, false, 'admin@x')).toBe(false);
    });

    it('listDepartments dem so nguoi dung va dang ky cho', async () => {
      const a = (await store.saveDepartment({ name: deptName('dem') }, 'admin@x')) as { id: number };
      await h.addAccount(mail('dem-user'), a.id);
      await store.createRequest(newRequest(mail('dem-req'), { departmentId: a.id }));
      const row = (await store.listDepartments()).find((d) => d.id === a.id);
      expect(row).toMatchObject({ name: deptName('dem'), isActive: true, userCount: 1, pendingCount: 1 });
    });

    it('deleteDepartment: co nguoi dung hoac dang ky cho -> inUse va KHONG xoa; khong ai dung -> ok', async () => {
      const withUser = (await store.saveDepartment({ name: deptName('co-user') }, 'admin@x')) as { id: number };
      const withReq = (await store.saveDepartment({ name: deptName('co-req') }, 'admin@x')) as { id: number };
      const free = (await store.saveDepartment({ name: deptName('trong') }, 'admin@x')) as { id: number };
      await h.addAccount(mail('pb-user'), withUser.id);
      await store.createRequest(newRequest(mail('pb-req'), { departmentId: withReq.id }));

      expect(await store.deleteDepartment(withUser.id)).toEqual({ inUse: 1 });
      expect(await store.deleteDepartment(withReq.id)).toEqual({ inUse: 1 });
      const ids = (await store.listDepartments()).map((d) => d.id);
      expect(ids).toEqual(expect.arrayContaining([withUser.id, withReq.id]));

      expect(await store.deleteDepartment(free.id)).toBe('ok');
      expect((await store.listDepartments()).map((d) => d.id)).not.toContain(free.id);
      expect(await store.deleteDepartment(free.id)).toBe('not_found');
    });

    it('createRequest: email da co dang ky cho -> duplicate; emailTaken true khi co trong user_roles hoac signup_request', async () => {
      const email = mail('trung');
      expect(await store.emailTaken(email)).toBe(false);
      expect(await store.createRequest(newRequest(email))).toBe('created');
      expect(await store.createRequest(newRequest(email))).toBe('duplicate');
      expect(await store.emailTaken(email)).toBe(true);

      await h.addAccount(mail('co-tk'));
      expect(await store.emailTaken(mail('co-tk'))).toBe(true);
    });

    it('listPending cu truoc, kem ten phong ban; countPending dem dung', async () => {
      const a = (await store.saveDepartment({ name: deptName('ds') }, 'admin@x')) as { id: number };
      await store.createRequest(newRequest(mail('cu'), { createdAtIso: '2026-09-01T00:00:00.000Z', departmentId: a.id, locale: 'en' }));
      await store.createRequest(newRequest(mail('moi'), { createdAtIso: '2026-09-02T00:00:00.000Z' }));
      const mine = (await store.listPending()).filter((r) => r.email.startsWith(TEST_PREFIX));
      expect(mine.map((r) => r.email)).toEqual([mail('cu'), mail('moi')]);
      expect(mine[0]).toMatchObject({ departmentId: a.id, departmentName: deptName('ds'), locale: 'en', name: 'Nguyen Van Test' });
      expect(mine[1]).toMatchObject({ departmentId: null, departmentName: null });
      expect(await store.countPending()).toBeGreaterThanOrEqual(2);
    });

    it('approveRequest: tao tai khoan dung truong, xoa dang ky; goi lan 2 -> not_found', async () => {
      const a = (await store.saveDepartment({ name: deptName('duyet') }, 'admin@x')) as { id: number };
      const email = mail('duyet');
      await store.createRequest(newRequest(email, { departmentId: a.id, passwordHash: 'hash-duyet', name: 'Tran Duyet', locale: 'en' }));
      const id = (await store.listPending()).find((r) => r.email === email)!.id;

      const res = await store.approveRequest(id, { role: 'data-entry', canViewFinance: true });
      expect(res).toEqual({ email, name: 'Tran Duyet', locale: 'en' });
      expect(await h.findAccount(email)).toEqual({
        email, name: 'Tran Duyet', passwordHash: 'hash-duyet', role: 'data-entry', canViewFinance: true, isActive: true, departmentId: a.id,
      });
      expect((await store.listPending()).some((r) => r.email === email)).toBe(false);
      expect(await store.approveRequest(id, { role: 'data-entry', canViewFinance: true })).toBe('not_found');
    });

    it('approveRequest: email da co tai khoan -> duplicate_account, dang ky VAN con, khong ghi de tai khoan', async () => {
      const email = mail('da-co');
      await store.createRequest(newRequest(email, { passwordHash: 'hash-moi' }));
      await h.addAccount(email);
      const before = await h.findAccount(email);
      const id = (await store.listPending()).find((r) => r.email === email)!.id;
      expect(await store.approveRequest(id, { role: 'viewer', canViewFinance: false })).toBe('duplicate_account');
      expect((await store.listPending()).some((r) => r.email === email)).toBe(true);
      expect(await h.findAccount(email)).toEqual(before);
    });

    it('approveRequest: 2 loi goi dong thoi cung id -> dung 1 thanh cong', async () => {
      const email = mail('dong-thoi');
      await store.createRequest(newRequest(email));
      const id = (await store.listPending()).find((r) => r.email === email)!.id;
      const results = await Promise.all([
        store.approveRequest(id, { role: 'viewer', canViewFinance: false }),
        store.approveRequest(id, { role: 'viewer', canViewFinance: false }),
      ]);
      expect(results.filter((r) => typeof r === 'object')).toHaveLength(1);
      expect(results.filter((r) => r === 'not_found')).toHaveLength(1);
    });

    it('rejectRequest: xoa va tra email; lan 2 -> not_found; gui lai cung email duoc (Q5 = a)', async () => {
      const email = mail('tu-choi');
      await store.createRequest(newRequest(email));
      const id = (await store.listPending()).find((r) => r.email === email)!.id;
      expect(await store.rejectRequest(id)).toEqual({ email });
      expect(await store.rejectRequest(id)).toBe('not_found');
      expect(await store.emailTaken(email)).toBe(false);
      expect(await store.createRequest(newRequest(email))).toBe('created');
    });
  });
}
