'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Thanh tiến trình 0→100% mỗi khi đổi route/filter - báo hiệu dashboard đang load,
 * không phải lag. Chạy cả lần mount đầu để người dùng luôn thấy app đang load.
 */
export function TopProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(true);
    setProgress(0);
    const timers = [
      setTimeout(() => setProgress(35), 30),
      setTimeout(() => setProgress(70), 280),
      setTimeout(() => setProgress(90), 650),
      setTimeout(() => setProgress(100), 1100),
      setTimeout(() => setActive(false), 1450),
    ];
    return () => timers.forEach(clearTimeout);
  }, [pathname, searchParams]);

  if (!active) return null;

  return (
    <div className="progbar">
      <i style={{ width: `${progress}%` }} />
    </div>
  );
}
