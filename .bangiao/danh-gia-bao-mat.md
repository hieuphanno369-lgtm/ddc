BAO MAT: DAT

# P1A — Đánh giá bảo mật vòng 3 (sau vòng sửa 2)

> Security-reviewer không có công cụ ghi file; chặng điều phối (ship) ghi nguyên văn nội dung này. Bản vòng 2 nằm trong git ở commit `41c30cd`.

Nhánh `feature/p1a-du-lieu-dung`, HEAD `8cdbef6`; vòng sửa 2 = `d5c933c`, `cd02f41`, `fdbfbd6` (+ `8cdbef6` hồ sơ tester).
Skill: `ddc-tower:security-review`, `ddc-tower:security-audit` (guidance mode). Chỉ đọc source, `node_modules/next/dist` và git. Không chạy app, không truy vấn DB (vòng này không đụng dữ liệu).

**Phán quyết:** DAT trong phạm vi P1A. Vòng sửa 2 không đổi code sản phẩm, không mở lỗ mới. F1, F2a, F2b, F3 vẫn đóng; test F2a nay có giá trị thật (tester đột biến → đỏ).
**F10 vẫn là rủi ro lớn nhất nhưng KHÔNG chặn merge P1A** (lý do mục 3.3). Nên chặn go-live và việc mở server ra mạng khi còn Next 14.

## 1. Vòng sửa 2 có đổi code sản phẩm không — KHÔNG

- `git diff 8cdbef6~4..8cdbef6 -- ':!*.test.ts' ':!.bangiao'` → **rỗng**. Chỉ đổi 3 file test + `.bangiao/thay-doi.md`, `.bangiao/ket-qua-test.md`.
- `package.json` nhánh: `"dev": "next dev"`, `next 14.2.35`, `next-auth 4.24.7`, `next-intl 3.26.3` — giống vòng 2 (thử `-H 127.0.0.1` đã hoàn nguyên, không commit).
- Test mới: `nhap-lieu-page-guard.test.ts` chỉ thêm tham số `email` (`pm@daidung.com.vn` — tài khoản seed) và `vi.spyOn(mockRepo,'getFinancial')` + `mockRestore()`; `uploads.test.ts`, `photo-upload-route.test.ts`: magic byte giả JPEG/PNG/GIF/WebP/SVG/HTML/RIFF-WAVE. Không secret/token/mật khẩu/dữ liệu thật; không mock nào nới lỏng kiểm quyền sản phẩm.
- Đột biến của tester (bỏ `&& user.canViewFinance` → đỏ; hỏng magic JPEG → 400) xác nhận guard F2a và nhận diện ảnh F1 được khoá bằng test.
- Bằng chứng động CVE-2025-29927 payload đúng cho 14.x (`middleware` lặp 5 lần): `/vi/nhap-lieu`, `/vi/overview` → 307 `/vi/login`. F2b đóng cả tĩnh lẫn động.

## 2. Bảng trạng thái F1–F12

| # | Mức | Trạng thái v3 | Ghi chú |
|---|---|---|---|
| F1 | High | **ĐÃ ĐÓNG** | Có test bảng `detectImageKind` + test route JPEG thật; đột biến → đỏ |
| F2a | High | **ĐÃ ĐÓNG** | Test dùng data-entry có dự án thật, spy chứng minh không nạp `financial` |
| F2b | High | **ĐÃ ĐÓNG** | Bằng chứng động payload 5 lần → 307 |
| F3 | Medium | **ĐÃ ĐÓNG** (còn Low → P5B) | Không đổi |
| F4 | Medium | GHI NỢ → P2A | `xlsx` 0.18.5 |
| F5 | Low | GHI NỢ → P5B | |
| F6 | Low | GHI NỢ → P3A | |
| F7 | Low | GHI NỢ → P5B | |
| F8 | Low | Chờ chủ dự án | |
| F9 | Info | GHI NỢ → P5B | BOLA `/api/photos`, rate-limit upload |
| F10 | **Critical (có điều kiện)** | **MỞ, không chặn merge; chặn go-live** | Chưa giảm thiểu được bằng `-H 127.0.0.1`; phương án mục 3 |
| F11 | Low | GHI NỢ → task nâng nền tảng | next-auth 4.24.15 |
| F12 | Medium | GHI NỢ → task nâng nền tảng | next-intl ≥ 4.9.1 |

## 3. F10 — đánh giá lại khi `-H 127.0.0.1` không dùng được

### 3.1 Nguyên nhân lỗi 500 (đọc source Next 14.2.35, chưa chạy)
- `next/dist/server/lib/router-utils/resolve-routes.js:101`: router dựng `initUrl` từ `opts.hostname` → `http://127.0.0.1:3000`.
- Server render bên trong nhận `hostname: opts.hostname || "localhost"` (`render-server.js:90`), dựng URL request cho middleware từ `fetchHostname` (`next-server.js:1041`); log coder: URL rewrite next-intl mang host `localhost:3000`.
- `resolve-routes.js:407-416`: rewrite khác origin với `initUrl` → coi là URL ngoài → `proxyRequest` (`proxy-request.js:72`) gọi `http://localhost:3000`. Windows + Node ≥ 17: `localhost` thường ra `::1` trước, server chỉ nghe `127.0.0.1` → `socket hang up` → 500. Khớp log `thay-doi.md`.

### 3.2 Phương án giảm thiểu
| Phương án | Hiệu quả | Nhận định |
|---|---|---|
| A. `"dev": "next dev -H localhost"` (`package.json:6`) | Cao, nếu chạy được | **Nên thử trước.** Router và server trong cùng tên `localhost` → rewrite cùng origin, không proxy; `listen("localhost")` chỉ loopback. Giả thuyết, chưa chạy. Xong khi: netstat :3000 chỉ `[::1]:3000` hoặc `127.0.0.1:3000`; `curl http://localhost:3000/vi/login` → 200; đăng nhập admin, mở `/vi/overview`, `/vi/nhap-lieu`; launch `ddc-control-tower` (và `-B` cổng 3001) kết nối được. Không đổi `"start"`. Không được thì hoàn nguyên. |
| B. `-H ::1` | Trung bình | Phụ thuộc máy hơn A. Không khuyến nghị. |
| C. Kiểm Host header trong `middleware.ts` | **Không tác dụng** | Matcher `middleware.ts:57` bỏ `/api`, `/_next`, đường dẫn có dấu chấm; Host kẻ tấn công tự đặt; RCE ở lõi server, không sau middleware. |
| D. `allowedDevOrigins` | Không tác dụng | Chỉ chặn cross-site từ trình duyệt; không chặn curl. |
| E. Windows Firewall chặn inbound TCP 3000/3001 | Cao, chắc nhất | Chủ dự án tự làm. VD PowerShell (Admin): `New-NetFirewallRule -DisplayName "DDC dev block 3000-3001" -Direction Inbound -Protocol TCP -LocalPort 3000,3001 -Action Block`. Kiểm rule "Allow" cho `node.exe` còn sót: `Get-NetFirewallRule -Direction Inbound \| ? DisplayName -match node`. |
| F. Nâng `next` ≥ 15.5.24 (hoặc 16.x) | Triệt để | Task nâng nền tảng (gộp F11, F12). A/E chỉ che máy dev. |

### 3.3 Có nên đổi F10 thành CHẶN merge P1A không — KHÔNG
- `main` đang `next 14.2.15`: dính **cùng** F10 **cộng thêm** CVE-2025-29927 (Critical) mà nhánh này đã vá. Merge làm `main` an toàn hơn; chặn merge không giảm rủi ro nào.
- F10 có từ trước, không do P1A; mọi nhánh cắt từ `main` (kể cả B) đều dính.
- Điều kiện khai thác hiện tại: máy dev Windows chạy `next dev` nghe `0.0.0.0`/`[::]`, kẻ tấn công cùng mạng. Production chưa có (P6).
- **Nên CHẶN ở chỗ khác:** (1) không go-live P5/P6 khi còn Next < 15.5.24; (2) không host production trên Windows khi còn Next 14; (3) không mở cổng dev ra mạng không tin cậy trước khi có A hoặc E.

## 4. Việc trước merge
1. Không có gì bắt buộc cho P1A.
2. Khuyến nghị (không bắt buộc, sau merge, nhánh riêng nhỏ): thử phương án A `-H localhost` theo tiêu chí 3.2; được thì commit riêng + "Lưu ý cho B" trong `phien-A.md`.

## 5. Chủ dự án cần quyết
1. **Tường lửa Windows (E):** tự tạo rule chặn inbound 3000/3001 trên máy này (và máy B nếu khác máy).
2. **Cho phép thử `-H localhost` (A)** như task nhỏ sau merge P1A — có/không.
3. **Task nâng nền tảng F10/F11/F12** (`next` ≥ 15.5.24 + React 19 + `next-intl` ≥ 4.9.1 + `next-auth` 4.24.15): thời điểm, ai làm. Đề xuất ngay sau merge P1A, trước tách P2A/P2B; hạn chót cứng trước go-live P5/P6.
4. **Hệ điều hành VPS ở P6:** Windows → F10 áp thẳng production. Linux vẫn phải nâng Next trước go-live.
5. **F8:** import lộ mã SAP có tồn tại hay không (`src/server/actions.ts:474`) — treo từ vòng 1.
6. **Ghi chú vận hành:** coder từng chạy `taskkill /F /IM node.exe` ~12:04 ngày 2026-09-24, có thể đã tắt tiến trình node của B (dev 3001, MCP server) nếu đang chạy. Nên báo B kiểm lại.
