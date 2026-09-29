KẾT QUẢ: ĐỎ

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
