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
    projectName: 'DDC Control Tower',
    severity: 'Amber',
    ruleCode: null,
    rule: 'TEST',
    message: 'Tin nhắn thử từ DDC Control Tower',
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

export function webhookPayload(format: 'generic' | 'slack' | 'teams', n: AlertNotice): string {
  if (format === 'generic') return JSON.stringify({ event: 'alert.opened', alert: n });
  return JSON.stringify({ text: `${noticeSubject(n)}\n${noticeText(n)}` });
}
