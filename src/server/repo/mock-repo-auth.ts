import type { AuthAccountState, AuthStore, ThrottleKind, UserAccount } from './types';

/**
 * P3E (Task 4) - kho `AuthStore` cho chế độ mock (không có `DATABASE_URL`). `failedLoginCount`,
 * `lockedAt`, `passwordChangedAt` chưa có cột trong `UserAccount` (chờ Task 5) nên được lưu tách
 * riêng ở đây, khoá theo email; `MemoryAccountSource` chỉ cần đọc/đổi mật khẩu tài khoản.
 */
export interface MemoryAccountSource {
  findAccount(email: string): UserAccount | undefined;
  changePassword(email: string, passwordHash: string): void;
}

interface Counters {
  failedLoginCount: number;
  lockedAt: string | null;
  passwordChangedAt: string | null;
}

interface ResetTokenRow {
  email: string;
  tokenHash: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  requestIp: string;
}

interface ThrottleRow {
  /** N2 (bao-mat.md vòng 3) - khoá chính, dùng để `releaseThrottle` xoá ĐÚNG dòng (không dựa vào
   * `kind/key/createdAt` vì 2 dòng có thể trùng mili giây). */
  id: number;
  kind: ThrottleKind;
  key: string;
  createdAt: string;
}

export function createMemoryAuthStore(source: MemoryAccountSource): AuthStore {
  const counters = new Map<string, Counters>();
  let resetTokens: ResetTokenRow[] = [];
  let throttle: ThrottleRow[] = [];
  let nextThrottleId = 1;

  function findEmail(email: string): string | undefined {
    return source.findAccount(email.toLowerCase())?.email;
  }

  function countersFor(email: string): Counters {
    return counters.get(email) ?? { failedLoginCount: 0, lockedAt: null, passwordChangedAt: null };
  }

  return {
    async getAccountState(email) {
      const account = source.findAccount(email.toLowerCase());
      if (!account) return null;
      const c = countersFor(account.email);
      const state: AuthAccountState = {
        email: account.email,
        name: account.name,
        passwordHash: account.passwordHash,
        role: account.role,
        canViewFinance: account.canViewFinance,
        isActive: account.isActive,
        failedLoginCount: c.failedLoginCount,
        lockedAt: c.lockedAt,
        passwordChangedAt: c.passwordChangedAt,
      };
      return state;
    },

    async registerFailedLogin(email, threshold, nowIso) {
      const key = findEmail(email);
      if (!key) return null;
      const c = countersFor(key);
      const count = c.failedLoginCount + 1;
      const alreadyLocked = c.lockedAt !== null;
      const justLocked = !alreadyLocked && count >= threshold;
      const next: Counters = {
        failedLoginCount: count,
        lockedAt: alreadyLocked ? c.lockedAt : justLocked ? nowIso : null,
        passwordChangedAt: c.passwordChangedAt,
      };
      counters.set(key, next);
      return { count, locked: next.lockedAt !== null, justLocked };
    },

    async resetFailedLogin(email) {
      // L3 - nguyên tử theo tinh thần "chỉ reset khi locked_at IS NULL": đọc + ghi trong cùng 1
      // lượt đồng bộ của hàm này (không có await xen giữa), khớp với luật Prisma sẽ dùng ở Task 5.
      const key = findEmail(email);
      if (!key) return false;
      const c = countersFor(key);
      if (c.lockedAt !== null) return false;
      counters.set(key, { ...c, failedLoginCount: 0 });
      return true;
    },

    async unlockAccount(email) {
      const key = findEmail(email);
      if (!key) return false;
      const c = countersFor(key);
      counters.set(key, { ...c, failedLoginCount: 0, lockedAt: null });
      return true;
    },

    async setPassword(email, passwordHash, bumpChangedAt, nowIso) {
      const key = findEmail(email);
      if (!key) return false;
      source.changePassword(key, passwordHash);
      if (bumpChangedAt) {
        const c = countersFor(key);
        counters.set(key, { ...c, passwordChangedAt: nowIso });
      }
      // S-2 (bao-mat.md vong 4) - huy moi token dat lai con dung duoc cua email nay, du bumpChangedAt
      // hay khong (mat khau da doi qua duong khac thi 1 link cu con lai khong con ly do de dung duoc).
      for (const row of resetTokens) {
        if (row.email === key && row.usedAt === null) row.usedAt = nowIso;
      }
      return true;
    },

    // R3-1 (bao-mat.md vong 3, Trung) - compare-and-swap: chi doi khi passwordHash HIEN TAI cua tai
    // khoan van dung bang oldHash (da kiem o buoc verify truoc do trong CUNG request) - mo phong dung
    // hanh vi WHERE ... AND passwordHash = oldHash cua ban Prisma.
    // R4-4 (bao-mat.md vong 4, Thap) - tai khoan bi TAT hoac bi KHOA xen giua cung phai lam CAS thua,
    // giong ban Prisma (them dieu kien isActive/lockedAt).
    async setPasswordIfHash(email, oldHash, newHash, nowIso) {
      const key = findEmail(email);
      if (!key) return false;
      const account = source.findAccount(key);
      if (!account || account.passwordHash !== oldHash || !account.isActive) return false;
      const c = countersFor(key);
      if (c.lockedAt !== null) return false;
      source.changePassword(key, newHash);
      counters.set(key, { ...c, passwordChangedAt: nowIso });
      for (const row of resetTokens) {
        if (row.email === key && row.usedAt === null) row.usedAt = nowIso;
      }
      return true;
    },

    // R4-1a (bao-mat.md vong 4, Trung, chot chu du an 2026-09-28) - thu hoi moi phien: bump
    // passwordChangedAt, KHONG doi passwordHash.
    // R5-6 (bao-mat.md vong 5, Thap) - KHONG duoc keo lui: chi ghi khi chua co passwordChangedAt hoac
    // moc hien tai CU HON nowIso (kieu "GREATEST"), giong ban Prisma.
    async revokeSessions(email, nowIso) {
      const key = findEmail(email);
      if (!key) return false;
      const c = countersFor(key);
      if (c.passwordChangedAt === null || c.passwordChangedAt < nowIso) {
        counters.set(key, { ...c, passwordChangedAt: nowIso });
      }
      return true;
    },

    // R5-1 (bao-mat.md vong 5, Thap) - xem JSDoc AuthStore.reserveAccountGuess (types.ts). Doc
    // failedLoginCount/lockedAt TUOI (qua countersFor, khong dua vao ban chup cu ben ngoai) + dem so
    // cho DANG GIU (chua releaseThrottle) trong cua so sinceIso, roi moi quyet dinh.
    async reserveAccountGuess(kind, email, nowIso, sinceIso, threshold) {
      const key = findEmail(email);
      if (!key) return null;
      const c = countersFor(key);
      if (c.lockedAt !== null) return null;
      const held = throttle.filter((t) => t.kind === kind && t.key === key && t.createdAt >= sinceIso).length;
      if (c.failedLoginCount + held >= threshold) return null;
      const id = nextThrottleId++;
      throttle.push({ id, kind, key, createdAt: nowIso });
      return id;
    },

    async recordThrottle(kind, key, nowIso) {
      throttle.push({ id: nextThrottleId++, kind, key, createdAt: nowIso });
    },

    async countThrottle(kind, key, sinceIso) {
      return throttle.filter((t) => t.kind === kind && t.key === key && t.createdAt >= sinceIso).length;
    },

    async reserveThrottle(kind, key, nowIso, sinceIso, limit) {
      // R2 - dem + ghi trong CUNG 1 loi goi, khong co await nao xen giua (xem chu thich types.ts).
      const count = throttle.filter((t) => t.kind === kind && t.key === key && t.createdAt >= sinceIso).length;
      if (count >= limit) return null;
      const id = nextThrottleId++;
      throttle.push({ id, kind, key, createdAt: nowIso });
      return id;
    },

    async releaseThrottle(id) {
      // N2 - xoa theo id (khoa chinh), KHONG loc theo kind/key/createdAt (2 dong co the trung mili giay).
      const idx = throttle.findIndex((t) => t.id === id);
      if (idx !== -1) throttle.splice(idx, 1);
    },

    async replaceResetToken(email, tokenHash, expiresAtIso, requestIp) {
      const e = email.toLowerCase();
      resetTokens = resetTokens.filter((t) => t.email !== e);
      resetTokens.push({ email: e, tokenHash, expiresAt: expiresAtIso, usedAt: null, createdAt: new Date().toISOString(), requestIp });
    },

    async peekResetToken(tokenHash, nowIso) {
      const t = resetTokens.find((x) => x.tokenHash === tokenHash);
      if (!t || t.usedAt !== null || nowIso > t.expiresAt) return false;
      const account = source.findAccount(t.email);
      if (!account || account.passwordHash === '' || !account.isActive) return false;
      return true;
    },

    async consumeResetToken(tokenHash, passwordHash, nowIso) {
      const t = resetTokens.find((x) => x.tokenHash === tokenHash && x.usedAt === null && nowIso <= x.expiresAt);
      if (!t) return { ok: false };
      const account = source.findAccount(t.email);
      // L5 - kiểm CÙNG điều kiện với `peekResetToken` tại thời điểm tiêu token (không chỉ lúc cấp):
      // tài khoản có thể đã bị tắt hoặc chuyển sang chỉ-Google sau khi token được cấp.
      if (!account || account.passwordHash === '' || !account.isActive) return { ok: false };
      // Vô hiệu mọi token còn dùng được của email (kể cả chính token này).
      for (const row of resetTokens) {
        if (row.email === t.email && row.usedAt === null) row.usedAt = nowIso;
      }
      source.changePassword(account.email, passwordHash);
      const c = countersFor(account.email);
      const locked = c.lockedAt !== null;
      counters.set(account.email, { ...c, passwordChangedAt: nowIso, failedLoginCount: locked ? c.failedLoginCount : 0 });
      return { ok: true, email: account.email, name: account.name, locked };
    },

    async pruneAuthData(beforeIso) {
      throttle = throttle.filter((t) => t.createdAt >= beforeIso);
      resetTokens = resetTokens.filter((t) => t.createdAt >= beforeIso);
    },
  };
}
