KET QUA TEST: XANH

## Kiem lai vong 2 (Tester doc lap) - Buoc 11, 2026-09-26

Skill da dung: `test-driven-development`, `verification-before-completion`.
Nhanh `feature/p3c-a-form-ke-hoach`, kiem cac commit `a1fbaa6`, `7a9ff2a` (sua CS-1 + 6 loi chu de nhau vong truoc).

### Ket luan: XANH

Khong tim them loi moi. Da kiem lai bang du lieu THAT nhap qua giao dien (khong doan, khong doc code
suy dien) tren DB tam `ddc_control_tower_qa_a`, dev server that cong 3000, dang nhap that
`admin@daidung.com.vn` (mat khau seed dev, xem `src/data/seed/history.ts`), trinh duyet that (Playwright MCP, zoom 90%, da dat viewport
1296x810 = 1440x900 CSS va 351x760 = 390x844 CSS, kiem `innerWidth` truoc moi lan do).

### 1. Gantt thiet bi `#eq-gantt` - 3 kich ban du lieu that (nhap qua UI, bam Luu that)

- **Du an 1 (sua tu seed): 12 thang** - keo dai `Cau banh xich` dot 1 tu `2026-01-05`, dot 3 den
  `2026-12-20` (giu nguyen 2 dot chong ngay san co cua seed). Da bam "Luu ke hoach thiet bi", server
  tra "Da luu 3 loai thiet bi, 7 dot".
- **Du an 2 (SVĐ Hung Vuong): 24 thang** - nhap moi 1 loai `Cau banh xich`, Tong SL 5, 3 dot:
  `2025-01-05..2025-08-15 x3`, `2025-07-01..2026-06-30 x2` (chong voi dot 1 tu 07-01: 3+2=5 = Tong,
  khong vuot), `2026-07-01..2026-12-30 x4`. Luu thanh cong "1 loai thiet bi, 3 dot".
- **Du an 3 (Apec S3): 75 ngay (<=92, truc tuan)** - 1 loai `Cau banh xich`, Tong SL 2, 1 dot
  `2026-06-01..2026-08-15 x2`. Luu thanh cong "1 loai thiet bi, 1 dot".

Do that bang `getBoundingClientRect()` tren tung `<text>` trong `#eq-gantt svg.chart` (khong dung
accessibility tree, dung DOM SVG that):

| Kich ban | Man hinh | Locale | Tick dau - tick 2 (mau) | Header "SL nay/tong" - tick dau | Tat ca cap tick lien ke | Tick can giua luoi |
|---|---|---|---|---|---|---|
| 12 thang (DA1) | 1440 | vi | 24,55px | 30,98px | 18,53 - 24,87px (11 cap) | dung (lech <0,2px, do bang `getScreenCTM`) |
| 12 thang (DA1) | 1440 | en | - | 26,79px | tuong tu vi | - |
| 12 thang (DA1) | 390 | vi | 22,03px | - | 16,66 - 22,32px (11 cap) | - |
| 12 thang (DA1) | 390 | en | - | 24,28px | - | - |
| 24 thang (DA2) | 1440 | vi | 21,54px | 30,98px | 21,54 - 24,55px (11 cap, 12 nhan hien/24 thang = buoc 2) | - |
| 24 thang (DA2) | 390 | vi | 19,35px | - | 19,35 - 22,03px (11 cap) | - |
| 75 ngay/truc tuan (DA3) | 1440 | vi | 40,14px | 36,58px | 39,40 - 40,14px (10 cap) | - |
| 75 ngay/truc tuan (DA3) | 390 | vi | 35,96px | - | 35,22 - 35,96px (10 cap) | - |

Moi khoang cach deu duong (khong am) va >= 2px o ca 8 to hop man hinh x locale x kich ban da do
(24 phep do rieng, khong chi 1 mau) - CS-1 (tick can giua, sua o `7a9ff2a`) va BUG-A (header de tick
dau, sua o `a1fbaa6`) van dung sau khi doi ca 3 kich ban do vong truoc chua kiem het (12/24 thang/tuan).
Nhan "Hom nay" (vd "Hom nay 26.09", y 4230,9-4243,5) khong giao nhan tick nao (hang tick o y
4249,9-4262,5, cach 6,4px ve truc doc).

390px ca 3 du an: `document.documentElement.scrollWidth` (379) <= `innerWidth` (390) - trang khong
tran ngang; khung boc SVG (`#eq-gantt .bd > div[style*="overflow-x"]`) co `scrollWidth` 1000 >
`clientWidth` 306 - cuon ngang NOI BO dung thiet ke; hinh chu nhat cua khung nam gon trong card
(vd DA1: wrap left/right 36,7/342,5 nam trong card 19,99/359,27) - khong tran card.

### 2. Chart KH nhan luc `#res-shift` - du an 1 (seed, 2 ca) va du an 4 (that, 1 ca)

- Du an 1 (seed, khong doi): dung thuat toan quet toan bo cap `<text>` trong svg tim giao nhau
  bang bounding box (khong chi do 1-2 nhan nhu vong truoc) - **48 nhan chu, 0 cap giao nhau** o ca
  1440px va 390px. Truong hop kho nhat cua BUG-B (thang 09/2026: KH 540/360, TT TB/ngay 453) van
  tach ro: nhan "453" cach nhan cot "540" 3,3px o truc doc (khong am, khong de).
- Du an 4 (that su chi con 1 ca): giao dien KHONG co cach chon "chi 1 ca" cho tung du an (ca luon
  lay tu `dim_shift.isActive` toan he thong - dung K6). Da tao canh that bang cach: luu KH nhan luc
  du an 4 qua UI (thang 09/2026, Tong 100, ca ty le mac dinh 60/40 -> 60/40), roi tam tat
  `dim_shift.isActive=false` cho ma `evening` TREN DB TAM (khong dung DB that), kiem xong bat lai
  `true`. Sau khi tat: form KH nhan luc chi con dung 1 cot "Ca sang" (Ty le 100%) - dung theo thiet
  ke; chart chi ve 1 cot "Ca sang", chi 1 nhan gia tri "60" (duong Tong KH thang trung cot, dung nhu
  logic "1 ca thi bo so tren cot" da sua o `7a9ff2a`), **0 cap giao nhau**. Anh:
  `.bangiao/anh-test/p3c-a-b11-v2-resshift-1ca-1440.png`.

### 3. 1440x900 va 390x844 - khung cuon ngang, khong tran

Kiem `#eq-gantt` va `#res-shift` o ca 2 kich thuoc (xem so lieu muc 1); rieng `#res-shift` du an 1
390px: khung boc svg (`div[style="overflow-x: auto;"]`, KHONG phai div dau tien trong `.bd` - do la
legend) co `scrollWidth` 753 > `clientWidth` 306, nam gon trong card (wrap 36,7-342,5 trong card
19,99-359,27). Khong lap lai loi vong truoc chon nham svg dau tien (icon HelpTip).

### 4. Hoi quy o ca KH nhan luc (commit `a524407`) - du an 1, thang 06/2026

Bam o Ca sang (270) -> Backspace x3 het chu -> o rong, class `inp bad` (dung ky vong). Tab ra:
o tra ve dung **270**, o Tong van **450** (khong doi, khong bi treo `isManual`). Go lai **600** roi
Tab: o giu **600** (nhan `aria-label="O da sua tay, khong tu tinh lai"`), Tong tu cap nhat **780**
(600+180), nut "Tinh lai theo ty le" hien ra. Dung hanh vi ke hoach. Khong bam Luu (chi kiem state
client, khong ghi DB).

### 5. Cong kiem

- `npx tsc --noEmit`: sach.
- `npm test`: **210 file / 2397 test xanh** (dung moc, khong tut).
- Khong sua file san pham nao trong luot kiem lai nay (chi doc code de hieu cau truc do, khong sua).
- DB tam `ddc_control_tower_qa_a`: sau khi xong da xoa 3 du an test tao them KHONG can (DB se bi xoa
  toan bo, xem cuoi). `dim_shift.evening.isActive` da tra ve `true` truoc khi ket thuc.

### File anh moi

`.bangiao/anh-test/p3c-a-b11-v2-resshift-1ca-1440.png` (chart KH nhan luc du an 4, thuc su chi 1 ca).

> Dong dau cu cua Tester: `KET QUA TEST: DO`. Da doi thanh XANH sau vong sua ben duoi (commit `a1fbaa6`).
> Vong sua va kiem lai do DIEU PHOI VIEN lam (khong phai Tester doc lap); reviewer can soi lai.

## Vong sua sau Tester (dieu phoi vien, 2026-09-26)

| Loi | Nguon | Sua | Kiem |
|---|---|---|---|
| BUG-A header "SL nay/tong" de tick dau | Tester | `EquipmentPlanGantt.tsx`: QTY_W 76 -> 96, tick dau neo trai (`textAnchor=start`, +4px) | test QA viet lai do theo MEP chu that (co tinh textAnchor), vi + en, >= 6px |
| Nhan "Hom nay" de nhan thang (vd "10.2026") | Dieu phoi vien thay tren anh Tester | hang nhan dau bang ha tu `MT-18` xuong `HEAD_Y = MT-10`, duoi pill y 2..18 | test QA: dinh chu tick > 18 |
| BUG-B nhan "TT TB/ngay" de nhan cot ("45360") | Tester | `ManpowerMonthChart.tsx`: chon vi tri nhan TT theo khung chu (thu +16, -8, +28, -20), tranh cot, nhan cot, nhan Tong KH; nhan so khac co le ngang 6px | test QA cu (>= 14px) xanh: 453 o y 138.3, 360 o y 162.8 |
| Nhan ten ca truc duoi dinh nhau ("Ca sangCa toi") | Dieu phoi vien thay tren anh | moi cot ca 1 o rong theo ten ca dai nhat (toi da 72px, qua thi cat + `<title>`) | test QA moi: khoang cach tam >= do rong ten + 4px |
| Man 390px: chart thang bi CSS chung `svg.chart{width:100%;height:auto}` ep con 306x116, khong viewBox nen noi dung tran ra ngoai khung, de len noi dung ben duoi, khung khong cuon | Dieu phoi vien do lai (Tester do nham `#res-shift svg` dau tien la icon HelpTip) | style inline `width/height = W/H`, `maxWidth: none` tren svg | test QA moi; trinh duyet 390: svg 753x286, khung cuon 753/306, nam gon trong card, trang khong tran (docW 379 <= 390) |
| Man 390px: chu Gantt con ~7px (min-width 720 co viewBox 1000) | Dieu phoi vien | `MIN_SVG_W = W` (1000, ty le 1:1), cap nhat test `min-width:1000px` | trinh duyet 390: chu header cao 12px, khung cuon 1000/306 |

- Cong kiem sau sua: `npx tsc --noEmit` sach; `npm test` 210 file / 2393 test xanh (ca 2 test "PHAI THAT BAI" cua Tester nay xanh).
- Trinh duyet that (Playwright MCP, DB tam `ddc_control_tower_qa_a2`, cong 3005, da xoa DB): anh `.bangiao/anh-test/p3c-a-b11-sua-{eqgantt,resshift}-{1440,390}.png`.
- Cach chup: cong cu chup cua MCP lech vi tri khi trang da cuon (Tester da ghi); anh tren chup bang cach tam ghim card `position:fixed` len goc tren (scrollY 0) roi chup vung do, nen nen card con thay trang phia sau (khong phai loi giao dien).
- Luu y cho lan sau: khi do chart, chon `svg.chart`, khong chon `svg` dau tien (icon HelpTip cung la svg).


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
`admin@daidung.com.vn` (mat khau seed dev, xem `src/data/seed/history.ts`) (va `viewer@daidung.com.vn` cho muc
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

- Dang nhap that (`admin@daidung.com.vn` (tai khoan seed dev)), vao `/vi/projects/1`: xac nhan
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
