import { hash, compareSync } from 'bcryptjs';

/**
 * S-1 (bao-mat.md vong 4) - bam BAT DONG BO (`bcryptjs.hash`, khong con `hashSync`) de khong chan
 * event loop: `hashPassword` la ham dung CHUNG cho moi noi doi/dat mat khau, doi nhat quan ca ham
 * (khong tach rieng 1 ban bat dong bo chi cho 1 noi goi) de tranh 2 API khac nhau cho cung 1 viec.
 */
export async function hashPassword(password: string): Promise<string> {
  return hash(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return compareSync(password, hash);
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
