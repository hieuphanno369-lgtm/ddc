import { describe, expect, it } from 'vitest';
import {
  alertUrl,
  noticeFromAlert,
  noticeSubject,
  noticeText,
  severityPasses,
  testNotice,
  webhookPayload,
} from './notify-message';
import type { AlertLog } from '@/server/repo/types';

const ALERT_BASE: AlertLog = {
  id: 7,
  projectId: 3,
  alertType: 'Red',
  ruleTriggered: 'Công nợ quá hạn > 5% HĐ',
  message: 'Công nợ quá hạn 12.5 tỷ = 6.0% giá trị HĐ',
  openedAt: '2026-09-20T00:00:00.000Z',
  closedAt: null,
  owner: 'BOD',
  action: '',
  deadline: '2026-09-30',
  ruleCode: 'ar_overdue',
  dedupeKey: 'ar_overdue:3',
  closedBy: null,
  closeNote: '',
  notifyChannel: null,
  notifySentAt: null,
  notifyError: null,
  notifyAttempts: 0,
};

describe('severityPasses', () => {
  it.each([
    ['Red', 'Red', true],
    ['Amber', 'Red', false],
    ['Red', 'Amber', true],
    ['Amber', 'Amber', true],
  ] as const)('alert=%s min=%s -> %s', (alert, min, expected) => {
    expect(severityPasses(alert, min)).toBe(expected);
  });
});

describe('noticeSubject', () => {
  it('co [DDC][Do] cho Red, bo CR/LF khoi rule (chong injection header)', () => {
    const n = noticeFromAlert({ ...ALERT_BASE, ruleTriggered: 'TEST\r\nBcc: x' }, 'Dự án X', undefined);
    const subject = noticeSubject(n);
    expect(subject).toContain('[DDC][Đỏ]');
    expect(subject).not.toMatch(/[\r\n]/);
  });

  it("Amber -> [DDC][Vang]", () => {
    const n = noticeFromAlert({ ...ALERT_BASE, alertType: 'Amber' }, 'Dự án X', undefined);
    expect(noticeSubject(n)).toContain('[DDC][Vàng]');
  });

  it('cat toi da 200 ky tu', () => {
    const n = noticeFromAlert({ ...ALERT_BASE, ruleTriggered: 'x'.repeat(300) }, 'Dự án X', undefined);
    expect(noticeSubject(n).length).toBeLessThanOrEqual(200);
  });
});

describe('noticeFromAlert', () => {
  it("alert 'ar_overdue' (co tien) -> message = ruleTriggered, khong chua 'ty'", () => {
    const n = noticeFromAlert(ALERT_BASE, 'Dự án X', undefined);
    expect(n.message).toBe(ALERT_BASE.ruleTriggered);
    expect(n.message).not.toContain('tỷ');
  });

  it("alert 'spi_low' (khong tien) -> giu nguyen message", () => {
    const alert: AlertLog = { ...ALERT_BASE, ruleCode: 'spi_low', ruleTriggered: 'SPI thấp', message: 'SPI 0.8' };
    const n = noticeFromAlert(alert, 'Dự án X', undefined);
    expect(n.message).toBe('SPI 0.8');
  });
});

describe('alertUrl', () => {
  it("giao thuc khong phai http(s) -> null", () => {
    expect(alertUrl('javascript:x', 1)).toBeNull();
  });

  it('base hop le -> bo / cuoi, noi them /vi/projects/:id', () => {
    expect(alertUrl('http://localhost:3001/', 5)).toBe('http://localhost:3001/vi/projects/5');
  });

  it('undefined -> null', () => {
    expect(alertUrl(undefined, 1)).toBeNull();
  });
});

describe('testNotice', () => {
  it('cac truong co dinh dung nhu ke hoach', () => {
    const n = testNotice(undefined);
    expect(n).toMatchObject({
      alertId: 0,
      projectId: 0,
      projectName: 'BÁO CÁO QUẢN TRỊ',
      severity: 'Amber',
      rule: 'TEST',
      message: 'Tin nhắn thử từ BÁO CÁO QUẢN TRỊ',
      url: null,
    });
  });

  it('base hop le -> url = base (khong noi them duong dan)', () => {
    const n = testNotice('http://localhost:3001/');
    expect(n.url).toBe('http://localhost:3001');
  });
});

describe('webhookPayload', () => {
  it("'generic' co alert.alertId", () => {
    const n = noticeFromAlert(ALERT_BASE, 'Dự án X', undefined);
    const payload = JSON.parse(webhookPayload('generic', n));
    expect(payload.alert.alertId).toBe(n.alertId);
    expect(payload.event).toBe('alert.opened');
  });

  it("'slack' parse ra { text } (L-3: & < > da bi escape - ALERT_BASE co san '>' trong ruleTriggered)", () => {
    const n = noticeFromAlert(ALERT_BASE, 'Dự án X', undefined);
    const payload = JSON.parse(webhookPayload('slack', n));
    expect(typeof payload.text).toBe('string');
    // noticeSubject/noticeText CHUA escape (ham rieng, dung chung cho email/teams) - so sanh sau khi
    // tu escape & < > giong logic that trong webhookPayload('slack', ...).
    const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    expect(payload.text).toContain(escape(noticeSubject(n)));
    expect(payload.text).toContain(escape(noticeText(n)));
  });

  it("L-3 (danh-gia-bao-mat.md): 'slack' escape & < > (chan <!channel>, link gia <http://evil|Bam vao day>)", () => {
    const n = noticeFromAlert(
      { ...ALERT_BASE, owner: '<!channel> & <http://evil.invalid|Bam vao day>' },
      'Dự án <script>',
      undefined,
    );
    const payload = JSON.parse(webhookPayload('slack', n));
    expect(payload.text).not.toContain('<!channel>');
    expect(payload.text).not.toContain('<script>');
    expect(payload.text).toContain('&lt;!channel&gt;');
    expect(payload.text).toContain('&lt;script&gt;');
    expect(payload.text).toContain('&amp;');
  });

  it("L-3: 'teams' escape [ ] ( ) * _ (chan chen link/dinh dang gia qua ten du an/nguoi phu trach)", () => {
    const n = noticeFromAlert(
      { ...ALERT_BASE, owner: '[Click](http://evil.invalid) *bold* _italic_' },
      'Dự án Y',
      undefined,
    );
    const payload = JSON.parse(webhookPayload('teams', n));
    expect(payload.text).not.toContain('[Click](http://evil.invalid)');
    expect(payload.text).toContain('\\[Click\\]\\(http://evil.invalid\\)');
    expect(payload.text).toContain('\\*bold\\*');
    expect(payload.text).toContain('\\_italic\\_');
  });

  it("L-8: 'teams' escape ca dau \\ - dau vao da co '\\[' khong dung lai duoc link", () => {
    const n = noticeFromAlert(
      { ...ALERT_BASE, owner: String.raw`\[Bam\](http://evil.invalid\)` },
      'Dự án Y',
      undefined,
    );
    const payload = JSON.parse(webhookPayload('teams', n));
    // "\" goc -> "\\", "[" -> "\[" ... : moi ky tu markdown deu con 1 "\" ngay truoc (so le) -> khong tao link.
    expect(payload.text).toContain(String.raw`\\\[Bam\\\]\(http://evil.invalid\\\)`);
  });
});
