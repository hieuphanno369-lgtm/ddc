KET QUA TEST: DO

# Kiem doc lap Buoc 11 (gan chart T4/T5 vao trang Chi tiet) - P3C-A

Skill da dung: `test-driven-development`, `verification-before-completion`.
Nhanh: `feature/p3c-a-form-ke-hoach`, commit dang kiem: `954d31a`, `2c6598d`, `c2e21a7`, `fa4e226`.

## 1. Ket luan ngan gon

DO vi tim thay **2 bug that** (khong phai loi moi truong, da tai hien bang test tu dong +
anh chup man hinh that): nhan chu bi de len nhau trong 2 chart moi cua Buoc 11.
Ngoai 2 bug nay, toan bo hanh vi con lai (truy van, quyen doc, trang thai rong, cuon ngang,
i18n vi/en, khong loi console moi) deu dung nhu ke hoach.

Da viet 4 file test doc lap (`*.qa.test.ts`, khong sua code san pham):
- `src/server/equipment-plan-gantt-queries.qa.test.ts` (6 test, xanh)
- `src/server/manpower-queries.qa.test.ts` (6 test, xanh)
- `src/components/project/EquipmentPlanGantt.qa.test.ts` (4 test, **1 do**)
- `src/components/project/ManpowerMonthChart.qa.test.ts` (5 test, **1 do**)

## 2. Cong kiem

- `npx tsc --noEmit`: **sach**.
- `npm test`: **210 file / 2389 test** (truoc khi Tester them: 206 file / 2368 test).
  **2 test rot** (ca 2 la test "phai that bai" viet co chu dich de chung minh 2 bug o muc 3,
  khong phai flaky/loi moi truong). 208 file / 2387 test con lai xanh.
- `npm run check:read`: chay tren DB tam `ddc_control_tower_qa_a` (tao bang psql, migrate
  deploy 9 migration + `npx tsx prisma/seed.ts`) -> **OK toan bo**. Da `DROP DATABASE ...
  WITH (FORCE)` sau khi xong, khong dung DB `ddc_control_tower` that.
- Khong sua bat ky file san pham nao (chi tao 4 file `*.qa.test.ts` moi + anh trong
  `.bangiao/anh-test/`).

## 3. Bug tim thay (muc do: Trung binh - loi hien thi, khong mat du lieu, khong loi bao mat)

### BUG-A: `EquipmentPlanGantt.tsx` - header cot "SL nay/tong" de len nhan tick truc dau tien

- **File:** `src/components/project/EquipmentPlanGantt.tsx` dong 54-56 (header `colQty`, x =
  `NAME_W + QTY_W/2` = 228) va dong 62-64 (nhan tick truc, tick dau tien luon co x = `ML` =
  `NAME_W + QTY_W` = 266, vi `xOf(axis.from, dom, ML, IW)` voi `axis.from` chinh la ngay bat
  dau truc -> luon tra ve dung `ML`). Ca 2 `<text>` cung ve tai y = `MT - 18` = 22.
- **Vi sao luon xay ra:** `buildGanttAxis` (`src/lib/equipment-gantt-v2.ts` dong 36-60) luon
  dat `axis.from` = tick dau tien (ca che do tuan lan thang), nen khoang cach tam 2 chu **luon
  dung 38px** (266-228), bat ke du lieu du an nao - khong phai truong hop hiem, xay ra voi
  MOI Gantt co truc thang (va ca truc tuan, vi cung logic).
- **Tai hien that (Playwright MCP, dev server that cong 3000, DB tam
  `ddc_control_tower_qa_a` seed chuan, dang nhap that):** `/vi/projects/1`, 1440px, card
  `#eq-gantt`. Anh: `.bangiao/anh-test/p3c-a-b11-eqgantt-1440.png` (dong dau bang, chu
  "SL nay/tổ07.2026" bi de nhau, doc khong ro). Cung tai hien o 390px:
  `.bangiao/anh-test/p3c-a-b11-eqgantt-390.png`.
- **Test tu dong (RED, khong sua):**
  `src/components/project/EquipmentPlanGantt.qa.test.ts` mo ta "BUG tim thay (PHAI THAT BAI)":
  do toa do x that tu markup SVG (khong doan bang mat), khang dinh khoang cach tam 2 chu phai
  >= 60px (nua do rong uoc luong 2 chuoi) - code hien tai chi co 38px nen test **THAT BAI**:
  `expected 38 to be greater than or equal to 60`.
- **Goi y huong sua (khong tu sua):** doi x cua header `colQty` ve giua vung NAME_W..ML (thay
  vi giua vung QTY_W rieng), hoac chi hien header cot khi khong co tick nao trong vung do,
  hoac day tick dau tien vao trong 1 chut (vd bat dau ve tick tu `X(tk.date) + offset` khi
  `i === 0`).

### BUG-B: `ManpowerMonthChart.tsx` - nhan duong "TT TB/ngay" de len nhan cot ca khi 2 gia tri gan nhau

- **File:** `src/components/project/ManpowerMonthChart.tsx` dong 108-112 (nhan gia tri tren
  cot, ve tai `y = barY - 4`) va dong 151-157 (nhan diem TT TB/ngay, ve tai `y = p.y + 16`,
  cung thang do Y voi cot). Khi gia tri TT gan bang gia tri 1 cot (cung thang), khoang cach
  giua 2 nhan chi con vai px.
- **Tai hien that voi so lieu SEED THAT cua du an 1** (thang 09/2026: KH Ca sang 540, KH Ca
  toi 360, TT TB/ngay 453): anh `.bangiao/anh-test/p3c-a-b11-resshift-1440.png` - chu
  "453" (mau xanh la) va "360" (mau xam, nhan cot Ca toi) de chong len nhau thanh
  "45360" khong doc duoc so nao.
- **Test tu dong (RED, khong sua):**
  `src/components/project/ManpowerMonthChart.qa.test.ts` dung dung 3 so 540/360/453 (sao chep
  tu seed that), do toa do y that cua 2 the `<text>`, khang dinh khoang cach doc >= 14px (~1
  dong chu) - code hien tai chi cach **0.46px** (gan nhu chong khit) nen test **THAT BAI**:
  `expected 0.46000000000000796 to be greater than or equal to 14`.
- **Goi y huong sua (khong tu sua):** khi `|actualAvg - plannedTotal_cua_ca_gan_nhat| ` nho,
  day 1 trong 2 nhan sang ben (dich ngang) hoac danh 1 offset lon hon cho nhan diem TT khi no
  nam trong vung +-14px quanh dinh 1 cot bat ky trong cung thang.

## 4. Kiem trinh duyet that (Playwright MCP) - tung muc

Moi truong: DB tam `ddc_control_tower_qa_a` (tao bang psql, migrate deploy + `npx tsx
prisma/seed.ts`), dev server that `npm run dev -- -p 3000`, dang nhap that
`admin@daidung.com.vn` / `Admin@123` (va `viewer@daidung.com.vn` / `Viewer@12345` cho muc
quyen xem). Da kiem `devicePixelRatio` truoc: MCP dang zoom **90%** (`devicePixelRatio:
0.8999...`) - da dat lai viewport `1296x810` (=1440x900 CSS thuc, xac nhan bang
`window.innerWidth === 1440`) va `351x760` (=390x844 CSS thuc, xac nhan `innerWidth === 390`)
truoc khi do dac/chup anh, dung nhu luu y trong yeu cau.

| Muc | Ket qua | Bang chung |
|---|---|---|
| `/vi/projects/1` 1440px: truc thang MM.YYYY, marker "Hom nay", cot SL nay/tong, tooltip | **Dat** (tru BUG-A o header/tick) | `p3c-a-b11-eqgantt-1440.png`, `p3c-a-b11-full-1440.png` |
| `/vi/projects/1` 1440px: chart thang cot theo ca + duong tong KH + duong net dut TT, truc 2 tang | **Dat** (tru BUG-B o nhan TT) | `p3c-a-b11-resshift-1440.png` |
| `/vi/projects/1` 390px: Gantt + chart cuon ngang trong khung, trang khong tran ngang | **Dat** - do bang `getBoundingClientRect`/`scrollWidth`: `document.documentElement.scrollWidth` (379) <= `innerWidth` (390) -> KHONG cuon ngang trang; `div` boc SVG Gantt co `scrollWidth` 720 > `clientWidth` 306 -> CO cuon ngang NOI BO khung (dung thiet ke) | `p3c-a-b11-eqgantt-390.png`, `p3c-a-b11-resshift-390.png` |
| `/en/projects/1`: tieu de dich dung, khong con chuoi key i18n cu, co SVG | **Dat** - `eqTitle: "Equipment usage schedule"`, `resTitle: "Monthly manpower plan · by shift"`, `hasOldKeyLeftover: false` (kiem `equipmentGantt.`/`manpowerCharts.shift` khong con trong `body.innerText`) | do qua `browser_evaluate`, khong chup anh rieng (khong co gi khac vi so voi vi ngoai dich) |
| `/vi/projects/17`: 2 trang thai rong dung cho, dung chu | **Dat** - "Chua co ke hoach nhan luc theo thang", "Chua co ke hoach thiet bi cho du an nay", khong co the `<svg>` nao trong 2 card | `p3c-a-b11-p17-empty-1440.png` |
| Tai khoan viewer xem duoc trang, khong loi | **Dat** - dang nhap `viewer@daidung.com.vn`, vao `/vi/projects/1` binh thuong, ca 2 card co SVG, khong redirect, khong loi | kiem qua `browser_evaluate` (`eqExists/resExists/eqHasSvg/resHasSvg` deu true) |
| Console khong co loi moi | **Dat** - 3 warning console deu la warning san co tu truoc (`recharts` `defaultProps` deprecated, tu `WeeklyManpowerStackChart`/`SCurve`/`SpiCpiLine` - KHONG lien quan `EquipmentPlanGantt`/`ManpowerMonthChart`, 2 component nay tu ve SVG khong dung `recharts`) | log console giu trong phien lam viec |

### Luu y quan trong ve cong cu do pixel trong phien nay

Trong luc do, phat hien **Playwright MCP trong moi truong nay chup anh element/viewport SAI
VI TRI mot cach he thong** sau khi trang da cuon xa (vd `page.locator('#eq-gantt').screenshot()`
hoac `page.screenshot({clip})` sau khi `scrollIntoView`): toa do do bang
`getBoundingClientRect()` (va ca cay accessibility - da doi chieu 2 nguon deu khop nhau, deu
dang tin cay) khong khop voi vi tri thuc su duoc chup - anh tra ve luon la 1 vung khac cua
trang (lech ~400-530px, khong on dinh 1 gia tri co dinh). Day la **loi cong cu, khong phai loi
san pham**: da xac nhan bang `page.screenshot({fullPage:true})` KHONG bi loi nay (chup dung),
nen giai phap ap dung la: chup toan trang bang `fullPage:true` ngay sau khi `scrollY` con la 0
(vua nap trang, chua cuon gi), roi cat anh bang Python Pillow (`PIL.Image.crop`) theo toa do
tuyet doi lay tu `getBoundingClientRect()` luc `scrollY === 0` (luc nay toa do viewport = toa
do tuyet doi trong anh). Cach nay cho ket qua dung 100% (da doi chieu bang mat voi anh full
page). Tat ca anh trong bao cao nay deu qua quy trinh nay, dam bao dang tin cay. Ghi lai de
lan sau (Bien) khong mat thoi gian dieu tra lai.

## 5. E2E - khong nghi guard, thay bang gi

Theo dung yeu cau: **KHONG nghi guard `isExpectedDbUrl`/`E2E_TARGETS` trong
`e2e/helpers/env.ts`** (chi cho DB+cong cua B 3001 va C 3003), KHONG chay e2e tren worktree
cua B/C. Thay the bang kiem tay tung buoc tuong duong `e2e/03-project-detail.spec.ts` qua
Playwright MCP tren cong 3000 / DB tam `ddc_control_tower_qa_a` cua A:

- Dang nhap that (`admin@daidung.com.vn`/`Admin@123`), vao `/vi/projects/1`: xac nhan
  `#res-shift` va `#eq-gantt` co mat, co the `<svg class="chart">` (tuong duong dong spec kiem
  `#res-shift svg.chart` count > 0).
- Vao `/vi/projects/17`: xac nhan hien dung 2 chuoi trang thai rong (tuong duong nhanh
  `manpowerMonthChart.noData` / `equipmentPlanGantt.noPlan` cua spec).
- Kiem key i18n cu khong con trong DOM (tuong duong doi
  `vi('equipmentGantt.noPlan')` -> `vi('equipmentPlanGantt.noPlan')` trong spec).

## 6. Hoi quy nhanh commit `a524407` (o ca dang go do thi tra ca dong ve luc focus)

- Kiem qua unit test co san `src/components/form/manpowerPlanState.test.ts` (khong doi, van
  xanh trong lan chay `npm test` toan bo o muc 2).
- **Khong kiem duoc bang tay tren trinh duyet** (o `/vi/nhap-lieu`): sau khi doi tu tai khoan
  viewer ve lai admin de kiem hoi quy nay, phien dang nhap NextAuth trong Playwright MCP bi
  ket (form dang nhap khong nhan gia tri nhap moi qua `fill`/`type` binh thuong dan toi
  `Dang nhap` khong chuyen trang, kha nang do cache credential cua trinh duyet MCP + CSRF
  token; da thu clear cookie, nhap lai nhieu lan van khong vao duoc). Day la gioi han moi
  truong cua phien nay, khong phai loi san pham (da xac nhan gian tiep: unit test
  `manpowerPlanState.test.ts` van xanh, va cong viec doi tuong nay da duoc coder kiem tay that
  qua Playwright rieng trong `thay-doi.md` cua vong sua truoc voi anh chung minh). **De nghi**:
  neu can chac chan hon, mo lai phien trinh duyet moi (khong tai su dung session cu) roi dang
  nhap admin ngay tu dau, vao `/vi/nhap-lieu` -> buoc "Nhan luc & Thiet bi" -> xoa o ca bang
  Backspace -> kiem tra ca dong tra ve dung so cu.

## 7. Pham vi da doc, chua sua

Da doc `.bangiao/thay-doi.md` (muc "Buoc 11") va `.bangiao/archive/p3c-b-chart-2026-09-26/ke-hoach.md`
(muc "Buoc 11" 11.1-11.6 va "Truong hop bien bat buoc"). Khong dung file san pham nao (chi
doc). Khong sua `D:\_project\DDC_dieu-phoi\`.

## 8. Ket luan cho Reviewer

Dung dai o day. Theo dung quy trinh: tim ra 2 bug that (BUG-A, BUG-B), da co test tu dong RED
chung minh + anh chup that, KHONG tu sua code san pham. De nghi coder vao lai xu ly 2 bug nay
(hoac Reviewer quyet dinh muc do uu tien - ca 2 deu la loi hien thi/UI, khong anh huong du
lieu hay bao mat) roi cho Tester chay lai 2 file `EquipmentPlanGantt.qa.test.ts` va
`ManpowerMonthChart.qa.test.ts` de xac nhan xanh.
