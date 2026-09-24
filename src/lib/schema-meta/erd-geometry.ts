import type { MetaField, MetaTable, SchemaMeta } from './build';
import type { ErdLayoutPos, LogicalJoin, TableKind } from './docs';

/**
 * Dựng toạ độ ERD (hộp + đường quan hệ) từ `SchemaMeta` + phần "chữ" ở `docs.ts`. Hàm thuần -
 * không đụng DOM, chỉ tính số + chuỗi path SVG.
 */

export const BOX_W = 230;
export const COL_GAP = 90;
export const HEAD_H = 26;
export const LINE_H = 16;
export const PAD = 8;
export const ROW_GAP = 28;
/** Lề phải cho nhãn cardinality + lề dưới cho đường vòng tự quan hệ. */
const MARGIN_R = 60;
const MARGIN_B = 40;
/** Đường tự quan hệ / cùng cột cong ra ngoài bao xa. */
const LOOP_OUT = 40;
/** Khoảng cách nhãn cardinality tới đầu mút đường. */
const LABEL_OFFSET = 12;

export interface ErdBox {
  table: string; kind: TableKind; x: number; y: number; w: number; h: number;
  keyFields: { name: string; tag: 'PK' | 'FK' | 'PK,FK'; y: number }[]; moreCount: number;
}
export interface ErdEdge {
  from: string; to: string; path: string; fromLabel: string; toLabel: string;
  fromLabelPos: { x: number; y: number }; toLabelPos: { x: number; y: number }; dashed: boolean;
}

function keyTag(f: MetaField): 'PK' | 'FK' | 'PK,FK' | null {
  if (f.pk && f.fk) return 'PK,FK';
  if (f.pk) return 'PK';
  if (f.fk) return 'FK';
  return null;
}

function buildBoxes(meta: SchemaMeta, layout: Record<string, ErdLayoutPos>, kinds: Record<string, TableKind>): Map<string, ErdBox> {
  // Nhom bang theo cot, sap theo row trong ERD_LAYOUT.
  const cols = new Map<number, MetaTable[]>();
  for (const t of meta.tables) {
    const pos = layout[t.table];
    const col = pos?.col ?? 0;
    const list = cols.get(col) ?? [];
    list.push(t);
    cols.set(col, list);
  }
  for (const list of cols.values()) list.sort((a, b) => (layout[a.table]?.row ?? 0) - (layout[b.table]?.row ?? 0));

  const boxes = new Map<string, ErdBox>();
  for (const [col, list] of cols) {
    let cursorY = 0;
    for (const t of list) {
      const keyFields = t.fields
        .map((f) => ({ f, tag: keyTag(f) }))
        .filter((x): x is { f: MetaField; tag: 'PK' | 'FK' | 'PK,FK' } => x.tag != null)
        .map(({ f, tag }, i) => ({ name: f.name, tag, y: HEAD_H + PAD + i * LINE_H + LINE_H / 2 }));
      const moreCount = t.fields.length - keyFields.length;
      const rows = keyFields.length + (moreCount > 0 ? 1 : 0);
      const h = HEAD_H + PAD + Math.max(rows, 1) * LINE_H + PAD;
      const y = cursorY + ROW_GAP;
      cursorY = y + h;
      boxes.set(t.table, {
        table: t.table, kind: kinds[t.table] ?? 'support',
        x: col * (BOX_W + COL_GAP), y, w: BOX_W, h,
        keyFields, moreCount,
      });
    }
  }
  return boxes;
}

/** Cubic bezier tiếp tuyến ngang giữa 2 điểm - dùng cho mọi đường trong ERD. */
function bezierH(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.max(Math.abs(x2 - x1) / 2, 30);
  return `M ${x1} ${y1} C ${x1 + (x2 >= x1 ? dx : -dx)} ${y1}, ${x2 - (x2 >= x1 ? dx : -dx)} ${y2}, ${x2} ${y2}`;
}

function edgeGeometry(fromBox: ErdBox, toBox: ErdBox, fromRowY: number): {
  path: string; fromLabelPos: { x: number; y: number }; toLabelPos: { x: number; y: number };
} {
  const fromY = fromBox.y + fromRowY;
  const toY = toBox.y + HEAD_H / 2;

  if (fromBox.table === toBox.table) {
    // Tu quan he: vong ra canh phai.
    const x1 = fromBox.x + BOX_W;
    const xOut = x1 + LOOP_OUT;
    const path = `M ${x1} ${fromY} C ${xOut} ${fromY}, ${xOut} ${toY}, ${x1} ${toY}`;
    return {
      path,
      fromLabelPos: { x: x1 + LABEL_OFFSET, y: fromY },
      toLabelPos: { x: x1 + LABEL_OFFSET, y: toY },
    };
  }

  if (fromBox.x === toBox.x) {
    // Cung cot: ca 2 ra canh phai, cong ra ngoai.
    const x1 = fromBox.x + BOX_W;
    const x2 = toBox.x + BOX_W;
    const xOut = Math.max(x1, x2) + LOOP_OUT;
    const path = `M ${x1} ${fromY} C ${xOut} ${fromY}, ${xOut} ${toY}, ${x2} ${toY}`;
    return {
      path,
      fromLabelPos: { x: x1 + LABEL_OFFSET, y: fromY },
      toLabelPos: { x: x2 + LABEL_OFFSET, y: toY },
    };
  }

  if (fromBox.x < toBox.x) {
    // Dich o cot lon hon: ra canh phai cua nguon, vao canh trai cua dich.
    const x1 = fromBox.x + BOX_W;
    const x2 = toBox.x;
    return {
      path: bezierH(x1, fromY, x2, toY),
      fromLabelPos: { x: x1 + LABEL_OFFSET, y: fromY },
      toLabelPos: { x: x2 - LABEL_OFFSET, y: toY },
    };
  }

  // Dich o cot nho hon: ra canh trai cua nguon, vao canh phai cua dich.
  const x1 = fromBox.x;
  const x2 = toBox.x + BOX_W;
  return {
    path: bezierH(x1, fromY, x2, toY),
    fromLabelPos: { x: x1 - LABEL_OFFSET, y: fromY },
    toLabelPos: { x: x2 + LABEL_OFFSET, y: toY },
  };
}

function findKeyRowY(box: ErdBox, column: string): number {
  const row = box.keyFields.find((k) => k.name === column);
  return row ? row.y : HEAD_H + PAD + LINE_H / 2;
}

export function buildErd(
  meta: SchemaMeta,
  docs: { layout: Record<string, ErdLayoutPos>; kinds: Record<string, TableKind>; logical: readonly LogicalJoin[] },
): { boxes: ErdBox[]; edges: ErdEdge[]; width: number; height: number } {
  const boxMap = buildBoxes(meta, docs.layout, docs.kinds);
  const edges: ErdEdge[] = [];

  for (const r of meta.relations) {
    const fromBox = boxMap.get(r.fromTable);
    const toBox = boxMap.get(r.toTable);
    if (!fromBox || !toBox) continue;
    const fromRowY = findKeyRowY(fromBox, r.fromColumns[0]);
    const geo = edgeGeometry(fromBox, toBox, fromRowY);
    edges.push({
      from: r.fromTable, to: r.toTable, path: geo.path,
      fromLabel: r.kind === '1:1' ? '1' : 'N',
      toLabel: r.optional ? '0..1' : '1',
      fromLabelPos: geo.fromLabelPos, toLabelPos: geo.toLabelPos,
      dashed: false,
    });
  }

  // Join logic (khong FK that): chi ve khi from/to KHAC bang - 1 dong trong cung bang (vd
  // audit_log.recordId -> audit_log.tableName) chi la ghi chu, khong ve duong.
  for (const j of docs.logical) {
    const [fromTable, fromCol] = j.from.split('.');
    const [toTable] = j.to.split('.');
    if (fromTable === toTable) continue;
    const fromBox = boxMap.get(fromTable);
    const toBox = boxMap.get(toTable);
    if (!fromBox || !toBox) continue;
    const fromRowY = findKeyRowY(fromBox, fromCol);
    const geo = edgeGeometry(fromBox, toBox, fromRowY);
    edges.push({
      from: fromTable, to: toTable, path: geo.path,
      fromLabel: 'N', toLabel: '1',
      fromLabelPos: geo.fromLabelPos, toLabelPos: geo.toLabelPos,
      dashed: true,
    });
  }

  const boxes = [...boxMap.values()];
  const width = boxes.length ? Math.max(...boxes.map((b) => b.x + b.w)) + MARGIN_R + LOOP_OUT : 0;
  const height = boxes.length ? Math.max(...boxes.map((b) => b.y + b.h)) + MARGIN_B : 0;

  return { boxes, edges, width, height };
}
