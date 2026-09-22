'use client';

import { useEffect, useState } from 'react';

/**
 * Thanh tiến trình đồng bộ (0→100%) mỗi khi có mutation (thêm/sửa/xóa) ở trang quản trị.
 * Các client component dispatch `window.dispatchEvent(new Event('ddc:sync'))` khi bắt đầu.
 */
export function SyncProgressBar() {
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    function onStart() {
      setProgress(0);
      [25, 50, 75, 100].forEach((p, i) => setTimeout(() => setProgress(p), i * 120));
      setTimeout(() => setProgress(null), 4 * 120 + 250);
    }
    window.addEventListener('ddc:sync', onStart);
    return () => window.removeEventListener('ddc:sync', onStart);
  }, []);

  if (progress == null) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[100] h-1">
      <div className="h-full bg-[#F5B301] transition-[width] duration-100" style={{ width: `${progress}%` }} />
    </div>
  );
}
