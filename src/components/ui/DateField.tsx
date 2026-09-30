'use client';

import { useEffect, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { formatDmy, maskDmy, parseDmy } from '@/lib/date-input';
import type { IsoDate } from '@/lib/clock';
import { IconCalendar } from '@/components/icons';

/**
 * Ô ngày riêng: LUÔN hiện và nhập dd/mm/yyyy (không theo ngôn ngữ giao diện trình duyệt như `input[type=date]`).
 * - Gõ bằng bàn phím (tự chèn "/", bàn phím số trên điện thoại), Enter hoặc rời ô để áp dụng; sai thì báo lỗi, không đổi giá trị.
 * - Nút lịch: `input[type=date]` gốc trong suốt phủ lên biểu tượng nên chạm/bấm mở lịch gốc của thiết bị, không cần thư viện.
 * - Ngoài `min`/`max` (nếu có) cũng báo lỗi. `onChange` chỉ được gọi với ngày ISO hợp lệ (hoặc '' khi `allowEmpty` và ô được xoá trống).
 * - `variant="form"`: cỡ như ô `.inp` trong form (cao 38px, rộng hết ô), `invalid` tô viền đỏ như `.inp.bad`.
 */
export function DateField({
  value,
  onChange,
  min,
  max,
  ariaLabel,
  testId,
  width,
  variant = 'compact',
  allowEmpty = false,
  invalid = false,
}: {
  /** Ngày ISO, hoặc '' khi chưa có ngày (chỉ dùng cùng `allowEmpty`). */
  value: IsoDate | '';
  onChange: (iso: IsoDate | '') => void;
  min?: IsoDate;
  max?: IsoDate;
  ariaLabel: string;
  testId?: string;
  width?: number | string;
  variant?: 'compact' | 'form';
  allowEmpty?: boolean;
  invalid?: boolean;
}) {
  const isForm = variant === 'form';
  const t = useTranslations();
  const errId = useId();
  const [text, setText] = useState(formatDmy(value));
  const [error, setError] = useState<string | null>(null);
  // `data-ready` = đã hydrate xong (e2e chờ thuộc tính này trước khi gõ, tránh gõ vào ô chưa có trình xử lý).
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  // Giá trị từ ngoài (URL) đổi thì ô theo đó và xoá lỗi cũ.
  useEffect(() => {
    setText(formatDmy(value));
    setError(null);
  }, [value]);

  function commit(raw: string) {
    if (allowEmpty && raw.trim() === '') {
      setError(null);
      setText('');
      if (value !== '') onChange('');
      return;
    }
    const iso = parseDmy(raw);
    if (!iso) return setError(t('period.dateInvalid'));
    if ((min && iso < min) || (max && iso > max)) {
      return setError(t('period.dateOutOfRange', { min: min ? formatDmy(min) : '...', max: max ? formatDmy(max) : '...' }));
    }
    setError(null);
    setText(formatDmy(iso));
    if (iso !== value) onChange(iso);
  }

  return (
    <span className="relative inline-flex flex-col" style={{ width: width ?? (isForm ? '100%' : 150) }}>
      <span className="relative inline-flex items-center">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={t('period.datePlaceholder')}
          maxLength={10}
          className={`inp${error || invalid ? ' bad' : ''}`}
          style={
            isForm
              ? { width: '100%', height: 38, paddingRight: 34 }
              : { width: '100%', padding: '6px 34px 6px 10px', fontSize: 'var(--t-caption1)' }
          }
          value={text}
          aria-label={ariaLabel}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
          data-testid={testId}
          data-ready={ready}
          onChange={(e) => {
            setText(maskDmy(e.target.value));
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit(text);
            }
          }}
          // Không cần cờ "bỏ qua blur sau Enter": Enter không làm mất tiêu điểm, còn lần blur thật sau đó phải luôn được áp dụng.
          // `commit` idempotent (giá trị đã áp dụng thì `text === formatDmy(value)`, sai thì báo lại đúng lỗi đó).
          onBlur={() => {
            if (text !== formatDmy(value)) commit(text);
          }}
        />
        <span className="pointer-events-none absolute right-2 flex items-center text-label2" aria-hidden="true">
          <IconCalendar size={15} />
        </span>
        <input
          type="date"
          tabIndex={-1}
          aria-label={t('period.pickDate')}
          title={t('period.pickDate')}
          value={value}
          min={min}
          max={max}
          data-testid={testId ? `${testId}-picker` : undefined}
          style={{ position: 'absolute', right: 0, top: 0, width: 32, height: '100%', opacity: 0, cursor: 'pointer' }}
          onClick={(e) => {
            try {
              e.currentTarget.showPicker?.();
            } catch {
              /* trình duyệt cũ: lịch gốc vẫn mở khi chạm */
            }
          }}
          onChange={(e) => {
            if (e.target.value) commit(formatDmy(e.target.value));
            else if (allowEmpty) commit('');
          }}
        />
      </span>
      {error && (
        <span id={errId} role="alert" className="hintline" style={{ color: 'var(--danger)' }} data-testid={testId ? `${testId}-error` : undefined}>
          {error}
        </span>
      )}
    </span>
  );
}
