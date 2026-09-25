/** Công tắc `.switch` (mock-up) - server-safe, không cần 'use client' vì không dùng hook. */
export function Switch(p: { checked: boolean; onChange?: (v: boolean) => void; label: string; disabled?: boolean }) {
  const { checked, onChange, label, disabled } = p;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={checked ? 'switch on' : 'switch'}
      style={{ border: 'none', padding: 0, cursor: disabled ? 'default' : 'pointer' }}
      onClick={() => onChange?.(!checked)}
      disabled={disabled}
    >
      <i />
    </button>
  );
}
