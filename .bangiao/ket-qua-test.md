KET QUA TEST: XANH

# Kiem thu doc lap P3C-A (Tester) - 2026-09-26

Nhanh `feature/p3c-a-form-ke-hoach`, DB `ddc_control_tower` (localhost:5433), dev server cong 3000.
Skill da dung: `test-driven-development`, `verification-before-completion`.

## 1. Loi tim thay khi kiem trinh duyet that (BAT BUOC, lam KHONG dat mot yeu cau T3)

### BUG-01: O "Gia tri nguyen te" (select tien te + o so) KHONG cung 1 dong - vi pham hop dong T3

**Muc do:** Trung binh (loi hien thi/UX ro rang, khong mat du lieu, khong loi bao mat). Vi pham
truc tiep yeu cau da chot trong `D:\_project\DDC_dieu-phoi\hop-dong-du-lieu-P3C.md` (T3: `"Giá trị
nguyên tệ" gộp select tiền tệ + ô số trên 1 dòng`) va `ke-hoach.md` Task 1 (`nguyên tệ: select + ô
số cùng dòng`).

**Noi bi loi:**
- `D:\_project\DDC_Control_Tower\app\globals.css:390` dinh nghia `.inline{display:flex;align-items:center;gap:9px}`
  (class cua app dung lam khung select+input o `ProjectForm.tsx:505-517`, `data-field="contractValueOriginal"`).
- Tailwind CSS cung sinh mot utility class TRUNG TEN: `.inline{display:inline}` (vi trong code co
  chuoi literal `className="inline"` nen Tailwind JIT quet thay va tu sinh utility co san cua no).
  Trong bundle CSS bien dich cuoi cung (`layout.css`), rule `.inline{display:inline}` cua Tailwind
  nam SAU rule `.inline{display:flex}` cua app (da xac nhan bang cach doc `document.styleSheets`
  that trong trinh duyet, cung specificity `0,1,0`, luat sau THANG). Ket qua: phan tu `.inline` bi
  Tailwind ep ve `display:inline` (roi bi "blockify" thanh `display:block` vi no la con cua `.field`
  - mot flex container `display:flex;flex-direction:column`), nen KHONG con la flex row nua. Cac quy
  tac flex danh cho no (`app/globals.css:396-397`: `.feven>.field>.inline>select.inp{flex:0 0 88px}`,
  `...>input.inp{flex:1 1 auto}`) tro thanh vo hieu vi cha khong con la flex container.
- Hau qua: `<select>` (chon VND/USD...) va `<input>` (o so) khong con nam cung hang; `<input>` bi
  day xuong MOT DONG RIENG ben duoi select (chenh dung 38px = 1 hang), de bi de/chong len khu vuc
  ben duoi khi input duoc hien thi (vd khi doi tien te sang USD, o so duoc bat active va hien ro).

**Cach tai hien (da lam that tren trinh duyet that, Playwright MCP, dev server that cong 3000):**
1. Dang nhap `admin@daidung.com.vn` / `Admin@123`.
2. Mo `http://localhost:3000/vi/ho-so-du-an?mode=new` (hoac `?project=1`), 1440px hoac 390px deu
   tai hien - khong phu thuoc kich thuoc man hinh (goc la xung dot ten class CSS, khong phai do
   thieu khong gian).
3. Doi "Gia tri nguyen te" tu VND sang USD (o so tro nen active/hien ro).
4. Do bang `getBoundingClientRect()`: `select.top` va `input.top` lech dung 38px (khong `<= 2px`
   nhu yeu cau "cung dong"). Anh chup: `.bangiao/anh-test/BUG-t3-nguyen-te-fullpage-USD-1440.png`
   va `...-390.png` (thay ro o input rieng 1 dong duoi o select "USD").
5. Kiem chung goc: `getComputedStyle(el).display` cua `.inline` = `"block"` (ky vong `"flex"`);
   doc `document.styleSheets` thay 2 rule `.inline` trung ten, rule cua Tailwind
   (`display:inline`) dung SAU rule cua app (`display:flex`) trong cung 1 file `layout.css` nen
   thang cascade.

**De xuat huong sua (KHONG tu sua, de danh cho debugger):** doi ten class rieng cua app tu
`.inline` sang mot ten khong trung utility co san cua Tailwind (vd `.rowline`, `.fx-inline`) o ca
`app/globals.css` va moi cho dung trong `.tsx` (it nhat `ProjectForm.tsx` dong 507; ren toan repo
truoc khi doi vi co the co cho khac dung `className="inline"` voi ky vong flex).

**Anh bang chung:** `.bangiao/anh-test/BUG-t3-nguyen-te-2-dong-1440.png` (crop),
`BUG-t3-nguyen-te-2-dong-USD-1440.png`, `BUG-t3-nguyen-te-fullpage-USD-1440.png` (toan trang, 1440px,
thay ro o input rieng dong duoi select USD), `BUG-t3-nguyen-te-fullpage-USD-390.png` (390px).

**Tai sao coder + tester truoc (P3A) khong bat duoc:** test tu dong (`ProjectForm.test.ts`) chi
kiem markup chua dung the (`data-field="contractValueOriginal"` co `<div class="inline"><select`
va `<input`), KHONG do vi tri thuc te tren man hinh; kiem trinh duyet cua coder (theo `thay-doi.md`)
dung script Playwright tam thoi + xem anh chup toan trang - o input khi tien te la VND bi `disabled`
nen gan nhu vo hinh tren nen toi, chi hien ro khi doi sang ngoai te (USD...), luc do moi thay o rieng
dong.

## 2. Cac hang muc DA KIEM VA DAT (bang chung that, khong doan)

### 2.1 Cong kiem tu dong
- `npx tsc --noEmit`: **sach** (chay lai lan cuoi sau khi them 4 file test QA).
- `npm test`: **186 file / 2151 test xanh** (moc coder ban giao 182 file/2065 test + 4 file QA moi
  cua Tester = 86 test moi, khong test nao rot).
- `npm run check:read`: **OK toan bo** (18 ham doc doi chieu prisma vs mock, du an 1 va 17).
- `npx prisma migrate status`: **up to date**.

### 2.2 Test QA moi (doc lap voi test cua coder, dang `*.qa.test.ts`)
- `src/lib/equipment-plan.p3c-a.qa.test.ts` (25 test): `findOverloads`/`validateEquipmentPlan` -
  duong thuan, dot cham dung ngay dau/cuoi cua dot khac (chong 1 ngay), dot 1 ngay (`from===to`) tu
  no da vuot, nhieu khoang vuot ROI RIENG khong lien tuc, 3 dot chong 1 phan (`used:5`), equipmentId
  trung/la, `to < from`, ngay khong hop le, 301 dot -> `tooManySegments`, so nhom vuot
  `EQUIP_GROUP_MAX`, `toEquipmentGroupDrafts`/`normalizeEquipmentGroups`/`equipGroupsAuditText`
  (dung mau chuoi + cat 2000 ky tu), va 1 truong hop PHAI THAT BAI bat buoc (totalQty am).
- `src/lib/manpower-plan.p3c-a.qa.test.ts` (38 test): `splitTotal` lam tron + ca cuoi nhan phan du +
  tong luon = total (50 bo ngau nhien seed co dinh), `recomputeMonth` giu o sua tay khi doi
  Tong/ty le, `below_manual`/`all_manual`, `resetMonthToRatio`, `isRatioSumValid` dung/sai bien
  +-0.001, `defaultShiftRatios`/`resolveShiftRatios`, `validateManpowerPlan` (shifts/range/sum,
  yearMonth, duplicate, cells, tooManyMonths, thang toan 0 hop le), audit text dung mau, va 1
  truong hop PHAI THAT BAI bat buoc (planned NaN).
- `src/server/actions-p3c-a-quyen.qa.test.ts` (12 test): quyen ghi ca 2 action
  (`saveEquipmentPlansAction`, `saveManpowerPlanAction`) - admin ok moi du an; data-entry (pm@) la
  PIC du an 1 thi ok, du an 16 (KHONG duoc gan) thi Forbidden; viewer (ke ca duoc gan Backup de doc
  du an 1) thi Forbidden; bod Forbidden; chua dang nhap Forbidden; payload sai kieu (totalQty/planned
  am) bi zod chan truoc khi cham repo (`Invalid input`).
- `src/server/repo/form-p3c-a-doc-ghi.qa.test.ts` (11 test): dung kieu + thu tu 4 ham doc hop dong
  (`readEquipmentPlanSegments` sort equipmentId+from; `readEquipmentQuotas` sort equipmentId;
  `readManpowerPlanMonths` sort yearMonth+sortOrder ca; `readShiftRatios` mac dinh khi du an rong);
  `replaceManpowerPlan` CHI ghi audit cho thang co doi (gui lai y het -> 0 audit moi; doi 1/7 thang
  -> dung 1 dong audit, 6 thang con lai KHONG doi); doi ty le rieng (audit rieng, khong dung thang
  nao); du an chua co dong ty le luu dung mac dinh -> KHONG ghi audit ty le; `replaceEquipmentPlans`
  1 dong audit "replace" chua "tong", luu mang rong xoa sach dung du an do.

### 2.3 Migration + rollback (Task 2) - kiem doc lap THAT tren DB that, AN TOAN (tu huy transaction)
- Da doc `prisma/migrations/20260926100000_p3c_a_plan_tables/migration.sql` va
  `prisma/rollback/20260926100000_p3c_a_plan_tables.down.sql`: dung nhu dac ta trong `ke-hoach.md`
  Task 2 (GREATEST(COUNT(DISTINCT unitNo),1) cho du lieu cu; CHECK constraint; FK Cascade/Restrict
  dung bang).
- Da CHAY THAT toan bo noi dung rollback SQL (bao gom DROP TABLE, tach dot qty=n thanh n dong, DROP
  COLUMN qty, ALTER unitNo NOT NULL) trong 1 Prisma `$transaction` roi CHU DONG throw de Prisma tu
  ROLLBACK - khong commit gi vao DB that. Ket qua kiem TRONG transaction (truoc khi rollback):
  - Dong scratch tu chen (`equipmentId=4`, `unitNo=NULL`, `qty=3`) -> tach dung 3 dong `unitNo` 1,2,3.
  - Dong that co san du an 1 `equipmentId=1` (qty goc 1,3,2 tren 3 dot) -> tach dung 6 dong
    `unitNo` = [1,1,1,2,2,3] (dot qty=1 khong tach them; dot qty=3 tach 3; dot qty=2 tach 2).
  - 3 bang moi (`project_equipment_quota`, `project_manpower_plan_month`, `project_shift_ratio`)
    bi xoa dung; cot `qty` bi xoa, `unitNo` tro lai `NOT NULL`.
  - SAU KHI throw: da hau kiem DB that - dong scratch = 0, 3 bang moi con du 3, cot `qty` con 1 ->
    XAC NHAN DB that KHONG bi anh huong gi.
- Doi chieu du lieu that hien tai qua `mcp__postgres` (read-only): `project_equipment_quota` du an 1
  = `{1:3, 2:2, 3:4}`, `project_equipment_plan` du an 1 = 7 dong `unitNo NULL` dung seed;
  `project_manpower_plan_month` 7 thang dung [450,700,800,900,800,650,400]; `project_shift_ratio` =
  `morning 0.6, evening 0.4`; `dim_shift` = `morning`(sortOrder1)/`evening`(sortOrder2), ca deu
  `isActive`. Khop hoan toan hop dong P3C va bang seed trong `ke-hoach.md` Task 5.

### 2.4 Kiem trinh duyet that (Playwright MCP, dev server that cong 3000, DB `ddc_control_tower`)

**T3 - form Tao/Sua (`/vi/ho-so-du-an?mode=new`), 1440px va 390px:**
- Dau `?` cung dong nhan (`labelHeight` = 18px deu nhau, khong bi day xuong dong rieng) - DAT.
- 5 khoi `.f4.feven` deu co cac o cung `top`/`height=38` trong tung hang (do bang
  `getBoundingClientRect()` tung o) - DAT.
- Go ma `M-1` o che do Tao -> o Ma CT to do (`class="inp bad"`) + dong loi dung
  `projectForm.err.code_reserved` - DAT.
- **O "Gia tri nguyen te" (select + input) KHONG cung dong - xem BUG-01 o tren.**

**T4 - KH thiet bi theo dot (`/vi/nhap-lieu?project=1&step=resources`), 1440px:**
- Hien dung 3 loai thiet bi seed (Cau banh xich tong 3/3 dot, Cau banh lop tong 2/2 dot, Xe nang
  nguoi tong 4/2 dot), dung so lieu nhu seed - DAT.
- Sua 1 o SL dung de tao chong ngay vuot Tong SL (Xe nang nguoi: dot 2 tu 1 -> 2, lam doan
  15/09-30/09 dung 5 > tong 4) -> hien dung dong loi
  `"Xe nâng người: từ 15/09/2026 đến 30/09/2026 dùng 5, vượt Tổng SL 4"` + CA 2 o SL dung lien quan
  deu to do (`class="inp bad"`) + bam "Luu ke hoach thiet bi" KHONG luu (da doi chieu DB that: du
  lieu du an 1 khong doi) - DAT dung nhu hop dong (transaction, khong mat du lieu cu khi validate
  that bai).

**T5 - KH nhan luc thang (cung trang), 1440px:**
- Bang 7 thang dung so seed (450..400), ty le 60/40 - DAT.
- Sua tay 1 o ca (thang 09/2026, ca sang 540->600) -> o do co `data-manual="1"`, vien
  `var(--accent)` (xanh), o Tong tu dong cong lai dung (960) - DAT.
- Doi Tong (900->1000) -> o da sua tay GIU nguyen (600), o con lai tu tinh lai (400=1000-600) - DAT
  dung K8.
- Doi Tong xuong duoi tong o sua tay (500 < 600) -> hien dung loi
  `"Tổng nhỏ hơn tổng các ô đã sửa tay (600)"`, nut "Luu ke hoach nhan luc" bi VO HIEU HOA
  (`disabled`) - DAT.
- Bam "Tinh lai theo ty le" -> het co sua tay, chia lai theo 60/40 - DAT.
- Da THU LUU THAT 1 lan (hop le, 600/400 thang 09) qua UI de xac nhan hanh vi dau-cuoi that: bam
  "Luu ke hoach nhan luc" -> hien "Da luu 1 thang thay doi"; doi chieu DB that dung 600/400
  `isManual:false` - DAT. **Da chay lai `npx prisma db seed` + `npm run check:read` (OK toan bo)
  ngay sau do de dua DB ve dung seed goc** (da doi chieu lai: thang 09/2026 = 540/360 nhu seed).

### 2.5 Cac muc khac
- Quyen ghi: xem 2.2 (test tu dong) + da xac nhan cung logic o `src/server/action-guards.ts`
  (`requireWriteProject` -> `canWriteProject`: chi admin hoac data-entry duoc gan PIC/Backup).
- E2E Playwright cua repo (`e2e/04-data-entry.spec.ts`, `05-import.spec.ts`): **BO QUA** - dung
  ly do coder da ghi trong `thay-doi.md` (`e2e/global-setup.ts` chan cung DB B/cong 3001, sua file
  do ngoai pham vi P3C-A). Da thay the bang kiem tay qua Playwright MCP tren dev server that cong
  3000/DB `ddc_control_tower` (muc 2.4 o tren) nen coi la du bang chung cho T4/T5.
- Migration data cu (chuyen tu du lieu P3A) khong the tao lai tren DB that (du lieu cu da bi ghi de
  boi seed moi tu Task 5 cua chinh phase nay) - da kiem bang doc code SQL (khop dac ta) thay vi chay
  lai; phan tach dot qua rollback (rui ro cao hon, hay xay ra loi so hoc/thu tu) DA duoc kiem THAT
  nhu muc 2.3.

## 3. Ket luan

Con **1 loi that (BUG-01)** lam KHONG dat mot yeu cau hien thi da chot trong hop dong P3C (T3:
"nguyen te select + o so cung dong"). Cac hang muc con lai (T4, T5, 4 ham doc, quyen ghi, migration/
rollback, cong kiem tu dong) deu DAT voi bang chung that. De nghi Reviewer/debugger xu ly BUG-01
(doi ten class `.inline` cua app sang ten khac khong trung Tailwind utility) roi kiem lai truoc khi
CHOT phase.

Khong tu sua code san pham. Dung lai tai day theo dung quy trinh.

## Vong 2 (Tester, kiem lai sau Debugger vong 1) - 2026-09-26

Nhanh `feature/p3c-a-form-ke-hoach`, commit dang kiem `66c8983` (fix BUG-01: doi `.inline`
sang `.inline-row` o `app/globals.css`, `ProjectForm.tsx`, `DataEntryForm.tsx`,
`EquipmentPlanEditor.tsx`). Skill da dung: `test-driven-development`, `verification-before-completion`.
Dev server that cong 3000, DB `ddc_control_tower`, dang nhap that `admin@daidung.com.vn`/`Admin@123`,
kiem trinh duyet bang Playwright MCP (co san lan nay).

### 1. BUG-01 - xac nhan DA DONG tren trinh duyet that

O "Gia tri nguyen te" (`data-field="contractValueOriginal"` o `/vi/ho-so-du-an?mode=new`),
do bang `getBoundingClientRect()`:

- **1440px, tien te VND (mac dinh, o so `disabled`):** `wrap.display = "flex"`, `select.top = 548`,
  `input.top = 548` -> lech **0px**.
- **1440px, doi tien te sang USD (o so active):** `select.top = 548`, `input.top = 548`,
  `input.height = 38` -> lech **0px**. Anh: `.bangiao/anh-test/tester-v2-bug01-usd-1440.png`.
- **390px, doi tien te sang USD:** `select.top = 1118`, `input.top = 1118` -> lech **0px**.
  Anh: `.bangiao/anh-test/tester-v2-bug01-usd-390.png`.
- Ca tao moi (`?mode=new`) va kiem lai o cung file `ProjectForm.tsx` dung chung cho ca che do sua
  (cung component, cung markup) - khong can lap lai rieng `?project=1`.

**Ket luan: BUG-01 DA DONG**, dung nhu Debugger bao cao.

### 2. Khong vo cho khac dung class cu `.inline` -> `.inline-row` (khat khe pixel, 1440px + 390px)

Do `getComputedStyle(...).display` va `getBoundingClientRect()` cho tat ca phan tu `.inline-row`
tren 3 trang, ca 2 kich thuoc man hinh:

| Noi | 1440px | 390px |
|---|---|---|
| `ProjectForm.tsx` - khung "Gia tri nguyen te" | `display:flex`, top select=input=548, lech 0px | top=1118, lech 0px |
| `ProjectForm.tsx` - Switch "Da bi phat" | `display:flex`, top switch/text = 1984/1986 (lech 2px, do can giua doc trong hang cao hon element - khong phai loi BUG-01) | top = 1984/1986 tuong tu |
| `ProjectForm.tsx` - dong dem "* Bat buoc · N/19 truong da dien" o thanh sticky duoi | `display:flex`, height 18, 1 dong | tuong tu |
| `DataEntryForm.tsx` - `<label>` checkbox "Ap dung" tung giai doan (`/vi/nhap-lieu?project=1`, buoc Tien do) | 7/7 nhan deu `display:flex`, checkbox va o % cung hang (lech 1-2px do can giua, khong tach dong) | 7/7 nhan tuong tu, lech 1-2px |
| `EquipmentPlanEditor.tsx` - hang chon thiet bi trong nhom (`/vi/nhap-lieu?project=1&step=resources`) | 3/3 nhom `display:flex`, height 84 (co `flexWrap:'wrap'` theo dung code, khong bi sap sang dong don) | 3/3 nhom tuong tu, `display:flex` |

Anh: `.bangiao/anh-test/tester-v2-equip-390.png` (EquipmentPlanEditor 390px),
`.bangiao/anh-test/tester-v2-projectform-fullpage-1440.png` (toan trang ProjectForm 1440px, xem bang
mat thuong: hang "Gia tri nguyen te" va hang "Da bi phat hop dong?" deu 1 dong).

Khong con cho nao trong `src/`/`app/` dung `className="inline"` tran (da grep xac nhan, xem muc 4).

Khong phat sinh loi console moi (`browser_console_messages` level error: 0 loi).

### 3. Cong kiem tu dong (chay lai toan bo, lan nay)

- `npx tsc --noEmit`: **sach**.
- `npm test`: **186 file / 2153 test xanh** (moc Debugger 186/2151 + 2 test guard moi cua Tester,
  khong test nao rot).
- `npm run check:read`: **OK toan bo** (18 ham doc, du an 1 va 17).
- `npx prisma migrate status`: **up to date**.
- Khong luu du lieu qua UI lan nay (chi doi tien te de do vi tri, khong bam Luu) nen KHONG can chay
  lai `npx prisma db seed`.

### 4. Test moi them - chan tai phat BUG-01 (TDD, da xac nhan RED truoc khi GREEN)

Them 2 test vao `src/ui/legacy-style-guard.test.ts` (file guard co san tu truoc, dung de canh style
cu toan `.tsx` trong `src/` + `app/`):

1. `BANNED chan className="inline" tran (P3C-A BUG-01), khong chan inline-row/inline-flex`: kiem
   rule regex moi (`/className=(["'])inline\1/`) khop `className="inline"`/`className='inline'`
   nhung KHONG khop `inline-row`/`inline-flex`/`inline-block`.
2. `khong con file nao trong src/ va app/ dung className="inline" tran`: quet toan bo `FILES`
   (danh sach `.tsx` co san trong file guard) bang chinh regex tren.

**Da lam dung TDD (RED truoc khi GREEN, khong doan):**
- Viet test 1 TRUOC khi them rule vao mang `BANNED` -> chay `npx vitest run src/ui/legacy-style-guard.test.ts`
  -> **THAT BAI dung ly do mong doi**: `chua co rule chan class "inline" tran trong BANNED: expected undefined to be truthy`
  (88 test khac van xanh, dung 1 test moi do rot).
- Them rule vao `BANNED` -> chay lai -> **89/89 test xanh**.
- Day chinh la "1 truong hop phai that bai" theo yeu cau (nhom 3): rule regex duoc chung minh la
  BAT DUOC dung mau loi BUG-01 truoc khi duoc chap nhan xanh, khong phai chi doan.

File test duy nhat bi sua: `src/ui/legacy-style-guard.test.ts` (them 2 `it`, them 1 phan tu vao
mang `BANNED` co san trong chinh file test - khong dung code san pham).

### 5. Ket luan vong 2

BUG-01 **DA DONG**, khong phat sinh regression o cac cho dung chung class `.inline-row` (Switch
"Da bi phat", dong dem thanh duoi, DataEntryForm, EquipmentPlanEditor), o ca 1440px va 390px. Cong
kiem tu dong xanh toan bo, khong tut so test. Da them test chan tai phat, xac nhan RED-GREEN that
(khong chi doan). **Du dieu kien de Reviewer CHOT phase.**

