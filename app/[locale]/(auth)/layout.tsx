import { Suspense } from 'react';
import s from '@/components/auth/auth.module.css';
import { AuthShowcase } from '@/components/auth/AuthShowcase';
import { AuthLocaleSwitch } from '@/components/auth/AuthLocaleSwitch';

/**
 * P3F-2 - khung chung của các trang xác thực (Đăng nhập, Quên/Đặt lại mật khẩu, Đăng ký):
 * nửa trái minh hoạ + nửa phải form. Layout nhóm không mount lại khi đổi trang trong nhóm
 * nên animation cẩu tháp không chạy lại. URL giữ nguyên (route group không thêm đoạn đường dẫn).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.shell} data-auth="shell">
      <AuthShowcase />
      <div className={s.side}>
        <Suspense fallback={null}>
          <AuthLocaleSwitch />
        </Suspense>
        {children}
      </div>
    </div>
  );
}
