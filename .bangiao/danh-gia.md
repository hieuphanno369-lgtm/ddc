PHAN QUYET: CAN SUA

# Danh gia cuoi - P5 ha tang go-live (nhanh `feature/p5-b-ha-tang`, HEAD `a97d841`)

Skill da dung: `ddc-tower:code-review`.
Da doc: `.bangiao/ke-hoach.md` (toan bo 726 dong), `thay-doi.md`, `ket-qua-test.md` (vong 1 DO, vong 2 XANH), `danh-gia-bao-mat.md` (LO HONG).
Da chay: `git status`, `git log main..HEAD` (11 commit), `git diff --stat main...HEAD` (47 file, +3732/-86).
Da tu doc code that: `scripts/backup/pg-restore-test.sh`, `scripts/backup/pg-backup.sh`, `app/api/health/db/route.ts`, `docs/DEPLOY.md` muc 5-13, danh sach ca cua `src/server/health-db-route.test.ts` va `src/server/deploy-files.test.ts`.

## Tra loi 3 cau hoi

1. **Code co khop ke hoach khong?**
   Khop gan nhu tron ven.
   Task 0 den 7 lam dung thu tu, dung interface.
   `package.json` chi them 1 dong, khong doi `package-lock.json`.
   Khong co migration, khong dung UI.
   Quyet dinh Q1-Q4 cua chu du an deu duoc thuc hien dung: Docker Compose, backup 02:00, moi service co anchor `x-logging`, co lenh `create-admin`.
   Co 2 cho lech.
   (a) Phan "chay that" Docker cua Task 4 buoc 4 va Task 5 buoc 3-5 CHUA CHAY vi may khong co Docker va khong co client PostgreSQL. Coder da khai trung thuc.
   (b) `DEPLOY.md` mau thuan cong: ke hoach muc 1 viet `127.0.0.1:3000`, con compose mac dinh `3005` (xem B-4).
2. **Test co gia tri that khong?**
   Phan lon la co gia tri that:
   - `logger.test.ts` va `logger-bien.test.ts` kiem hanh vi that: loc khoa, khong lo `message`, vong tham chieu, tham chieu dung chung.
   - `env-check.test.ts` co 29 ca bam sat bang luat.
   - `health-db.test.ts` kiem ca unhandled rejection.
   - `backup-scripts-lock.test.ts` chay that `sh` voi binary gia va da bat duoc mot race condition that. Day la test dang gia nhat cua dot.

   Diem yeu:
   - `deploy-files.test.ts` chi kiem van ban (grep chuoi). No chap nhan duoc nhu luoi chan hoi quy cau hinh, nhung khong chung minh duoc compose hay Dockerfile chay duoc.
   - `pg-restore-test.sh` KHONG co test chay that nao. Chinh vi vay TB-2 lot qua ca coder lan tester: tester vong 1 "doc ky, logic hop ly" ma khong thay loi ghep chuoi SQL.
   - `health-db-route.test.ts` chi co ca gioi han theo IP, khong co ca "mot IP bi chan khong duoc tieu han muc toan cuc". Vi vay TB-1 xanh ma van sai.
3. **Bao mat, hieu nang, tinh dung dan:** co 2 lo hong muc trung binh da xac nhan (TB-1, TB-2) va 2 loi dung dan anh huong van hanh go-live (B-3, B-4), chi tiet ben duoi.
   Khong thay van de hieu nang dang ke.

## BAT BUOC sua truoc khi merge

### B-1 (TB-1): Sai thu tu rate limit o `/api/health/db`

- **Vi tri:** `app/api/health/db/route.ts:13-17`.
- **Da xac nhan:** dong 13 goi `rateLimit('health-db:global', 300, 60_000)` TRUOC dong 16 `rateLimit(\`health-db:${ip}\`, 60, ...)`.
  Nghia la request da vuot han muc cua IP minh van tang bo dem toan cuc.
  Mot IP gui khoang 300 request/phut la khoa duoc healthcheck container (`docker-compose.yml`, dung `r.ok`) va giam sat IT (`docs/DEPLOY.md:377`).
- **Sua:** dao thu tu, kiem per-IP truoc, chi request qua duoc per-IP moi tinh vao bucket toan cuc.
- **Test bat buoc (viet do truoc):** them vao `src/server/health-db-route.test.ts` ca "IP A gui 400 lan (bi 429 tu lan 61), sau do IP B van nhan 200".
  Test nay phai DO tren code hien tai.
- **Tai lieu:** `docs/DEPLOY.md` muc 6 them `location = /api/health/db { allow <IP giam sat IT>; allow 127.0.0.1; deny all; proxy_pass ...; }` de endpoint khong cong khai ra Internet.
  Healthcheck trong container goi thang `127.0.0.1:3000` nen khong bi anh huong.

### B-2 (TB-2): `pg-restore-test.sh` ghep ten bang tu file dump vao SQL roi chay tren DB THAT

- **Vi tri:** `scripts/backup/pg-restore-test.sh:97` va `:98`.
- **Da xac nhan doc lap:**
  - `TABLE_NAMES` (dong 86-88) doc tu DB tam vua khoi phuc, tuc la do noi dung file dump quyet dinh.
  - Dong 98 `psql -tAc "select count(*) from \"$t\"" -d "$PGDATABASE"` chi boc bang dau `"`, khong escape `"` ben trong ten.
    `psql -c` chay duoc nhieu cau lenh trong mot chuoi.
    PGUSER `ddc` la superuser.
    Ten bang `x"; DROP TABLE "user_roles"; --` se thanh `select count(*) from "x"; DROP TABLE "user_roles"; --"` va chay tren production.
  - Dong 98 con nuot loi (`2>/dev/null || echo "?"`), nen nguoi van hanh khong thay gi bat thuong.
  - Dong 97 cung loi, chay tren DB tam, nhung van la superuser, nen van dung duoc `COPY ... TO PROGRAM` de chay lenh trong container `db`.
  - `.sha256` nam canh file dump nen ke sua dump cung tinh lai duoc, khong phai lop bao ve.
  - Dieu nay pha cam ket "KHONG BAO GIO dung vao database that" o `docs/DEPLOY.md:312` va comment dong 2 cua script.
  - Kich ban that: khi co su co, nguoi van hanh keo ban dump tu NAS ve de thu khoi phuc.
- **Sua (ca 3 y):**
  1. Trong vong lap, truoc dong 97, kiem `t` khop `^[A-Za-z_][A-Za-z0-9_]*$`, khong khop thi `fail "bad_table_name"`.
     Cach POSIX: `case "$t" in *[!A-Za-z0-9_]*|[0-9]*) fail "bad_table_name";; esac`.
  2. Truy van DB nguon phai chi doc o muc server: `PGOPTIONS='-c default_transaction_read_only=on' psql ... -d "$PGDATABASE"`.
     Khuyen nghi manh hon: bo han cot `so_dong_nguon` (ke hoach dong 576 ghi ro cot nay chi de xem), de script khong bao gio ket noi `PGDATABASE`.
  3. Khong nuot loi im lang o truy van nguon: neu giu cot thi in `?` nhung kem 1 dong canh bao ra stderr.
- **Test bat buoc (viet do truoc):** file moi, vi du `src/server/backup-restore-test-script.test.ts`, cung khuon voi `backup-scripts-lock.test.ts`.
  Dung binary gia `createdb`/`dropdb`/`pg_restore`/`psql`/`sha256sum`, voi `psql` gia tra ve danh sach bang chua ten doc hai va ghi moi lenh nhan duoc ra 1 file nhat ky.
  Ky vong: script thoat 1 voi `reason:"bad_table_name"`, va nhat ky KHONG co lan goi `psql` nao voi `-d <PGDATABASE>` chua chuoi doc hai.
  Kem 1 ca duong thanh cong (ten bang hop le) de chac ban va khong lam hong luong binh thuong.
- **Gop luon T-1 (re, cung file):** them `[ ${#RESTORE_DB} -le 63 ] || { echo "ten DB tam qua dai" >&2; exit 5; }` sau dong 59.
  Chuyen `trap cleanup EXIT` (dong 66) xuong SAU `createdb` (dong 68) thanh cong, de loi "already exists" khong bao gio dan toi `dropdb --force` nham DB cua lan chay khac.
  Hien ten chi phan giai toi giay nen 2 lan chay cung giay se trung ten. Neu lam duoc, them `$$` vao ten DB tam.

### B-3: Khoa `.lock` bi ket vinh vien lam backup ngung ma khong ai biet

- **Vi tri:** `scripts/backup/pg-backup.sh:52-58`.
- **Van de (reviewer phat hien, security-reviewer chua neu):**
  - Script chi `trap cleanup EXIT`.
    Voi `sh` (dash/busybox), khi tien trinh bi SIGTERM/SIGINT/SIGHUP (`docker stop`, `docker compose down`, reboot, Ctrl+C khi chay tay) thi trap EXIT khong chay.
    Khi bi SIGKILL (OOM) thi khong trap nao chay duoc.
  - `.lock` nam tren thu muc bind-mount cua host nen con nguyen sau khi container `--rm` bien mat.
  - Tu dem sau, moi lan backup 02:00 deu thoat 3 `lock_busy`.
    Loi chi ghi vao `/var/log/ddc-backup.log`, khong ai giam sat file nay, va `find -mtime +14` dan xoa het ban cu.
    Sau khoang 14 ngay co the khong con ban backup nao.
  - Voi he thong go-live, day la rui ro mat du lieu, va cach va re.
- **Sua:**
  1. `trap 'exit 130' INT TERM HUP` cung voi `trap cleanup EXIT`, de tin hieu di qua duong EXIT va don khoa.
  2. Xu ly khoa cu: truoc `mkdir`, neu `$LOCK_DIR` ton tai va cu hon mot nguong ro rang (vi du `find "$LOCK_DIR" -maxdepth 0 -mmin +360` co ket qua) thi log `backup.stale_lock_removed` roi `rmdir`.
     Nguong phai lon hon thoi gian dump toi da hop ly.
  3. `docs/DEPLOY.md` muc 11 va 15: ghi cach nhan biet `lock_busy` lap lai, cach go tay `.lock`.
     Them 1 kiem tra giam sat thuong truc, khong chi trong checklist 1-2 tuan dau: "file `.dump` moi nhat trong `BACKUP_DIR` khong duoc cu hon 26 gio".
- **Test bat buoc:** them vao `src/server/backup-scripts-lock.test.ts`.
  Ca 1: tao san `.lock` voi mtime cu thi script chay thanh cong va log `stale_lock_removed`.
  Ca 2: `.lock` moi thi van thoat 3.
  Ca 3: gui SIGTERM giua luc `pg_dump` gia dang ngu thi `.lock` va `.partial` duoc don.

### B-4: `docs/DEPLOY.md` sai cong va sai thu muc trong quy trinh khoi phuc

- **Cong (T-6, reviewer nang len bat buoc):**
  - `docs/DEPLOY.md:14, 132, 164, 176, 186, 197, 324, 340` dung `127.0.0.1:3000`.
  - `docker-compose.yml` publish `127.0.0.1:${APP_PORT:-3005}`, va `.env.docker.example` dat `APP_PORT=3005`.
  - Chinh `DEPLOY.md:100` lai viet "Nginx goi `127.0.0.1:$APP_PORT`".
  - Lam dung tai lieu tren server moi se ra Nginx 502 va `curl` health that bai.
    Rui ro phu: nguoi van hanh "sua nhanh" thanh `3000:3000`, tuc bind 0.0.0.0, va Docker vuot qua ufw.
  - **Sua:** muc 4 ghi ro "tren server dat `APP_PORT=3000`", hoac doi moi cho thanh `127.0.0.1:<APP_PORT>` cho nhat quan.
    Them cau canh bao "khong bao gio bo tien to `127.0.0.1:` trong `ports`".
  - Nen them 1 ca vao `deploy-files.test.ts`: moi `proxy_pass`/`curl http://127.0.0.1:<cong>` trong `DEPLOY.md` phai khop mot cong duy nhat da khai bao.
- **Thu muc khoi phuc:**
  - `docs/DEPLOY.md:321` mount cung `"$(pwd)/.backups:/backups:ro"`.
  - Nhung `DEPLOY.md:299` bat buoc `BACKUP_DIR` tro o du lieu ben, khong phai `./.backups`.
  - Dung luc su co, lenh khoi phuc se khong thay file.
  - **Sua:** dung dung gia tri `BACKUP_DIR` cua `.env.docker`, hoac dung `run --rm backup pg_restore ...` vi service nay da mount dung `${BACKUP_DIR}` va co san `PGPASSWORD`.
    Lenh o dong 321-322 chay service `db`, von khong co bien `PGPASSWORD`, nen se hoi mat khau.
  - Them 1 buoc `cd <BACKUP_DIR> && sha256sum -c <ten-file>.dump.sha256` TRUOC `dropdb --force` (dong 319).
    Hien quy trinh xoa DB that truoc khi kiem ban dump co hong hay khong.

### Dieu kien di kem (khong phai sua code, nhung phai ghi ro)

Toan bo Dockerfile, compose va 2 script backup CHUA tung chay that voi Docker va `pg_dump` that.
Sau khi merge, truoc khi chinh thuc go-live, bat buoc co 1 luot chay du Task 4 buoc 4 (9 muc) va Task 5 buoc 3-5 tren may co Docker, dan output vao ho so.
Neu chu du an muon merge truoc khi co Docker, ghi muc nay thanh dieu kien chan go-live trong `lo-trinh.md`.

## NEN LAM (co the de sau, ghi vao so no)

- **N-1 (T-2):** app dung superuser `ddc`.
  Tao role rieng khong superuser cho `DATABASE_URL` cua app; `ddc` chi dung cho migrate va backup.
- **N-2 (T-3):** bo sung khoa nhay cam cho logger (`src/lib/logger.ts:15-27`): dang so nhieu, dang viet lien (`apikey`, `accesstoken`, `newpassword`), `credential`, `jwt`, `bearer`, `auth`, `dsn`, `salt`, `signature`, `csrf`, `sid`, khoa chua ky tu ngoai ASCII.
- **N-3 (T-4):** logger gioi han khoang 50 khoa moi object, `ArrayBuffer.isView` thi thay bang `'[binary]'` (`logger.ts:52`).
- **N-4 (T-5):** `.dockerignore` them `_material`, `_Image`, `data`, `.vscode`, `*.tsbuildinfo`, `*.pem`, `*.key`.
  Anh `tools` ke thua `builder` voi `COPY . .` nen hien dang chua tai lieu noi bo.
- **N-5 (T-7):** `DEPLOY.md` muc 7 ghi "bat buoc `--rm`, khong pipe output vao file/log".
  Co `mustChangePassword` la cau hoi nghiep vu, can hoi chu du an (ke hoach da de ngoai pham vi).
- **N-6 (T-8):** yeu cau share NAS gioi han quyen, hoac ma hoa (`age`/`gpg`) truoc `rsync`.
  Rieng `rsync --delete-after` (`DEPLOY.md:303`) se lan truyen viec xoa sang NAS: neu `BACKUP_DIR` bi xoa nham hoac bi ma hoa tong tien thi NAS mat theo.
  Nen bo `--delete-after` hoac giu ngay rieng tren NAS.
- **N-7 (T-9):** `env-check` kiem do dai mat khau trong `DATABASE_URL` khi production.
- **N-8 (I-1):** `env-check` canh bao khi `NODE_ENV=production` ma `NEXTAUTH_URL` la `localhost`.
- **N-9:** sua cau loi thoi o `docs/csp-header-bao-mat.md` muc 5 (tien to `[csp-report]`, dong 72 va 76), doi thanh `event: "csp_report.violation"`.
- **N-10:** giam sat loi backup: ngoai B-3, can nhac day `backup.failed` vao kenh canh bao co san cua app, hoac mot cron kiem tuoi file moi nhat co gui email.

## Nhan xet chat luong chung

- **Cau truc Task:** tot.
  Ke hoach chi tiet toi muc interface va bang chuyen log, coder bam dung.
  Moi task 1 commit, message dung quy uoc.
  File nong `next.config.mjs` duoc giu va nha dung luat.
  Logger, env-check, health-db tach phan thuan khoi I/O nen de test; `create-admin` theo dung khuon `unlock-account`.
- **TDD:** thuc chat o Task 1, 2, 3, 7b: test do truoc, ca bien co y nghia, khong mock thua (create-admin dung kho gia thay vi mock Prisma).
  Task 4 coder tu nhan da tao file truoc test roi kiem do bu. Chap nhan duoc vi da khai.
  Task 5 la diem yeu: test chi grep van ban, nen ca race condition lan SQL injection deu lot qua lop coder.
  Cong bat loi thuoc ve tester (race) va security-reviewer (TB-2).
  Bai hoc cho cac dot sau: script shell co logic phai co test chay that bang binary gia ngay tu luc coder viet.
- **DEPLOY.md:** noi dung tot va day du 15 muc cung Phu luc A.
  Phan Nginx xu ly dung bay thua ke `add_header`, co `x-middleware-subrequest ""`, co `limit_req`.
  Cron doc secret tu file 600, co canh bao in dam khong chay seed tren production.
  Nhung co loi nhat quan o nhung cho quan trong nhat luc go-live (cong) va luc su co (thu muc khoi phuc, chua kiem sha256 truoc khi drop), xem B-4.
  Chua co huong dan xu ly khoa backup ket (B-3).
- **Thua/thieu so voi ke hoach:**
  Khong thay phan thua.
  Thieu muc "Bang chung khoi phuc that" trong `thay-doi.md` (ke hoach Task 5 buoc 5), vi chua co Docker; da khai.
  `docs/HUONG_DAN_GOOGLE_OAUTH.md` chi sua dung muc 3 nhu ke hoach.
- **Diem dang khen:**
  - Logger khong bao gio ghi `e.message`, va viec chuyen cac cho log cu da lam `alert-engine`/`jobs` an toan hon truoc.
  - `pingDb` co handler cho promise tre.
  - Cong app chi bind `127.0.0.1`; CA cong ty di qua build secret, khong nam trong layer.
  - Ban va race condition toi thieu, dung goc, co them ca don dep binh thuong.

## Viec cho vong sau

Coder/debugger sua B-1 den B-4, moi muc co test do truoc (B-4 phan tai lieu thi kiem bang grep hoac ca `deploy-files.test.ts`).
Chay lai `npx tsc --noEmit`, `npm test`, roi chuyen lai security-reviewer (xac nhan TB-1, TB-2 da dong) va reviewer.
Cac muc N-1 den N-10 dua vao so no hardening.
