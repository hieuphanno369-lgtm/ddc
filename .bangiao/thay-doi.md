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

(Se bo sung tiep theo tung Task, xem cuoi file muc "Tong ket" sau khi xong Task 10.)
