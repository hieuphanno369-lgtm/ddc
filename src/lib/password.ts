import { compare, hash } from 'bcryptjs';

/**
 * S-1 (bao-mat.md vong 4) - bam BAT DONG BO (`bcryptjs.hash`, khong con `hashSync`) de khong chan
 * event loop: `hashPassword` la ham dung CHUNG cho moi noi doi/dat mat khau, doi nhat quan ca ham
 * (khong tach rieng 1 ban bat dong bo chi cho 1 noi goi) de tranh 2 API khac nhau cho cung 1 viec.
 */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, 10);
}

/**
 * Vong sua bao mat 2 (bao-mat.md, ghi chu vong 2 "S-1: DA DONG") - doi `compareSync` -> `compare`
 * bat dong bo, nhat quan voi `hashPassword` (khong con ham nao trong cap doi/kiem mat khau chan
 * event loop bang bcrypt dong bo).
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return compare(password, hash);
}

/** Độ mạnh mật khẩu: 0 = quá ngắn, 1 = yếu, 2 = trung bình, 3 = mạnh. */
export function passwordStrength(password: string): number {
  if (password.length < 8) return 0;
  let s = 0;
  if (/[a-z]/.test(password)) s++;
  if (/[A-Z]/.test(password)) s++;
  if (/\d/.test(password)) s++;
  if (/[^A-Za-z0-9]/.test(password)) s++;
  if (s <= 1) return 1;
  if (s === 2) return 2;
  return 3;
}
