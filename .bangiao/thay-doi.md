# P3C-A: thay doi cho Tester

## Moc dau phase (Task 0)

- Nhanh: `feature/p3c-a-form-ke-hoach`, tu main `bb5d95d`.
- `npx tsc --noEmit`: sach.
- `npm test`: **177 file / 1958 test xanh** (dung moc ke hoach ghi).
- Dev server dang chay san o cong 3000 (DB `ddc_control_tower`).

## Task 2: migration + schema

- Migration `20260926100000_p3c_a_plan_tables`: them `qty` + `unitNo` tuy chon tren `project_equipment_plan`;
  3 bang moi `project_equipment_quota`, `project_manpower_plan_month`, `project_shift_ratio`.
- `npx prisma migrate deploy` (lan 1): OK. Kiem `project_equipment_quota` du an 1 = `{equipmentId 1: totalQty 3, equipmentId 2: totalQty 2}` (dung nhu ke hoach); moi dong `project_equipment_plan` co `qty = 1`.
- Them 1 dong thu `unitNo NULL, qty 3` roi chay rollback `20260926100000_p3c_a_plan_tables.down.sql`: dong do tach thanh 3 dong `unitNo` 1, 2, 3; 3 bang moi da bi xoa; `_prisma_migrations` khong con dong nay. Xoa dong test, deploy lai.
- `npx prisma migrate deploy` (lan 2): "Database schema is up to date!".
- `npx prisma migrate diff --from-schema-datasource ... --to-schema-datamodel ...`: **"This is an empty migration."** (khong de xuat gi, ke ca 2 index tao tay P3A - da duoc mo ta bang comment `///` trong schema.prisma tu P3A nen khong lech).

## Task 5: 4 ham doc + seed + check:read

- 4 ham doc theo hop dong P3C them vao `prisma-repo-form.ts` + `mock-repo-form.ts`:
  `readEquipmentPlanSegments`, `readEquipmentQuotas`, `readManpowerPlanMonths`, `readShiftRatios` (ca 2 ben deu async).
- Seed du an 1 (`src/data/seed/erp.ts`): doi ten mang 6 dong cu (theo tung chiec) thanh
  `legacyEquipmentPlanFixture` (chi cho test Gantt cu, xoa o Buoc 11); `equipmentPlanSeed` moi
  7 dot (unitNo null); them `equipmentQuotaSeed`, `manpowerPlanSeed` (7 thang), `shiftRatioSeed` (60/40).
  `SEED_VERSION = '2026-09-26-p3c-a'`.
- `prisma/seed.ts`: them insert 3 bang moi. Da chay `npx prisma db seed` tren `ddc_control_tower`
  (xoa va nap lai du lieu dev, chu du an cho phep).
- `scripts/check-read-parity.ts`: them doi chieu 4 ham doc moi. Ket qua sau seed: **OK toan bo**
  (bao gom 4 ham moi cho du an 1 va 17).
- `npm test`: 179 file / 2043 test xanh. `tsc` sach. `npx prisma migrate status`: up to date.
