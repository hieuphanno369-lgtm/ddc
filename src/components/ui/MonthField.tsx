'use client';

import { useEffect, useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { formatMy, maskMy, parseMy } from '@/lib/date-input';
import type { YearMonth } from '@/lib/clock';
import { IconCalendar } from '@/components/icons';

/**
 * Ô tháng riêng: LUÔN hiện và nhập mm/yyyy (không theo ngôn ngữ giao diện trình duyệt như `input[type=month]`), cùng họ với `DateField`.
 * - Gõ bằng bàn phím (tự chèn "/", bàn phím số trên điện thoại), Enter hoặc rời ô để áp dụng; sai thì báo lỗi (theo ngôn ngữ ứng dụng), không đổi giá trị.
 * - Nút lịch: `input[type=month]` gốc trong suốt phủ lên biểu tượng, chỉ bật khi trình duyệt hỗ trợ (Firefox/Safari desktop không có thì chỉ còn gõ).
 * - `onChange` chỉ được gọi với tháng YYYY-MM hợp lệ (năm 2000-2999).
 * - `variant="form"`: cỡ như ô `.inp` trong form (cao 38px, rộng hết ô), `invalid` tô viền đỏ như `.inp.bad`.
 */
export function MonthField({
  value,
  onChange,
  ariaLabel,
  testId,
  width,
  variant = 'compact',
  invalid = false,
}: {
  value: YearMonth;
  onChange: (ym: YearMonth) => void;
  ariaLabel: string;
  testId?: string;
  width?: number | string;
  variant?: 'compact' | 'form';
  invalid?: boolean;
}) {
  const isForm = variant === 'form';
  const t = useTranslations();
  const errId = useId();
  const [text, setText] = useState(formatMy(value));
  const [error, setError] = useState<string | null>(null);
  // `data-ready` = đã hydrate xong (e2e chờ thuộc tính này trước khi gõ, tránh gõ vào ô chưa có trình xử lý).
  const [ready, setReady] = useState(false);
  const [pickerOk, setPickerOk] = useState(false);
  useEffect(() => {
    setReady(true);
    const probe = document.createElement('input');
    probe.type = 'month';
    setPickerOk(probe.type === 'month');
  }, []);

  // Giá trị từ ngoài đổi thì ô theo đó và xoá lỗi cũ.
  useEffect(() => {
    setText(formatMy(value));
    setError(null);
  }, [value]);

  function commit(raw: string) {
    const ym = parseMy(raw);
    if (!ym) return setError(t('monthField.invalid'));
    setError(null);
    setText(formatMy(ym));
    if (ym !== value) onChange(ym);
  }

  return (
    <span className="relative inline-flex flex-col" style={{ width: width ?? (isForm ? '100%' : 140) }}>
      <span className="relative inline-flex items-center">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={t('monthField.placeholder')}
          maxLength={7}
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
            setText(maskMy(e.target.value));
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit(text);
            }
          }}
          // Như DateField: `commit` idempotent, lần blur thật sau Enter luôn được áp dụng.
          onBlur={() => {
            if (text !== formatMy(value)) commit(text);
          }}
        />
        <span className="pointer-events-none absolute right-2 flex items-center text-label2" aria-hidden="true">
          <IconCalendar size={15} />
        </span>
        {pickerOk && (
          <input
            type="month"
            tabIndex={-1}
            aria-label={t('monthField.pick')}
            title={t('monthField.pick')}
            value={value}
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
              if (e.target.value) commit(formatMy(e.target.value));
            }}
          />
        )}
      </span>
      {error && (
        <span id={errId} role="alert" className="hintline" style={{ color: 'var(--danger)' }} data-testid={testId ? `${testId}-error` : undefined}>
          {error}
        </span>
      )}
    </span>
  );
}
