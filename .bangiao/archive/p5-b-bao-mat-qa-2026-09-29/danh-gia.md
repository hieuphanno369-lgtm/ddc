PHAN QUYET: CHOT

# Đánh giá P5-B mục 6-7, lần 2 (diff `2171d61..HEAD`, HEAD `006c549`, nhánh `feature/p5-b-bao-mat-qa`)

Reviewer dùng skill `ddc-tower:code-review`.
Agent không có quyền ghi file nên điều phối viên chép lại nội dung báo cáo vào đây.
Đã đọc `danh-gia.md` lần 1, `ket-qua-test.md` (vòng kiểm `006c549`, XANH) và `danh-gia-bao-mat.md` (vòng 2, CHOT).
Đã rà toàn bộ diff `2171d61..HEAD` (30 file) và đọc từng dòng commit `006c549` (13 file).
Không tự chạy lại test, dùng số của tester vòng kiểm `006c549`.

## Xác nhận 6 mục bắt buộc vòng 1

1. M1, đúng. `app/api/csp-report/route.ts:27-32`: `rateLimit('csp-report:global', CSP_REPORT_GLOBAL_PER_MIN, 60_000)` chạy và trả 429 trước, sau đó mới tới `clientIpFrom` và khoá theo IP.
   Test `src/server/csp-report-route.test.ts:87-105` bọc `rateLimit` thật để ghi khoá, chạm trần rồi gửi 1000 IP giả: cả 1000 đều 429, không có khoá IP mới.
   Với thứ tự cũ, test này sẽ đỏ, nên đây là test hồi quy thật.
2. L1, đúng. `src/lib/security-headers.ts:83-85` có `h.delete('content-security-policy')` trước 2 lệnh `h.set`, kèm comment dặn cách làm khi chuyển sang enforce.
   Có test ở `src/lib/security-headers.test.ts:73-80` và `src/server/middleware-csp.test.ts:91-96`.
3. L2a, đúng. `src/lib/csp-report.ts:35` viết regex bằng mã escape, phủ C0, C1 (U+007F..U+009F), U+2028/2029, U+202A..202E, U+2066..2069.
   Test tạo ký tự bằng `String.fromCharCode`, không dán ký tự thật vào mã, và kiểm cả `script-sample` lẫn `blocked-uri`.
4. L2b, đúng. Trần toàn hệ thống là hằng `CSP_REPORT_GLOBAL_PER_MIN = 60`, cả 2 ca test giới hạn đều dùng hằng này.
5. QG-10, đúng. `docs/qa-gate-truoc-go-live.md:29` ghi rõ máy dev chỉ chứng minh app không tin phần tử ĐẦU của XFF, đổi phần tử CUỐI vẫn né được khi không có proxy.
   Hai nhãn `SẴN SÀNG (máy dev)` và `CHỜ HẠ TẦNG C` được giữ nguyên.
6. Mỗi câu một dòng, đúng. Đã tách các dòng được chỉ ra ở `docs/load-test.md` và `docs/csp-header-bao-mat.md`.
   Rà lại cả 3 file tài liệu: ngoài tiêu đề và ô bảng thì không còn dòng nào chứa 2 câu.
   Ô bảng QG-10 có 3 câu trên một dòng, nhưng Markdown không cho ngắt dòng trong ô bảng, nên chấp nhận.
   Toàn bộ diff không có dấu gạch dài.

## Xác nhận 4 mục khuyến nghị

7. L4, đủ 6 ý ở `docs/csp-header-bao-mat.md:55-64`: không cache HTML/RSC, HSTS `always`, bẫy thừa kế `add_header` kèm cách kiểm bằng `curl -I`, `client_max_body_size 32k` + `limit_req` cho `/api/csp-report`, bind `127.0.0.1`, gỡ `x-middleware-subrequest`.
   QG-18 đã thêm 2 phép kiểm: cổng 3000 bị từ chối từ máy ngoài, và 121 lần gọi `/api/health` phải có 429.
8. L3, có ở `docs/load-test.md:56-58`: `--xff=per-vu` chỉ có tác dụng khi không có proxy.
   Ở P6 phải chạy từ nhiều máy nguồn, hoặc nới giới hạn có chủ đích và ghi lại việc đã nới.
9. Timeout làm nóng, đúng. `scripts/perf/load-test.ts:134-141` dùng `AbortSignal.timeout(opts.timeoutMs)` trong `try/catch`, in ra `timeout` hoặc `network` rồi chạy tiếp.
10. I1, đúng. `src/lib/load-test.ts:191-203` dùng `realpathSync` (đường dẫn chưa tồn tại thì quay về `resolve`).
    Gốc repo lấy bằng `path.resolve(__dirname, '../..')`: `package.json` không khai `"type": "module"` và tsx chạy CJS, nên `__dirname` dùng được, giống `scripts/gen-erd-doc.ts`.
    Test đi qua junction trỏ vào repo vẫn ném lỗi.
    Test này thay cho ca "repoRoot là thư mục con" mà lần 1 gợi ý: đổi sang `__dirname` đã bỏ nguồn lỗi của ca đó, nên chấp nhận.

## Phát sinh trong `006c549`

Không có lỗi mới.
Có 3 điểm nhỏ, không chặn merge:

- [nit] `src/server/csp-report-route.test.ts:97-104`: ca M1 chỉ so `after === before`.
  Nếu `vi.doMock` không gắn được thì mảng khoá rỗng, 0 bằng 0, test vẫn xanh dù không kiểm gì.
  Nên thêm `expect(before).toBe(CSP_REPORT_GLOBAL_PER_MIN)` ngay sau dòng tính `before` để chứng minh mock có tác dụng.
  Hiện code route đúng qua đọc mã và ca "gioi han toan cuc" kiểm được hành vi, nên không chặn.
- [thông tin] Đánh đổi của M1: giờ mọi request đều tính vào trần chung, kể cả request lẽ ra bị chặn theo IP.
  Vì vậy một IP gửi 60 lần/phút là làm tắt nhận báo cáo CSP của cả hệ thống trong phút đó.
  Cái mất chỉ là dữ liệu đo từ xa ở chế độ report-only, không ảnh hưởng người dùng, và security-reviewer đã chấp nhận.
  Ở P6, `limit_req` riêng trên proxy (L4) sẽ chặn trước.
- [nit] R2 của bảo mật: tên ca test viết sai "da ccham" (`csp-report-route.test.ts:87`).

## Ba câu hỏi (toàn phase)

1. Code có khớp kế hoạch không: có, đủ 3 việc.
   - Load test gồm thư viện thống kê, tham số/kịch bản/cookie jar, script và tài liệu.
   - CSP Report-Only có nonce ở middleware, phủ cả nhánh redirect và nhánh intl, cùng endpoint `/api/csp-report` có giới hạn tần suất và kích thước.
   - qa-gate đủ 22 mục, có nhật ký lượt chạy thật.
   Lệch có chủ đích ở `DEFAULT_SCENARIOS` đã được chấp nhận ở lần 1 (e2e 28 chứng minh).
   Phase không đụng file nóng, `next.config.mjs`, `PROGRESS.md`, `.serena/`, không thêm dependency.
   `CLAUDE.md` chỉ thêm quy tắc `npm ci` (commit `558a98b`), đúng luật dự án.
2. Test có giá trị thật không: có.
   - Unit test kiểm hành vi biên thật: percentile, tiêu chí, cookie jar, đọc body có trần, lọc ký tự, thứ tự rate limit, header giả của client, symlink/junction.
   - e2e 26/27 chạy trên `next start`, đo header và vi phạm CSP trên trình duyệt thật.
   - e2e 28/29 tái hiện lỗi kịch bản và ảnh logo trước khi sửa.
   - Các test hồi quy của `006c549` đều đỏ được với mã cũ.
   Chỗ yếu duy nhất là ca M1 thiếu 1 assert chống xanh rỗng (xem trên).
3. Bảo mật, hiệu năng, tính đúng đắn:
   - Bảo mật: đồng ý `danh-gia-bao-mat.md` vòng 2 CHOT. M1, L1, L2 đã vá đúng gốc. 2 lớp chặn đăng nhập của P3D-B không yếu đi. Endpoint công khai có trần kích thước, loại nội dung, số mục, trần theo IP và trần chung, log đã lọc ký tự điều khiển/bidi và cắt URL.
   - Hiệu năng: 30 người dùng ảo ĐẠT, 50 và 100 KHÔNG ĐẠT trên máy dev (bão hoà 12-13 rps). Đây là kết quả đo, không phải lỗi mã, và đã ghi vào nhật ký qa-gate. QG-13 vẫn `CHỜ SERVER (P6)`.
   - Đúng đắn: không thấy lỗi logic mới.

## Kết luận

Phase P5-B mục 6-7 đã sẵn sàng để chủ dự án duyệt merge vào `main`.
Trước merge, chuyển `.bangiao/*` vào `.bangiao/archive/p5-b-bao-mat-qa-<yyyy-mm-dd>/` theo CLAUDE.md mục 4.

Lưu ý working tree: `package.json` đang có thay đổi CHƯA commit, thêm khối `"allowScripts"` (7 gói: `@parcel/watcher`, `@prisma/client`, `@prisma/engines`, `esbuild` x2, `@swc/core`, `prisma`).
Thay đổi này không nằm trong commit nào của phase và không thuộc phạm vi review.
Trước merge phải hỏi chủ dự án rồi xử lý tách bạch: hoặc bỏ, hoặc commit riêng có lý do.
Không để nó lọt vào commit archive hay commit merge.

## Việc còn treo, không chặn merge (ghi vào lo-trinh.md / phien-B.md)

- R1 (bảo mật): thêm vào cột Tiêu chí đạt của QG-17 (`docs/qa-gate-truoc-go-live.md:36`) ý "log stdout có xoay vòng (Docker `max-size`/`max-file` hoặc logrotate) và có trần dung lượng". Làm ở lượt merge hoặc P6.
- R2 (bảo mật): sửa chính tả "ccham" ở `src/server/csp-report-route.test.ts:87`.
- Nit test: thêm `expect(before).toBe(CSP_REPORT_GLOBAL_PER_MIN)` vào ca M1, `src/server/csp-report-route.test.ts` sau dòng tính `before`.
- `package.json` chưa commit (`allowScripts`): chờ chủ dự án quyết.
- Trước go-live, thuộc hạ tầng của C: QG-10, QG-12, QG-17, QG-18 (gồm đủ 6 ý bàn giao proxy L4).
- QG-07 (chuyển CSP sang enforce): chờ P4-X. Còn phải đo nút Google, form quên mật khẩu khi có SMTP, và xuất PDF/JPG.
- QG-13 (load test 100 người dùng ảo): đo lại trên server thật ở P6. Qua proxy phải chạy từ nhiều máy nguồn hoặc nới giới hạn có ghi lại. Chọn nhiều tiến trình hay nâng cấu hình server là quyết định của chủ dự án.
