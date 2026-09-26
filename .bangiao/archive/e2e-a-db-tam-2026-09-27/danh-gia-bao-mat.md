DANH GIA BAO MAT: DAT

# e2e cho A tren DB tam (nhanh `feature/e2e-a-db-tam`, commit `756bf69`) - 2026-09-27

> Security-reviewer (vai chi doc) tra bao cao; dieu phoi vien chep tom tat va ghi xu ly.

- Khong tim thay duong nao de seed/migrate cham DB that `ddc_control_tower` hay DB B/C sai cap.
- Guard `isExpectedDbUrl` chan dung cac bien the (chu hoa host, `/` cuoi, `%5F`/`%2F`, `[::1]`, userinfo co `@`, tab), `mergeE2eEnv` chi de 2 bien `E2E_*` va van qua guard.
- Tien trinh con: Next dev nhan `DATABASE_URL` truyen vao (`@next/env` khong de), seed dung `url`, khong spec nao mo Prisma.
- Cong ban: webServer chay truoc globalSetup; `reuseExistingServer:false` + cong ban -> Playwright bao loi, seed khong chay.
- B/C khong doi hanh vi. `.env.example` khong lo bi mat.

## Phat hien va xu ly (commit ke tiep)

- TR-1 (trung, co tu truoc): A giu cong 3000 ca phien e2e -> `npm run dev` cua A nhay 3001, e2e cua B (`reuseServer:true`) bam nham, ghi du lieu thu vao DB that cua A.
  -> DA SUA mot phan chinh: e2e cua A dung cong rieng `3010` (`E2E_A_PORT`), khong giu 3000 nua.
  Phan co tu truoc (cong 3000 tinh co ban vi ly do khac, `dev` khong co `-p`) con lai: xem De sau.
- T-1 (thap): `DIRECT_URL` that lot vao env cua seed va Next e2e -> DA SUA: `DIRECT_URL = databaseUrl` o global-setup (seed) va `webServer.env`.
- T-2 (thap): khe giua luc Playwright kiem URL va luc Next e2e bind, server dev that cua A co the chiem cong -> DA DONG nho cong rieng 3010 (khong server dev nao dung).
- T-3 (thap): `spawnSync(..., shell:true)` noi tham so khong escape -> DA SUA: goi `process.execPath` + `@playwright/test/cli`, khong qua shell; kiem `--grep "03 - "` qua duoc nguyen ven.

## Kiem sau sua

- `tsc` sach; test guard 48/48; `npm test` 210 file / 2407 xanh.
- e2e that `npm run test:e2e:a`: 74/74 xanh o cong 3010; DB that A van 0 du an, 0 audit, 0 kenh `E2E`.

## De sau

- TR-1 phan co tu truoc: can nhac `dev` co `-p` co dinh cho tung ben, hoac global-setup hoi server "dang noi DB nao" (endpoint chi bat o dev/e2e) roi dung neu khac `target.databaseUrl` - dong han moi lo do `reuseServer` cua B/C (N-P7-1).
- Chay `npm run test:e2e:a` tu worktree B/C se day migration nhanh do len DB tam cua A (chi lech lich su migration, khong mat du lieu that).
- Khong chay `npm run dev` cua A cung luc voi e2e: 2 `next dev` cung thu muc dung chung `.next`.
