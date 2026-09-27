KET QUA: DAT

# Tester doc lap - P7-C2 (chuoi gia tri giai doan dong tu dim_stage)

Nhanh `feature/p7-c2-chuoi-gia-tri`, worktree `D:\_project\DDC_Control_Tower-C` (tai khoan C, cong 3003,
DB `ddc_control_tower_c`). Kiem tren commit coder ban giao `6fe574f`. Skill da dung: `test-driven-development`,
`verification-before-completion`.

## 1. Cong kiem doc lap

- `npx tsc --noEmit`: sach (0 loi), ca truoc va sau khi them test moi.
- `npm test` (truoc khi them test): **212 file / 2487 test XANH** - dung khop moc coder ghi trong `thay-doi.md`.
- `npm test` (sau khi them 3 file test doc lap, 10 test moi): **215 file / 2497 test XANH**.
- `npm run check:read`: OK (doi chieu mock vs Prisma tren DB `_c` sau khi seed lai).
- `npx prisma migrate status`: "Database schema is up to date" (10 migration).
- `npx playwright test e2e/12-chuoi-gia-tri.spec.ts`: **4/4 kich ban XANH** (+ 3 test dang nhap setup).
- `npx playwright test` (toan bo, khong loc): **83/83 XANH** tren cong 3003, khong dung 3000/3001/3002.

Khong con test nao rot. Khong sua bat ky file san pham nao (xem muc 5 ve 1 lan thu tam da phuc hoi ngay).

## 2. Test doc lap da them (chi tao file test, khong dung code san pham)

Muc dich: kiem lai 4 diem rui ro nguoi giao viec neu ten (StageEditor, chen trong so 0%, quyen admin,
cot trai/phai doc DB, khong con hang cung) va bo sung nhung bien ke hoach co neu ten nhung code lai
CHUA co test truc tiep (doc `ke-hoach.md` + doi chieu tung file test cua coder truoc khi viet, tranh
trung lap).

### `src/server/actions-p7c2-tester.qa.test.ts` (5 test) - `createProjectAction` + `stageWeights`
Ke hoach Task 3 ghi ro: "createProjectAction: stageWeights co gui -> kiem cung tap voi giai doan dang
dung TRUOC khi tao du an, lech -> 'stages_changed'" nhung khong co test nao (`actions.test.ts`,
`actions-key-milestones.test.ts`, `actions-project.qa.test.ts`, `actions-vong-sua-1.qa.test.ts`) kiem
duong nay o ham `createProjectAction` (chi co o `saveMonthlyData`/`saveStageWeightsAction`).
- Duong chay thuan loi: gui du 8 dong LEGACY (dung tap dang dung) -> ok, du an moi co dung 8 dong trong so.
- Bien tu ke hoach: chi gui 7 dong (thieu settlement) -> `stages_changed`, KHONG tao du an moi (dem lai
  so du an truoc/sau).
- Bien: gui thua 1 ma la (khong thuoc `dim_stage` dang dung) -> `stages_changed`, khong tao du an.
- Truong hop phai that bai: tong trong so khac 100 (du 8 ma) -> `weights_invalid`, khong tao du an.
- Khong gui `stageWeights` -> van tao duoc du an, `getStageWeights` roi ve `DEFAULT_STAGE_WEIGHTS` (K7).

### `src/lib/stages-p7c2-tester.qa.test.ts` (4 test) - `presetWeightsFor` + `fillWeightsForStages`
Ke hoach muc "Truong hop bien bat buoc xu ly" ghi ro: "Bo theo loai du an khi mot giai doan goc bi
ngung dung: `fillWeightsForStages` bo giai doan do, tong co the lech 100 ... khong tu chia" nhung
`stage-weight-presets.test.ts`/`.qa.test.ts` cua coder chi kiem chieu THEM ma moi (`custom_1`), chua
kiem chieu BOT 1 ma goc.
- EPC voi `order` thieu `fabrication` -> ket qua khong con dong do, dung 7 dong con lai dung thu tu.
- Tong trong so ap dung lech 100 dung bang trong so fabrication da mat (32) -> `validateStageWeights`
  bao loi `sum`.
- Bo mac dinh (`DEFAULT_STAGE_WEIGHTS`) cung lech tuong tu, cac dong con lai GIU NGUYEN so cu (khong
  tu chia lai) - dung y "chap nhan, khong tu chia" cua ke hoach.
- Doi chieu duong thuan loi: ca 8 bo preset voi `order` du 8 ma goc deu hop le (tong = 100).

### `src/server/actions-master-p7c2-tester.qa.test.ts` (1 test) - `saveStageAction` bien `STAGE_MAX_COUNT`
`actions-master.test.ts` cua coder da kiem `too_many` o tang repo (mock + Prisma, qua mock trong so)
nhung chua kiem qua tang ACTION that (`requireRoleUser` -> `repo.saveStage` -> map loi). Test moi: them
lien tiep tu 8 len du 30 giai doan qua `saveStageAction` that, giai doan thu 23 tra `too_many`, khong
tao them, van dung 30 dong.

Ca 3 file deu da chay va XANH (`npx vitest run <file>` rieng le + trong `npm test` toan cuc).

## 3. Cac diem rui ro nguoi giao viec neu ten - da soi va xac nhan DAT (coder da co san test tot)

- **StageEditor** (them/sua/ngung dung/dung lai, trung ten, chan in_use): `actions-master.test.ts`
  (166-243) kiem day du Forbidden/tao moi/trung ten/sua khong ton tai/in_use kem so du an/ngung-dung-lai
  custom/Invalid input; `StageEditor.test.ts` kiem render (8 giai doan seed, sap xep theo sortOrder roi
  code, trang thai active/inactive); e2e kich ban 2+3 kiem hanh vi that tren trinh duyet (them, an
  khoi the, bang trong so 0%, chan in_use voi thong bao dung chu). Xac nhan tat ca XANH.
- **Chen trong so 0% chi cho du an DA co dong trong so** (lech ke hoach coder da ghi ro ly do o
  `thay-doi.md`): `entry.test.ts` dong 215-225 dung 2 du an (1 co dong trong so, 1 khong) va khang dinh
  CHI du an co dong trong so nhan them dong 0% moi - dung diem coder tu nhan lech ke hoach. Xac nhan
  dung nhu mo ta, khong phai loi.
- **Quyen admin (Forbidden)**: kiem truoc/sau du lieu khong doi cho ca `saveStageAction` va
  `setStageActiveAction` voi data-entry/bod/viewer; da doi chieu qua e2e (storageState admin) + doc code
  `requireRoleUser` goi truoc khi parse zod (dung thu tu ke hoach yeu cau).
- **Cot trai/phai the Chuoi gia tri doc tu DB, khong con hang cung**: `projects-detail-page-render.test.ts`
  (dong 182-213) dung mock `repo.getStages()` de kiem thu tu cot + giai doan ngung dung an di + custom_1
  chen dung vi tri; `stages-nguon-dong.test.ts` quet TINH toan bo `src/`+`app/` xac nhan khong con file
  nao (ngoai `stages.ts`/`stage-weight-presets.ts`/seed) nhac den `STAGE_ORDER`/`STAGE_CALC_MODE`/
  `VALUE_CHAIN_COLUMNS`/`stageKey`. Da chay lai, XANH.

## 4. Kiem giao dien that (Playwright MCP, khong dung Vitest)

Server dev rieng tren cong 3003 (khong dung 3000/3001/3002), dang nhap admin that, chup/soi truc tiep
(khong luu anh vao repo - coder da co anh chinh thuc o `.bangiao/anh-task9/`; anh cua tester chi de doi
chieu, da xoa sau khi xem xong).

- `/vi/admin` 1440px: the "Giai doan chuoi gia tri" nam dung ngay sau the "Khu vuc / Nha may san xuat"
  (dung vi tri ke hoach yeu cau). Bang 8 dong dung du lieu seed, cot Thu tu/Ten (VI)/Ten (EN)/Ben/Cach
  tinh/Trang thai/nut Luu+Ngung dung deu ro rang, khong lech pixel, dong them moi day du (khong con bi
  gioi han cao 420px giau mat nhu coder da sua). Console sach (0 warning/error).
- `/vi/admin` 390px: bang dung dung minWidth 920px nen CUON NGANG (thanh cuon xam nho o duoi bang) thay
  vi ep cac o con vai pixel - dung y do coder sua trong Task 9. Dong chu thich (`hintline`) xuong dong
  day du, doc duoc, khong de chu.
- `/vi/projects/1` 1440px: the "Chuoi gia tri quan ly du an" hien dung 2 cot 4+4: trai Thiet ke(5%)/
  Shop Drawing(10%)/Vat tu(10%)/Gia cong(40%), phai Van chuyen(5%)/Lap dung(27%)/Nghiem thu(3%)/Thanh
  quyet toan(0%); chan the dung "Σ trong so 100% ... 79,0%"; nhan "Khau nghen: Lap dung" dung (settlement
  0% nen khong tinh la khau nghen, dung Q4a). "Timeline cac giai doan" (da bo so 7) va "Bieu do so sanh -
  Gia cong (mac dinh)" hien dung ten tu DB.
- `/vi/projects/1` 390px: 2 cot gop doc thanh 1 cot (trai roi phai, dung thu tu), khong vo bo cuc, khong
  de chu; Timeline cac giai doan khong hien Thanh quyet toan (dung - giai doan nay trong so 0% o du lieu
  seed nen khong co moc ngay, dung mo ta Task 2 cua coder).

Khong phat hien lech giao dien nao can Reviewer xu ly them ngoai nhung gi coder da tu ghi va sua san.

## 5. Ghi chu ky thuat (khong phai loi, chi de Reviewer/chu du an biet)

- Trong luc dung ky thuat "sua tam de xac nhan test bat duoc regression" (thu bo doan kiem
  `stages_changed` trong `actions.ts`), he thong tu dong chan lenh chay test voi ly do "Modify Shared
  Resources" (bao ve file nong san pham). Da `git checkout -- src/server/actions.ts` phuc hoi NGAY,
  khong chay duoc lenh vitest sau do nen KHONG con dau vet nao trong ket qua. Xac nhan lai bang
  `git diff -- src/server/actions.ts` rong va `git status --short` chi con 3 file test moi. Khong lap
  lai ky thuat nay o cac test con lai (chi doc code de xac nhan logic dung).
- e2e kich ban 2 (`e2e/12-chuoi-gia-tri.spec.ts`) tao 1 giai doan `custom_1` "E2E GĐ <timestamp>" tren DB
  `_c` moi lan chay (ngung dung, khong xoa - dung luat Q1a "khong co nut xoa"). Da don sach du lieu tester
  tao ra trong luc kiem (xoa dong `dim_stage`/`project_stage_weight`/`audit_log` lien quan qua script
  Prisma tam, xoa script ngay sau do) roi `npx prisma db seed` + `npm run check:read` lai de xac nhan DB
  ve dung trang thai 17 du an + 8 giai doan. Day la hanh vi vinh vien cua tinh nang (khong xoa duoc, chi
  ngung dung) - neu chay e2e nhieu lan lien tuc tren cung 1 DB se tich luy `custom_N` ngung dung, den gan
  30 lan se cham `STAGE_MAX_COUNT`; khong phai loi can sua trong phase nay (dung Q1a da chot), chi ghi
  chu de A/B/chu du an biet khi chay lai e2e nhieu lan tren cung DB.
- Khong sua `PROGRESS.md`, `.serena/memories/`, file nong (`vi.json`/`en.json`/`actions.ts`/
  `prisma-repo.ts`/`queries.ts`/`project-queries.ts`) - chi tao 3 file test moi, khong dung code san
  pham nao con lai trong commit cuoi cung.

## 6. File da tao (chi test, khong sua code san pham)

- `src/server/actions-p7c2-tester.qa.test.ts`
- `src/lib/stages-p7c2-tester.qa.test.ts`
- `src/server/actions-master-p7c2-tester.qa.test.ts`

## Ket luan

**DAT.** Coder da lam TDD rat ky (test do truoc, sua sau, cong day du o `thay-doi.md`), phan lon diem
rui ro nguoi giao viec neu ten da co test tot san. Tester bo sung 3 file (10 test) lap 2 lo hong that
(bien `createProjectAction` + `stageWeights` lech tap chua co test; preset trong so lech 100 khi 1 giai
doan goc bi ngung dung chua co test) va 1 diem cung co (bien `STAGE_MAX_COUNT` qua tang action that).
Khong tim thay loi hanh vi nao can Reviewer/chu du an quyet dinh. Giao dien 1440/390 o ca hai trang
(`/admin` the giai doan, `/projects/1` the Chuoi gia tri) dung nhu mo ta, khong lech pixel dang ke.

---

# Vong 2 - kiem doc lap vong sua T-1..T-4 theo security-reviewer

KET QUA: DAT

Kiem tren commit `ca9a255` (fix "vong sua bao mat T-1..T-4"), nhanh `feature/p7-c2-chuoi-gia-tri`,
worktree `D:\_project\DDC_Control_Tower-C` (tai khoan C, cong 3003, DB `ddc_control_tower_c`).
Skill da dung: `test-driven-development`, `verification-before-completion`.

## 1. Cong kiem doc lap

- `npx tsc --noEmit`: sach, ca truoc va sau khi them test moi.
- `npm test` (truoc khi them test): **215 file / 2502 test XANH** - dung khop coder bao trong `thay-doi.md`.
- `npm test` (sau khi them 1 test moi o `entry.test.ts`): **215 file / 2503 test XANH**.
- `npm run check:read`: OK, sau khi seed lai va chay ngay (xem muc 5 ve 1 lan bao "CO LECH" do do tre
  thoi gian giua seed va check, khong phai loi code).
- `npx playwright test` (TOAN BO, khong loc file): **83/83 XANH** tren cong 3003 (coder chi bao 7/7 cho
  rieng `e2e/12-chuoi-gia-tri.spec.ts` trong vong sua nay; 83 la tong so kich ban toan bo suite gom ca
  12 file khac khong doi trong vong sua). Khong dung cong 3000/3001/3002.

## 2. Kiem doc lap tren repo Prisma that (DB `_c`), khong qua mock

Dung `entryPrismaRepo`/`formPrismaRepo` that (khong mock `@/server/db`) qua script tam
`scripts/tmp-tester-v2-concurrency.ts` (da xoa ngay sau khi chay xong, khong con trong git status).

- **T-1 (2 lenh `saveStage` dong thoi CUNG TEN)**: goi `Promise.all` 2 lan `saveStage` voi cung
  `nameVi`. Ket qua: dung 1 doi tuong `Stage` tao thanh cong + 1 chuoi `'duplicate_name'`; `dim_stage`
  sau do chi con DUNG 1 dong ten do (khong trung, khong vuot, khong nem loi/500).
- **T-3 mo rong (2 lenh `setStageActive` dong thoi tren 2 giai doan tam KHAC nhau)**: ca hai deu tra
  `'ok'`, khong deadlock, khong nem loi - chung minh khoa advisory dung 1 ten `'dim_stage'` serial hoa
  dung cac giao dich dong thoi tren DB that (khong chi tren mock nhu test cua coder). KHONG dung lai
  kich ban "2 giai doan cuoi cung" tren du lieu that (giong ly do coder da ghi: phai tat 6/8 giai doan
  that qua rui ro cho DB dang dung chung); dong y voi lua chon nay cua coder, dua vao test mock da
  RED/GREEN day du (`prisma-repo-entry.test.ts` dong 229-242) + bang chung tren cho thay khoa hoat dong
  dung tren Postgres that.
- **T-4 (ngung dung -> luu trong so xen ke KHONG gui ma do -> dung lai) tren du an that (du an 1)**:
  tao giai doan tam, `applicable=false` de "sua trong so" (weightPct 5, khong chan duoc ngung dung vi
  luat chi chan khi `applicable=true` VA `weightPct>0`) -> ngung dung OK -> luu trong so LAN NUA KHONG
  gui ma do (mo phong form an di) -> doc lai DB: dong van con dung `5/false` (khong bi xoa) -> dung lai
  -> doc lai DB: dong VAN `5/false` (khong bi ghi de ve `0/true`, dung `skipDuplicates`). `calcChainPctActual`
  voi va khong co dong nay cho ra CUNG 1 so (0,5) - dung "khong doi %TT" chu du an yeu cau.
- Da don toan bo giai doan/dong trong so/audit tam ngay trong script, roi `npx prisma db seed` +
  `check:read` de dua DB ve chuan (xem muc 4).

## 3. Kiem giao dien that (Playwright MCP, dang nhap admin that, cong 3003)

- **1440px**: mo `/admin`, dien dong Them moi ("Tester V2 GD Thu", thu tu 5, ben Trai) -> bam Them ->
  xuat hien dung dong trong bang, ghi hoat dong "Luu giai doan chuoi gia tri". Sang `/projects/1`: giai
  doan moi hien dung CUOI cot trai, 0%. Sang `/ho-so-du-an?project=1`: dong trong so moi hien dung 0.
  Quay lai `/admin` bam "Ngung dung" -> trang thai doi "Ngung dung", nut doi thanh "Dung lai"; sang
  `/projects/1` giai doan da BIEN MAT khoi the (dung). Quay lai `/admin` bam "Dung lai" -> sang
  `/projects/1`: giai doan XUAT HIEN LAI dung vi tri, 0%, khong loi console, chan the %TT khong doi
  (79,0% - dung vi trong so giai doan nay la 0% ca truoc/sau).
  - Da don sach giai doan tam nay ngay sau khi kiem xong.
- **390px**: the "Giai doan chuoi gia tri" render dung, khong crash, khong de chu; bang co `minWidth`
  920px lam CUON NGANG trong khung the (kiem bang `scrollLeft`) thay vi ep cot - cuon toi cung thay du
  cot "Trang thai" + nut "Luu"/"Ngung dung"/"Dung lai", dung y thiet ke coder ghi trong `thay-doi.md`.
  Khong phat hien loi giao dien.
- Console trinh duyet: 0 error/warning lien quan trong suot qua trinh thao tac tren.

## 4. Test moi them (chi tao/sua file test, khong dung code san pham)

`src/server/repo/entry.test.ts` (mock-repo-entry) - `entry repo (mock) - quan tri giai doan`: coder da
sua `mock-repo-entry.ts` de them nhanh T-4 (dung lai chen 0%) nhung theo `thay-doi.md` "chi bo sung
comment giai thich", KHONG co test moi rieng cho nhanh nay o tang mock (chi co o tang Prisma trong
`prisma-repo-entry.test.ts`). Them 1 test:

> "setStageActive dung lai -> chen 0% cho du an da co dong khac nhung thieu dong ma nay, giu nguyen
> dong da co, du an chua co dong nao thi khong them"

Da doi chieu qua `git show ca9a255 -- src/server/repo/mock-repo-entry.ts`: test nay nham dung vao 12
dong code MOI them trong nhanh `if (isActive) { ... }` cua `setStageActive` (khong ton tai truoc fix) -
neu bo doan do di thi du an 1 (co dong `design` nhung thieu dong `custom_1`) se KHONG duoc chen dong 0%,
test se ROT. Khong sua code san pham de xac nhan RED truc tiep (dung luat "khong dung code san pham");
doi chieu bang doc diff la bang chung thay the. Da chay `npx vitest run src/server/repo/entry.test.ts`
rieng (25/25 XANH, +1 so voi truoc) va trong `npm test` toan cuc (215/2503 XANH).

## 5. Ghi chu ky thuat (khong phai loi code, chi de Reviewer/dieu phoi biet)

- **`check:read` nhay do lech thoi gian, khong phai loi vong sua nay**: chay `npm run check:read` NGAY
  SAU KHI e2e/khao sat giao dien (khong seed lai) bao "CO LECH" o 3 diem (`readManpowerWeekly`,
  `readManpowerRange`, `readManpowerActualByMonth` cho du an 1) - do mock tu tinh "hom nay" bang dong ho
  he thong tai THOI DIEM CHAY script, con du lieu that trong DB duoc chot cung dinh dang do luc
  `npx prisma db seed` chay (trong `e2e/global-setup.ts`, khong truyen `DDC_FAKE_TODAY`) - neu 2 moc
  thoi gian nay lech qua ranh gioi ngay/tuan (o day do phien kiem keo dai qua nhieu buoc: tsc, 2503
  test, 83 kich ban e2e ~4 phut, thao tac trinh duyet that) thi mock va Prisma tinh "tuan nay"/"thang
  nay" khac nhau. Sua bang cach `npx prisma db seed` roi chay `check:read` NGAY sau -> OK. Day la han
  che co san cua kich ban `check-read-parity.ts` (tu ghi trong comment dau file "chay tay ... cung
  DDC_FAKE_TODAY luc seed"), KHONG lien quan gi den fix T-1..T-4; ghi lai de A/B biet neu gap lai.
- e2e file 12 van tao 1 giai doan tam moi lan chay (theo dung luat Q1a "khong xoa, chi ngung dung") -
  da don sach sau MOI lan chay (ca lan dau do sot tu phien truoc, lan chay toan bo cua tester, va lan
  kiem giao dien thu cong) - DB cuoi cung dung **17 du an / 8 giai doan**.
- Khong sua `PROGRESS.md`, `.serena/memories/`, file nong nao; khong sua bat ky file san pham nao
  trong vong 2 (chi 1 file test: `src/server/repo/entry.test.ts`); khong dung `git stash`.

## 6. File da sua trong vong 2

- `src/server/repo/entry.test.ts` (them 1 test)

## Ket luan vong 2

**DAT.** Vong sua T-1..T-4 dung nhu coder mo ta: khoa advisory `pg_advisory_xact_lock(hashtext('dim_stage'))`
gop tron doc-kiem-ghi-audit vao 1 transaction, kiem chung DUOC tren ca mock lan repo Prisma that (DB
`_c`) - 2 `saveStage` dong thoi cung ten chi 1 thanh cong khong loi 500; trong so giai doan ngung dung
duoc GIU NGUYEN qua nhieu vong ngung/luu/dung lai xen ke, dung lai khong ghi de dong da co va tu dong bu
0% cho du an thieu dong; giao dien `/admin` va `/projects/1` o ca 1440 va 390 hoat dong dung sau khi
them/ngung/dung lai giai doan that qua trinh duyet, khong loi console. Bo sung 1 test that o tang mock
lap 1 lo nho (nhanh T-4 cua mock chua co test rieng). Khong tim thay loi hanh vi nao moi can Reviewer
xu ly. DB `_c` da don sach ve dung 17 du an / 8 giai doan.

---

# Vong 3 - kiem vong sua reviewer (`d6d4f14`, `8416963`) - 2026-09-28

## 1. Cong kiem

- `npx tsc --noEmit`: sach.
- `npm test`: 219/219 file, 2519/2519 test DAT (sau ban sua o muc 3).

## 2. Test moi them

- `src/i18n/stage-admin-hint-vong3.test.ts`: khoa chu `stageAdmin.hint` moi o ca vi va en (muc 4 cua reviewer).
- `src/server/repo/mock-repo-create-project-stage-weights-vong3.test.ts`: goi thang `repo.createProject` voi trong so khop, lech tap giai doan, mang rong, ma la, khong gui; moi ca that bai deu khong de lai du an nua voi hay dong trong so mo coi.
- `src/server/actions-create-project-vong3.qa.test.ts`: `stageWeights: []` phai tra `weights_required`; tao lai dung ma CT sau lan tao bi `stages_changed` phai thanh cong, khong gap `code_taken`.

## 3. Loi tim thay va da sua

- Test `stageWeights: []` DO: action tra ve cau tieng Anh tho cua zod `"Too small: expected array to have >=1 items"` thay vi ma `weights_required`.
- Goc: `stageWeightRowsSchema` (`src/server/validation.ts`) co `.min(1)` khong kem ma loi, nen zod chan mang rong truoc khi toi nhanh `weights_required` trong `createProjectAction`, va form se hien cau khong co ban dich.
- Sua: `.min(1, { message: 'weights_required' })`.
- Noi dung schema thu hai (`saveStageWeightsAction` trong `src/server/actions-project.ts`) quy moi loi parse ve `Invalid input`, nen khong doi hanh vi.

## 4. Chua lam

- Khong kiem giao dien that (Playwright) o vong nay: form tao du an luon gui du bang trong so, nen mang rong khong di toi duoc tu giao dien; ban sua chi doi ma loi o tang server.

## Ket luan vong 3

**DAT** sau 1 ban sua nho o schema; khong con loi hanh vi nao can Reviewer xu ly.
