import s from './auth.module.css';
import { cx } from './cx';

/**
 * Cẩu tháp minh hoạ (hình theo Main.dc.html 29/09 + nhóm tia hàn của bản gốc 28/09).
 * Mỗi nhóm động có `data-anim` để e2e kiểm chu kỳ và reduced-motion.
 */
export function CraneArt({ size }: { size: 'lg' | 'md' }) {
  const [w, h] = size === 'lg' ? [270, 220] : [240, 196];
  return (
    <svg
      data-auth="crane"
      className={s.crane}
      width={w}
      height={h}
      viewBox="0 0 320 260"
      fill="none"
      aria-hidden="true"
    >
      <g className={s.craneFrame} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M60 250h40" />
        <path d="M72 250V58M88 250V58" />
        <path
          d="M72 250L88 234L72 218L88 202L72 186L88 170L72 154L88 138L72 122L88 106L72 90L88 74L72 58"
          strokeWidth={1.2}
          opacity={0.6}
        />
        <path d="M72 58L80 26L88 58" />
        <path d="M20 58H304M88 50H296M20 50H72" />
        <path
          d="M88 58l8-8l8 8l8-8l8 8l8-8l8 8l8-8l8 8l8-8l8 8l8-8l8 8l8-8l8 8l8-8l8 8l8-8l8 8l8-8l8 8l8-8l8 8l8-8l8 8l8-8l8 8"
          strokeWidth={1.2}
          opacity={0.6}
        />
        <path d="M80 26L296 50M80 26L24 50" strokeWidth={1.2} />
        <rect className={s.craneWeight} x="24" y="58" width="24" height="16" rx="2" />
        <rect x="88" y="58" width="14" height="14" rx="2" />
      </g>
      <circle className={cx(s.blink, s.craneGold)} data-anim="blink" cx="80" cy="21" r="3" />
      <g className={s.craneColumn} strokeWidth={3} strokeLinecap="round">
        <path d="M212 250V208M288 250V208" />
        <path d="M204 250h16M280 250h16" strokeWidth={2} />
      </g>
      <path className={s.craneGround} d="M0 250.5H320" strokeWidth={1} />
      <g className={s.placed} data-anim="placed">
        <rect className={s.craneGold} x="205" y="200" width="90" height="8" rx="1" />
      </g>
      <g className={cx(s.spark, s.craneSpark)} data-anim="spark" strokeWidth={1.5} strokeLinecap="round">
        <path d="M212 206l-6-6M212 206l-8 2M212 206l-2-9" />
        <path d="M288 206l6-6M288 206l8 2M288 206l2-9" />
      </g>
      <g className={s.trolley} data-anim="trolley">
        <rect className={s.craneGold} x="142" y="58" width="16" height="6" rx="1" />
        <rect className={cx(s.cable, s.craneCable)} data-anim="cable" x="149.25" y="64" width="1.5" height="40" />
        <g className={s.hook} data-anim="hook">
          <path className={s.craneHook} d="M150 104v5a4 4 0 1 1-4 4" strokeWidth={2} strokeLinecap="round" />
          <g className={s.hb} data-anim="hb">
            <path className={s.craneSling} d="M150 110L112 122M150 110L188 122" strokeWidth={1} />
            <rect className={s.craneGold} x="105" y="122" width="90" height="8" rx="1" />
          </g>
        </g>
      </g>
    </svg>
  );
}
