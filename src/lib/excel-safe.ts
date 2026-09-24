/** Chuỗi bắt đầu bằng = + - @ \t \r → thêm tiền tố "'" để Excel/CSV coi là chữ. Số/boolean/null trả nguyên. */
export function safeCell<T>(v: T): T | string {
  if (typeof v !== 'string') return v;
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}
