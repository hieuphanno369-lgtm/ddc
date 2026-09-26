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

## Task 10: cong cuoi + tong ket cho Tester

### Danh sach commit theo Task (nhanh `feature/p3c-a-form-ke-hoach`, tu main `bb5d95d`)

| Task | Commit | Noi dung chinh |
|---|---|---|
| 1 | `a30a812` | T3 form ho so deu o (dau `?` cung dong nhan, o cung chieu cao); bat loi luu `code_reserved`/`code_taken`, to do o Ma CT; `catch` loi ngoai du kien (K11) |
| 2 | `cb3f3eb` | Migration `20260926100000_p3c_a_plan_tables` (qty tren `project_equipment_plan`, 3 bang moi) + rollback; quá độ Gantt cu (K9) |
| 3 | `1267bc3` | Logic thuan `equipment-plan.ts` viet lai: `findOverloads`, `validateEquipmentPlan`, `equipGroupsAuditText`... |
| 4 | `2ca41b5` | Logic thuan `manpower-plan.ts` (moi): chia ca theo ty le, o sua tay, `recomputeMonth`/`resetMonthToRatio` |
| 5 | `36e3c83` | 4 ham doc hop dong P3C + seed du an 1 (7 dot, 3 quota, 7 thang KH nhan luc, ty le 60/40) + `check:read` |
| 6+7 (1 commit) | `facb6f3` | Ghi + form ke hoach thiet bi theo loai (Tong SL + dot), thay form theo tung chiec cu; xoa het export P3A cu |
| 8 | `42b9396` | Ghi ke hoach nhan luc thang + ty le ca, audit tung thang, nhat ky du an |
| 9 | `d266650` | Form ke hoach nhan luc thang (`manpowerPlanState.ts` + `ManpowerPlanEditor.tsx`), gan vao `/nhap-lieu` |

### Quyet dinh nghiep vu da ap (Q1)

- Chu du an chon **(a)**: bo ca "Hang muc" va "Ghi chu" khoi form doi thiet bi. Cot DB `workItemId`, `note`
  van giu nguyen trong schema (khong xoa cot) - dot moi luu `unitNo = null`, `workItemId = null`, `note = ''`.
  Dong `project_equipment_plan` cu (P3A, theo tung chiec, co `workItemId`/`note`) van con nguyen trong DB
  cho toi khi nguoi dung bam luu lai qua form moi (luc do bi thay toan bo theo dung nghia hop dong).

### Test bi xoa / viet lai co chu dich (khong tinh la "tut moc")

- `src/lib/equipment-plan.ts` + `.test.ts`: xoa het export P3A cu theo tung chiec
  (`EquipmentPlanInput`, `validateEquipmentPlans`, `toEquipmentPlanDraft`, `normalizeEquipmentPlans`,
  `nextUnitNo`, `equipPlanAuditText`, `EQUIP_UNIT_MAX`, `EQUIP_NOTE_MAX`) va khoi test cu tuong ung -
  thay bang logic theo dot (Tong SL). `src/server/repo/types.ts` xoa `EquipmentPlanInput`.
- `src/components/form/EquipmentPlanEditor.tsx` + `.test.ts`: viet lai hoan toan (form theo tung
  chiec -> form theo loai + dot).
- `src/server/actions-equipment-plan.test.ts`, `.qa.test.ts`: viet lai theo chu ky action moi
  (`groups: EquipmentPlanGroupInput[]` thay `rows: EquipmentPlanInput[]`).
- `src/lib/equipment-gantt.test.ts`, `src/components/project/EquipmentGantt.test.ts`: doi sang
  import `legacyEquipmentPlanFixture` (gia tri test khong doi) - phuc vu qua do Gantt cu toi Buoc 11.
- `src/server/equipment-gantt-queries.test.ts`: cap nhat ky vong "du an 1" tu 5 hang (theo tung
  chiec) xuong 3 hang (K9: dot khong danh so gop 1 hang/thiet bi).
- **Khong xoa test nao ma khong co thay the** - tong so file/test cuoi phase (182/2065) **cao hon**
  moc dau phase (177/1958), khong tut.

### Ket qua cong kiem cuoi (2026-09-26)

- `npx tsc --noEmit`: **sach**.
- `npm test`: **182 file / 2065 test xanh** (moc dau phase 177/1958 - khong tut, tang 5 file/107 test).
- `npm run check:read`: **OK toan bo** (18 ham doc, du an 1 va 17, tren DB `ddc_control_tower` sau
  `npx prisma db seed` lan cuoi).
- `npx prisma migrate status`: **up to date**.
- `npm run build` voi `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` tro file mock: **thanh cong** (chi kiem
  compile, khong deploy).
- `git diff main...HEAD --stat`: xac nhan **KHONG dung** `prisma-repo.ts`, `mock-repo.ts`, `actions.ts`,
  `queries.ts`, `project-queries.ts`, `PROGRESS.md`, `.serena/` (dung file nong theo dung pham vi
  duoc giao). 68 file thay doi, +3814/-526 dong.
- **E2E: BO QUA.** Ly do: `e2e/global-setup.ts` chan cung - neu `DATABASE_URL` khong tro dung
  `ddc_control_tower_b` hoac `NEXTAUTH_URL` khong phai cong 3001 thi nem loi ngay (co chu dich, tranh
  chay nham DB/cong cua ben kia). De chay `04-data-entry.spec.ts`/`05-import.spec.ts` tren DB/cong cua A
  can sua `e2e/global-setup.ts` (ngoai pham vi file duoc giao trong ke hoach P3C-A) - khong tu y sua.
  Da kiem chan qua unit test (Task 6, 7, 8, 9) va kiem tay tren trinh duyet that (Playwright script,
  khong qua Playwright test runner) nen coi la du bang chung cho lan ship nay; **Tester nen tu chay
  e2e tren cau hinh rieng cua minh neu can chac chan hon**.

### Anh truoc/sau (`.bangiao/anh-test/`)

- **T3** (form ho so deu o): `t3-truoc-{1440,390}-{moi,sua}.png`, `t3-sau-{1440,390}-{moi,sua}.png`.
- **T4** (KH thiet bi theo dot): `t4-truoc-1440.png`, `t4-loi-vuot-tong-sl-1440.png`,
  `t4-sau-luu-hop-le-1440.png`, `t4-390.png`.
- **T5** (KH nhan luc thang): `t5-truoc-1440.png`, `t5-sua-o-thu-cong-1440.png`, `t5-loi-ty-le-1440.png`,
  `t5-sau-luu-1440.png`, `t5-390.png`.
- Kiem trinh duyet dung Playwright qua script tam (`playwright-core` + Chromium, xoa sau khi dung),
  **khong dung Playwright MCP** (khong co san trong danh sach cong cu cua lan chay nay) - dang nhap
  that bang `admin@daidung.com.vn` / `Admin@123` tren dev server that cong 3000, DB `ddc_control_tower`.
- **Luu y quan trong cho Tester:** trong luc kiem T4/T5, coder co luu THAT qua UI (khong chi xem) de
  xac nhan hanh vi dung - sau moi lan lam vay da chay lai `npx prisma db seed` + `npm run check:read`
  de dua DB ve dung seed goc truoc khi tiep tuc/ket thuc. Neu Tester thay du lieu du an 1 khac seed
  mong doi, chay lai `npx prisma db seed` truoc khi kiem.
- Moi truong dev server tren may nay **khong on dinh** trong phien lam viec (bi crash 2 lan do RAM
  may thap luc chay dong thoi nhieu tien trinh - khong lien quan code P3C-A); da xu ly bang cach dung
  bot tien trinh mo coi va khoi dong lai, khong anh huong ket qua kiem cuoi cung.

### Rui ro Tester/Security nen soi ky

1. **Payload lon:** `saveEquipmentPlansAction` nhan toi da `EQUIP_GROUP_MAX=100` loai x
   `EQUIP_PLAN_MAX_ROWS=300` dot/du an (tong, khong phai moi loai); `saveManpowerPlanAction` toi da
   `MANPOWER_PLAN_MAX_MONTHS=60` thang x 10 o/thang. Chua co gioi han kich thuoc body rieng cho 2
   action nay (dung `bodySizeLimit` chung cua Next server actions, da cau hinh tu P3A).
2. **"Thay toan bo" (replace-all) cho ca 2 form:** `replaceEquipmentPlans` xoa het quota + dot cu
   cua du an roi tao lai trong 1 transaction; `replaceManpowerPlan` xoa/tao lai CHI thang co doi (giu
   nguyen thang khong doi) nhung van la pattern "gui toan bo, sai 1 cho la chan hang loat truoc khi
   ghi" (dung 1 transaction, du lieu cu khong mat neu validate that bai - da kiem trong
   `actions-equipment-plan.qa.test.ts`).
3. **Audit ghi 1 dong "replace" cho ca kh thiet bi** (khong tach tung dong nhu KH nhan luc) - neu
   Tester can xem "dong nao doi" phai tu doc chuoi `oldValue`/`newValue` dang
   `"<equipmentId> tong <n>: <dot>,..."`.
4. **`unitNo = null` cho moi dot moi (Q1a):** Gantt cu (`equipment-gantt.ts`, con chay toi Buoc 11)
   coi moi thiet bi la 1 hang duy nhat (K9) - dung nhung se doi lai hoan toan o Buoc 11 khi B gan
   chart moi. Khong kiem Gantt cu voi ky vong "moi chiec 1 hang" nua.
5. **Quyen ghi:** `saveEquipmentPlansAction`/`saveManpowerPlanAction` deu dung `requireWriteProject`
   (admin hoac data-entry duoc gan PIC/Backup du an do) - khong kiem khoa thang, khong chay alert
   engine (dung theo ke hoach).
6. **`toEquipmentGroupDrafts`/`initPlanState` xu ly thiet bi/ca da ngung dung:** thiet bi ngung dung
   con quota cu van hien duoc trong danh sach chon (co hau to "(ngung dung)") va van luu lai duoc; ca
   khong con active thi BI BO khoi bang KH nhan luc (khong hien, khong luu duoc nua) - can luu y neu
   co du an dang dung ca da tat `isActive`.

### No de sau (khong lam trong lan nay, ghi lai cho Buoc 11 / phase sau)

- Key i18n Gantt cu (`equipmentGantt.*`, `manpowerCharts.shift*`) se xoa o Buoc 11 khi B gan chart moi.
- `scripts/perf/seed-perf.ts` chua tao quota/KH thang cho du lieu hieu nang (neu co chay perf test se
  thieu du lieu cho 4 ham doc moi).
- `.serena/memories/core.md` con ghi ma ca `afternoon` (cu) - sua o luot merge vao `main`.

Buoc 11 (gan chart cua B vao trang Chi tiet): **CHO**, chua lam trong lan nay - dieu kien mo: B da
merge P3C-B vao `main`, P3C-A da CHOT, A khong dang nang Next (xem `.bangiao/ke-hoach.md`).
