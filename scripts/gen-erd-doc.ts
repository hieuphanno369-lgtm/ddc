/**
 * Sinh lại mục 1 (ERD) trong docs/DATA_WAREHOUSE_README.md tu Prisma.dmmf.datamodel - thay doan
 * giua 2 dau moc ERD:BEGIN/ERD:END bang khoi mermaid moi nhat. Usage: npm run docs:erd
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Prisma } from '@prisma/client';
import { buildSchemaMeta, type DatamodelLike } from '@/lib/schema-meta/build';
import { toMermaid } from '@/lib/schema-meta/mermaid';

const BEGIN = '<!-- ERD:BEGIN (sinh tu dong: npm run docs:erd) -->';
const END = '<!-- ERD:END -->';

export function renderErdBlock(): string {
  const meta = buildSchemaMeta(Prisma.dmmf.datamodel as unknown as DatamodelLike);
  return '```mermaid\n' + toMermaid(meta) + '\n```';
}

function main() {
  const readmePath = resolve(__dirname, '../docs/DATA_WAREHOUSE_README.md');
  const content = readFileSync(readmePath, 'utf-8');
  const beginIdx = content.indexOf(BEGIN);
  const endIdx = content.indexOf(END);
  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
    console.error(`gen-erd-doc: khong tim thay dau moc ${BEGIN} / ${END} trong ${readmePath}`);
    process.exit(1);
  }
  const before = content.slice(0, beginIdx + BEGIN.length);
  const after = content.slice(endIdx);
  const block = renderErdBlock();
  const next = `${before}\n${block}\n${after}`;
  writeFileSync(readmePath, next);
  console.log(`gen-erd-doc: da cap nhat ${readmePath}`);
}

main();
