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

## Debugger vong 1 - BUG-01

### Root cause (da xac nhan THAT tren trinh duyet that, khong doan)

`app/globals.css` dinh nghia class rieng cua app `.inline{display:flex;align-items:center;gap:9px}`
dung lam khung select+input cung dong (vd o "Gia tri nguyen te" o `ProjectForm.tsx`). Vi trong code
co dung chuoi lieu `className="inline"`, Tailwind JIT quet thay va TU SINH THEM utility co san cua no
trung ten `.inline{display:inline}`. Ca 2 rule cung specificity (`0,1,0`) nam trong CUNG 1 file bundle
`layout.css`; rule cua Tailwind duoc ghi SAU rule cua app nen THANG cascade (CSS: cung specificity thi
rule khai bao sau thang). Ket qua phan tu `.inline` bi ep ve `display:inline` roi bi trinh duyet
"blockify" thanh `display:block` (vi no la con truc tiep cua `.field`, mot flex-column container) -
khong con la flex-row nua, nen `<select>` va `<input>` ben trong khong cung dong: `<input>` roi
xuong 1 dong rieng ben duoi `<select>` (lech dung 38px = 1 hang).

**Da tai hien That truoc khi sua** (Playwright qua `node_modules/playwright-core` co san trong repo,
dang nhap that `admin@daidung.com.vn`/`Admin@123`, dev server that cong 3000, DB `ddc_control_tower`,
KHONG qua UI luu du lieu):
- Doc `document.styleSheets` cua trang that: xac nhan dung 2 rule `.inline` trong `layout.css`, rule
  `display:flex` cua app o INDEX 232, rule `display:inline` cua Tailwind o INDEX 389 (sau) - dung nhu
  gia thuyet cua Tester.
- Do `getBoundingClientRect()` truoc khi sua (doi tien te sang USD o `/vi/ho-so-du-an?mode=new`):
  `select.top` va `input.top` lech dung **38px** ca o 1440px lan 390px (`getComputedStyle(wrap).display`
  = `"block"`, ky vong `"flex"`) - khop 100% bang chung Tester da ghi trong `ket-qua-test.md`.

### Cach sua (toi thieu, dung cho)

Doi ten class rieng cua app tu `.inline` sang **`.inline-row`** (khong trung bat ky pattern utility
nao cua Tailwind - `inline-flex`/`inline-block`/`inline-grid`/`inline-table` deu co hau to rieng,
`inline-row` khong phai hau to Tailwind sinh ra) o ca dinh nghia trong `app/globals.css` (4 dong: rule
chinh + 3 rule con `.feven>.field>.inline>...`) va tat ca noi dung trong `.tsx` (rename dong bo,
khong doi hanh vi):
- `app/globals.css` (dong ~390-397).
- `src/components/form/ProjectForm.tsx` (3 cho: khung "Gia tri nguyen te" dong 507, khung Switch
  "penalized" dong 577, dong dem "Bat buoc/N truong da dien" o thanh sticky dong 656).
- `src/components/form/DataEntryForm.tsx` (1 cho: `<label>` checkbox "Ap dung" giai doan, dong 383).
- `src/components/form/EquipmentPlanEditor.tsx` (1 cho: hang chon thiet bi trong nhom, dong 137).
- `src/components/form/ProjectForm.test.ts` (cap nhat chuoi ky vong `<div class="inline-row">`).

Da grep toan `src/` + `app/` xac nhan day la TOAN BO 5 cho dung `className="inline"` chinh xac (khong
con cho nao dua vao `.inline` cu sau khi sua).

### Ra soat class app khac co the trung utility Tailwind (chi ghi nhan, khong sua vi khong cung goc/
khong co xung dot that)

Da liet ke moi class don dinh nghia trong `globals.css` trung ten voi cac utility Tailwind pho bien
(hidden/flex/grid/block/relative/absolute/sticky/scroll/gap/fill/transform...). Ket qua:
- `.relative` (dong 395, trong selector `.feven>.field>.relative>.inp`): **khong phai class rieng cua
  app** - khong co dinh nghia `.relative{...}` doc lap nao trong `globals.css`; day la Tailwind utility
  `position:relative` dung DUNG y (Combobox, SettingsMenu, ProjectSwitcher, PasswordInput dung lam
  positioning context cho dropdown/icon) - khong xung dot.
- `.scroll{overflow-x:auto}` (dong 298) va `.fill` (`.stage .fill`, dong con dung standalone o
  DataEntryForm/`[id]/page.tsx`): Tailwind KHONG co utility bare `scroll` hay bare `fill` (Tailwind chi
  sinh `scroll-auto`/`scroll-smooth`/`scroll-p-*`... va `fill-none`/`fill-current`/`fill-{color}`, deu
  co hau to bat buoc) - khong co utility trung ten de xung dot.
- `.gap` chi xuat hien trong selector ghep `.kpi .sb.gap` (khong phai class don dung rieng); Tailwind
  cung khong sinh utility bare `gap` (luon can hau to `gap-N`) - khong xung dot.
- `.sticky` chi xuat hien trong selector ghep `.tbl.sticky` (khong co `className="sticky"` dung rieng
  o dau trong `src/`/`app/`) - Tailwind CO utility bare `.sticky{position:sticky}` nhung vi app khong
  dung `.sticky` mot minh nen khong co phan tu nao bi anh huong; **ghi nhan de y**: neu sau nay co code
  dung `className="sticky"` doc lap, se gap dung mau loi giong BUG-01 (Tailwind sinh utility trung ten,
  co the thang cascade tuy thu tu bundle) - nen dat ten khac (vd `.sticky-head`) neu can dung.

Khong phat hien xung dot ten class TAT CA con lai ngoai `.inline` (da sua) va rui ro tiem an `.sticky`
(da ghi nhan, chua co xung dot that nen khong sua).

### Kiem chung sau sua

- Playwright that (script tam, cung `playwright-core`, dev server that cong 3000, khong luu du lieu
  qua UI): sau sua, `getComputedStyle(wrap).display` = `"flex"`, `select.top` va `input.top` LECH
  **0px** o ca 1440px va 390px (doi tien te sang USD). Anh chup:
  `.bangiao/anh-test/debugger-v1-bug01-sau-1440-usd.png`, `...-390-usd.png`.
- `npx tsc --noEmit`: sach.
- `npm test`: **186 file / 2151 test xanh** (dung moc Tester ban giao, khong tut, khong tang - chi doi
  ten class + cap nhat 1 chuoi ky vong trong test cu).
- `npm run check:read`: OK toan bo (18 ham doc, du an 1 va 17).
- `npx prisma migrate status`: khong doi (lan sua nay khong dung migration).
- Khong luu du lieu qua UI trong lan sua nay nen KHONG can chay lai `npx prisma db seed`.

## Vong sua 1 sau reviewer (CAN SUA 1 + L-1) - 2026-09-26

### CAN SUA 1: o ca KH nhan luc khong xoa trang duoc

- Tai hien do truoc khi sua: 4 test moi trong `manpowerPlanState.test.ts` do (`cellInputs` chua ton tai, `setCell('')` bi nuot).
- Sua: `PlanRowState` them `cellInputs: string[]` (chuoi nhap tung o ca, nhu `totalInput`/`pctInputs`).
  - `setCell` luon ghi chuoi vao `cellInputs`; hop le moi doi `cells` (+ `isManual`), rong/khong hop le chi doi nhap.
  - `revertCell` (moi): roi o thi tra chuoi ve so dang luu.
  - `isCellInputValid` (moi): chuoi khop so dang luu; sai thi o to do va `toPlanInput` tra null (nut Luu tat).
  - `initPlanState`, `setTotal`, `setPct`, `resetRow`, `addMonth` dong bo `cellInputs` theo `cells` moi.
  - `ManpowerPlanEditor.tsx`: o ca dung `value={r.cellInputs[ci]}`, `onBlur` goi `revertCell`, class `bad` khi nhap sai.
- Test doi co chu dich: ca cu "setCell gia tri am hoac le -> state khong doi" doi thanh "cells khong doi, chi doi nhap, khong cho luu" (hanh vi moi theo yeu cau reviewer).
- Kiem trinh duyet that (Playwright, go phim that tung ky tu, 1440px): xoa "270" bang Backspace -> o rong, vien do, Luu tat; go "600" -> 600, tong 780 (truoc sua ra 5600); xoa trang roi Tab -> tra ve 600; Luu -> DB `planned=600, isManual=true`, audit `morning:270,evening:180 -> morning:600(m),evening:180`.

### L-1: zod duyet toi 30.000 dot truoc khi chan tong

- Tai hien do: test schema 100 loai x 300 dot rac tra 90.001 issue (duyet het tung dot, ~3,4s) moi bao "Qua nhieu dot".
- Sua (`validation.ts`): `groups` = `z.unknown().refine(countRawSegments <= EQUIP_PLAN_MAX_ROWS, { abort: true }).pipe(equipmentPlanGroupsSchema)`; dem tren du lieu tho truoc khi parse sau, bo `refine` tong cu o cuoi. Khong doi luat nghiep vu (van 300 dot/du an, 100 loai).
- Test moi (`actions-equipment-plan.test.ts`): 2 loai x 200 dot -> `Invalid input`, `replaceEquipmentPlans` khong bi goi; 100 x 300 dot rac -> dung 1 issue; dung 300 dot chia 2 loai van qua.

### Sua them (muc "De sau" cua reviewer, cung file, nho)

- 2 nut "Tinh lai theo ty le" / "Xoa thang" dinh sat nhau (khoang cach 0px, thay tren anh 1440) -> boc flex `gap: 8`.
- `pctSum` lam tron 1 so le (tranh `100.00000000000001%`).
- O tong % dung nham `className="inp bad"` cho `<td>` -> doi sang chu mau danger.
- O Tong thang lech tong cac ca (vd sau `setPct`, hoac dang xoa trang) nay to do (truoc chi tat nut Luu ma khong bao).

### Cong kiem

- `npx tsc --noEmit`: sach.
- `npm test`: 186 file / 2159 test xanh (truoc 2153, them 6).
- `npm run check:read`: tren DB A bao LECH vi DB `ddc_control_tower` da bi C xoa du lieu nghiep vu (7.2, 0 du an), khong lien quan thay doi; chay tren DB tam `ddc_control_tower_qa_a` (migrate deploy + seed) -> OK toan bo; DB tam da xoa.
- Luu y moi truong: migration Prisma doc `DIRECT_URL`, khong phai `DATABASE_URL`; tro DB khac phai dat ca hai.
- Anh: `.bangiao/anh-test/p3c-a-vong-sua-*.png` (o rong 1440, go 600 1440, ty le + tong sai 1440, 390 giua bang va cuoi trang).
- Khong ghi du lieu thu vao DB A (chu du an tu nhap lai).

## Buoc 11 (gan chart T4/T5 vao trang Chi tiet)

Chu du an chot 2026-09-26: A lam Buoc 11 ngay trong nhanh P3C-A (truoc khi merge main), thay vi
cho ke hoach goc cua B ("TREO" cho toi khi A merge). Da doc `.bangiao/archive/p3c-b-chart-2026-09-26/ke-hoach.md`
muc Buoc 11 (11.1-11.6) va lam theo dung do, tru cac diem chu du an chot khac ghi trong prompt.

### Commit

1. `954d31a` `feat(p3c-a): buoc 11.2 doi import p3c-contract sang @/server/repo/types, xoa file kieu tam`
   - Doi import trong 8 file (`equipment-gantt-v2.ts`, `manpower-month-chart.ts`, va cac `.test.ts`/`.qa.test.ts`
     tuong ung, cong `EquipmentPlanGantt.test.ts`, `ManpowerMonthChart.test.ts`) tu `@/lib/p3c-contract`
     sang `@/server/repo/types` (`types.ts` da co san 4 kieu hop dong tu merge main truoc do).
   - Xoa `src/lib/p3c-contract.ts`, `p3c-contract.test.ts`, `p3c-contract.qa.test.ts` (kieu tam khong
     con y nghia; da chay `p3c-contract.test.ts` TRUOC khi xoa - 2 test xanh, xac nhan 4 kieu khop
     `types.ts` - dung theo yeu cau khong tu sua hop dong neu do).
2. `2c6598d` `feat(p3c-a): buoc 11.3-11.6 noi gantt theo dot + chart KH nhan luc thang vao trang chi tiet, xoa chart cu`
   - Them (moi): `src/server/equipment-plan-gantt-queries.ts` + `.test.ts` - `getEquipmentPlanGantt(projectId, today)`,
     KHONG tu kiem quyen (comment ro trong file), chi goi tu trang da `requireProjectRead`.
   - Them vao `src/server/manpower-queries.ts`: `getManpowerMonthChartData(projectId, locale)` (+ test trong
     `manpower-queries.test.ts`).
   - `app/[locale]/(app)/projects/[id]/page.tsx`: card `#res-shift` doi sang `ManpowerMonthChart`
     (`manpowerMonthChart.title/help/noData`), card `#eq-gantt` doi sang `EquipmentPlanGantt`
     (`equipmentPlanGantt.title/help/noPlan`, bo `action` Legend cu). `requireProjectRead(user, id)`
     (P3D-B) va regex `^[1-9]\d*$` cho `params.id` da co san TRUOC ca 2 lenh doc moi trong `Promise.all`
     - khong sua gi them o phan kiem quyen, chi doi ten bien `shiftChart`->`monthChart`, `gantt`->`planGantt`
     va doi ham goi. `today = todayIso()` doi len truoc `Promise.all` de dung chung cho `getEquipmentPlanGantt`
     va timeline (truoc goi rieng 2 lan, gio 1 lan, cung 1 gia tri).
   - Xoa (khong con ai dung sau khi bo card cu): `src/components/project/ShiftManpowerChart.tsx` + `.test.ts`,
     `EquipmentGantt.tsx` + `.test.ts`, `src/lib/equipment-gantt.ts` + `equipment-gantt.test.ts` +
     `equipment-gantt-independent.test.ts`, `src/server/equipment-gantt-queries.ts` + `.test.ts`.
   - Xoa trong `manpower-queries.ts`: `getShiftChartData` + interface `ShiftChartData` (+ test tuong ung);
     import `ShiftMonthRow` khong con dung cung bo.
   - Xoa trong `src/lib/manpower-charts.ts`: `buildShiftBars`, `shiftChartMonths`, `shiftsForMonth`,
     `ShiftBarDatum` (chi `ShiftManpowerChart.tsx` da xoa dung; da grep xac nhan khong con noi khac) +
     test tuong ung trong `manpower-charts.test.ts`.
   - Xoa `readEquipmentPlans` + `readEquipmentUsageDays` (cung `EquipmentUsageDay`) trong
     `read-types.ts`/`read-prisma.ts`/`read-mock.ts` + test trong `read-prisma.test.ts`/`read-mock.test.ts`
     + `scripts/check-read-parity.ts` (grep xac nhan khong con noi goi ngoai cac file nay sau khi xoa
     `EquipmentGantt`/`equipment-gantt-queries.ts`).
   - `scripts/perf/bench-data.ts`: doi `getShiftChartData` -> `getManpowerMonthChartData`,
     `getEquipmentGantt(id, 'Chua gan hang muc')` -> `getEquipmentPlanGantt(id, todayIso())`.
   - Sua `src/server/projects-detail-page-render.test.ts`: 2 mo ta "P2B Buoc 2"/"P2B Buoc 4" doi theo
     key moi (`manpowerMonthChart.title`, `equipmentPlanGantt.title/noPlan`), them assertion
     `not.toContain` key cu (`manpowerCharts.shiftTitle`, `equipmentGantt.legendUsed`).
3. `c2e21a7` `feat(p3c-a): buoc 11 xoa key i18n cu equipmentGantt.* va manpowerCharts.shift*/month/noDataMonth/tipLine`
   - Prompt chot: A dang giu `vi.json`/`en.json` trong buoc nay nen XOA luon key khong con cho dung
     (khac ke hoach goc cua B la de nguyen + ghi no). Da grep `t('...')` dong, `messages.test.ts`, e2e
     truoc khi xoa.
   - Xoa het nhom `equipmentGantt` (title/help/noPlan/noWorkItem/legendUsed/tipWorkItem/tipPlan/
     tipPlanDays/tipUsedDays/unplanned) - component da xoa, khong con cho dung.
   - Trong `manpowerCharts` xoa `shiftTitle`, `shiftHelp` (chi `ShiftManpowerChart.tsx` da xoa dung) va
     3 key mo cung nhom chi `ShiftManpowerChart.tsx` dung: `month`, `noDataMonth`, `tipLine` (khong nam
     trong prefix `shift*` ma prompt neu, nhung grep xac nhan khong con cho dung sau khi xoa component -
     xoa theo tinh than chung "khong con cho dung" cua yeu cau). Giu nguyen `weeklyTitle`, `weeklyHelp`,
     `allMonths`, `plannedLine`, `weekOf`, `days`, `scrollHint`, `noData`, `total` (WeeklyManpowerStackChart
     con dung).
   - Sua `e2e/03-project-detail.spec.ts`: `vi('equipmentGantt.noPlan')` -> `vi('equipmentPlanGantt.noPlan')`;
     them kiem sau doan `#res-shift` visible: `#res-shift svg.chart` count > 0 HOAC
     `getByText(vi('manpowerMonthChart.noData'))` count > 0 (dung ca 2 nhanh du lieu/rong).

### File cam khong dung toi (dung theo yeu cau)

Khong sua `prisma/schema.prisma`, `prisma/migrations/`, `src/server/repo/types.ts` (chi doc), `app/globals.css`,
`PROGRESS.md`, `.serena/`, `CHANGELOG.md`.

### Test bi xoa + ly do

- `p3c-contract.test.ts`, `p3c-contract.qa.test.ts` (2+4=6 test): kiem tra hop dong tam thoi, het
  y nghia khi `types.ts` da co san 4 kieu that va file tam da xoa.
- `ShiftManpowerChart.test.ts` (1 test), `EquipmentGantt.test.ts` (1 test): component bi xoa.
- `equipment-gantt.test.ts`, `equipment-gantt-independent.test.ts`, `equipment-gantt-queries.test.ts`:
  logic Gantt "tung chiec" cu (`buildGantt`/`GanttModel`) da thay bang `equipment-gantt-v2.ts`/
  `buildPlanGantt` (Gantt theo dot, Buoc 4-5 cua P3C-B).
- Trong `manpower-charts.test.ts`: 8 test cua `shiftChartMonths`/`shiftsForMonth`/`buildShiftBars`
  (ham da xoa cung file nguon).
- Trong `read-prisma.test.ts`/`read-mock.test.ts`: cac test rieng cho `readEquipmentPlans`/
  `readEquipmentUsageDays` (ham da xoa).
- Test moi them bu lai: `equipment-plan-gantt-queries.test.ts` (2 test), `getManpowerMonthChartData`
  trong `manpower-queries.test.ts` (2 test).
- Tong: 206 file / 2368 test xanh (truoc Buoc 11: 212 file / 2414 test) - giam 6 file / 46 test, dung
  nhu du kien (xoa nhieu hon them vi thay 1 he thong Gantt/chart cu bang he thong moi da co san tu
  P3C-B, khong phai bo tinh nang).

### Ket qua cong kiem

- `npx tsc --noEmit`: sach (chay lai nhieu lan trong qua trinh, lan cuoi sau khi xoa key i18n cung sach).
- `npm test`: **206 file / 2368 test xanh** (chay lai lan cuoi sau tat ca thay doi, bao gom sau `npm run build`).
- `npm run check:read`: tao DB tam `ddc_control_tower_qa_a` bang psql (KHONG dung DB A that -
  `ddc_control_tower` van nguyen, `.env` khong doi), `npx prisma migrate deploy` (9 migration, co ca
  `20260926100000_p3c_a_plan_tables`) + `npx tsx prisma/seed.ts` tren DB tam -> `check:read` **OK toan bo**
  (9 ham cu + 4 ham hop dong P3C + `readManpowerActualByMonth`, du an 1 va 17). Da `DROP DATABASE ...
  WITH (FORCE)` DB tam sau khi xong.
- `npm run build` (voi `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` tro
  `D:\_project\DDC_dieu-phoi\tools\font-mock.js`): **thanh cong**, `/[locale]/projects/[id]` bien dich
  15.7 kB / 253 kB First Load JS.

### E2E - KHONG chay duoc tren may nay, ly do

- `e2e/global-setup.ts` -> `e2e/helpers/env.ts` (`isExpectedDbUrl`/`E2E_TARGETS`, them o P7-C1) chi cho
  DB + cong da dang ky: `ddc_control_tower_b` (3001) hoac `ddc_control_tower_c` (3003). A chay o cong
  3000 voi DB `ddc_control_tower` (that) hoac DB tam ngoai danh sach - guard se nem loi ngay tu
  `globalSetup`, dung nhu thiet ke bao ve (chan seed nham len DB that/khac tai khoan). Theo yeu cau
  KHONG duoc noi guard nay.
- Da lam thay: doc HTML server-render qua `curl` (dang nhap that qua `/api/auth/callback/credentials`,
  cookie NextAuth that) tren DB tam `ddc_control_tower_qa_a`, cong 3000:
  - `/vi/projects/1`: co `id="res-shift"`/`id="eq-gantt"`, tieu de dich dung "Ke hoach nhan luc theo
    thang · theo ca" va "Lich su dung thiet bi", subtitle Gantt "06/07/2026 - 29/11/2026" (khop
    `equipmentPlanSeed` cua A: min `2026-07-06`, max `2026-11-29`); khong con chuoi `equipmentGantt.`/
    `manpowerCharts.shift` nao trong HTML.
  - `/vi/projects/17`: hien dung 2 trang thai rong "Chua co ke hoach nhan luc theo thang" va "Chua co
    ke hoach thiet bi cho du an nay".
  - Day chi xac nhan phan server-render (2 chart la `dynamic(..., { ssr: false })` nen SVG that chi
    ve o client sau hydrate) va cau truc/i18n dung, KHONG thay the duoc kiem pixel-perfect that.
- **Chua kiem duoc bang trinh duyet that** (Playwright MCP hay bat ky cong cu trinh duyet nao) o
  1440px/390px cho: truc thang cua Gantt, marker "Hom nay", cot SL nay/tong; chart thang cot + 2
  duong + truc 2 tang; cuon ngang 390px, chu co de nhau khong, du an 17 hien trang thai rong dung
  vi tri. **Ly do: phien lam viec nay khong co cong cu trinh duyet (khong thay Playwright MCP/browser
  tool nao trong danh sach cong cu duoc cap)** - khac voi gia dinh trong prompt la co san. Khong co
  anh trong `.bangiao/anh-test/p3c-a-b11-*.png`.
- **De nghi Tester**: chay `npm run test:e2e -- e2e/03-project-detail.spec.ts` tren cong/DB da dang
  ky (B hoac C) hoac mo trinh duyet that o `/vi/projects/1` (1440px va 390px) + `/vi/projects/17`
  de kiem pixel truoc khi CHOT.

### Rui ro / cho Tester + security-reviewer soi ky

- `getEquipmentPlanGantt`/`getManpowerMonthChartData` KHONG tu kiem quyen (dung comment ro trong file,
  giong `getShiftChartData`/`getWeeklyChartData` cu) - dua vao `requireProjectRead(user, id)` da goi
  TRUOC ca 2 lenh nay trong `Promise.all` cua trang. Soi ky: co duong nao khac goi 2 ham nay ma bo qua
  `requireProjectRead` khong (hien tai chi trang Chi tiet va `bench-data.ts` - script perf noi bo,
  khong qua HTTP).
- Xoa key i18n `manpowerCharts.month/noDataMonth/tipLine` la quyet dinh tu suy luan "khong con cho
  dung" (grep xac nhan), khong nam trong danh sach prefix `shift*` ma prompt neu ro - neu Tester/chu
  du an muon giu lai (vd de dung lai sau) thi bao, hoan tac de dang (chi 3 dong moi file).
- 390px + nhieu thang cho `ManpowerMonthChart` (component cua B, khong sua trong buoc nay) chua duoc
  kiem tren du an that co nhieu hon 7 thang KH - chi kiem qua test co san.
- `EquipmentPlanGantt`/`ManpowerMonthChart` la component B viet o P3C-B, buoc nay chi noi day (query +
  trang) - khong sua logic ben trong 2 component, neu co loi hien thi thi soi ca file component
  (`src/components/project/EquipmentPlanGantt.tsx`, `ManpowerMonthChart.tsx`) chu khong chi trang.

### No de sau

- Kiem pixel-perfect trinh duyet that (xem muc E2E o tren) - chua lam duoc, can Tester lam bu.
- Nhan T1 co the de nhau khi KH ~ TT (da ghi tu vong truoc, chua sua - ngoai pham vi Buoc 11).
