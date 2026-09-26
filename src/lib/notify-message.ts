import type { AlertLog, AlertSeverity } from '@/server/repo/types';
import { isMoneyAlert } from '@/lib/finance-gate';

export interface AlertNotice {
  alertId: number;
  projectId: number;
  projectName: string;
  severity: AlertSeverity;
  ruleCode: string | null;
  rule: string;
  message: string;
  deadline: string;
  owner: string;
  openedAt: string;
  url: string | null;
}

const MAX_SUBJECT_LENGTH = 200;

/** min 'Red' → chỉ Red khớp; min 'Amber' → Red + Amber đều khớp. */
export function severityPasses(alert: AlertSeverity, min: AlertSeverity): boolean {
  if (min === 'Red') return alert === 'Red';
  return true;
}

/** base không phải http(s) hợp lệ → null; bỏ '/' cuối. */
function normalizedBaseUrl(baseUrl: string | undefined): string | null {
  if (!baseUrl) return null;
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  return baseUrl.replace(/\/+$/, '');
}

export function alertUrl(baseUrl: string | undefined, projectId: number): string | null {
  const base = normalizedBaseUrl(baseUrl);
  return base ? `${base}/vi/projects/${projectId}` : null;
}

/** Q4=(a): isMoneyAlert(alert) → message = alert.ruleTriggered (không số tiền). */
export function noticeFromAlert(alert: AlertLog, projectName: string, baseUrl: string | undefined): AlertNotice {
  return {
    alertId: alert.id,
    projectId: alert.projectId,
    projectName,
    severity: alert.alertType,
    ruleCode: alert.ruleCode,
    rule: alert.ruleTriggered,
    message: isMoneyAlert(alert) ? alert.ruleTriggered : alert.message,
    deadline: alert.deadline,
    owner: alert.owner,
    openedAt: alert.openedAt,
    url: alertUrl(baseUrl, alert.projectId),
  };
}

export function testNotice(baseUrl: string | undefined): AlertNotice {
  return {
    alertId: 0,
    projectId: 0,
    projectName: 'BÁO CÁO QUẢN TRỊ',
    severity: 'Amber',
    ruleCode: null,
    rule: 'TEST',
    message: 'Tin nhắn thử từ BÁO CÁO QUẢN TRỊ',
    deadline: '',
    owner: '',
    openedAt: new Date().toISOString(),
    url: normalizedBaseUrl(baseUrl),
  };
}

function severityLabel(severity: AlertSeverity): string {
  return severity === 'Red' ? 'Đỏ' : 'Vàng';
}

export function noticeSubject(n: AlertNotice): string {
  const raw = `[DDC][${severityLabel(n.severity)}] ${n.projectName} - ${n.rule}`;
  return raw.replace(/[\r\n]+/g, ' ').slice(0, MAX_SUBJECT_LENGTH);
}

export function noticeText(n: AlertNotice): string {
  const lines = [
    `Dự án: ${n.projectName}`,
    `Mức độ: ${severityLabel(n.severity)}`,
    `Luật: ${n.rule}`,
    `Nội dung: ${n.message}`,
    `Người phụ trách: ${n.owner}`,
    `Hạn xử lý: ${n.deadline}`,
    `Mở lúc: ${n.openedAt}`,
  ];
  if (n.url) lines.push(`Link: ${n.url}`);
  return lines.join('\n');
}

/**
 * L-3 (danh-gia-bao-mat.md): Slack mrkdwn coi &, <, > la ky tu dac biet (vd `<!channel>` de dinh
 * danh moi nguoi, `<http://evil|Bam vao day>` de gia mao link) - phai escape truoc khi dua du lieu
 * nguoi dung (ten du an, luat, message, nguoi phu trach...) vao message text.
 */
function escapeSlackMrkdwn(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * L-3: Teams (MessageCard) render markdown - `[]()` tao link, `*`/`_` tao in dam/in nghieng. Escape
 * de du lieu nguoi dung khong the chen link/dinh dang gia.
 */
function escapeTeamsMarkdown(s: string): string {
  // L-8: escape ca chinh dau "\" - neu khong, dau vao "\[" thanh "\\[" va markdown doc lai duoc "[".
  return s.replace(/([\\[\]()*_`~#>])/g, '\\$1');
}

export function webhookPayload(format: 'generic' | 'slack' | 'teams', n: AlertNotice): string {
  if (format === 'generic') return JSON.stringify({ event: 'alert.opened', alert: n });
  const combined = `${noticeSubject(n)}\n${noticeText(n)}`;
  const text = format === 'slack' ? escapeSlackMrkdwn(combined) : escapeTeamsMarkdown(combined);
  return JSON.stringify({ text });
}
