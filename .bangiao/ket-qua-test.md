# ĐỎ

P2B — Vòng sửa 1, kiểm thử lại (vòng 2). Commit kiểm: `710abab`, `f794113`, `c59716f`, `cdd5733`,
`84b6760`, `c61fa61` (`git log fa2b261..HEAD`). Đối chiếu `.bangiao/danh-gia.md` mục CẦN SỬA 1-4 +
`.bangiao/thay-doi.md` "Vòng sửa 1" / "Vòng sửa 1 — bổ sung". Kiểm thử độc lập, không sửa file sản
phẩm. Skill dùng: `ddc-tower:test-driven-development`, `ddc-tower:verification-before-completion`
(viết test trước, chạy tay xác nhận trước khi kết luận). Đụng UI → smoke-test bằng `mcp__playwright`
trên dev server cổng 3001 (đăng nhập thật `admin@daidung.com.vn` / `viewer@daidung.com.vn`). Đụng DB
→ đọc trực tiếp bằng `mcp__postgres` (read-only) trên `ddc_control_tower_b` để đối chiếu %TT tổng của
thẻ Chuỗi giá trị với công thức, độc lập với code.

## Môi trường trước khi kiểm

- `npm ci` ban đầu lỗi `EPERM` khi xoá `node_modules/@prisma/engines/...dll.node` và
  `.../@next/swc-win32-x64-msvc/....node` — bị khoá bởi 1 tiến trình `next start` cổng 3001 (PID
  11696) **đã chạy sẵn trước khi tôi vào phiên, không phải do tôi khởi động** → không `taskkill`.
  Gỡ tay 2 gói thừa không có trong `package.json` (`playwright-core`, `playwright`, để lại từ phiên
  coder trước) bằng `rm -rf node_modules/playwright*` thay cho `npm ci` đầy đủ.
- `npx prisma generate` (qua `npx`) vô tình tải và chạy **`prisma@7.10.0`** từ registry (không phải
  bản `6.19.3` khai trong `package.json`) vì `node_modules/prisma` cục bộ bị xoá dở bởi lượt `npm ci`
  lỗi ở trên, khiến `npx` fallback ra bản mới nhất — sinh ra Prisma Client **rỗng** (`PrismaClient:
  any`, thiếu `Prisma.dmmf`/`Prisma.sql`) vì schema dùng cú pháp Prisma 6 (`url`/`directUrl` trong
  `datasource`) mà Prisma 7 không còn hỗ trợ (lỗi `P1012`, nhưng lệnh vẫn thoát mã 0 — tự nó là 1 bất
  thường của `prisma@7.10.0`, ngoài phạm vi P2B). Đã sửa bằng cách gọi thẳng
  `node node_modules/prisma/build/index.js generate` (đúng bản `6.19.3` cục bộ) → Prisma Client sinh
  lại đầy đủ. Sự cố `npm ci`/`npx prisma` ở trên cũng vô tình làm tiến trình `next start` PID 11696
  (đang giữ file) bị crash (không còn trong `tasklist`) — **không phải tôi `taskkill`**, tự đổ vì file
  nó cần bị dọn. Đã tự khởi động lại `next dev -p 3001` (PID mới, node PID 13700) để tiếp tục kiểm UI
  bằng Playwright; PID này do tôi khởi động nên tôi tự dừng khi xong (không đụng PID khác).
- Sau khi sửa: `npx tsc --noEmit` sạch, `npm test` **1109/1109 xanh** (96 file, trước khi thêm test
  mới của vòng 2). `git status` xác nhận **không có thay đổi** ở `package.json`/`package-lock.json`
  (đúng yêu cầu — chỉ dọn `node_modules`, không đổi lockfile).
- Phát hiện thêm (không chặn XANH/ĐỎ, chỉ ghi chú môi trường): `.env` của worktree B có
  `NEXTAUTH_URL=http://localhost:3000` (cổng của tài khoản A) thay vì `3001` — khiến luồng
  `signOut()` phía client của NextAuth redirect nhầm sang cổng 3000 (`net::ERR_CONNECTION_REFUSED`
  quan sát được qua `mcp__playwright__browser_network_requests`). Sign-out qua trang xác nhận
  `/api/auth/signout` (POST trực tiếp, không qua redirect client) vẫn hoạt động đúng — dùng cách này
  để đăng nhập lại bằng tài khoản khác khi kiểm mục 5. Không sửa `.env` (không phải file test, không
  thuộc 6 commit đang kiểm).

## Kết quả theo từng mục danh-gia.md

### Mục 1 — Chart tuần giữ dữ liệu nhà thầu đã tắt (`710abab`) — ĐẠT

`src/server/manpower-queries.ts:46-53` (`getWeeklyChartData`): `contractors` dựng từ
`contractorId` có thật trong `totalActual` (gộp từ `readManpowerWeekly`), tên tra `getContractors()`
rồi fallback `` `#${id}` ``, sort theo tổng actual giảm dần — đúng như mô tả. Test
`src/server/manpower-queries.test.ts` dòng 55-68 (`nha thau co so lieu nhung getContractors thieu ->
van hien, ten fallback #<id>`) spy `repo.getContractors` bỏ đúng 1 nhà thầu có dữ liệu thật của dự
án 1 (id lấy động, không hard-code) → assert nhà thầu đó vẫn có mặt + tên đúng `` `#${id}` ``. Seed
DB hiện không có nhà thầu `isActive=false` nào (`SELECT ... FROM dim_contractor WHERE
"isActive"=false` → rỗng) nên không thể xác nhận trực quan trên trình duyệt bằng dữ liệu thật —
unit test dùng spy để mô phỏng đúng tình huống là cách hợp lý duy nhất hiện có. **PASS.**

### Mục 2 — Gantt thiết bị đọc usage toàn bộ ngày dự án (`f794113`) — ĐẠT

`src/server/equipment-gantt-queries.ts:9-25`: bỏ `minStart`/`maxFinish` tính từ plans, gọi
`readEquipmentUsageDays(projectId, '0001-01-01', '9999-12-31')`; `buildGantt` giữ nguyên nên trục
Gantt vẫn dựng từ plan. Test `src/server/equipment-gantt-queries.test.ts` dòng 26-57 mô phỏng đúng
hành vi lọc `from`/`to` thật của repo (không mock cứng kết quả) — 1 ngày dùng trước `plannedStart` 5
ngày → `unplannedUsage=2` (đã có sẵn 1 ngày trong plan), `planFrom`/`planTo` không đổi, và
`readEquipmentUsageDays` được gọi với khoảng ngày bao trùm cả ngày ngoài plan. Trên trình duyệt thật
(`/vi/projects/1`), dòng chú thích "… lượt thiết bị-ngày có dùng nhưng nằm ngoài kế hoạch (không
vẽ)" hiện đúng dưới Gantt, trục ngày không đổi. **PASS.**

### Mục 3 — Kết luận hiệu năng T1 không còn khẳng định quá bằng chứng (`c59716f`) — ĐẠT

`.bangiao/hieu-nang.md`: không còn câu "tiêu chí nghiệm thu T1 đạt"/"đạt ở steady state" (đã
`grep` toàn file, 0 kết quả). Mục 4 (dòng 95 trở đi) ghi rõ "CHƯA THUYẾT PHỤC, chưa có đối chứng",
nêu 1/12 request 1635 ms, bench `month='all'` median 1789 ms/max 2384 ms, và lý do thứ 3 (khoá cache
`loadSpiCpiTrend`/`loadSCurve` không theo `month`) đã được thêm. Mục "4b. Chưa kết luận, chờ đo lại ở
Bước 11" có đủ quy trình đo lại có kiểm soát (warm-up ngoài `/overview`, đo `month=all` trước tiên,
đo riêng từng hàm nhánh `'all'`). Chỉ sửa câu chữ/tài liệu, không đụng code/script đo — đúng chỉ
định. **PASS.**

### Mục 4 — Thẻ "Chuỗi giá trị" theo mock-up (`cdd5733`) — **KHÔNG ĐẠT (lỗi mới phát hiện)**

Phần bố cục/công thức **đạt**, đã xác nhận bằng cả unit test lẫn trình duyệt thật + đối chiếu DB độc
lập:

- Bỏ hẳn thẻ "Chỉ số EVM" — xác nhận trên `/vi/projects/1` (Playwright): không còn text "Chỉ số
  EVM" ở đâu trên trang.
- Thẻ rộng hết hàng, 2 cột đúng thứ tự mock-up (trái: Thiết kế/Vật tư/Vận chuyển/Nghiệm thu; phải:
  Shop Drawing/Gia công/Lắp dựng) — xác nhận qua `outerHTML` thật của `.valueChainCard` (2
  `.stagecol`), khớp cả ở desktop 1440px và mobile 390px (`.stagegrid` xuống 1 cột đúng breakpoint
  1180px có sẵn).
- Dòng chân Σ trọng số + %TT: DB thật dự án 1 (`project_stage_weight`) cho trọng số
  `design5/procurement10/transport5/handover3/shop10/fabrication40/erection27` = 100 (khớp UI "Σ
  trọng số 100%", không tô cảnh báo). `fact_value_chain_progress` tháng `2026-09` cho
  `pctComplete`: design/procurement/transport/shop/fabrication=1.0, handover=0.0,
  erection=0.33259259...; tự tính lại độc lập bằng SQL: Σ(w×pct)/Σw =
  (5+10+5+0+10+40+27×0.332593)/100 = **78.98% → làm tròn 79,0%**, khớp CHÍNH XÁC số UI hiển thị
  "79,0%". Test `src/lib/value-chain-view.test.ts` (`chainFooterSummary`, 4 case) cũng khớp công
  thức `calcChainPctActual`/`validateStageWeights` của `src/lib/stages.ts`.
- Chip góc "Toàn bộ 7 giai đoạn" ↔ `StageExplorer`: xác nhận bằng thao tác thật trên trình duyệt —
  bấm 1 hàng "Gia công" ở "Timeline của 7 giai đoạn" (dispatch click thật lên `<rect>` overlay của
  SVG) → chip đổi thành "Gia công"; bấm lại → chip trở về "Toàn bộ 7 giai đoạn"; panel mốc chi tiết
  (`.msdetail`) và "Biểu đồ so sánh" đổi giai đoạn tương ứng, không vỡ hành vi cũ.
  `ValueChainModeChip.test.ts` (3 test) cũng xanh.
- `/en/projects/1`: không có `MISSING_MESSAGE` (đã `find` trong console + DOM), thẻ hiện "Value
  Chain"/"All 7 stages"/"Bottleneck: Erection" đúng.

**Lỗi phát hiện — thanh tiến độ (`.stage .fill`) không hiển thị được, ở MỌI độ rộng màn hình, kể cả
thanh "khâu nghẽn" không tô cam như mock-up yêu cầu (mục 4(a)/(d) của `danh-gia.md`):**

- Nguyên nhân: `app/[locale]/(app)/projects/[id]/page.tsx:579` (hàm `StageRow`) render
  `<div className="bar"><i className="fill" style={{ width: ... }} /></div>` — dùng thẻ **`<i>`**,
  mặc định `display:inline` trong HTML. Rule CSS `app/globals.css:469-471`
  (`.stage .fill{height:100%;border-radius:5px;background:linear-gradient(...);...}`,
  `.stage.bt .fill{background:linear-gradient(90deg,#ffb340,var(--warn))}`) **không khai báo
  `display:`** nào cả → trên thẻ `inline`, thuộc tính `width`/`height` hoàn toàn vô tác dụng (đặc
  tính CSS chuẩn, không phải bug trình duyệt). Kết quả: `.fill` luôn có `getBoundingClientRect() =
  {width:0, height:0}` bất kể `style.width` là "0%", "33%" hay "100%" — người dùng chỉ thấy nền xám
  nhạt cố định của `.bar` (`var(--fill-2)`), không bao giờ thấy gradient xanh (`--accent-2`→
  `--accent`) hay cam (`#ffb340`→`var(--warn)`) của hàng nghẽn.
  Mock-up gốc `mockup-apple-glass.html:1364` dùng đúng **`<div class="fill">`** (mặc định `block`) —
  bản chuyển sang React đã lỡ đổi tag mà không thêm `display:block` bù lại.
- **Không phải lỗi mới của vòng sửa 1**: dòng code này đã tồn tại y hệt (copy verbatim) từ `EvmRow`
  cũ bị xoá trong chính commit `cdd5733` (`git show cdd5733` dòng 114 cũ → dòng 204 mới, không đổi 1
  ký tự nào ở phần `<i className="fill"...>`), và cũng thấy y hệt trong ảnh `before-desktop-*.png`
  (chụp TRƯỚC vòng sửa 1) — mọi hàng đều phẳng, không phân biệt được % hay hàng nghẽn ngay cả ở bản
  gốc trước khi sửa. Tuy predate vòng sửa 1, đây **vẫn là chỗ nằm đúng trong phạm vi mục 4** đang kiểm
  (thẻ vừa được viết lại hoàn toàn ở `cdd5733`, với yêu cầu tường minh "Thanh luôn hiện đủ" và "thanh
  giai đoạn nghẽn tô cam như mock-up" — cả 2 đều KHÔNG đạt được trên trình duyệt thật), và
  `thay-doi.md` (dòng ghi của coder) khẳng định sai sự thật: "Thanh giai đoạn nghẽn tô cam qua
  `.stage.bt .fill` (CSS có sẵn, không đổi)" — trên thực tế thanh không tô màu gì cả.
- **Tái hiện**: mở `http://localhost:3001/vi/projects/1` (đăng nhập `admin@daidung.com.vn`), cuộn
  tới thẻ "Chuỗi giá trị". Mọi hàng (kể cả "Lắp dựng" 33,3% có badge nghẽn màu đỏ) đều hiện thanh
  màu xám nhạt đồng nhất — không có đoạn màu xanh/cam nào theo tỷ lệ %. Ảnh chụp:
  `.bangiao/anh-test/v2-bug-thanh-tien-do-khong-hien.png` (toàn thẻ, 2 lần chụp giống hệt nhau ở
  hàng 100% và hàng 33% — không phân biệt được bằng mắt). Kiểm bằng
  `getComputedStyle(document.querySelector('.stage .fill')).display` → `"inline"`;
  `getBoundingClientRect()` → `{width:0, height:0}` dù `style.width` đã đúng "33%"/"100%".
- **Test hồi quy đã thêm** (RED, đúng lỗi trên): `src/server/projects-detail-page-render.test.ts`,
  describe `Vong sua 1 muc 4 - the "Chuoi gia tri" ...`, test mới cuối cùng ("thanh tien do (.stage
  .fill) phai la the block hoac co display ro rang..."). Test render THẬT trang
  `app/[locale]/(app)/projects/[id]/page.tsx`, trích thẻ HTML `class="fill"` đầu tiên, đọc thật
  `app/globals.css`, và assert: nếu thẻ là loại mặc định `inline` (`i/span/em/b/strong/a/u/small`)
  thì rule CSS `.stage .fill{...}` phải có `display:` tường minh khác `inline` — **FAIL** ở trạng
  thái code hiện tại (`tag="i"`, CSS không có `display:`). Sửa gợi ý (KHÔNG tự làm, để lại cho
  Reviewer): đổi `<i>` → `<div>` ở `page.tsx:579`, HOẶC thêm `display:block` (hay `inline-block`)
  vào rule `.stage .fill` ở `app/globals.css:469`.
  Ghi chú thêm: `src/components/form/DataEntryForm.tsx` dùng chung class `.stage`/`.fill` (coder cố
  ý không sửa `.stage`/`.stagegrid` gốc để tránh ảnh hưởng file này) — nên rất có thể wizard nhập
  liệu cũng bị đúng lỗi này; ngoài phạm vi test của tôi (không phải trang Chi tiết dự án) nên không
  viết test riêng, chỉ ghi chú lại cho Reviewer.

### Mục 5 — Thứ tự trang Chi tiết + anchor + phân quyền tài chính (`c61fa61`, bổ sung điều phối viên) — ĐẠT

- Thứ tự heading thật trên `/vi/projects/1` (lấy bằng `document.querySelectorAll('main h2, main
  h3')`): Header → KPI → Timeline KH/TT → Các mốc chính → Chuỗi giá trị + Timeline 7 giai đoạn + Biểu
  đồ so sánh → Nhân lực theo nhà thầu/Thiết bị theo nhóm (nhập tay) → Tracking tuần → Nhân lực theo
  ca → Nhân lực theo tuần → Gantt thiết bị → **S-curve PV/EV/AC → SPI/CPI trend → What-if → Lịch sử
  mã dự án → Mã SAP → Alert/Action → Tài chính chi tiết → Ảnh hiện trường** — khớp chính xác mô tả
  trong `thay-doi.md`.
- Anchor `#res-manpower`/`#res-equipment`/`#res-shift`: cả 3 tồn tại trong DOM; bấm thẻ KPI "Tổng số
  nhân lực" → `location.hash = '#res-manpower'`, `getBoundingClientRect().top ≈ 72px` (khớp
  `scrollMarginTop: 72`, không bị header che).
- Phân quyền tài chính: đăng nhập thật bằng `viewer@daidung.com.vn` (seed có sẵn,
  `canViewFinance=false`, xác nhận qua DB `user_roles` và qua `/api/auth/session`). Trên
  `/vi/projects/1` thật: **không** có text hiển thị (visible, loại trừ nội dung nằm trong thẻ
  `<script>` hydrate của Next.js/next-intl) "Tài chính chi tiết" — khớp đúng hành vi gate hiện có.
  Ghi chú: "S-curve"/"SPI/CPI" **vẫn hiển thị** cho viewer — đã kiểm bằng `git show c61fa61` +
  `git show 84b6760:app/.../page.tsx`: khối S-curve/SPI-CPI **chưa từng** được bọc trong
  `canViewFinance` kể cả trước vòng sửa 1 (chỉ khối "Tài chính chi tiết" — bảng doanh
  thu/chi phí/lợi nhuận gộp — mới được gate, từ Task 8 P1A). `c61fa61` chỉ di chuyển JSX
  (`git show c61fa61` không đụng dòng nào chứa `canViewFinance`) nên đây là hành vi **giữ nguyên
  "như trước"**, không phải hồi quy do vòng sửa 1 gây ra — khớp đúng yêu cầu kiểm ("vẫn không thấy
  S-curve/Tài chính như trước", tức không đổi so với trước, không phải "phải ẩn cả S-curve").
  Test `src/server/projects-detail-page-finance-guard.test.ts` (3 test, dùng đúng `page.tsx` hiện
  tại qua `renderToStaticMarkup`) xanh, khớp quan sát trình duyệt.

## Cổng kiểm cuối

- `npx tsc --noEmit`: sạch.
- `npm test`: **1109/1109 xanh + 1 ĐỎ = 1110 test** (96 file, 1 file có 1 test rớt). Test rớt:
  `src/server/projects-detail-page-render.test.ts` — test mới tôi thêm ở vòng 2, xem chi tiết lỗi
  mục 4 ở trên. Không có test cũ nào (của coder hay tôi ở vòng 1) bị ảnh hưởng.
- `git status`: không có thay đổi ở `package.json`/`package-lock.json`/bất kỳ file sản phẩm nào.
  File tôi đã sửa: `src/server/projects-detail-page-render.test.ts` (thêm 1 test, +2 import
  `node:fs`/`node:path`) — commit `test(p2b): ...` riêng.

## Việc còn treo / không thuộc phạm vi ĐỎ này

- `.env` (`NEXTAUTH_URL=http://localhost:3000`) — nghi vấn cấu hình sai cổng cho worktree B, không
  sửa (không phải file test, không thuộc 6 commit đang kiểm). Báo lại để chủ dự án/điều phối viên
  quyết.
- `.bangiao/anh-test/after-desktop-full.png`/`after-mobile-full.png`: `git status` đầu phiên đã báo
  2 file này bị sửa đổi (kích cỡ đổi) so với commit `84b6760`, không phải do tôi. Trong lúc kiểm, 2
  ảnh tôi tự chụp tạm thời (`test-v2-desktop-chuoi-gia-tri.png`,
  `test-v2-mobile-chuoi-gia-tri.png`, `zoom-bar-*.png`) cũng biến mất khỏi `.bangiao/anh-test/` giữa
  chừng dù đã xác nhận tồn tại ngay sau khi chụp — nghi có tiến trình nền khác (không phải tôi khởi
  động) đang tự động ghi/dọn thư mục này. Đã chụp lại bằng chứng lỗi mục 4 lần cuối và xác nhận còn
  tồn tại trước khi kết thúc phiên: `v2-bug-thanh-tien-do-khong-hien.png`. Điều phối viên nên kiểm
  xem có tiến trình nền nào (script chụp ảnh cũ của coder còn chạy?) đang ghi đè thư mục
  `.bangiao/anh-test/` ngoài ý muốn.

## Kết luận vòng 2

**ĐỎ.** Mục 1, 2, 3, 5 ĐẠT. Mục 4 ĐẠT phần bố cục/công thức/chip nhưng **KHÔNG ĐẠT** phần hiển thị
thanh tiến độ (thanh không bao giờ hiện màu theo %, thanh nghẽn không tô cam) — vi phạm trực tiếp
2 tiêu chí tường minh trong `danh-gia.md` mục 4(a) và 4(d). Đã ghi lại bằng 1 test tự động RED
(`src/server/projects-detail-page-render.test.ts`) + ảnh chụp trình duyệt thật + đối chiếu
`getComputedStyle`. Không tự sửa code sản phẩm — dừng lại theo đúng quy định, chuyển cho Reviewer xử
lý (gợi ý sửa 1 dòng: đổi `<i>` → `<div>` ở `page.tsx:579`, hoặc thêm `display:block` vào rule
`.stage .fill` ở `app/globals.css:469`).

---

# Vòng 1 (trước) — tóm tắt, giữ nguyên để tham khảo

P2B — Biểu đồ & hiệu năng. Kiểm thử độc lập (không chỉnh sửa file sản phẩm), skill dùng:
`ddc-tower:test-driven-development`, `ddc-tower:verification-before-completion` (viết test/chạy
tay trước khi tin kết quả). Đụng UI → smoke-test bằng `mcp__playwright` trên dev server cổng 3001.
Đụng DB → kiểm trạng thái dữ liệu bằng `psql`/`prisma` qua `DATABASE_URL` trong `.env` (MCP
postgres đang trỏ DB của A nên không dùng để đọc/ghi DB B).

## Cổng kiểm

- `npx tsc --noEmit`: sạch.
- `npm test`: **1088/1088 xanh** (95 file test). Mốc trước khi tester thêm: 1060/1060 (coder).
  Tester thêm 3 file test mới, 28 test: `src/lib/equipment-gantt-independent.test.ts` (7),
  `src/lib/manpower-charts-independent.test.ts` (7), `src/server/queries-independent.test.ts` (14).
- `npm run check:read` (chạy tay trên Postgres thật `ddc_control_tower_b`, không phải mock): **OK**
  toàn bộ 18 dòng đối chiếu `readRepoPrisma` vs `createReadMock` (Bước 1 + Bước 5).
- Trạng thái DB sau khi kiểm (đọc bằng `prisma`, không qua MCP postgres): 17 dự án, 0 dòng
  `PERF-*`, đúng DB `ddc_control_tower_b` — không còn dấu vết seed hiệu năng, khớp mô tả trong
  `thay-doi.md`.

## Test tester viết thêm (độc lập với test của coder)

### 1. `src/lib/equipment-gantt-independent.test.ts` (assignUsage, Q1-b)

Không tin test có sẵn của coder — dựng thêm 7 case riêng, gồm cả case dùng plans KHÔNG theo thứ tự
`unitNo` trong mảng đầu vào (coder test luôn tạo plans theo đúng thứ tự 1,2,3 nên không bắt được
lỗi sort nếu có): plans thứ tự (unitNo 3, 1, 2) + N=2 → vẫn đúng chọn unitNo 1 và 2 (không phải 3).
Thêm: biên đúng 2 đầu mút `plannedStart`/`plannedFinish` (bao gồm), sad-path ngày lệch 1 ngoài biên
(31/08 khi KH bắt đầu 01/09) → KHÔNG được gán + `unplanned` tăng đúng 1, `qtyActual=0` không gán gì
không cộng `unplanned`, 2 nhóm thiết bị khác nhau trong 1 lần gọi không lẫn nhau, nhiều ngày dùng
cộng dồn đúng 1 chiếc → `usedDays` tăng dần không trùng, và `buildGantt` gán đúng ngày dùng vào đúng
thanh khi 2 plan cùng chiếc nối tiếp không chồng ngày. **Tất cả pass — không phát hiện lỗi.**

### 2. `src/lib/manpower-charts-independent.test.ts` (Q3/Q4/Q5)

Trọng tâm: coder test chỉ dùng chuỗi `'YYYY-MM-DD'` thuần cho `ProjectDates`, nhưng dữ liệu thật từ
Prisma (`prisma-repo.ts` hàm `iso()`) trả `Date.toISOString()` — chuỗi ISO ĐẦY ĐỦ có giờ
(`'2026-09-02T00:00:00.000Z'`). Test độc lập truyền thẳng dạng ISO đầy đủ này vào `projectTimeline`
để xác nhận `.slice(0,10)` cắt đúng, kể cả case mix (actualStart có, actualFinish thiếu → rơi về
plannedFinish, cả 2 đều ISO đầy đủ). Thêm: nới khoảng CẢ HAI đầu cùng lúc, dataRange nằm gọn trong
ngày dự án (không nới), `buildWeeklyStack` với số liệu không tròn để xác nhận TB tính trên TỔNG THÔ
rồi mới chia (không cộng các số hạng đã làm tròn trước — nếu code cộng nhầm số đã tính TB theo từng
nhà thầu thay vì cộng thô, test này bắt được ngay), và 2 sad-path: `range.from > range.to` (gọi hàm
sai tham số) → không throw, trả mảng rỗng; `weeksInMonth` với tháng không giao timeline nào → mảng
rỗng. **Tất cả pass — không phát hiện lỗi.**

### 3. `src/server/queries-independent.test.ts` (T1 — bỏ N+1, so kết quả TRƯỚC/SAU)

Cách làm: dựng lại nguyên văn logic `queries.ts` TRƯỚC refactor bằng `git show
10cda5a:src/server/queries.ts` (đổi hậu tố `Old`, chỉ tồn tại trong file test, không đụng code sản
phẩm), chạy song song với `queries.ts` SAU refactor trên CÙNG mock repo (seed mặc định), so sánh
GIÁ TRỊ trả về (không chỉ số lần gọi repo như `queries-n1.test.ts` của coder) cho:
`getProjectSummaries` (tháng hiện tại, `month=all`, tháng rác, có filter `groupBy=team`, groupKey
không tồn tại), `getPortfolioKpis` (tháng hiện tại, `all`), `getTonnageValueByGroup` (theo team,
theo market x `all`), `getCapacityData`, `getSpiCpiTrend`, `getPortfolioSCurve`, `getWatchlist`,
`getMissingMonth`. **14/14 pass — giá trị SAU refactor giống HỆT giá trị TRƯỚC refactor** trên toàn
bộ seed 17 dự án. Đây là bằng chứng độc lập mạnh nhất rằng T1 Bước 5 không đổi hành vi (không chỉ
dựa vào lời khai "test hồi quy chạy nguyên" của coder).

## Kiểm bằng mắt qua Playwright (dev server cổng 3001, đăng nhập admin@daidung.com.vn)

Ảnh lưu `.bangiao/anh-test/`: `projects-1-full.png`, `shift-chart.png`, `weekly-chart.png`,
`equipment-gantt.png`, `data-schema.png`, `data-dictionary.png`, `admin.png`, `admin-bottom.png`.

- `/vi/overview`: render đủ KPI, donut, 4 chart, bảng dự án, không crash. "Cập nhật DB lần cuối: -"
  — kiểm DB thật thì `audit_log` đang RỖNG (0 dòng) nên `-` là đúng biên (không phải lỗi).
- `/vi/projects/1`: 3 thẻ mới hiện đủ — chart ca × nhà thầu (6 nhà thầu, cột KH/TT), chart tuần
  chồng (mặc định tháng hiện tại 09/2026, đường KH tổng), Gantt thiết bị (5 hàng, màu theo hạng
  mục, dòng chú thích "385 lượt thiết bị-ngày ngoài kế hoạch"). Anchor `#res-manpower`,
  `#res-equipment` (thẻ P1B) và `#res-shift` (thẻ mới) đều cuộn đúng — kiểm bằng
  `getBoundingClientRect().top` sau khi click/scrollIntoView, ra đúng ~72px (khớp
  `scrollMarginTop: 72`, không bị header che). Phím `ArrowLeft`/`ArrowRight` trên chart tuần cuộn
  đúng ±44px mỗi lần nhấn (đo `scrollLeft` trước/sau, khớp chính xác spec kế hoạch).
- `/vi/projects/17` (dự án không có KH thiết bị): hiện đúng "Chưa có kế hoạch thiết bị cho dự án
  này".
- `/vi/data-schema`: ERD có đường nối quan hệ (nét liền + nét đứt cho join logic), legend
  cardinality N/1/0..1, hộp bảng theo màu `kind`, mục "Chi tiết từng bảng" đủ field. Không lỗi
  console.
- `/vi/data-dictionary`: mỗi bảng 1 accordion, mô tả + bảng field + mục Join. Không lỗi console.
- `/vi/admin`: "Lịch sử hoạt động" (P2B — `readActivitySince`) hiện đúng "Không có dữ liệu" — kiểm
  DB thật thì `activity_log` đang RỖNG (0 dòng, seed không tạo activity log) nên đây là biên đúng,
  không phải lỗi lọc DB.

### Phát hiện ngoài phạm vi P2B (không phải lỗi của coder — không chặn XANH)

`/vi/admin` có 2 lỗi console `MISSING_MESSAGE: admin.delete` (nút "Xóa dự án" trong
`DeleteProject.tsx`, file KHÔNG nằm trong bất kỳ bước nào của kế hoạch P2B). Đã kiểm
`git show 10cda5a` (commit gốc trước khi P2B bắt đầu) — key `admin.delete`/`admin.deleted` đã thiếu
từ trước, không phải do coder P2B gây ra. Ghi lại để chủ dự án biết, không tính vào kết quả P2B.

## Không phát hiện lỗi nào trong phạm vi P2B

Không có test nào rớt. Không cần sửa code sản phẩm.
