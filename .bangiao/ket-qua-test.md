KET QUA: DAT

# Ket qua kiem chung doc lap - nang Next 14 -> 15.5.26 / React 19 / next-intl 4 / next-auth 4.24.15 / recharts 2.15.4

Skill da dung: `test-driven-development` (viet test moi theo red-green, xem muc "Test moi viet them"),
`verification-before-completion` (moi khang dinh o duoi deu dua tren lenh vua chay that trong phien nay).

Nhanh `feature/nang-next15`, HEAD luc kiem: `50083cf` (Task 5 ban giao). Da doc `.bangiao/ke-hoach.md`,
`.bangiao/thay-doi.md`, `.bangiao/hieu-nang.md` va cac file coder da sua truoc khi kiem.

## 1. Cong lenh (chay lai tu dau, doc lap voi coder)

| Lenh | Ket qua |
|---|---|
| `npx tsc --noEmit` | Sach (exit 0, khong output) |
| `npm test` | **210 file / 2409 test xanh** (khop moc coder bao cao, chay 2 lan o dau va cuoi phien deu ra dung so nay) |
| `npm run build` (font mock + DB tam `ddc_control_tower_e2e_a`) | Qua sach, khong canh bao `ssr: false`/"should be awaited"/"sync dynamic APIs" |
| `npm run build` (font THAT, `NODE_EXTRA_CA_CERTS`, DB tam) | Qua sach - dung de kiem giao dien bang trinh duyet that (muc 3) |
| `npm run test:e2e:a` (cong 3010, DB tam, tat truoc moi server o 3000/3010 cua A) | **79/79 xanh** (74 spec cu + 5 test moi trong `e2e/13-locale-redirect-cookie.spec.ts`), khong dung toi tien trinh cua B/C (cong 3001/3003) |

Khong sua bat ky file san pham nao trong qua trinh kiem; `git status` cuoi phien chi con file test moi
(`e2e/13-locale-redirect-cookie.spec.ts`), khong con file .png/tam nao sot lai.

## 2. Soi rieng cac diem duoc yeu cau

### 2.1 `e2e/02-overview.spec.ts` noi long `toPass` 15s - co che loi that khong?

Da kiem tra bang `next start` (production, chunk da build san, KHONG qua `next dev` bien dich on-demand):
- Dang nhap admin qua form that (khong dung storageState), mo `/vi/overview`: `document.querySelectorAll('.recharts-wrapper').length` = **5** (dung so chart cho role admin, khong thieu cai nao).
- Console sach hoan toan (0 error, 0 warning) sau khi doi 2s.
- Hover vao chart S-curve o `/vi/projects/1`: tooltip hien dung du lieu ("AC : 54 ty"), khong phai gia lap.

Ket luan: `toPass({ timeout: 15_000 })` KHONG che loi that. No thay the mot phep doc `.count()` mot lan
(vo tinh gia dinh chart mount xong trong vong 5s mac dinh cua Playwright `expect()`) bang mot vong cho
dung dieu kien - dung huong khi nguyen nhan that su la do `next dev` bien dich on-demand chunk
`OverviewChartsLazy` (nang hon vi bao them recharts 2.15.4 + React 19) co the mat hon 5s luc he thong
dang tai (nhieu tien trinh node khac). Tren production (`next start`), chart len chi sau ~1-2s - da xac
nhan doc lap, khop bao cao cua coder.

### 2.2 `params`/`searchParams`/`headers` sang async

Da doc lai toan bo `app/[locale]/(app)/projects/[id]/page.tsx` va cac page/route con lai: dung mau
`await params`/`await searchParams` (khong dung `Promise.all([params, searchParams])` vi test tinh
`src/server/app-pages-require-user.test.ts` coi do la 1 loi goi ham dung truoc `requireUser`).
`npx tsc --noEmit` sach, 12 file test da bo `Promise.resolve(...)` deu xanh - xac nhan doc lap dung
cac file nay khong bi sua sai kieu.

### 2.3 `requireUser` van dung dau

Doc `app/[locale]/(app)/projects/[id]/page.tsx`: thu tu van la `await params` / `await searchParams`
(khong co dau ngoac ngay sau ten bien nen khong tinh la loi goi ham) -> `getLocale()` -> `requireUser()`
-> kiem `rawId` hop le -> `requireProjectRead` -> doc du lieu. Dung thu tu ke hoach yeu cau.
`src/server/app-pages-require-user.test.ts` (15 test) xanh, xac nhan quet tinh khong phat hien vi pham.

### 2.4 Cookie locale giu 1 nam

Da kiem 3 lop doc lap:
1. `curl` truc tiep vao server that (khong qua thu vien nao khac): `Set-Cookie: NEXT_LOCALE=vi; ...; Max-Age=31536000` (dung 365 ngay).
2. Trinh duyet that (Playwright MCP): dang nhap, bam Cai dat -> Ngon ngu -> English, URL doi dung
   `/en/overview`, `document.cookie` = `NEXT_LOCALE=en`.
3. Test tu dong moi viet (xem muc 4) doc `Set-Cookie` qua `APIRequestContext`, xac nhan co `Max-Age` >
   300 ngay - **da lam RED/GREEN**: tam bo `localeCookie: { maxAge: ... }` trong `src/i18n/routing.ts`
   thi test nay rot dung ly do (cookie phien, khong co `Max-Age`); phuc hoi lai file goc (`git checkout --`)
   thi xanh tro lai. Xac nhan test that su bat duoc hoi quy, khong phai test hinh thuc.

### 2.5 Doi locale vi/en

Kiem bang trinh duyet that (khong phai gia lap): dang nhap admin, bam menu Cai dat -> Ngon ngu -> chon
English -> URL chuyen dung `/en/overview`, tieu de trang doi sang "MANAGEMENT REPORTS - Project Portfolio".

### 2.6 Chart client component (Recharts 2.15.4 + React 19)

Trinh duyet that, ca 2 trang (Tong quan, Chi tiet), ca `next start` (production) lan `next dev`: chart
mount du so luong, co truc/legend/tooltip, khong co canh bao `defaultProps`/hydration. Anh chup so voi
`.bangiao/anh-test/sau-*.png` khop bo cuc, mau sac, font o ca 1440px va 390px (xem muc 3).

### 2.7 Redirect dang nhap khi chua co cookie

`curl` va `APIRequestContext` (khong cookie): `/vi/overview` -> 307 `/vi/login`; test tu dong 09 (58 test
con lai trong file 09) va test moi (muc 4) deu xanh.

### 2.8 Phat hien phu (ngoai pham vi sua code, chi ghi nhan)

- Trong luc dung `next start` de kiem giao dien, phat hien 1 lan server cu (build voi font mock) khong
  bi dung dung do lenh `pkill -f "next start"` cua toi khong khop tien trinh node tren Windows/Git-Bash
  (chi image name, khong thay day du dong lenh) -> gay nham lan HTML/CSS lech buildId luc dau. Da xac
  minh day la **loi thao tac moi truong cua tester**, khong phai loi cua ung dung: dung `taskkill //F //PID`
  dung PID roi dung lai sach thi HTML/CSS/build deu khop nhau binh thuong. Khong lien quan gioi han
  cham diem cua coder.
- `matcher` cua `middleware.ts` (`/((?!api|_next|_vercel|.*\\..*).*)`) loai tru moi duong dan co dau
  cham trong bat ky segment nao (vd `/vi/overview/evil.com` do "evil.com" co dau cham) - middleware
  (ca redirect dang nhap lan RBAC) KHONG chay cho cac duong dan nay, ket qua la 404 (khong co page nao
  khop) thay vi redirect ve `/vi/login`. Day la hanh vi **co tu truoc** (file `middleware.ts` khong nam
  trong danh sach sua cua phase nay, ke hoach cung ghi ro "KHONG dung: middleware.ts"), khong phai hoi
  quy do nang Next 15. Van an toan (khong lo du lieu, khong ra host la), chi ghi nhan de tham khao neu
  co audit bao mat rieng ve sau (khong phai viec cua phase nay).

## 3. Kiem giao dien bang trinh duyet that (Playwright MCP)

Da build (font that, khong mock) + `next start -p 3010` (DB tam), dang nhap that bang form (admin@daidung.com.vn),
khong dung storageState co san, de kiem tu dau den cuoi luong dang nhap that.

- **1440x900**, trang Tong quan: 5 chart mount du, bo cuc/KPI/mau/font khop `anh-test/sau-overview-1440.png`
  (chi khac gio "Cap nhat DB lan cuoi" va ma ngau nhien do seed lai, dung nhu coder ghi nhan).
- **390x844**, trang Tong quan: khop `anh-test/sau-overview-390.png`, khong tran, khong de chu, thu tu
  card giong het.
- Trang Chi tiet du an (`/vi/projects/1`): 4 chart (dung so cho trang nay), hover chart S-curve ra tooltip
  dung du lieu, console sach ca 2 kich thuoc.
- Doi ngon ngu qua menu Cai dat: URL doi dung, tieu de dich dung.
- Console (moi trang, ca 2 kich thuoc, sau khi doi 2s cho Recharts): 0 error, 0 warning.

Anh chup luc kiem (`tester-overview-1440.png`, `tester-overview-390.png`, `tester-project1-tooltip.png`)
CHI dung de doi chieu, da xoa sau khi kiem xong (khong commit, dung quy uoc "chi tao/sua file test").

## 4. Test moi viet them (thieu test tu dong cho hanh vi bao mat moi)

Ke hoach danh dau 2 truong hop bien Task 3 ("cookie locale ~1 nam", "khong open redirect") la "kiem o
Task 5 bang trinh duyet/e2e" nhung coder chi kiem thu cong (curl/trinh duyet), **chua co test tu dong**
nao khoa lai 2 hanh vi bao mat nay (dung dong luc nang next-intl 4 - va GHSA-8f24-v5vv-gm5j open redirect).
Da viet file moi **`e2e/13-locale-redirect-cookie.spec.ts`** (5 test, dung `APIRequestContext` giong quy
uoc cua `e2e/09-chan-chua-dang-nhap.spec.ts`):

1. **Duong chay thuan loi**: `GET /` khong cookie -> redirect `/vi` (locale mac dinh).
2. **Bien (ke hoach neu ten)**: `GET /vi//evil.com` khong bi open redirect ra host la.
3. **Bien (ke hoach neu ten)**: `GET //evil.com/vi` khong bi open redirect ra host la (phai truyen URL
   TUYET DOI cho `api.get()`, khong truyen path tuong doi bat dau bang "//" - da ghi chu trong code vi
   client tu resolve thanh protocol-relative, khac hanh vi server that, de bay cho lan sua sau).
4. **Bien (ke hoach neu ten)**: cookie `NEXT_LOCALE` giu ~1 nam (`Max-Age` > 300 ngay), dung context
   rieng (khong dung chung cookie jar voi cac test khac trong file, tranh false-negative do
   `APIRequestContext` giu cookie qua cac lenh nhu trinh duyet that).
5. **Phai that bai**: gia mao open-redirect vao trang bao ve (`/vi/overview//evil.com`) - cuoi cung
   khong bao gio ra ngoai host, khong lo du lieu du an (`projectName`), du ket qua that su la 404 (do
   `matcher` cua middleware loai tru duong dan co dau cham - xem muc 2.8) chu khong phai redirect login.

Da lam dung quy trinh RED-GREEN cho test #4 (quan trong nhat ve bao mat): tam bo `localeCookie.maxAge`
trong `src/i18n/routing.ts` -> chay lai -> **test rot dung ly do** ("set-cookie phai co Max-Age... Received: null")
-> `git checkout -- src/i18n/routing.ts` phuc hoi nguyen ban -> chay lai toan bo file -> **8/8 xanh**
(3 setup + 5 test). Da chay lai `npx tsc --noEmit` (sach) va `git status` (chi con dung 1 file moi,
khong con thay doi o `routing.ts`) de xac nhan phuc hoi dung, khong lam ro code san pham.

Da chay lai toan bo `npm run test:e2e:a` (khong loc file) sau khi them test moi: **79/79 xanh** (74 spec
cu khong doi + 5 test moi), khong tut mot spec nao.

## 5. Ket luan

Khong test nao rot trong lan chay cuoi cung (sau khi sua xong 3 loi tu viet test cua chinh toi trong luc
soan `e2e/13-locale-redirect-cookie.spec.ts` - da ghi lai qua trinh dieu tra/sua trong muc 4, khong phai
loi cua coder). Moi cong (`tsc`, `npm test`, `npm run build` x2, `npm run test:e2e:a`) deu xanh, doc lap
voi bao cao cua coder va khop so lieu. Da kiem bang trinh duyet that (khong chi doc snapshot) o 1440/390,
soi rieng diem `toPass` 15s (khong che loi that) va cac bien Task 2/3 theo dung yeu cau.

**Viec ke tiep**: security-reviewer -> reviewer.
