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
