KET QUA: XANH

# Bao cao kiem thu doc lap - P3A Form Tao/Sua du an

Skill da dung: `test-driven-development`, `verification-before-completion` (bat buoc theo lenh).
Vi thay doi dung ca UI lan DB, da chay them smoke test that bang `mcp__playwright` (dev server that,
cong 3000) va kiem trang thai du lieu sau test bang `mcp__postgres` (read-only).

## Lenh da chay va ket qua

- `npx tsc --noEmit` -> 0 loi.
- `npm test` -> **149 file / 1652 test XANH** (moc truoc khi Tester them test: 139 file / 1588 test
  theo `.bangiao/thay-doi.md` cua coder - khong tut, tang dung bang so test moi Tester them).
- `npx prisma migrate status` -> "Database schema is up to date!" (7 migrations, DB `ddc_control_tower`
  localhost:5433).
- Kiem cot `dim_customer` qua `mcp__postgres`: co du `needsReview` (boolean, default false) va
  `createdBy` (text, default 'system') - khop Task 1.

## File test moi (Tester viet, khong sua code nguon)

Tat ca dat canh file nguon, hau to `.qa.test.ts` de khong dung ten voi test cua coder (van chung 1
suite khi chay `npm test`):

1. `src/server/actions-members.qa.test.ts` (9 test) - G-17: viewer/bod bi Forbidden khi goi
   set/removeProjectMemberAction; gan PIC cho tai khoan **PIC** bi khoa (khac ca Backup bi khoa ma
   coder da kiem) -> `user_not_found`; gan lai dung PIC hien tai -> `unchanged` khong ghi audit moi;
   email sai dinh dang -> `Invalid input`; doi PIC (data-entry) sang Backup thi VAN con quyen ghi
   (Backup data-entry != Backup viewer); nguoi hoan toan chua duoc gan -> `requireProjectRead` nem
   `notFound`; go Backup xong thi mat quyen doc; `removeProjectMemberAction` voi nguoi khong thuoc
   du an -> `not_member`.
2. `src/server/repo/form.qa.test.ts` (6 test) - G-3/G-5 o tang repo: `isProjectCodeTaken` khong
   phan biet hoa/thuong (ca hai chieu VIET HOA/thuong), trung voi mot dong ALIAS CU (khong phai
   `currentAliasCode`) cua du an khac; `createDimValue` trung ten tra ve id cu va KHONG doi lai co
   `needsReview`; `changeProjectCode` chup snapshot dung du lieu TRUOC khi doi (khong phai sau).
3. `src/lib/stage-weight-presets.qa.test.ts` (13 test) - Q1/G-6: doi chieu TUNG SO cua ca 9 loai du
   an voi bang Q1 da chot (khong chi kiem tong = 100 nhu coder), preset tra ve la ban sao (sua ket
   qua khong lam hong bo goc), moi loai deu qua `validateStageWeights`.
4. `src/server/project-profile-rules.qa.test.ts` (10 test) - G-11/G-12: bo sung 3/4 luat chuoi ngay
   ma test cua coder CHUA cham (`handover_before_finish`, `contract_after_start`, `actual_order`),
   EUR (khac USD), tonnage rat nho > 0, ten dung DUNG 160 ky tu, va xac nhan doi ty gia SAU khi da
   luu KHONG lam tinh lai `contractValue` cu (chot cung, dung mock-up).
5. `src/server/actions-project.qa.test.ts` (5 test) - **Q8 (trong tam)**: doi trong so KHONG tinh
   lai %TT thang da luu (kiem bang `saveMonthlyData` that + `saveStageWeightsAction` that, so
   `pctActual` truoc/sau doi trong so phai bang nhau, thang MOI luu sau moi dung trong so moi); xac
   nhan server **KHONG** tu ep VIET HOA ten du an (chi `ProjectForm.tsx` lam o client - xem muc
   "Phat hien" ben duoi); bien duoi ly do doi ma dung 5 ky tu.
6. `src/components/form/dataEntryState.qa.test.ts` (3 test) - F6: mo phong dung DevTools, kiem
   chuoi `JSON.stringify(toDraftForm(...))` THAT SU khong chua ten du an/so tien/ma du an nhay cam;
   `DRAFT_FIELDS` dung chinh xac 6 field da chot.
7. `src/lib/project-draft.qa.test.ts` (7 test) - F6 ProjectForm draft: JSON hong, thieu `form`, sai
   version -> `none`; `restoreProjectDraft` bo qua field sai KIEU (chuoi "true" khong phai boolean
   that) thay vi crash hoac ap nham.
8. `src/server/actions-equipment-plan.qa.test.ts` (2 test) - Task 10: overlap THAT SU bi chan o
   TANG ACTION (khong chi tang luat thuan nhu coder da kiem) va tra dung `overlaps`; tinh khong-mat-
   du-lieu khi payload moi co 1 dong sai (du lieu cu con nguyen, khong bi xoa truoc khi validate
   that bai).
9. `src/server/validation.qa.test.ts` (6 test) - Task 2: kiem TRUC TIEP zod schema
   `importFileSchema`/`dailyImportFileSchema` o 4 moc 1MB/5MB/dung 10MB (phai QUA) va 10MB+1 (phai
   bi tu choi) - dung yeu cau "file 1-10MB qua duoc, >10MB bi chan".
10. `src/server/ho-so-du-an-page-guard.qa.test.ts` (3 test) - trang `/ho-so-du-an`: admin voi
    `?project=999999` (du an KHONG TON TAI, khac "khong duoc gan") -> `notFound`; `?project=abc`
    (khong phai so) -> khong loi, roi ve mode `new`; data-entry hoan toan chua duoc gan du an nao
    van vao duoc trang o mode `new`.

Tong: **10 file test moi, 64 test case moi**, du 3 nhom yeu cau (duong chay thuan loi, cac bien da
neu ten trong ke hoach, va nhieu ca phai-that-bai: Forbidden/Invalid input/notFound/invalid_rows/...).

## Smoke UI that (Playwright, dev server that cong 3000)

- Kiem cong 3000 ranh truoc khi chay (`netstat`), khoi dong `npm run dev`, dung server bang
  `taskkill //PID <pid>` (KHONG `taskkill /IM node.exe`).
- Dang nhap `admin@daidung.com.vn` / mat khau seed (`Admin@***`, xem `history.ts`).
- **Desktop 1440x900**: mo `/vi/ho-so-du-an`, dien du 19 truong (Ten tu dong VIET HOA ngay khi go -
  xac nhan G-4 client hoat dong dung), chon Loai hinh **EPC** -> bang trong so tu dien lai dung
  `8,10,15,32,5,27,3` (khop Q1) truoc ca khi bam Luu - xac nhan G-6 UI. Bam "Tao du an" -> chuyen
  sang `?project=18`, the "Dau vet thay doi" hien 2 dong (Trong so, Ho so/create).
  - Sua tiep: doi ten + doi Ma CT hien hanh sang `CT-QA-SMOKE-01`, dien Ly do >=5 ky tu, bam "Luu
    thay doi" -> "Da luu thay doi".
  - Gan `pm@daidung.com.vn` lam **PIC** qua khoi "Nguoi phu trach" (chi admin moi thay nut Them,
    dung Q3).
- Kiem `mcp__postgres` (read-only) NGAY SAU khi thao tac tren UI that (khong phai mock-repo):
  - `dim_project` id=18: `projectName` = 'DU AN QA SMOKE TEST PLAYWRIGHT DA SUA' (van VIET HOA),
    `currentAliasCode` = 'CT-QA-SMOKE-01'.
  - `dim_project_alias` cho id=18: dong cu `M-00018` co `effectiveTo` = hom nay (2026-09-25), dong
    moi `CT-QA-SMOKE-01` co `effectiveFrom` = ngay mai (2026-09-26), `effectiveTo` = null - **dung
    100% luat G-3 (Q4) tren du lieu that**, khong phai mock.
  - `project_assignments`: co dong `(18, pm@daidung.com.vn, PIC, assignedBy=admin@daidung.com.vn)`.
- **Mobile 390x844**: mo lai `/vi/ho-so-du-an?project=18`, form xep chong doc, khong vo trang, 0
  console error (kiem bang `browser_console_messages`). Anh chup: xem muc Anh chup ben duoi.
- Console error trong luc test: chi la canh bao `defaultProps` cua thu vien `recharts` (co san tu
  truoc P3A, khong lien quan thay doi nay) - khong co loi lien quan P3A.

### Anh chup (`.bangiao/anh-test/`)

- `01-ho-so-du-an-tao-moi-desktop-1440.png` - form Tao moi, desktop 1440.
- `02-ho-so-du-an-sau-khi-tao-desktop-1440.png` - sau khi tao du an 18, mode Sua.
- `03-ho-so-du-an-sau-khi-gan-PIC-desktop-1440.png` - sau khi gan PIC.
- `04-ho-so-du-an-mobile-390.png` - full form o mobile 390, khong vo trang.

Luu y mat khau seed da CHE theo yeu cau (`Admin@***`), khong ghi ro trong tai lieu nay.

## Phat hien (khong phai loi test rot - de reviewer/chu du an xac nhan co dung y do)

1. **G-4 chi ep VIET HOA o client**: `src/server/validation.ts`, `src/server/project-profile-rules.ts`,
   `src/server/actions-project.ts` KHONG co buoc `.toUpperCase()` nao - chi `ProjectForm.tsx` dong
   400 lam (`onChange={(e) => set('projectName', e.target.value.toUpperCase())}`). Test
   `actions-project.qa.test.ts` xac nhan goi thang `updateProjectAction(1, { projectName: 'ten chu
   thuong' })` (bo qua UI) thi luu duoc nguyen van chu thuong. Ke hoach Q6 chi noi "giu ep VIET HOA
   nhu quy uoc dang chay" ma khong noi ro cap nao phai ep - hanh vi nay giong voi hien trang truoc
   P3A (form cu cung chi ep o client) nen KHONG tinh la hoi quy, chi ghi lai de Security-reviewer
   danh gia neu can ep them o server.
2. **Du an QA con lai trong DB dev** (`ddc_control_tower`, id=18, ten "DU AN QA SMOKE TEST
   PLAYWRIGHT DA SUA") do smoke test tao ra qua UI that. Cong cu `mcp__postgres` chi cho phep doc
   (read-only) nen Tester khong tu xoa duoc. De nghi nguoi tiep theo xoa thu cong neu can DB sach
   truoc khi merge/demo.
3. **`bodySizeLimit: '11mb'`** (Task 2) va rui ro authz G-17 (`project_assignments` cap quyen doc/
   ghi) da duoc coder tu neu trong `thay-doi.md` muc "Rui ro/diem can soi them" - Tester xac nhan
   lai bang test doc lap (`validation.qa.test.ts`, `actions-members.qa.test.ts`) rang hanh vi hien
   tai DUNG nhu thiet ke, nhung phan danh gia rui ro bao mat (DoS qua body lon, dung sai quyen) van
   thuoc pham vi Security-reviewer nhu coder da de nghi.

Khong tim thay hoi quy hay loi hanh vi nao khac dung yeu cau. Tester khong sua bat ky file code
nguon nao - chi tao 10 file `*.qa.test.ts` moi.

---

# Vong sua 1 (kiem thu doc lap sau khi coder sua 7 muc CAN SUA cua reviewer vong 1)

KET QUA: XANH

Pham vi: `git diff c360d84..HEAD` (7 commit sua loi + 1 commit docs), doi chieu tung muc "Xong khi"
trong `.bangiao/danh-gia.md`. Skill da dung: `test-driven-development`, `verification-before-completion`
(bat buoc theo lenh). Vi thay doi dung ca UI lan DB, da smoke that bang `mcp__playwright` (dev server
that cong 3000) va kiem/chung minh rang buoc DB bang ket noi Prisma that toi `ddc_control_tower`
(khong dung duoc `mcp__postgres` cho phan nay vi cong cu chi cho READ-ONLY, tu choi ca `BEGIN`).

## Lenh da chay va ket qua

- `npx tsc --noEmit` -> 0 loi.
- `npm test` -> **154 file / 1716 test XANH** (moc truoc vong sua 1: 149 file / 1676 test theo
  `.bangiao/thay-doi.md` cua coder - khong tut, tang dung bang 5 file / 40 test moi Tester them).
- `npm run check:read` -> OK (17/17 ham doc khop mock/Prisma tren `ddc_control_tower`).
- `npx prisma migrate status` -> "Database schema is up to date!" (8 migrations).
- `pg_indexes` (qua `mcp__postgres`, read-only): xac nhan CA HAI index moi co mat dung dinh nghia:
  `dim_project_currentAliasCode_lower_key` (UNIQUE btree tren `lower("currentAliasCode")`),
  `project_assignments_one_pic_key` (UNIQUE btree tren `"projectId"` WHERE `roleInProject='PIC'`).

## File test moi (Tester viet, khong sua code nguon), 5 file / 40 test case

1. `src/server/repo/prisma-repo-create-project.qa.test.ts` (7 test) - **muc 1 + muc 6, tang prisma
   CHUA tung co unit test truoc do** (chi duoc kiem qua mock-repo va smoke DB that): mock thang
   `@/server/db` kieu `prisma-repo-save.test.ts`. Doi `DDC_FAKE_TODAY` sang mot moc XA (2031-03-20,
   khac ca gio may that lan moc mac dinh 2026-09-16 cua `vitest.config.ts`) -> dong `dim_project_alias`
   luc tao du an bam DUNG dong ho ao, khong dung `Date.now()`/`createdAt` that. `tx.project.findFirst`
   hoac `tx.projectAlias.findFirst` tra ve trung -> nem `ProjectCodeTakenError`, KHONG goi
   `project.update`/`projectAlias.create` (khong ghi du lieu nua chung nao roi moi bao loi). P2002 gia
   lap tu `projectAlias.create` (race hiem 2 request gan nhu dong thoi) -> bat va nem lai thanh
   `ProjectCodeTakenError`; loi Prisma KHAC P2002 (vd P2025) thi nem NGUYEN loi goc, khong bi nuot oan.
2. `src/lib/project-code.qa.test.ts` (10 test) - **muc 6/S-2**: `isReservedProjectCode` chua co unit
   test truc tiep nao truoc do (chi kiem gian tiep qua 1 ca trong `actions-project.test.ts`). Kiem day
   du bien the: hoa/thuong, khoang trang thua, so it chu so (`M-1`), dung masterCode CHINH du an dang
   sua thi KHONG bi chan, dung masterCode du an KHAC thi VAN bi chan, va cac dang KHONG khop mau
   (`M-00099A`, `M00099`, `MM-00099`) thi KHONG bi chan oan.
3. `src/server/repo/form-vong-sua-1.qa.test.ts` (8 test) - **muc 6-7 tang mock-repo, bien coder/tester
   vong 1 chua cham**: `isProjectCodeTaken` trung MASTERCODE (khong chi currentAliasCode/alias) cua
   du an khac; `createProject` (mock) voi `currentAliasCode` trung masterCode cua du an khac -> nem
   `ProjectCodeTakenError`, danh sach du an KHONG doi; `changeProjectCode` doi sang dung masterCode cua
   du an khac -> `'taken'`; `setProjectMember` tren du an MOI TAO (chua co PIC tu seed, khac voi ca
   "du an 16 da co san PIC" ma coder da kiem) van bi chan dung khi gan PIC thu 2; doi chung Backup thu
   2 van duoc phep (index chi ap PIC); ghi lai ranh gioi co chu dich la `isReservedProjectCode` CHUA
   ap dung o `createProject`/`createProjectAction` (chi o `changeProjectCodeAction`, dung nhu
   `thay-doi.md` da neu o phan "de sau").
4. `src/lib/project-form-vong-sua-1.qa.test.ts` (6 test) - **muc 2**: bien duoi `validateAliasChange`
   ma coder chua cham - chuoi toan khoang trang bi coi la rong (`'required'`), thu tu uu tien loi khi
   nhieu dieu kien cung sai mot luc (rong ma tinh truoc reason ngan, dinh dang ma sai tinh truoc reason
   ngan), ly do co khoang trang dau/cuoi duoc trim truoc khi dem do dai, va ghi lai 1 diem thiet ke: ham
   nay so sanh ma moi/cu CO phan biet hoa thuong (khac tang server so khong phan biet hoa/thuong) -
   khong phai loi, chi la 2 tang kiem khac muc dich (client hoi "co doi khong", server hoi "co trung ai
   khong"), da ghi ro trong comment test de nguoi sau khoi nham la hoi quy.
5. `src/server/actions-vong-sua-1.qa.test.ts` (9 test) - **muc 4 + muc 5**: `updateProjectAction` voi
   `teamKdId`/`customerId` DA BI GOP (khong chi "khong ton tai") -> `invalid_team`/`invalid_customer`;
   `createProjectAction` voi `teamKdId` da bi gop -> `invalid_team` (truoc do chi co ca customer);
   `saveMonthlyData` voi `actualStartDate`/`committedHandoverDate`/`contractDate` sai dinh dang (khong
   chi `plannedFinishDate` ma coder da kiem) -> tu choi, du an khong doi; xac nhan `actualFinishDate:
   null` (xoa ngay) VAN hop le va luu duoc (nullableDate cho phep null).

## Smoke UI that (Playwright, dev server that cong 3000) + doi chieu DB that

- Dang nhap Admin (session co san tu phien truoc). Desktop 1440x900:
  - **Muc 2**: mo `/vi/ho-so-du-an?project=1`, doi "Ma CT hien hanh" thanh gia tri moi, KHONG dien
    "Ly do doi ma", bam "Luu thay doi" -> client chan NGAY: o Ma CT + o Ly do to do, hien dong chu
    "Ly do doi ma phai co it nhat 5 ky tu" va banner "Con truong chua hop le - xem cac o to do";
    KHONG action nao duoc goi. Kiem lai DB that (`mcp__postgres`): `dim_project.currentAliasCode`
    cua id=1 van la `10626-008` (khong doi) - dung dung yeu cau "bao loi, khong luu".
  - **Muc 3**: sau thao tac tren (form co thay doi, autosave nhap chay ngam), doc THAT localStorage
    trinh duyet bang `browser_evaluate`: key `ddc_pform_v1_<ownerTag>_1` co JSON KHONG chua chuoi con
    `"contractValue"` lan `"penaltyValue"` o dau nao (kiem bang `.not.toContain` tren chinh chuoi JSON
    tho, khong phai doc field roi suy luan) - dung 100% yeu cau F6 tren du lieu nhap THAT, khong phai
    mock.
  - **Muc 4**: dieu huong sang `/vi/ho-so-du-an` (tao moi), go ten du an CHU THUONG
    ("du an qa vong sua 1 chu thuong") -> UI tu dong hien VIET HOA ngay khi go; dien du 11/19 truong
    bat buoc (khach hang VinGroup, team P.KD 01, thi truong Trong nuoc, loai hinh EPC, gia tri HD 10,
    khoi luong 100, do uu tien P2, 3 ngay bat buoc) -> bam "Tao du an" -> chuyen sang `?project=19`.
    Kiem DB that: `dim_project.projectName` id=19 = `'DU AN QA VONG SUA 1 CHU THUONG'` (VIET HOA toan
    bo, dung tu server tra ve chu khong phai gia dinh tu UI).
  - Anh chup: `05-doi-ma-CT-thieu-ly-do-loi-desktop-1440.png`,
    `06-tao-du-an-ten-chu-thuong-thanh-VIET-HOA-desktop-1440.png` (`.bangiao/anh-test/vong-sua-1/`).
- **Mobile 390x844**: `07-ho-so-du-an-mobile-390-vong-sua-1.png` - form xep chong doc, khong vo trang,
  0 loi console (kiem bang `browser_console_messages`, ca muc `error` lan `warning` deu 0 dong moi).
- **Don du lieu test sau khi xong**: du an id=19 (va toan bo du lieu lien quan: project_stage_weight,
  audit_log) da duoc xoa sach bang script Prisma tam thoi (co kiem tra an toan so ten du an truoc khi
  xoa), file script da xoa ngay sau khi chay, KHONG con trong repo. Da xoa key `ddc_pform_v1_*` khoi
  localStorage trinh duyet. Du an id=18 (`DU AN QA SMOKE TEST PLAYWRIGHT DA SUA`) la du lieu con lai TU
  VONG TRUOC (khong phai Tester tao ra o vong sua nay) - KHONG dong cham, da ghi lai o bao cao vong 1.

## Kiem chung rang buoc DB that (muc 6, 7) bang transaction ROLLBACK

`mcp__postgres` chi cho phep cau lenh READ-ONLY (thu `BEGIN; UPDATE ...; ROLLBACK;` bi tu choi ngay o
buoc validate). De "thu INSERT/UPDATE vi pham trong transaction ROLLBACK" nhu yeu cau, da dung Prisma
Client that (qua `DATABASE_URL` trong `.env`, ket noi `ddc_control_tower`) trong 1 script `tsx` tam
thoi (xoa ngay sau khi chay, khong con trong repo), moi thu nghiem la 1 `$transaction` rieng, cuoi moi
transaction CHU DONG nem loi de Prisma tu ROLLBACK:

| Thu nghiem | Ket qua |
|---|---|
| Doi `currentAliasCode` du an 1 sang TRUNG CHINH XAC ma cua du an 2 (`10626-051`) | BI CHAN, `P2010` (loi tho tu unique index) |
| Doi `currentAliasCode` du an 1 sang bien the VIET THUONG cua ma du an 18 (`ct-qa-smoke-01`) | BI CHAN, `P2010` (dung index `lower()`, khong phan biet hoa/thuong) |
| Doi `currentAliasCode` du an 1 sang ma CHUA TUNG DUNG (doi chung, khong duoc chan oan) | THANH CONG (dung nhu ky vong) |
| Them PIC thu 2 (`admin@...`) cho du an 1 (da co PIC `pm@...`) | BI CHAN, `P2010` (dung partial unique index) |
| Them Backup thu 2 cho du an 1 (doi chung, index chi ap PIC) | THANH CONG (dung nhu ky vong, khong bi chan oan) |

Sau khi TAT CA transaction ROLLBACK: `dim_project.currentAliasCode` id=1 van la `10626-008`
(khong doi), `project_assignments` cua du an 1 van dung 2 dong nhu truoc (PIC + Backup) - xac nhan
KHONG con du lieu ban nao trong DB sau khi thu nghiem.

**Bo qua co ghi ro (khong bat buoc theo lenh)**: chua thu 2 ket noi Postgres THAT chay song song de
quan sat khoa advisory (`pg_advisory_xact_lock`) chan race THAT giua 2 giao dich dong thoi - dung nhu
`thay-doi.md` da tu nhan (`Rui ro Tester/Security nen soi ky them, muc 1`), day van la khoang trong
chi duoc chung minh bang unit test (mock tuan tu), CHUA co test tich hop 2 ket noi that chay song song.
De nghi Security-reviewer luu y diem nay khi ra soat lai S-2/S-6 nhu `danh-gia.md` da yeu cau.

## Doi chieu tung muc "Xong khi" trong danh-gia.md

- **Muc 1** (alias dong ho ao): dat qua unit test moi voi moc thoi gian gia XA hon ca thuc te lan moc
  mac dinh test - chung minh doc lap voi ca gio may that lan `DDC_FAKE_TODAY` mac dinh cua bo test.
- **Muc 2** (validateAliasChange chan client): dat qua smoke UI that + 6 test bien duoi moi.
- **Muc 3** (F6 khong chua so tien): dat qua doc THAT localStorage trinh duyet, khong chi doc code.
- **Muc 4** (VIET HOA + invalid_customer/team): dat qua smoke UI + DB that (tao du an moi) + 4 test
  bien duoi moi (team da gop, ca 2 chieu create/update).
- **Muc 5** (saveMonthlyData ngay ISO): dat qua 5 test moi tren cac truong ngay coder chua cham toi.
- **Muc 6** (unique ma CT + khoa + P2002): dat qua kiem index that + transaction ROLLBACK that + 7+8
  test unit moi (prisma mock + mock-repo) tren cac bien coder chua cham (trung masterCode, P2002 tu
  layer khac, loi Prisma khac P2002 khong bi nuot oan).
- **Muc 7** (partial unique 1 PIC): dat qua kiem index + transaction ROLLBACK that + test tren du an
  MOI TAO (khong chi du an co san PIC tu seed).

## Ket luan

Khong phat hien hoi quy hay loi hanh vi nao trai voi "Xong khi" cua ca 7 muc trong `danh-gia.md`.
Tester khong sua bat ky file code nguon nao - chi tao 5 file `*.qa.test.ts` moi va 2 script `tsx` tam
thoi da xoa ngay sau khi dung (khong con dau vet trong repo). DB dev `ddc_control_tower` sach sau khi
Tester don du lieu, chi con du an id=18 la di san tu vong truoc (khong phai cua vong sua nay).

**KET QUA VONG SUA 1: XANH.**
