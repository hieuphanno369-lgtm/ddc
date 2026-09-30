PHAN QUYET: CHOT

# Danh gia cuoi VONG 2 - P5 ha tang go-live (nhanh `feature/p5-b-ha-tang`, HEAD `6569b91`)

Skill da dung: `ddc-tower:code-review`.
Da doc: `danh-gia.md` vong 1 (CAN SUA, B-1..B-4, ban day du nam trong commit `50aac58`), `thay-doi.md`, `ket-qua-test.md` (tester vong 3 XANH), `danh-gia-bao-mat.md` muc VONG 2 (DAT, T-10/T-11/T-12).
Da chay: `git status`, `git log`, `git diff a97d841..HEAD` (12 file, +1016/-26, trong do 8 file code/tai lieu/test).
Da tu doc code that: `app/api/health/db/route.ts`, `scripts/backup/pg-restore-test.sh`, `scripts/backup/pg-backup.sh`, `docker-compose.yml`, `docs/DEPLOY.md` (cac doan bi sua), 4 file test bi sua/them.

## Cong kiem (reviewer tu chay lai tren may nay, 2026-09-29)

- `npx tsc --noEmit`: exit 0.
- `npm test`: 256 file pass + 1 skip (257), 2913 test pass + 16 skip (2929).
  Khop dung moc tester vong 3.
- `npm run build` (voi `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` tro `D:\_project\DDC_dieu-phoi\tools\font-mock.js`): exit 0.

## Tra loi 3 cau hoi

1. **Code co khop ke hoach va yeu cau vong 1 khong?**
   Co.
   Ca 4 muc B-1..B-4 duoc sua dung vi tri, dung cach da yeu cau, khong lan sang file ngoai pham vi (`Dockerfile`, `docker-compose.yml`, logger, schema khong bi dung).
2. **Test co gia tri that khong?**
   Co, voi 1 luu y.
   - B-1: ca "IP A 400 lan, IP B van 200" DO tren code cu (code cu tinh ca request bi 429 vao bucket toan cuc, toi lan 300 thi IP B nhan 429) va XANH tren code moi.
     Day la test hanh vi that.
   - B-2: file moi `src/server/backup-restore-test-script.test.ts` chay THAT script bang `sh` voi binary gia, co ca ten bang doc hai (exit 1, `bad_table_name`, nhat ky `psql` khong chua chuoi doc hai) va ca duong thanh cong.
     Dung khuon reviewer yeu cau.
   - B-3: 2 ca khoa cu/khoa moi chay that, co gia tri.
     Ca SIGTERM bi `skipIf(!signalDeliveryWorks)` va tren Windows/Git Bash no bi skip, nghia la hanh vi don khoa khi nhan tin hieu CHUA TUNG duoc chung minh chay tren may nay.
     Cach skip co dieu kien bang probe la trung thuc, khong phai test "cho co", nhung phai chay lai tren Linux luc go-live (xem G-1).
   - B-4: grep van ban (dem `127.0.0.1:3000` con dung 1 cho, sha256 dung truoc dropdb, khong con mount cung `$(pwd)/.backups`).
     Du lam luoi chan hoi quy tai lieu; ca dem `=== 1` hoi gion nhung chap nhan duoc.
3. **Bao mat, hieu nang, tinh dung dan:** khong con loi muc trung binh tro len.
   Con cac muc thap va 3 dieu kien go-live, chi tiet ben duoi.
   Khong co van de hieu nang.

## Xac nhan doc lap B-1..B-4

### B-1: DONG

- `app/api/health/db/route.ts:16-20`: per-IP (60/phut) kiem truoc, chi request qua duoc per-IP moi goi `rateLimit('health-db:global', 300, ...)`.
- `docs/DEPLOY.md` muc 6 them `location = /api/health/db { allow <IP giam sat IT>; allow 127.0.0.1; deny all; ... }` kem lap lai `nosniff`/HSTS dung bay thua ke `add_header`.
- Healthcheck compose (`docker-compose.yml:64`) goi thang `127.0.0.1:3000` trong container nen khong bi `deny` chan; tai lieu da ghi ro.

### B-2: DONG

- `pg-restore-test.sh:105-107`: `case "$t" in *[!A-Za-z0-9_]*|[0-9]*) fail "bad_table_name"` truoc khi ghep vao SQL o dong 108.
  Mot ten bang chua `"`, `;`, khoang trang, ky tu ngoai ASCII deu bi chan; `_prisma_migrations` va ten Prisma hien co deu hop le.
- Cot `so_dong_nguon` da bi bo han (cach manh hon reviewer khuyen nghi).
  Tu doc lai ca file: KHONG con cho nao ket noi `-d "$PGDATABASE"`, moi `psql` deu `-d "$RESTORE_DB"`.
- Gop T-1: ten DB tam them `_$$`, kiem do dai <= 63 (dong 60), `trap cleanup EXIT` chuyen xuong sau `createdb` (dong 71).
  Dung yeu cau.

### B-3: DONG (co luu y van hanh, xem N-11)

- `pg-backup.sh:55-58`: khoa `.lock` cu hon 360 phut thi log `backup.stale_lock_removed` roi `rmdir`.
  `.lock` la thu muc rong nen mtime = luc tao, dung lam moc tuoi khoa.
- `pg-backup.sh:69`: `trap 'exit 130' INT TERM HUP` di cung `trap cleanup EXIT`.
- `docs/DEPLOY.md` muc 11: cach nhan biet `lock_busy` lap lai, lenh go tay `.lock`; muc 15: giam sat thuong truc "file `.dump` moi nhat khong cu hon 26 gio".
- Luoi an toan thuc su la nguong khoa cu 6 gio (khong phu thuoc tin hieu), va luoi nay da co test chay that.

### B-4: DONG (co T-11 con ho, xem G-2)

- Moi lenh Nginx/`curl` chay tren host dung `127.0.0.1:<APP_PORT>`, co doan quy uoc cong o muc 1 va canh bao in dam "khong bao gio bo tien to `127.0.0.1:`".
- Khoi phuc dung `run --rm --entrypoint pg_restore backup ...`: service `backup` da mount `${BACKUP_DIR}:/backups` va co `PGHOST/PGUSER/PGPASSWORD/PGDATABASE`, lenh hop le voi `entrypoint: ["sh"]` cua service (bi ghi de).
- `sha256sum -c` dat truoc `dropdb --force`.
  Tu kiem: `pg-backup.sh:82` ghi file `.sha256` bang TEN TUONG DOI (`cd "$BACKUP_DIR" && sha256sum "$NAME"`), nen lenh `cd "<BACKUP_DIR>" && sha256sum -c` tren host chay dung.

## Danh gia doc lap ve T-10

**Ket luan: KHONG nang thanh muc chan merge, nhung KHONG de nam im trong so no.**
**Nang thanh dieu kien go-live G-3 ben duoi: chu du an phai doc, chap nhan bang van ban, va co bien phap giam nhe re truoc go-live that.**

Ly do khong chan merge:

- Day la han che cua chinh PostgreSQL: dump dinh dang custom chua san cau SQL va `pg_restore` chay nguyen van.
  Khong co cach va triet de trong pham vi mot script shell; cach duy nhat la bao dam toan ven ban dump bang nguon tin cay nam ngoai tam tay ke tan cong.
- Merge nhanh nay vao `main` KHONG tao ra rui ro moi tren moi truong that nao: chua co server production, script chua chay o dau ca.
  Rui ro chi xuat hien khi go-live va co quy trinh keo dump tu NAS ve.
- Dieu kien khai thac hep: phai co quyen ghi `BACKUP_DIR` tren server (thuong da la nguoi co quyen root/docker, tuc da chiem duoc DB bang duong khac) hoac quyen ghi share NAS.
  Nhom thu hai moi la nhom dang lo.

Ly do KHONG duoc chi de trong so no:

- Day chinh la quy trinh dung de ung cuu su co (restore-test hang thang va khoi phuc that).
  Luc su co la luc nguoi van hanh hay keo ban tu NAS ve nhat, va cung la luc it nghi ngo nhat.
- Tai lieu hien van cam ket "KHONG BAO GIO dung vao database that" (`docs/DEPLOY.md` muc 11, `pg-restore-test.sh:2`).
  Voi dump bi sua co chu dich, cam ket nay sai: `COPY ... TO PROGRAM` chay trong container `db` bang superuser `ddc`, tu do vao duoc DB that.
  Cam ket sai trong tai lieu van hanh nguy hiem hon mot rui ro duoc ghi ro.
- Gia dinh "tin tuong file dump" la quyet dinh chap nhan rui ro cua chu du an, khong phai cua agent.

## DIEU KIEN BAT BUOC TRUOC GO-LIVE CHINH THUC (khong chan merge nhanh vao `main`)

Khi merge, phai chep 3 muc nay vao `D:\_project\DDC_dieu-phoi\lo-trinh.md` thanh dieu kien chan go-live, khong de chi nam trong `.bangiao/archive/`.

### G-1: Chay that toan bo ha tang voi Docker va PostgreSQL that, dan bang chung

- Dockerfile, `docker-compose.yml`, `pg-backup.sh`, `pg-restore-test.sh` va quy trinh khoi phuc o `docs/DEPLOY.md` muc 11 CHUA TUNG chay that tren may nao.
- Tren may Linux co Docker (tot nhat la may giong server that): chay du Task 4 buoc 4 (9 muc) va Task 5 buoc 3-5 cua ke hoach, dan output vao ho so.
- Bo sung bat buoc cho vong nay:
  - Chay `npm test` tren Linux de ca SIGTERM trong `src/server/backup-scripts-lock.test.ts` KHONG bi skip va phai xanh.
  - Kiem `find /backups/.lock -maxdepth 0 -mmin +360` chay duoc trong image `postgres:16-alpine` (busybox); loi cua lenh nay dang bi nuot bang `2>/dev/null` o `pg-backup.sh:55`, neu busybox khong ho tro thi co che khoa cu se tat im lang.
  - Chay that 1 lan quy trinh khoi phuc muc 11 tren DB thu (khong phai production) tu dau den cuoi.

### G-2: Khoi lenh khoi phuc phai dung lai khi mot buoc loi (T-11)

- **Vi tri:** `docs/DEPLOY.md` khoi `bash` quy trinh khoi phuc, cac dong `run --rm backup` (backup truoc khi ghi de), `sha256sum -c`, `dropdb --force` (khoang dong 342-345).
- **Van de:** cac dong doc lap, khong `set -e`, khong `&&`.
  Nguoi van hanh dan ca khoi vao terminal luc su co thi du `sha256sum -c` bao sai hoac backup truoc do loi (vd `lock_busy`), `dropdb --force` van chay va xoa DB that.
  Muc dich cua B-4 ("kiem TRUOC khi xoa") vi vay chua thuc su duoc bao dam.
- **Sua:** noi 3 buoc bang `&&` (hoac boc ca khoi trong `( set -e; ... )`), va them cau "chay tung dong, dong nao loi thi DUNG, khong chay tiep".
  Them 1 ca vao `src/server/deploy-files.test.ts` kiem dong `dropdb --force` nam trong cung chuoi `&&` voi `sha256sum -c`.
- Viec nay re; nen lam ngay trong luot chuan bi go-live, cung luc voi G-1 (G-1 kieu gi cung se phai sua lai tai lieu).

### G-3: Chu du an chap nhan gia dinh "tin tuong file dump" (T-10) va co bien phap giam nhe

- Chu du an doc muc "Danh gia doc lap ve T-10" o tren va ghi ro quyet dinh chap nhan vao `lo-trinh.md`.
- Toi thieu truoc go-live (re, khong can doi kien truc):
  1. Sua `docs/DEPLOY.md` muc 11 va comment `pg-restore-test.sh:2`: cam ket "khong bao gio dung vao database that" chi dung "voi ban dump tin cay"; them canh bao ban dump bi sua co the chay lenh tuy y bang quyen superuser.
  2. `pg-backup.sh` ghi them ma sha256 vao dong log `backup.done` (log nam tren server `/var/log/ddc-backup.log`, khong di qua NAS).
     Quy trinh khoi phuc tu ban keo tu NAS ve bat buoc doi chieu ma bam voi dong log tren server, khong dung file `.sha256` di kem (vi ke sua dump cung sua duoc file nay).
  3. Gioi han quyen ghi share NAS chi cho tai khoan `rsync` cua server (gop voi N-6/T-8).
- Hardening sau (so no): role rieng co `CREATEDB` khong superuser cho restore-test; HMAC ban dump bang khoa chi co tren server.

## NEN LAM (so no hardening, khong chan)

- **N-1..N-10:** giu nguyen nhu vong 1 (xem commit `50aac58`), tru T-1 va T-6 da dong trong vong nay.
- **N-11 (moi, reviewer):** cau "tu don khi script ket thuc binh thuong (ke ca bi `docker stop`/Ctrl+C)" o `docs/DEPLOY.md` muc 11 (khoang dong 322) noi qua.
  Khi chay qua `docker compose run`, `sh` la PID 1, `docker stop` chi gui SIGTERM cho `sh`; `sh` hoan trap cho toi khi `pg_dump` (tien trinh con dang chay) ket thuc, con Docker het 10 giay la SIGKILL, nen `.lock` van ket.
  Luoi an toan that la nguong khoa cu 6 gio (da co test), khong phai trap tin hieu.
  Sua cau thanh "tu don khi ket thuc binh thuong hoac Ctrl+C; neu bi kill cung (docker stop qua han, OOM) thi tu go sau 6 gio".
- **N-12 (moi, reviewer, nho):** `pg-backup.sh:55-63` co cua so race hep: neu dang ton tai khoa cu va 2 tien trinh cung chay dung luc, tien trinh sau co the `rmdir` khoa moi cua tien trinh truoc roi ca hai cung chay.
  Chi xay ra khi vua co khoa cu vua co 2 lan chay trung luc, hau qua la 2 file dump khac ten; chap nhan duoc, ghi lai de biet.
- **N-13 (T-12):** bo qua bucket toan cuc cho IP `127.0.0.1` (healthcheck noi bo) de container khong bao gio bi `unhealthy` vi bucket toan cuc.

## Nhan xet chat luong

- Luot sua gon, dung goc, dung pham vi: 4 file code/tai lieu, 4 file test, khong dung file nong.
- Coder chon cach manh hon yeu cau o B-2 (bo han truy van DB nguon) la quyet dinh dung: script restore-test gio khong the dung vao `PGDATABASE` du co loi o dau khac.
- Moi muc co test do truoc va test chay that bang binary gia, rut dung bai hoc vong 1 ("script shell co logic phai co test chay that").
- Probe `signalDeliveryWorks` la cach trung thuc de khong bao do gia tren Windows, nhung dong nghia ca SIGTERM chua chay o dau; da dua vao G-1.
- Security-reviewer tu nhan sot T-10 o vong 1 la dang ghi nhan; reviewer vong 1 cung sot diem nay (khi neu B-2 da mo ta dung dieu kien tan cong "sua duoc file dump" nhung khong suy ra `pg_restore` cung bi anh huong).

## Viec tiep theo

1. Chu du an dong y thi merge `feature/p5-b-ha-tang` vao `main` theo quy trinh (chuyen `.bangiao/*` vao `.bangiao/archive/p5-b-ha-tang-<ngay>/`).
2. Trong luot merge, chep G-1, G-2, G-3 vao `lo-trinh.md` thanh dieu kien chan go-live.
3. N-1..N-13 vao so no hardening.
