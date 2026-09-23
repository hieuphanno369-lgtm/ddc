/** Nút "?" + bong bóng `.help .bub` (mock-up dòng 437-458). Card chứa nó phải có className="overflow-visible". */
export function HelpTip({ text, label, alignRight = false }: { text: string; label: string; alignRight?: boolean }) {
  return (
    <button type="button" className={alignRight ? 'help rt' : 'help'} aria-label={label}>
      ?<span className="bub">{text}</span>
    </button>
  );
}
