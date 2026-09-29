KẾT QUẢ: XANH (vòng 3, đã xác nhận độc lập bản vá B-1..B-4 theo danh-gia.md)

# Kết quả kiểm thử độc lập - P5 hạ tầng go-live (P5-B, nhánh `feature/p5-b-ha-tang`)

Skill đã dùng: `test-driven-development`, `verification-before-completion`.
Không dùng `qa`/`qa-only` vì thay đổi không đụng UI (đúng như kế hoạch), có dùng `mcp__playwright` để
đăng nhập thật (rủi ro 6) và `mcp__postgres` (chỉ đọc) để xác nhận trạng thái dữ liệu DB B trước/sau dọn dẹp.

Tôi chỉ tạo/sửa 2 file test mới (`src/lib/logger-bien.test.ts`,
`src/server/backup-scripts-lock.test.ts`), không sửa bất kỳ file code sản phẩm nào.

---

## 1. Có 1 test RỚT (đỏ) - phát hiện lỗi race condition THẬT trong `scripts/backup/pg-backup.sh`

**File:** `src/server/backup-scripts-lock.test.ts` (mới, do tester viết để chạy thật script `.sh` bằng
`sh` + binary `pg_dump`/`pg_restore` giả lập, không cần Postgres/Docker thật trên máy này).

**Tên test rớt:**
`scripts/backup/pg-backup.sh - khoa chong chay trung (chay that qua binary gia) > tien trinh thua khoa (thoat ma 3) KHONG duoc xoa khoa cua tien trinh dang giu (rui ro coder da tu neu)`

**Lỗi:**
```
AssertionError: expected false to be true
- Expected: true
+ Received: false
 ❯ src/server/backup-scripts-lock.test.ts:89:35
```

**Nguyên nhân gốc (đã đọc code, đã xác nhận bằng chạy thật 2 lần độc lập - vừa thủ công qua Bash, vừa
qua test tự động):**

Trong `scripts/backup/pg-backup.sh`, `trap cleanup EXIT` được đăng ký **TRƯỚC** khi thử giành khoá
(`mkdir "$LOCK_DIR"`):

```sh
cleanup() {
  rm -f "$PARTIAL"
  rmdir "$LOCK_DIR" 2>/dev/null || true
}
trap cleanup EXIT

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  log_err backup.failed ',"reason":"lock_busy"'
  exit 3
fi
```

Khi tiến trình B chạy trong lúc tiến trình A đang giữ khoá: B thua (`mkdir` thất bại), in đúng
`backup.failed reason:lock_busy` và thoát mã 3 (đúng như kế hoạch mong đợi cho **B**). Nhưng vì
`trap cleanup EXIT` đã được đăng ký từ đầu script, `exit 3` của B vẫn kích hoạt `cleanup()`, và
`cleanup()` chạy `rmdir "$LOCK_DIR"` **vô điều kiện** - xoá luôn thư mục khoá **của A đang chạy**
(không phải khoá do B tạo ra, vì B chưa từng tạo được nó). Hệ quả: một tiến trình **C** khởi động
ngay sau đó, trong lúc A vẫn đang chạy `pg_dump`, sẽ `mkdir` thành công (khoá đã bị B xoá hộ) và
chạy `pg_dump` **song song thật sự** với A - đúng cái kịch bản "chạy backup 2 lần song song" mà cơ
chế khoá này được thiết kế để chặn, nhưng lại KHÔNG chặn được khi có tiến trình thứ 3 xen vào.

**Bằng chứng tái hiện thủ công (trước khi viết test tự động), dùng `pg_dump`/`pg_restore` giả (không
cần Postgres thật):**

```
== Trang thai khoa ngay sau khi A da chiem (ky vong: co ton tai) ==
LOCK_TON_TAI=yes
== Chay B trong luc A dang giu khoa (ky vong B thoat ma 3) ==
B_EXIT=3
{"ts":"...","event":"backup.failed","reason":"lock_busy"}
== Trang thai khoa NGAY SAU KHI B thoat, trong luc A VAN DANG chay (ky vong: khoa VAN CON) ==
LOCK_TON_TAI=no        <-- BUG: khoa da bi xoa trong khi A van con chay
A_EXIT=0
```

Và khai thác thật (chạy tiến trình C ngay sau B, trong lúc A vẫn đang "dump"):
```
--- A2.out ---
{"event":"backup.start","file":"demo2_..._09.dump"}
{"event":"backup.done","file":"demo2_..._09.dump", ...}
--- C2.out ---
{"event":"backup.start","file":"demo2_..._10.dump"}   <-- C bat dau chi 1 giay sau A
{"event":"backup.done","file":"demo2_..._10.dump", ...}  <-- C ket thuc CUNG LUC voi A
```
A và C có 2 tên file khác nhau, cả hai đều `backup.start`/`backup.done`, và khoảng thời gian chạy của
chúng chồng lấn hoàn toàn - tức C đã chạy `pg_dump` song song với A dù cơ chế khoá lẽ ra phải ngăn.

**Test tự động (`src/server/backup-scripts-lock.test.ts`)** hiện thực hoá đúng kịch bản trên bằng
`child_process.spawn`/`execFileSync` gọi thẳng `scripts/backup/pg-backup.sh` qua `sh`, dùng 2 binary
giả `pg_dump` (ngủ 3 giây rồi ghi file) và `pg_restore` (luôn thoát 0) đặt tạm trong 1 thư mục đưa
lên đầu `PATH` - không cần Postgres/Docker thật. Test tự bỏ qua (`describe.skipIf`) nếu máy không có
`sh` trong `PATH`; trên máy này (`sh` có sẵn qua Git) test đã chạy và rớt đúng như dự đoán.

**Ảnh hưởng thực tế:** đây chính là rủi ro số 1 mà coder đã tự nêu ("chưa chạy thật lần nào... race
condition") - nay đã được xác nhận là lỗi CÓ THẬT, không chỉ là nghi ngờ lý thuyết. Hệ quả trên
production: nếu vì lý do nào đó (ví dụ cron `02:00` bị trùng với một lần chạy tay, hoặc healthcheck/
retry của một orchestrator nào đó gọi lại `docker compose run backup` khi bản trước chưa xong) có 2-3
lệnh backup được kích hoạt gần nhau, khoá `mkdir .lock` **không đảm bảo loại trừ lẫn nhau** như tài
liệu/kế hoạch mô tả ("Khoá mkdir .lock chống chạy trùng") - nhiều `pg_dump` có thể chạy chồng lên
DB cùng lúc.

**Đề xuất hướng vá (để reviewer/debugger tham khảo, KHÔNG tự sửa vì ngoài phạm vi cho phép của
tester):** chỉ đăng ký `trap cleanup EXIT` sau khi `mkdir "$LOCK_DIR"` đã thành công (di chuyển dòng
`trap cleanup EXIT` xuống sau khối `if ! mkdir ...; then ... exit 3; fi`), và dùng 1 trap `EXIT` khác
(chỉ xoá `.partial`, không đụng `.lock`) áp dụng cho nhánh thất bại giành khoá.

---

## 2. Xác nhận độc lập 3 cổng kiểm tổng - KHỚP đúng số coder đã báo cáo

| Cổng kiểm | Coder báo | Tester tự chạy lại (độc lập) |
|---|---|---|
| `npx tsc --noEmit` | sạch | **sạch** (0 lỗi) |
| `npm test` (trước khi tester thêm test) | 253 file (1 skip)/2897 xanh + 15 skip | **khớp đúng 100%**: 253 file passed + 1 skipped (254 total) / 2897 tests passed + 15 skipped (2912 total) |
| `npm run build` | qua (CA công ty) | **qua**, có route `/api/health/db` mới trong danh sách route, không lỗi build |

Sau khi tester thêm 2 file test mới (`logger-bien.test.ts`, `backup-scripts-lock.test.ts`):
**254 file test tổng cộng, 1 file rớt (file mới của tester) / 2902 test xanh + 15 skip / 1 test rớt
(test mới của tester, phát hiện bug thật ở mục 1).** Không có test nào trong bộ 253 file gốc của
coder bị ảnh hưởng hay giảm đi.

---

## 3. 6 rủi ro coder tự nêu - kết quả soi độc lập từng điểm

1. **Script backup/restore-test chưa chạy thật** → ĐÃ CHẠY THẬT (mô phỏng bằng binary giả, không cần
   Docker/Postgres) và **tìm ra 1 lỗi race condition thật** trong `pg-backup.sh` (xem mục 1 ở trên).
   `pg-restore-test.sh` được đọc kỹ, logic hợp lý (kiểm sha256, chặn cứng tên DB tạm phải chứa
   `_restore_test_` và khác `PGDATABASE`, luôn `dropdb --if-exists --force` trong `trap`); ghi chú
   nhỏ (không chặn): `RESTORE_DB` chỉ có độ phân giải đến GIÂY
   (`date -u +%Y%m%d%H%M%S`), nên 2 lần chạy `pg-restore-test.sh` khởi động trong CÙNG 1 giây có thể
   trùng tên DB tạm - rủi ro thấp hơn nhiều so với mục 1, nêu để reviewer cân nhắc có cần vá hay
   không.
2. **Docker/Compose chưa build/chạy thật** → xác nhận lại: máy này vẫn KHÔNG có Docker Desktop, nên
   phần "chạy container thật" (build ảnh, `docker compose up`, healthcheck, `docker inspect` log
   config, seed demo qua container) **VẪN CHƯA kiểm chứng được**, giữ nguyên như coder đã báo. Tôi đã
   đọc kỹ `Dockerfile`/`docker-compose.yml` theo đúng kế hoạch: 4 stage đúng thứ tự, `secrets.extra_ca`
   dùng `required=false` đúng cách, cổng DB không publish, cổng app chỉ bind `127.0.0.1`, anchor
   `x-logging` áp dụng cho cả 5 service (`db`, `migrate`, `app`, `tools`, `backup`) - khớp với
   `deploy-files.test.ts`. Đây là điểm CHƯA CHẠY THẬT, cần máy có Docker Desktop kiểm lại trước khi
   coi Task 4-5 là ĐẠT đầy đủ - không phải lỗi, nhưng phải nêu rõ mức tin cậy.
3. **Logic vòng tham chiếu trong `logger.ts` dùng `Set` theo nhánh cha** → viết thêm 5 test mới
   (`src/lib/logger-bien.test.ts`): 2 trường khác nhau cùng trỏ 1 object ở cấp 1, 2 nhánh con cùng trỏ
   1 object lồng nhau, mảng dùng chung giữa 2 trường, object dùng lại ở 2 phần tử của 1 mảng, và đối
   chứng vòng lặp thật vẫn phải bị báo. **Cả 5 test đều XANH** - xác nhận logic hiện tại **KHÔNG có
   bug báo `unserializable` oan** khi chỉ là chia sẻ tham chiếu (không phải vòng lặp thật); cơ chế
   `seen.delete()` trong khối `finally` xoá đúng lúc rời nhánh trước khi xử lý nhánh anh em kế tiếp.
4. **`docs/csp-header-bao-mat.md` mục 5 vẫn nhắc tiền tố log cũ `[csp-report]`** → xác nhận ĐÚNG: đọc
   lại nguyên văn mục 5 (dòng 72, 76 của file), tài liệu vẫn ghi "Log của app: các dòng có tiền tố
   `[csp-report]`..." trong khi code thật (`app/api/csp-report/route.ts:43`) đã đổi sang
   `logger.warn('csp_report.violation', ...)` (JSON có khoá `event`, không còn tiền tố chuỗi). Xác
   nhận thêm: file này KHÔNG nằm trong danh sách file được phép sửa của Task 1 hay Task 7 theo kế
   hoạch, nên đúng là ngoài phạm vi coder - để điều phối viên/reviewer quyết định có vá câu đó không.
5. **Cách hiểu "không còn Supabase/Vercel/Vietcombank/data/uploads" trong DEPLOY.md** → đọc lại toàn
   văn `docs/DEPLOY.md`, xác nhận: 4 chữ này CHỈ xuất hiện trong các câu dạng "không còn dùng nữa"
   ("Tài liệu này thay thế hoàn toàn bản cũ (Supabase + Vercel)", "không còn thư mục `data/uploads`",
   "KHÔNG còn gọi Vietcombank lấy tỷ giá") - không có bước hướng dẫn thao tác nào còn dùng các dịch
   vụ/tính năng này. Đồng ý với cách hiểu của coder, đúng theo yêu cầu mục 1 của kế hoạch.
6. **Đăng nhập thật bằng tài khoản `create-admin`** → ĐÃ TỰ LÀM TRỌN VẸN (xem mục 4 dưới đây).

---

## 4. Task 7b - đăng nhập thật qua trình duyệt (Playwright), trên DB B thật

Các bước đã thực hiện, tất cả THÀNH CÔNG:

1. `npm run create-admin -- p5b-qa-doc-lap@example.com "QA Doc Lap"` → thoát 0, in đúng 1 lần mật
   khẩu tạm.
2. Kiểm bằng `mcp__postgres` (chỉ đọc, xác nhận đang ở DB `ddc_control_tower_b`): tài khoản lưu đúng
   `role=admin`, `canViewFinance=true`, `isActive=true`, `lockedAt=NULL`.
3. Khởi động `npx next dev -p 3001` nền, chờ sẵn sàng; log dev server có đúng 1 dòng
   `{"level":"warn","event":"env.invalid_dev",...}` (do `.env` cục bộ thiếu `CRON_SECRET`/sai
   `NEXTAUTH_SECRET`), server KHÔNG crash - đúng hành vi Task 2.
4. Dùng `mcp__playwright` mở `http://127.0.0.1:3001/vi/login`, đăng nhập bằng email + mật khẩu tạm →
   vào được `/vi/overview`, menu hiển thị đúng "QA Doc Lap / Admin", có mục "Quản trị" (chỉ admin mới
   thấy).
5. Mở menu Cài đặt → Người dùng → Đổi mật khẩu, đổi thành công (`"Đã đổi mật khẩu. Các phiên đăng
   nhập khác (nếu có) sẽ bị đăng xuất trong vài phút."`).
6. Đăng xuất, đăng nhập lại bằng email + MẬT KHẨU MỚI → thành công, vào lại `/vi/overview`.
7. Dọn dẹp: xoá tài khoản test + 4 dòng `activity_log` (`create_admin_cli` + các dòng đăng nhập/đổi
   mật khẩu) khỏi DB B bằng 1 script Prisma tạm (không phải file trong repo, đã xoá ngay sau khi
   chạy). Xác nhận lại bằng `mcp__postgres`: `select count(*) from user_roles where email=...` → 0.
   Tắt dev server cổng 3001.

**Kết luận:** luồng tạo admin → đăng nhập lần đầu bằng mật khẩu tạm → bắt buộc đổi mật khẩu (bằng
thao tác thủ công, đúng như thiết kế "chỉ nhắc bằng chữ", không có tính năng ép đổi) → đăng nhập lại
bằng mật khẩu mới, hoạt động đúng end-to-end trên môi trường thật (dev server + DB B thật).

---

## 5. Các điểm khác đã tự rà thêm (đều ĐẠT, không phát hiện vấn đề)

- `pingDb` (`src/lib/health-db.ts`): đọc code + test có sẵn (5 ca) - xác nhận đua đúng timeout, luôn
  `clearTimeout`, gắn `.catch` cho promise trễ nên không rớt `unhandledRejection`. Khớp đúng mô tả kế
  hoạch.
- `enforceServerEnv`/`instrumentation.ts`: đọc code + test có sẵn - xác nhận CHỈ `exit(1)` khi
  `NODE_ENV=production`, dev chỉ `logger.warn`, bỏ qua hoàn toàn lúc `NEXT_PHASE=phase-production-build`.
  Đúng yêu cầu "chỉ dừng app ở production".
- Rà toàn bộ các điểm gọi `logger.*` đã chuyển đổi trong `src/`, `app/` (15+ vị trí) - không nơi nào
  đưa `e.message`/toàn bộ object lỗi thô vào log; `auth-mail.ts` dùng `String(r.error)` nhưng
  `r.error` chỉ là 1 trong các chuỗi mã lỗi cố định (`no_recipients`, `blocked_ip`, `dns_failed`,
  `smtp_rejected`, `smtp_auth`, `timeout`, `smtp_conn`) - không có dữ liệu nhạy cảm.
- `src/server/deploy-files.test.ts`: đọc lại toàn bộ, xác nhận đúng những gì coder mô tả (biến bắt
  buộc, không publish cổng DB, anchor logging áp dụng đủ 5 service, shebang/`set -eu`/không CRLF/
  không gán cứng `PGPASSWORD=` cho cả 2 script `.sh`).

---

## 6. Việc tester đã KHÔNG làm (theo đúng giới hạn được giao)

- Không tự sửa `scripts/backup/pg-backup.sh` dù đã xác định rõ dòng cần sửa - đây là việc của
  debugger/coder sau khi reviewer xác nhận.
- Không build/chạy Docker thật (máy không có Docker Desktop, đúng như đã xác nhận từ trước).
- Không chạy được `pg_dump`/`pg_restore`/`psql`/`createdb`/`dropdb` thật với PostgreSQL (máy không có
  các client này); phần kiểm race condition dùng binary giả lập hành vi tối thiểu (ghi file + ngủ),
  đủ để lộ lỗi logic khoá nhưng KHÔNG thay thế được việc chạy thật với `pg_dump` thật trên máy có
  Docker/PostgreSQL client đầy đủ (các phần khác của 2 script - sha256, đếm bảng, đếm dòng qua `psql`
  thật - vẫn CHƯA được kiểm chạy thật).

---

## Việc cần làm tiếp (đề xuất cho reviewer/debugger)

1. **Bắt buộc xử lý mục 1** (race condition khoá `pg-backup.sh`) trước khi Task 5 được coi là ĐẠT -
   đây là lỗi ảnh hưởng tới tính toàn vẹn dữ liệu backup, không phải vấn đề tài liệu.
2. Khi có máy có Docker Desktop: chạy lại toàn bộ Task 4 Bước 4 và Task 5 Bước 3-4 như kế hoạch đã
   ghi, bao gồm cả kịch bản khoá chạy trùng bằng `pg_dump` thật (không chỉ binary giả) để xác nhận
   bản vá mục 1 hoạt động đúng với tải I/O thật.
3. Cân nhắc vá câu lỗi thời ở `docs/csp-header-bao-mat.md` mục 5 (rủi ro 4) - không chặn, tuỳ quyết
   định điều phối viên.
4. File test mới `src/lib/logger-bien.test.ts` và `src/server/backup-scripts-lock.test.ts` nên được
   giữ lại trong bộ test (không phải test tạm) vì chúng phủ đúng 2 rủi ro coder đã tự nêu và không
   phụ thuộc Docker/Postgres thật.

---

# VÒNG 2 - kiểm chứng độc lập bản vá race condition khoá `pg-backup.sh`

Skill đã dùng: `test-driven-development`, `verification-before-completion`.
Không đụng UI ở vòng vá này (chỉ sửa 1 file `.sh`) nên không cần `mcp__playwright`; không đụng DB nên
không cần `mcp__postgres` ở vòng này (khác vòng 1, vòng 1 đã dùng cả hai cho phần Task 7b/logger).

Tôi CHỈ sửa 1 file trong vòng 2 này: `src/server/backup-scripts-lock.test.ts` (thêm 2 ca test mới,
mục 3 dưới đây). Không đụng bất kỳ file code sản phẩm nào.

## 1. Xác nhận độc lập test cũ đã XANH

Chạy riêng đúng ca test đã rớt ở vòng 1:

```
npx vitest run src/server/backup-scripts-lock.test.ts
```

Kết quả: **1/1 pass** (trước khi thêm 2 ca mới ở mục 3). Log ra đúng 1 dòng
`{"event":"backup.failed","reason":"lock_busy"}` (tiến trình B thua khoá), và khoá `.lock` vẫn còn
tồn tại ngay sau khi B thoát trong lúc A vẫn đang chạy - đúng hành vi kỳ vọng, khác hẳn vòng 1 (lúc đó
`existsSync(lockDir)` trả về `false` sau khi B thoát, gây rớt).

## 2. Đọc lại diff bản vá - đúng như debugger mô tả, không có tác dụng phụ

`git show 33eeaf9 -- scripts/backup/pg-backup.sh`:

```diff
 cleanup() {
   rm -f "$PARTIAL"
   rmdir "$LOCK_DIR" 2>/dev/null || true
 }
-trap cleanup EXIT

 if ! mkdir "$LOCK_DIR" 2>/dev/null; then
   log_err backup.failed ',"reason":"lock_busy"'
   exit 3
 fi
+# Chi dang ky trap SAU KHI da gianh duoc khoa: tien trinh thua khoa (exit 3 o tren)
+# khong duoc dang ky trap nao, nen khong bao gio tu xoa khoa cua tien trinh dang giu.
+trap cleanup EXIT

 log backup.start ",\"file\":\"$NAME\""
```

Xác nhận: **đúng 1 dòng bị di chuyển** (`trap cleanup EXIT` dời từ trước khối `mkdir` xuống sau khối
đó, chỉ khi `mkdir` thành công mới chạy tới dòng `trap`), thêm 2 dòng comment giải thích, hàm
`cleanup()` giữ nguyên 100% không đổi. Không có thay đổi nào khác trong file (không đổi tên biến,
không đổi luật `BACKUP_KEEP_DAYS`, không đổi log, không đổi `pg_dump`/`pg_restore`/`mv`/`sha256sum`).
Đây là bản vá tối thiểu, đúng gốc rễ (chỉ tiến trình thực sự giành được khoá mới có cơ hội đăng ký dọn
dẹp cho chính khoá đó) - không phải patch né triệu chứng.

Đã đọc lại `scripts/backup/pg-restore-test.sh` (không bị sửa trong bản vá này) để chắc không còn chỗ
nào khác cùng lỗi: `trap cleanup EXIT` ở dòng 66, đứng SAU tất cả các gate thoát sớm (kiểm file backup
tồn tại - exit 2, kiểm sha256 - exit 4, kiểm tên DB tạm hợp lệ - exit 5) và TRƯỚC `createdb`. Đồng ý
với debugger: không cần sửa gì ở file này.

## 3. Ca biên bắt buộc theo yêu cầu vòng 2: dọn dẹp bình thường (không tranh chấp) có bị phá không

Trước khi vá, `backup-scripts-lock.test.ts` (vòng 1) CHỈ có 1 ca kiểm tiến trình THUA khoá. Không có ca
nào kiểm tiến trình THẬT SỰ GIỮ khoá (trường hợp bình thường, không tranh chấp) vẫn dọn sạch `.lock` +
`.partial` đúng cách - đây chính là rủi ro "vá race condition có thể vô tình đổi hành vi dọn dẹp bình
thường" mà nhiệm vụ vòng 2 yêu cầu soi. Tôi đã thêm 2 ca mới vào describe block mới trong cùng file
(dùng binary `pg_dump`/`pg_restore` giả có thể cấu hình mã thoát qua biến môi trường
`FAKE_PG_DUMP_EXIT`/`FAKE_PG_RESTORE_EXIT`, không cần Docker/Postgres thật):

- **"thanh cong: khoa `.lock` va file `.partial` khong con, chi con lai `.dump` + `.sha256`"**: chạy
  script với `pg_dump`/`pg_restore` giả đều thoát 0. Kiểm sau khi script thoát 0: `BACKUP_DIR/.lock`
  không còn tồn tại, không còn file nào đuôi `.partial`, có đúng 1 file `demo_test_*.dump` và 1 file
  `*.dump.sha256`.
- **"loi giua chung (pg_restore --list that bai): van xoa .lock va .partial, KHONG tao ra file .dump
  cuoi"**: mô phỏng nhánh `corrupt_dump` (`pg_restore` giả thoát 1) - script phải thoát mã 1, và sau
  đó `.lock` không còn, không còn file `.partial`, và KHÔNG có file `.dump` cuối nào được tạo ra (vì
  `mv` chưa từng chạy).

Cả 2 ca đều **XANH** ngay lần chạy đầu (không cần sửa code sản phẩm) - xác nhận bản vá của debugger
CHỈ ảnh hưởng đúng nhánh "tiến trình thua khoá" như mô tả, không đụng tới luồng dọn dẹp bình thường của
tiến trình đang giữ khoá (thành công lẫn lỗi giữa chừng vẫn dọn đúng `.lock`/`.partial`).

Ghi chú phương pháp: tôi không sửa tạm `scripts/backup/pg-backup.sh` để kiểm "đỏ trước khi vá" cho 2 ca
mới này, vì đó là sửa file code sản phẩm (dù có revert sau) - ngoài phạm vi cho phép của tester. Việc
đọc kỹ diff ở mục 2 cùng với suy luận: cả bản cũ (lỗi) và bản mới (đã vá) đều đăng ký `trap` cho tiến
trình duy nhất/đang thắng theo cùng một cách (chỉ khác thời điểm đăng ký, không khác việc CÓ đăng ký
hay không khi mkdir thành công) - nên về logic, 2 ca mới này đúng là bổ sung độ phủ cho luồng bình
thường, độc lập với chính lỗi race condition đã sửa (lỗi đó chỉ lộ ra khi có tiến trình THUA khoá).

## 4. Chạy lại 3 cổng kiểm tổng - khớp đúng mốc debugger báo

| Cổng kiểm | Debugger báo | Tester vòng 2 tự chạy lại (độc lập) |
|---|---|---|
| `npx tsc --noEmit` | sạch | **sạch** (không có output lỗi) |
| `npm test` (trước khi tester vòng 2 thêm 2 ca) | 255 file (1 skip)/2903 xanh + 15 skip | **khớp đúng 100%**: 255 file passed, 1 skipped (256) / 2903 tests passed, 15 skipped (2918) |
| `npm test` (sau khi tester vòng 2 thêm 2 ca ở mục 3) | - | 255 file passed, 1 skipped (256) / **2905 tests passed**, 15 skipped (2920) - tăng đúng 2 test mới, không giảm/mất test nào |
| `npm run build` (CA công ty `NODE_EXTRA_CA_CERTS`) | qua | **qua**, exit 0, danh sách route đầy đủ kể cả `/api/health/db`, không lỗi |

## 5. Xác nhận phạm vi sửa đổi từ vòng 1 tới giờ

`git diff --stat 1414d77 HEAD` (mốc ngay sau khi coder hoàn tất Task 0-7, trước khi tester vòng 1 chạy):

```
 scripts/backup/pg-backup.sh            |  4 +-
 src/lib/logger-bien.test.ts            | 62 ++++++++++++++++++++++
 src/server/backup-scripts-lock.test.ts | 95 ++++++++++++++++++++++++++++++++++
 3 files changed, 160 insertions(+), 1 deletion(-)
```

Đúng như mong đợi: chỉ có `scripts/backup/pg-backup.sh` (bản vá) + 2 file test do chính tester vòng 1
viết (được debugger gộp vào cùng commit vá theo đúng lời dặn "giữ lại 2 file test"). Xác nhận thêm:
`git diff --stat -- package.json package-lock.json` giữa 2 mốc này ra RỖNG - hai file này KHÔNG đổi.
Các phần khác của vòng 1 (logger chống vòng tham chiếu, route health/db, create-admin đăng nhập thật,
DEPLOY.md, docker-compose) không bị đụng lại, đúng như debugger chỉ sửa đúng phạm vi bug được giao -
không cần lặp lại các phần đó.

## 6. Kết luận vòng 2

- Bug race condition khoá `pg-backup.sh` (rủi ro số 1 của vòng 1) **đã được vá đúng gốc rễ, đã kiểm
  chứng độc lập là XANH**, không có tác dụng phụ lên luồng dọn dẹp bình thường (đã bổ sung test phủ
  rõ ca này).
- 3 cổng kiểm tổng (`tsc`, `npm test`, `npm run build`) đều sạch/xanh, khớp đúng số debugger báo cáo.
- Phạm vi sửa đổi đúng như cam kết: chỉ 1 dòng code sản phẩm di chuyển trong `pg-backup.sh`, không đụng
  gì khác ngoài phạm vi bug.
- Các rủi ro CÒN TỒN ĐỌNG từ vòng 1 (chưa chạy Docker thật cho Task 4-5, câu lỗi thời ở
  `docs/csp-header-bao-mat.md` mục 5, cần chạy lại Task 5 Bước 3-4 với `pg_dump` thật khi có máy có
  Docker) **vẫn còn nguyên, KHÔNG thuộc phạm vi vòng vá này** - để điều phối viên/chủ dự án quyết định
  có chặn merge vì lý do đó hay không; riêng lỗi race condition (lý do khiến vòng 1 ĐỎ) coi như ĐÃ
  ĐÓNG.
- File test mới thêm ở vòng 2 (2 ca trong `src/server/backup-scripts-lock.test.ts`) nên được giữ lại
  cùng lý do như 2 file test vòng 1: không phụ thuộc Docker/Postgres thật, phủ đúng ca biên vòng 2 yêu
  cầu.

---

# VÒNG 3 - xác nhận vá 4 mục BẮT BUỘC (B-1..B-4) theo `.bangiao/danh-gia.md`

Skill đã dùng: `test-driven-development`, `verification-before-completion`.
Không đụng UI ở vòng vá này (route API + 2 script `.sh` + tài liệu) nên không cần `mcp__playwright`.
Không có DB thật nào bị đụng ở vòng này: B-2/B-3 chỉ chạy `sh` với binary `pg_dump`/`pg_restore`/
`psql`/`createdb`/`dropdb` GIẢ (fake, không kết nối Postgres thật) nên không cần `mcp__postgres` kiểm
trạng thái dữ liệu sau test - không có dữ liệu thật nào bị chạm tới ở vòng này.

Tôi KHÔNG sửa file code sản phẩm nào ở vòng này, chỉ đọc code, chạy test có sẵn, và tự chạy thêm 1
thăm dò độc lập (Node script tạm ngoài repo) để kiểm chứng lý do skip ca SIGTERM.

## 1. B-1: đảo thứ tự rate limit `/api/health/db` - ĐÃ XÁC NHẬN ĐÚNG

- Đọc `app/api/health/db/route.ts`: dòng 15-17 kiểm bucket per-IP (`health-db:${ip}`, 60/phút)
  TRƯỚC, chỉ khi qua mới chạy tiếp dòng 18-19 kiểm bucket toàn cục (`health-db:global`, 300/phút).
  Đúng thứ tự đã đảo, khớp mô tả coder.
- Tự chạy `npx vitest run src/server/health-db-route.test.ts`: 4/4 pass, gồm đúng ca mới "IP A gửi
  400 lần (bị 429 từ lần 61) không được tính vào bộ đếm toàn cục, IP B vẫn nhận 200 (B-1)". Đọc kỹ ca
  test: mô phỏng đúng kịch bản khai thác của TB-1 (1 IP làm tràn bucket toàn cục), không phải test
  hời hợt.
- Đọc `docs/DEPLOY.md` mục 6 (dòng 212-224): có khối Nginx `location = /api/health/db { allow <IP
  giám sát IT>; allow 127.0.0.1; deny all; proxy_pass ...; }` đúng yêu cầu, kèm ghi chú healthcheck
  nội bộ container gọi thẳng `127.0.0.1:3000` không đi qua Nginx nên không bị chặn.

Kết luận B-1: ĐẠT.

## 2. B-2: `pg-restore-test.sh` chặn SQL injection qua tên bảng - ĐÃ XÁC NHẬN ĐÚNG, có 1 điểm cần chủ dự án/reviewer xác nhận lại (đánh đổi tính năng)

Đọc toàn bộ 119 dòng `scripts/backup/pg-restore-test.sh` (không chỉ đoạn coder nói đã sửa):

- (a) Kiểm định dạng tên bảng: dòng 105-107, `case "$t" in *[!A-Za-z0-9_]*|[0-9]*) fail
  "bad_table_name" ;; esac` - tương đương đúng biểu thức `^[A-Za-z_][A-Za-z0-9_]*$` (chặn mọi ký tự
  ngoài chữ/số/gạch dưới, và chặn tên bắt đầu bằng số). Đứng TRƯỚC dòng ghép `$t` vào SQL (dòng 108).
  Đúng vị trí, đúng logic.
- (b) Bỏ hẳn truy vấn PGDATABASE + cột "so_dong_nguon": rà toàn văn `PGDATABASE` trong file chỉ còn
  6 chỗ, TẤT CẢ đều là kiểm biến môi trường bắt buộc (dòng 12), lấy tên file mặc định (dòng 31), tạo
  tên DB tạm (dòng 48), so sánh chuỗi để chặn trùng tên (dòng 56), và 2 dòng comment giải thích
  (103-104). Không còn bất kỳ lệnh `psql`/`pg_restore`/`createdb`/`dropdb` nào nhắm `-d "$PGDATABASE"`
  hay chạy SQL trên DB nguồn - đã tự rà toàn văn, xác nhận không sót chỗ nào khác. Đóng lỗ hổng TB-2
  đúng theo nghĩa đen "không bao giờ đụng vào DB thật, kể cả đọc".
  - Đánh giá đánh đổi tính năng (theo yêu cầu nhiệm vụ, ghi nhận xét rõ): kế hoạch gốc (`ke-hoach.md`
    dòng 576) mô tả cột "so_dong_nguon" là "chỉ để người xem, không dùng làm điều kiện đỏ" (không
    phải điều kiện pass/fail, không có test nào của kế hoạch gốc dựa vào). Vì vậy việc bỏ hẳn cột này
    chỉ mất đi 1 tiện ích hiển thị tham khảo cho người vận hành khi đối chiếu số dòng thủ công, KHÔNG
    làm mất bất kỳ điều kiện kiểm tra nào đã có (migration, số bảng khớp, tổng số dòng > 0 vẫn giữ
    nguyên vẹn ở các dòng 75-116). Tôi cho rằng đánh đổi này chấp nhận được và là lựa chọn AN TOÀN
    HƠN so với phương án chỉ thêm cờ chỉ-đọc (`PGOPTIONS=-c default_transaction_read_only=on`) mà
    đánh giá gốc đưa ra như 1 trong 2 lựa chọn - vì loại bỏ hẳn khả năng kết nối tới DB thật thay vì
    chỉ giảm nhẹ rủi ro. Đề nghị chủ dự án/reviewer xác nhận lại 1 lần cuối trước merge, vì đây là
    thay đổi hành vi so với đặc tả gốc (dù đặc tả gốc đã tự nói tính năng này không quan trọng).
- (c) Giới hạn độ dài + PID: dòng 48 `RESTORE_DB="${PGDATABASE}_restore_test_$(date -u
  +%Y%m%d%H%M%S)_$$"` có `_$$` (PID); dòng 60 `[ ${#RESTORE_DB} -le 63 ] || exit 5`. Đúng cả 2 ý của
  T-1.
- (d) `trap cleanup EXIT` đúng vị trí: dòng 68 `createdb "$RESTORE_DB"`, dòng 71 `trap cleanup EXIT`
  - đúng NGAY SAU khi `createdb` thành công, không đăng ký trap nếu `createdb` lỗi (ví dụ trùng tên
  với 1 lần chạy khác) - khớp đúng yêu cầu T-1.

Tự chạy `npx vitest run src/server/backup-restore-test-script.test.ts`: 2/2 pass. Đọc kỹ 2 ca:
- Ca 1 dùng `psql` giả đọc biến `FAKE_TABLE_NAMES` trả về đúng chuỗi độc hại `x"; DROP TABLE
  "user_roles"; --` (mô phỏng file dump bị chỉnh sửa chứa tên bảng độc hại thật), script phải thoát 1
  với `reason:bad_table_name`, và file nhật ký `PSQL_LOG` (ghi lại MỌI lệnh psql thật sự chạy) không
  được chứa `DROP TABLE` hay chuỗi độc hại - tức là chứng minh được lệnh nguy hiểm CHƯA BAO GIỜ được
  thực thi, không chỉ kiểm mã thoát. Đây là test tấn công thật, không hời hợt.
- Ca 2 (đường thành công, tên bảng hợp lệ `orders`) chạy hết, in đúng `restore_test.ok` - xác nhận
  bản vá không phá luồng bình thường.

Kết luận B-2: ĐẠT (đóng đúng lỗ hổng SQL injection TB-2 và T-1), kèm 1 ghi chú đánh đổi tính năng nêu
trên cần xác nhận cuối.

## 3. B-3: khoá `.lock` tự dọn khi có tín hiệu / khoá cũ - ĐÃ XÁC NHẬN ĐÚNG, ca SIGTERM tự skip là chính đáng

- Đọc `scripts/backup/pg-backup.sh`: dòng 69 `trap 'exit 130' INT TERM HUP` đăng ký cùng lúc với
  `trap cleanup EXIT` (dòng 66), SAU khi giành được khoá. Cú pháp POSIX đúng chuẩn - gọi `exit` bên
  trong handler tín hiệu sẽ kích hoạt lại trap EXIT để chạy `cleanup()` (hành vi chuẩn của `sh`/POSIX).
- Cơ chế dọn khoá cũ: dòng 46-58, `STALE_LOCK_MIN=360` (6 giờ), dùng `find "$LOCK_DIR" -maxdepth 0
  -mmin "+$STALE_LOCK_MIN"` để phát hiện khoá cũ hơn ngưỡng, log `backup.stale_lock_removed` rồi
  `rmdir`, sau đó tiếp tục giành khoá bình thường (không exit).
- Tự chạy `npx vitest run src/server/backup-scripts-lock.test.ts`: 5 pass, 1 skip. Đọc kỹ:
  - Ca "khoá cũ hơn ngưỡng (7h) tự dọn, log `stale_lock_removed`" - xanh.
  - Ca "khoá mới (trong ngưỡng) vẫn thoát 3 như cũ" - xanh, xác nhận không phá hành vi cũ.
  - Ca race condition gốc (vòng 1) và 2 ca dọn dẹp bình thường (vòng 2) - vẫn xanh, không bị ảnh
    hưởng bởi thay đổi B-3.
  - Ca SIGTERM: `it.skipIf(!signalDeliveryWorks)`.
- Tự xác minh độc lập lý do skip (không chỉ tin lời coder): viết 1 script Node tạm (ngoài repo, trong
  thư mục scratchpad, không phải file test) lặp lại đúng thí nghiệm `probeSignalDelivery()` của coder
  - `spawn('sh', [script])` với script có `trap 'echo x > marker; exit 0' TERM`, rồi
  `child.kill('SIGTERM')`. Kết quả tự chạy: `child` báo thoát với `sig: SIGTERM` (Node/Windows chấm
  dứt tiến trình `sh` con trực tiếp) nhưng file `marker` KHÔNG được tạo ra - tức là trap TERM bên
  trong `sh` không hề được thực thi. Xác nhận độc lập: đúng là môi trường Windows/Git-Bash (MSYS)
  hiện tại không chuyển được tín hiệu SIGTERM tới tiến trình `sh` con theo cách để trap chạy được -
  đây là giới hạn hệ điều hành thật, không phải coder né việc.
- Đọc lại cú pháp `.sh` bằng mắt (không chạy được tín hiệu thật): `trap 'exit 130' INT TERM HUP` là
  cú pháp POSIX chuẩn, hoàn toàn hợp lệ trên `dash`/`busybox sh` (môi trường thật sẽ dùng ở container
  `postgres:16-alpine`). Logic không có lỗi rõ ràng khi đọc tĩnh.
- Ghi nhận rõ theo yêu cầu nhiệm vụ: ca SIGTERM CHƯA được kiểm bằng tín hiệu thật trên máy này (do
  giới hạn hệ điều hành Windows/Git-Bash đã tự xác minh ở trên), CẦN xác nhận lại trên Linux/Docker
  thật (container `postgres:16-alpine` hoặc CI Linux) trước khi go-live, đúng như Điều kiện đi kèm đã
  có trong `danh-gia.md` về việc chạy thật Task 4-5 bằng Docker.
- Đọc `docs/DEPLOY.md` mục 11 (dòng 300-324): có đoạn giải thích cơ chế stale lock (6 giờ), cách nhận
  biết `lock_busy` lặp lại bất thường, lệnh gỡ khoá tay `--entrypoint sh backup -c 'rmdir
  /backups/.lock'`.

Kết luận B-3: ĐẠT (với điều kiện đi kèm: xác nhận lại bằng tín hiệu thật trên Linux/Docker trước
go-live, đã có sẵn trong "Điều kiện đi kèm" của `danh-gia.md`).

## 4. B-4: sửa cổng và thư mục khôi phục trong `docs/DEPLOY.md` - ĐÃ XÁC NHẬN ĐÚNG

- Tự rà toàn văn `docs/DEPLOY.md` bằng grep: literal `127.0.0.1:3000` chỉ còn ĐÚNG 1 chỗ (dòng 235,
  ghi chú healthcheck nội bộ container, có giải thích rõ đây là cổng CỐ ĐỊNH bên trong container
  không đi qua Nginx) - đúng như coder mô tả, đã tự phát hiện thêm 1 chỗ ngoài danh sách đánh giá
  liệt kê (dòng 105/bảng biến mục 4). Mọi lệnh Nginx/`curl` chạy trên host còn lại đều dùng
  `127.0.0.1:<APP_PORT>` (đếm được 9 chỗ, đủ ≥7 theo test).
  - Riêng dòng 437 (`curl http://127.0.0.1:3005/api/health/db`) nằm trong Phụ lục A (dev Windows,
    KHÔNG áp dụng cho production, đã ghi rõ ngay đầu phụ lục) - dùng số cụ thể `3005` đúng bằng
    default thật của `.env.docker.example`, không mâu thuẫn với quy ước `<APP_PORT>` áp dụng cho
    phần production. Không phải lỗi.
- Quy trình khôi phục (dòng 342-349): `sha256sum -c` (dòng 345) đứng TRƯỚC `dropdb --force` (dòng
  346) - đúng yêu cầu. Dùng `docker compose run --rm --entrypoint pg_restore backup ...` (dòng 348),
  không còn mount cứng `-v "$(pwd)/.backups`.
- Tự chạy `npx vitest run src/server/deploy-files.test.ts`: 16/16 pass (13 ca cũ + 3 ca mới describe
  `docs/DEPLOY.md (B-4)`). Đọc kỹ 3 ca mới:
  - Ca 1 đếm chính xác số lần xuất hiện `127.0.0.1:3000` (phải = 1) và `127.0.0.1:<APP_PORT>` (phải
    ≥ 7) - kiểm được đúng sự nhất quán cổng bằng đếm số, không phải chỉ kiểm tồn tại 1 chuỗi bất kỳ -
    không hời hợt.
  - Ca 2 kiểm vị trí `sha256sum -c` đứng trước `dropdb --force -U ddc ddc_control_tower` bằng so
    sánh `indexOf`, đúng thứ tự thao tác thật trong văn bản, không chỉ kiểm tồn tại cả 2 chuỗi.
  - Ca 3 kiểm không còn chuỗi mount cứng `-v "$(pwd)/.backups` VÀ có đúng lệnh `--entrypoint
    pg_restore backup`.

Kết luận B-4: ĐẠT.

## 5. Cổng kiểm tổng - tự chạy lại độc lập, khớp đúng số coder báo

| Cổng kiểm | Coder báo | Tester vòng 3 tự chạy lại (độc lập) |
|---|---|---|
| `npx tsc --noEmit` | sạch | sạch (không có output lỗi) |
| `npm test` | 257 file (1 skip)/2913 xanh + 16 skip | khớp đúng 100%: 256 passed + 1 skipped (257
  file) / 2913 passed + 16 skipped (2929) |
| `npm run build` | qua (CA công ty qua `NEXT_FONT_GOOGLE_MOCKED_RESPONSES`) | qua, exit 0, có đủ
  route `/api/health/db`, không lỗi |

Đã tự xác nhận +1 skip so với mốc 15 skip cũ (vòng 2) đúng là ca SIGTERM MỚI của B-3 (mục 3 ở trên đã
xác minh độc lập lý do skip chính đáng), KHÔNG phải 1 ca cũ nào bị skip oan - đối chiếu bằng cách đọc
toàn bộ nội dung `src/server/backup-scripts-lock.test.ts`, chỉ có đúng 1 `it.skipIf` mới thêm ở vòng
này, các `describe.skipIf(!shAvailable)` khác là cơ chế bỏ qua có sẵn từ vòng 1 (không đổi).

## 6. Xác nhận phạm vi sửa đổi - N-1..N-10 KHÔNG bị đụng

`git diff --stat 50aac58 984ff39` (từ commit đánh giá reviewer "CẦN SỬA" tới commit vá B-1..B-4) chỉ
đụng: `app/api/health/db/route.ts`, `docs/DEPLOY.md`, `scripts/backup/pg-backup.sh`,
`scripts/backup/pg-restore-test.sh`, `src/server/backup-restore-test-script.test.ts` (file mới),
`src/server/backup-scripts-lock.test.ts`, `src/server/deploy-files.test.ts`,
`src/server/health-db-route.test.ts`, và `.bangiao/thay-doi.md`.

Đúng khớp: chỉ đụng các file liên quan trực tiếp B-1 (route + test), B-2 (script restore + test
mới), B-3 (script backup + test), B-4 (DEPLOY.md + test). KHÔNG đụng `src/lib/logger.ts`,
`.dockerignore`, `Dockerfile`, `docker-compose.yml`, `docs/csp-header-bao-mat.md` hay bất kỳ file
nào khác liên quan N-1..N-10 - xác nhận coder chỉ sửa đúng phạm vi được giao, để lại sổ nợ hardening
như đánh giá yêu cầu.

## 7. Kết luận vòng 3

- Cả 4 mục BẮT BUỘC B-1, B-2, B-3, B-4 đều đã được vá đúng gốc rễ và xác nhận độc lập bằng cách tự
  đọc code, tự chạy test, và tự thăm dò thêm (script Node tạm kiểm SIGTERM) - không chỉ tin lời coder.
- 3 cổng kiểm tổng (`tsc`, `npm test`, `npm run build`) đều sạch/xanh, khớp đúng số coder báo cáo.
- Phạm vi sửa đổi đúng như cam kết, không đụng N-1..N-10.
- 1 điểm cần chủ dự án/reviewer xác nhận lần cuối (không chặn merge theo đánh giá của tester, nhưng
  là thay đổi hành vi so với đặc tả gốc): B-2 đã bỏ HẲN cột "so_dong_nguon" (chỉ để xem, kế hoạch
  gốc đã ghi rõ không dùng làm điều kiện đỏ) thay vì chỉ thêm cờ chỉ-đọc - tester đánh giá đây là
  lựa chọn an toàn hơn và chấp nhận được.
- Điều kiện đi kèm vẫn còn nguyên (không thuộc phạm vi vòng vá B-1..B-4, đã ghi trong `danh-gia.md`):
  toàn bộ Dockerfile/compose/2 script backup vẫn CHƯA từng chạy thật với Docker/`pg_dump` thật; riêng
  ca SIGTERM của B-3 cũng cần xác nhận lại bằng tín hiệu thật trên Linux/Docker trước khi chính thức
  go-live.
