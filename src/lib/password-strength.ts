/**
 * Độ mạnh mật khẩu cho thanh 4 vạch ở form xác thực (P3F).
 * 0 = rỗng; 1 = ngắn hơn 8 ký tự; còn lại = số nhóm ký tự có mặt
 * (chữ thường, chữ hoa, số, ký tự khác), tối thiểu 1. Chỉ là gợi ý hiển thị, không thay luật tối thiểu ở server.
 */
export function passwordStrength4(password: string): 0 | 1 | 2 | 3 | 4 {
  if (password.length === 0) return 0;
  if (password.length < 8) return 1;
  const groups = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) => re.test(password)).length;
  return Math.max(1, groups) as 1 | 2 | 3 | 4;
}
