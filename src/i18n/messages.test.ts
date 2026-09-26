import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * next-intl ném lỗi lúc render/build khi thiếu key → bắt ở test rẻ hơn ở runtime.
 * Bám 2 việc: (1) vi/en phải phủ key như nhau, (2) mọi key literal mà 4 trang mới +
 * sidebar dùng phải tồn tại ở CẢ HAI file.
 */
const ROOT = process.cwd();
const read = (p: string) => JSON.parse(readFileSync(join(ROOT, p), 'utf-8')) as Record<string, unknown>;
const vi = read('src/i18n/messages/vi.json');
const en = read('src/i18n/messages/en.json');

function flatten(obj: Record<string, unknown>, prefix = '', out: string[] = []): string[] {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v as Record<string, unknown>, key, out);
    else out.push(key);
  }
  return out;
}

const viKeys = flatten(vi).sort();
const enKeys = flatten(en).sort();

const readSrc = (p: string) => readFileSync(join(ROOT, p), 'utf-8');

/** Key literal dùng qua t('...') hoặc labelKey: '...' (không bắt được template literal - bỏ qua). */
function usedKeys(source: string): string[] {
  const keys = new Set<string>();
  for (const m of source.matchAll(/\bt\(\s*'([A-Za-z0-9_.]+)'\s*[,)]/g)) keys.add(m[1]);
  for (const m of source.matchAll(/labelKey:\s*'([A-Za-z0-9_.]+)'/g)) keys.add(m[1]);
  return [...keys];
}

const CHANGED_SOURCES: Record<string, string> = {
  'trang /report': 'app/[locale]/(app)/report/page.tsx',
  'trang /alerts': 'app/[locale]/(app)/alerts/page.tsx',
  'trang /compliance': 'app/[locale]/(app)/compliance/page.tsx',
  'trang /audit': 'app/[locale]/(app)/audit/page.tsx',
  'AlertList': 'src/components/alerts/AlertList.tsx',
  'AppShell (sidebar)': 'src/components/layout/AppShell.tsx',
  'trang /projects/[id]': 'app/[locale]/(app)/projects/[id]/page.tsx',
  'CountdownPanel': 'src/components/project/CountdownPanel.tsx',
  'ResourceBreakdownChart': 'src/components/project/ResourceBreakdownChart.tsx',
  'WeeklyTrackingCard': 'src/components/project/WeeklyTrackingCard.tsx',
  'KeyMilestoneChart': 'src/components/project/KeyMilestoneChart.tsx',
  'keyMsText': 'src/components/project/keyMsText.ts',
  'KeyMilestoneEditor': 'src/components/form/KeyMilestoneEditor.tsx',
  'StageExplorer': 'src/components/project/StageExplorer.tsx',
  'StageTimelineChart': 'src/components/project/StageTimelineChart.tsx',
  'stageText': 'src/components/project/stageText.ts',
  'WorkItemCompareChart': 'src/components/project/WorkItemCompareChart.tsx',
  'trang /admin': 'app/[locale]/(app)/admin/page.tsx',
  'ActivityViewer': 'src/components/admin/ActivityViewer.tsx',
  'ImportPanel': 'src/components/form/ImportPanel.tsx',
  'DailyImportBlock': 'src/components/form/DailyImportBlock.tsx',
  'StageWeightEditor': 'src/components/form/StageWeightEditor.tsx',
  'ProjectForm': 'src/components/form/ProjectForm.tsx',
  'ProjectLinksSection': 'src/components/form/ProjectLinksSection.tsx',
  'trang /ho-so-du-an': 'app/[locale]/(app)/ho-so-du-an/page.tsx',
  'FieldEditor': 'src/components/admin/FieldEditor.tsx',
  'EquipmentPlanEditor': 'src/components/form/EquipmentPlanEditor.tsx',
  'ManpowerPlanEditor': 'src/components/form/ManpowerPlanEditor.tsx',
};

describe('i18n: vi/en phủ key như nhau', () => {
  it('số key bằng nhau và không file nào có key riêng', () => {
    expect(viKeys.filter((k) => !enKeys.includes(k)), 'key chỉ có ở vi.json').toEqual([]);
    expect(enKeys.filter((k) => !viKeys.includes(k)), 'key chỉ có ở en.json').toEqual([]);
  });

  it('key mới của đợt này có đủ ở cả vi + en', () => {
    const required = [
      'nav.report',
      'nav.alerts',
      'nav.compliance',
      'nav.audit',
      'nav.operations',
      'nav.administration',
      'report.title',
      'report.p0Red',
      'report.projectTable',
      'compliance.title',
      'compliance.pm',
      'compliance.lastUpdate',
      'compliance.empty',
      'audit.title',
      'audit.table',
      'audit.record',
      'audit.field',
      'audit.old',
      'audit.new',
      'alert.title',
      'alert.owner',
    ];
    expect(required.filter((k) => !viKeys.includes(k)), 'thiếu ở vi.json').toEqual([]);
    expect(required.filter((k) => !enKeys.includes(k)), 'thiếu ở en.json').toEqual([]);
  });
});

describe('i18n: key dùng trong code đều tồn tại', () => {
  for (const [label, file] of Object.entries(CHANGED_SOURCES)) {
    it(`${label} không dùng key i18n thiếu`, () => {
      const keys = usedKeys(readSrc(file));
      expect(keys.length, `${file} không trích được key nào`).toBeGreaterThan(0);
      expect(keys.filter((k) => !viKeys.includes(k)), `thiếu ở vi.json`).toEqual([]);
      expect(keys.filter((k) => !enKeys.includes(k)), `thiếu ở en.json`).toEqual([]);
    });
  }

  it('key động trong AlertList (alert.red / alert.amber) tồn tại', () => {
    // AlertList render t(`alert.${type==='Red'?'red':'amber'}`) - không trích được bằng regex.
    expect(viKeys).toEqual(expect.arrayContaining(['alert.red', 'alert.amber']));
    expect(enKeys).toEqual(expect.arrayContaining(['alert.red', 'alert.amber']));
  });
});

/**
 * (danh-gia.md vòng 2, mục phải sửa 2) `ActivityViewer.tsx` render `t(\`activity.${a.action}\`)` -
 * mọi action literal truyền vào `logActivity(user, ...)` dưới `src/server/` phải có key
 * `activity.<action>` ở CẢ vi và en, nếu không next-intl ném lỗi lúc render trang /admin.
 */
function listTsFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listTsFilesRecursive(full));
    else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

/** Bắt cả action literal đơn (`'save_data'`) lẫn ternary (`isActive ? 'a' : 'b'`). */
function logActivityActions(source: string): string[] {
  const actions = new Set<string>();
  for (const m of source.matchAll(/logActivity\(\s*\w+\s*,\s*([^,)]+)[,)]/g)) {
    for (const lit of m[1].matchAll(/'([a-z_]+)'/g)) actions.add(lit[1]);
  }
  return [...actions];
}

describe('i18n: moi action logActivity duoi src/server/ co key activity.<action>', () => {
  const serverFiles = listTsFilesRecursive(join(ROOT, 'src/server'));
  const actions = new Set<string>();
  for (const f of serverFiles) for (const a of logActivityActions(readFileSync(f, 'utf-8'))) actions.add(a);
  const actionList = [...actions];

  it('quet duoc it nhat 1 action (khong bo sot do regex sai)', () => {
    expect(actionList.length).toBeGreaterThan(0);
  });

  it('moi action co activity.<action> o ca vi.json va en.json', () => {
    expect(actionList.filter((a) => !viKeys.includes(`activity.${a}`)), 'thiếu ở vi.json').toEqual([]);
    expect(actionList.filter((a) => !enKeys.includes(`activity.${a}`)), 'thiếu ở en.json').toEqual([]);
  });

  it('tap action thu duoc chua save_exchange_rate va activate_factory (14 key moi vong 2)', () => {
    expect(actionList).toEqual(expect.arrayContaining(['save_exchange_rate', 'activate_factory']));
  });
});
