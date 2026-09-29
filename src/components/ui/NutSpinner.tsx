import { IconHexNut } from '@/components/icons';
import s from './NutSpinner.module.css';

/** Đai ốc xoay 1 vòng/giây cho trạng thái "đang xử lý"; chữ do nút chứa nó hiển thị. */
export function NutSpinner({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <IconHexNut
      size={size}
      className={[s.spin, className].filter(Boolean).join(' ')}
      data-auth="spinner"
    />
  );
}
