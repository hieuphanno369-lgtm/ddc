PHAN QUYET BAO MAT: LO HONG

Khong co lo hong muc cao.
Co 2 lo hong muc trung binh, nen va truoc go-live vi va re.
Co mot so diem muc thap va ghi chu thong tin.

Skill da dung: `ddc-tower:security-review`.
Khong goi `api-security-testing`, `security-audit`, `find-security-vulnerabilities-in-code`, vi pham vi la ha tang/script va doc code tinh la du.
Khong dung `mcp__postgres`, vi thay doi khong dung schema hay truy van ung dung.
Da doc: `thay-doi.md`, diff `main...HEAD` (46 file), va tung file trong pham vi.

---

# Danh gia bao mat - P5 ha tang go-live (nhanh feature/p5-b-ha-tang, HEAD 575d43f)

## Lo hong

### TB-1 (Trung binh): Mot IP don le lam can gioi han toan cuc cua `/api/health/db`, khien healthcheck Docker va giam sat IT bao sai

- **Vi tri:** `app/api/health/db/route.ts:13-17`, `docker-compose.yml:63-68`, `docs/DEPLOY.md:377`.
- **Nguyen nhan:** bucket toan cuc `health-db:global` (300/phut) duoc tang dem TRUOC khi kiem bucket theo IP (60/phut).
  Request da bi chan theo IP van tieu han muc toan cuc.
- **Cach khai thac:**
  1. Ke tan cong tu 1 IP gui khoang 300 request/phut toi `https://<ten-mien>/api/health/db`. Route nay cong khai, middleware khong chan `/api`, Nginx mau o `DEPLOY.md` muc 6 khong gioi han.
  2. Tu request thu 301, moi nguoi nhan 429 trong phan con lai cua cua so, ke ca healthcheck noi bo cua container (`fetch ... r.ok ? 0 : 1`).
  3. Duy tri khoang 90 giay tro len (3 lan retry, moi lan 30s) la container bi danh dau `unhealthy`.
  4. Giam sat IT theo `DEPLOY.md:377` nhan 429/khong-200 va bao dong gia. Neu IT dung autoheal/restart theo health thi app bi khoi dong lai lien tuc.
- **Cach va:**
  - (a) Dao thu tu: kiem per-IP truoc, chi request qua duoc per-IP moi tinh vao bucket toan cuc.
  - (b) Trong `DEPLOY.md` muc 6, them `location = /api/health/db { allow <IP giam sat IT>; allow 127.0.0.1; deny all; proxy_pass ...; }` de endpoint khong cong khai ra Internet.
  - (c) Tuy chon: healthcheck noi bo khong gui `x-forwarded-for` va route khong tinh gioi han toan cuc cho request khong co XFF. Request di qua Nginx luon co XFF nen khong gia duoc.

### TB-2 (Trung binh): `pg-restore-test.sh` co the chay SQL tuy y tren DB THAT (`PGDATABASE`) bang quyen superuser, qua ten bang trong file dump

- **Vi tri:** `scripts/backup/pg-restore-test.sh:86-101`, cu the dong 98 (`psql -tAc "select count(*) from \"$t\"" -d "$PGDATABASE"`) va dong 97.
- **Nguyen nhan:** ten bang `$t` doc tu DB tam vua khoi phuc (tuc la do file dump quyet dinh), roi ghep thang vao chuoi SQL chi bang dau `"`, khong escape.
  `psql -c` chay duoc nhieu cau lenh trong mot chuoi.
  PGUSER `ddc` la superuser (POSTGRES_USER cua image postgres).
- **Cach khai thac:**
  1. File dump bi sua (tren NAS, hoac ai co quyen ghi `BACKUP_DIR`) chua bang ten `x"; DROP TABLE "user_roles"; --`. `.sha256` nam canh file nen tinh lai duoc, khong can duoc.
  2. `pg_restore` tao bang do trong DB tam, khong loi.
  3. Dong 98 thuc thi `select count(*) from "x"; DROP TABLE "user_roles"; --"` tren DB production.
  4. Superuser con dung duoc `COPY ... TO PROGRAM` de chay lenh trong container `db`.
  5. Viec nay pha cam ket "KHONG BAO GIO dung vao database that" (`DEPLOY.md:312`, comment dau script).
  Kich ban thuc te: khi su co, van hanh keo ban dump tu NAS ve de thu khoi phuc.
- **Cach va:**
  - Kiem `$t` khop `^[A-Za-z_][A-Za-z0-9_]*$` (ten bang Prisma deu khop), khong khop thi `fail "bad_table_name"`.
  - Hoac truyen qua bien psql tu stdin: `printf 'select count(*) from :"t";\n' | psql -v t="$t" ...`. Luu y `-c` khong noi suy bien.
  - Truy van DB nguon chay chi-doc: `PGOPTIONS='-c default_transaction_read_only=on' psql ... -d "$PGDATABASE"`.
  - Nen bo han cot "so_dong_nguon", vi cot nay chi de xem.

## Muc thap

### T-1: Ne dieu kien bao ve ten DB tam do Postgres cat ten dinh danh o 63 byte

- **Vi tri:** `pg-restore-test.sh:48-59, 61-68`.
- **Nguyen nhan:** so sanh `"$RESTORE_DB" = "$PGDATABASE"` lam tren chuoi CHUA cat, trong khi Postgres cat ten dinh danh con 63 byte.
- **Cach khai thac (can cau hinh):**
  - Neu `PGDATABASE` dai tu 63 byte tro len, `RESTORE_DB` sau khi cat TRUNG ten DB that.
  - Khi do `createdb` loi "already exists", `set -e` thoat, trap chay `dropdb --if-exists --force` voi cung ten da cat, va DB production bi xoa cuong buc.
  - Neu ten dai 49-62 byte, phan timestamp bi cat: 2 lan chay gan nhau se xoa DB tam cua nhau.
  - Cau hinh hien tai `ddc_control_tower` (17 ky tu) KHONG dinh.
- **Cach va:**
  - Them `[ ${#RESTORE_DB} -le 63 ] || { echo "ten DB tam qua dai" >&2; exit 5; }`.
  - Chi dang ky trap SAU khi `createdb` thanh cong, de loi "da ton tai" khong bao gio dan toi `dropdb`.

### T-2: App ket noi DB bang superuser Postgres

- **Vi tri:** `docker-compose.yml:3, 15, 50-51`.
- **Van de:** hien chua tim thay SQL injection (grep `queryRawUnsafe|executeRawUnsafe` trong `src` = 0). Nhung neu sau nay co, superuser nang len RCE qua `COPY TO PROGRAM`. TB-2 cung nang hon vi ly do nay.
- **Cach va:** tao role rieng khong superuser, so huu schema `public`, cho `DATABASE_URL` cua app. Role `ddc` chi de migrate/backup.

### T-3: Danh sach khoa nhay cam cua logger con thieu (bypass bang ten khoa)

- **Vi tri:** `src/lib/logger.ts:15-27`.
- **Khong bi loc:** dang so nhieu (`tokens`, `passwords`, `secrets`, `keys`, `emails`), tu viet lien chu thuong (`newpassword`, `apikey`, `accesstoken`, `resettoken`), va cac tu `credential(s)`, `jwt`, `bearer`, `auth`, `dsn`, `connectionString`, `salt`, `signature`, `csrf`, `sid`.
- Ky tu Unicode/homoglyph (vi du `pаssword` co chu a Cyrillic) cung lot.
- Gia tri chuoi khong duoc quet, vi du email nam duoi khoa `to` hay `detail`.
- **Hien tai chua lo:** moi cho goi deu dung khoa an toan (`tag`, `alertId`, `errCode`, `hint`, `fakeToday`, `violation`, `problems`, `method`, `path`, `routePath`, `routeType`, `errName`, `errStack`...).
- **Cach va:**
  - Them cac tu tren, chuan hoa bo `s` cuoi.
  - Khop them theo chuoi con cho `password|passwd|secret|token|apikey|credential`.
  - Coi khoa chua ky tu ngoai ASCII la nhay cam.

### T-4: Logger khong gioi han so khoa cua object

- **Vi tri:** `logger.ts:52`.
- **Van de:** `Object.entries` tren `Buffer`/`Uint8Array` hoac object lon sinh ra 1 khoa cho moi byte, gay phinh log hoac ton CPU. Khong lo du lieu.
- **Cach va:** cat toi da khoang 50 khoa moi object, `ArrayBuffer.isView(v)` thi thay bang `'[binary]'`.

### T-5: Anh `tools` (va build context) chua tai lieu noi bo

- **Vi tri:** `.dockerignore`, `Dockerfile:21` (`COPY . .`).
- **Van de:** `.dockerignore` khong loai `_material/` (docx/xlsx de bai, master data), `_Image/`, `data/uploads/`, `.vscode/`, `tsconfig.tsbuildinfo`.
  Cac thu muc nay nam trong stage `builder`, va vi vay nam trong anh `tools` (dung tu `builder`).
  Anh `runner` chi nhan `.next/standalone` + `static` + `public`.
  Nen xac nhan khi build that rang `data/uploads` khong bi file tracing keo vao standalone.
- **Cach va:** them `_material`, `_Image`, `data`, `.vscode`, `*.tsbuildinfo`, `*.pem`, `*.key` vao `.dockerignore`.

### T-6: `DEPLOY.md` mau thuan cong: Nginx/curl goi `127.0.0.1:3000` nhung compose publish `127.0.0.1:${APP_PORT:-3005}`

- **Vi tri:** `docs/DEPLOY.md:132, 164, 176, 186, 197, 324, 340` doi chieu voi `docker-compose.yml:60`, `.env.docker.example:5`.
- **Vi sao lien quan bao mat:** Nginx se tra 502. Nguoi van hanh de "sua nhanh" bang cach doi `ports` thanh `3000:3000`, tuc bind 0.0.0.0. Docker bo qua ufw voi cong publish, nen app bi lo thang, vuot Nginx: khong TLS, va XFF tu khai thanh IP tin cay, bypass rate-limit theo IP.
- **Cach va:** thong nhat mot gia tri, vi du ghi ro "server dat `APP_PORT=3000`" hoac doi moi cho thanh `127.0.0.1:<APP_PORT>`. Them cau canh bao "khong bao gio bo tien to `127.0.0.1:` trong `ports`".

### T-7: Mat khau tam cua `create-admin` khong bi bat doi, va lot vao log container neu chay khong co `--rm`

- **Vi tri:** `scripts/create-admin.ts:27-30`.
- **Van de:**
  - Mat khau tam co hieu luc vo thoi han cho toi khi admin tu doi. Chua co co bat buoc doi mat khau.
  - stdout cua `docker compose run` di vao log driver `json-file` (`x-logging`). Tai lieu dung `--rm` (`DEPLOY.md:234`) nen log bi xoa cung container. Chay thieu `--rm` thi mat khau nam trong `/var/lib/docker/containers/*/...-json.log` toi khi xoa container.
- **Cach va (ngan han):** `DEPLOY.md` muc 7 ghi ro "bat buoc `--rm`, khong pipe output vao file/log".
- **Cach va (dai han, cau hoi nghiep vu cho chu du an):** them co `mustChangePassword` cho tai khoan do CLI tao.

### T-8: File backup khong ma hoa khi chep sang NAS

- **Vi tri:** `DEPLOY.md:300-304`.
- **Van de:** dump chua hash mat khau, du lieu kinh doanh va bi mat da ma hoa bang `NOTIFY_SECRET_KEY`. `NOTIFY_SECRET_KEY` khong co trong dump, nen phan bi mat van an toan.
- **Cach va:** ghi yeu cau share NAS gioi han quyen (chi tai khoan backup), hoac ma hoa (`gpg --symmetric`/`age`) truoc khi rsync.

### T-9: `POSTGRES_PASSWORD` khong bi kiem do manh

- **Vi tri:** `docker-compose.yml:3, 16`.
- **Van de:** `:?` chi bat khong rong, nen `POSTGRES_PASSWORD=1` van chay. DB khong publish cong nen rui ro thap.
- **Cach va:** neu muon, `env-check` kiem do dai mat khau trong `DATABASE_URL` khi production (vi du >= 16).

## Thong tin (khong can va gap)

- **I-1:** `.env.docker.example:8` de mac dinh `NEXTAUTH_URL=http://localhost:3005`, va `env-check` cho qua o production vi compose local cung chay `NODE_ENV=production`. Quen doi tren server thi dang nhap chuyen huong ve localhost va bi phat hien ngay. Cookie phien cung mat co Secure, HSTS giam bot rui ro nay.
- **I-2:** `/api/health/db` cong khai trang thai DB up/down. Thoi gian phan hoi khong lo them gi ngoai chinh noi dung do (ok ngay, hoac down/timeout 3s), nen khong phai oracle moi. Va TB-1(b) la giai quyet luon.
- **I-3:** `errorFields` lay moi dong stack bat dau bang `at `. Neu mot message nhieu dong co dong bat dau `at ` thi dong do lot vao `errStack`. `errDigest` khong gioi han dinh dang. Rui ro rat thap.
- **I-4:** khoa `__proto__` trong fields bi gan vao prototype cua object cuc bo `out` va mat khoi JSON. Khong gay prototype pollution toan cuc, khong lo du lieu.
- **I-5:** `csp_report.violation` log dang chuoi JSON nen khong qua loc theo khoa. URL da duoc `parseCspReports` cat query/hash (`src/lib/csp-report.ts:73,81`), va hanh vi nay co tu truoc.

## Da xac nhan an toan (doi chieu code that)

1. **Logger:**
   - Khong cho nao dua `e.message` vao log. Da soat ca 15 cho doi trong diff: `auth.ts` x2, `actions-password-reset.ts` x2, `actions.ts`, `alert-engine.ts`, `auth-mail.ts` x2, `jobs.ts` x2, `notify/dispatch.ts` x3, `password-reset.ts`, `csp-report`, `clock.ts`, `client-ip.ts`.
   - `alert-engine.ts` va `jobs.ts` truoc day log ca object loi, nay da an toan hon.
   - `auth_mail.send_failed` chi log ma co dinh (`no_recipients`, `smtp_auth`...).
   - Vong tham chieu va do sau lon hon 3 deu khong lam lo du lieu.
2. **`/api/health/db`:** body loi co dinh `{status:'error',db:'down'}` kem `no-store`. Khong tra host, loi ket noi hay stack. Log chi co `errorFields`.
3. **`instrumentation.ts`:**
   - `onRequestError` chi log method, path da cat `?`/`#`, routePath, routeType va `errorFields`. Khong co header, cookie hay query.
   - Token dat lai mat khau nam trong query (`password-reset.ts:101`) nen bi cat.
   - `enforceServerEnv` chi chay trong `register()`, doc `process.env`, khong co dau vao tu nguoi dung. User ngoai khong kich hoat duoc `exit(1)`. Log chi co ten bien va ly do, khong co gia tri.
4. **Dockerfile/compose:**
   - `runner` va `tools` deu `USER node`.
   - CA cong ty chi vao qua `RUN --mount=type=secret`, khong nam trong layer, va khong co trong `runner`.
   - Khong co `ARG`/`ENV` bi mat.
   - `DATABASE_URL` gia (`build:build@127.0.0.1`) chi nam trong lenh RUN cua `builder`/`tools`. No hien trong `docker history` nhung ro rang la gia, va khong vao `runner`.
   - Chi `app` publish cong, va chi `127.0.0.1:`. `db`, `migrate`, `tools`, `backup` khong publish cong nao.
   - `.dockerignore` chan `.env`, `.env.*` (tru `.env.example`), `.git`, `.backups`, `.claude`, `.serena`, `e2e` (co `e2e/.auth`).
5. **Script backup:**
   - Ca 2 script deu `umask 077`, nen dump va `.sha256` la 0600, thu muc tao moi la 0700.
   - Khong in `PGPASSWORD` hay URL ket noi. Mat khau chi di qua bien moi truong libpq.
   - Race khoa da duoc va (trap dang ky sau `mkdir`).
6. **`create-admin`:**
   - Mat khau sinh bang `crypto.randomBytes(18)` (144 bit, base64url 24 ky tu), khong dung `Math.random`.
   - Chi in ra stdout dung 1 lan. `activityLog.detail=''`. Loi chi in `e.name`.
   - Truong hop 2 lenh chay song song: ca hai deu thay chua co tai khoan, chi mot ben tao duoc, ben kia nhan P2002 va tra ma 1 "da ton tai" (`create-admin-cli.ts:88-90`).
   - Email duoc `trim().toLowerCase()` boi `createAccountSchema` (`validation.ts:205`) truoc ca buoc tim lan buoc tao, nen khong tao trung duoc bang cach doi hoa/thuong.
   - Service `tools` khong publish cong. Muon chay phai co quyen shell/Docker tren server, tuong duong quyen DB.
7. **`.env.docker.example`:** moi bi mat de trong, compose `:?` bat buoc dien, `env-check` bat `NEXTAUTH_SECRET`/`CRON_SECRET` >= 32 ky tu va `NOTIFY_SECRET_KEY` dung 32 byte.
8. **`DEPLOY.md`:**
   - Khong co huong dan tat kiem TLS (khong co `NODE_TLS_REJECT_UNAUTHORIZED`). `EXTRA_CA_FILE` ghi ro "de trong tren server that".
   - ufw chi mo 80/443.
   - `.env.docker` duoc `chmod 600`, `CRON_SECRET` doc tu file 600 (khong ghi thang vao crontab).
   - Chi con mau thuan cong o T-6.

## De xuat thu tu va

1. TB-1: dao thu tu rate limit va chan `/api/health/db` o Nginx.
2. TB-2 + T-1: kiem ten bang, truy van DB nguon chi-doc, gioi han do dai ten DB tam, chi dang ky trap sau `createdb`.
3. T-6: sua `DEPLOY.md` cho thong nhat cong.
4. Cac diem con lai (T-2, T-3, T-4, T-5, T-7, T-8, T-9) lam trong dot hardening.
