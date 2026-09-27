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
