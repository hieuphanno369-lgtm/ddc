PHÁN QUYẾT BẢO MẬT: CẦN SỬA

# Đánh giá bảo mật P3B — thông báo webhook/email, N-3, Q6, e2e (`git diff d50db4c..HEAD`)

> Nội dung do subagent security-reviewer (vai chỉ đọc) trả về; điều phối viên lưu vào file này. Skill `ddc-tower:security-review`, rà tĩnh. MCP postgres (chỉ đọc) trỏ DB của A — seed giống nhau; chỉ luật `ar_overdue` có số tiền trong `message` (vd "Công nợ quá hạn 104.6 tỷ = 6.0% giá trị HĐ").

Tóm tắt: không có lỗ hổng mức cao khai thác được. SSRF webhook, mã hoá bí mật, phân quyền action notify, chống trùng, rate-limit làm tốt. **5 lỗi mức trung (T-1…T-5)** + 7 lỗi thấp (L-1…L-7).

## ĐẠT
- **SSRF webhook** (`notify-url.ts:41-76`, `webhook.ts:32-105`): WHATWG chuẩn hoá thập phân/hex/octal; IPv6 bỏ ngoặc; IPv4-mapped + NAT64 `64:ff9b::/96` tách IPv4 kiểm lại (`embeddedIPv4` 176-182); chặn `0.0.0.0/8`, `169.254/16`, `fc00::/7`, `fe80::/10`, `::`, `::1`; IP hỏng → chặn.
- **DNS rebinding webhook**: resolve 1 lần, kiểm mọi địa chỉ, kết nối thẳng `targetIp` (56-57, 75); `Host`/`servername` đúng (81, 87); `agent:false`; không theo redirect; mặc định chỉ https; whitelist `NOTIFY_WEBHOOK_ALLOW_HOSTS` không lách được.
- **Bí mật**: AES-256-GCM IV 12B tag 16B; thiếu/sai khoá fail-closed (`secret_key_missing`/`secret_decrypt_failed`); `secretEnc` không tới client (`hasSecret`); `notifyError`/`logActivity` chỉ mã lỗi; audit chỉ `secretHint`.
- **Phân quyền**: 6 action notify (`actions-notify.ts:28,101,122,136,149,163`) + `setUserCanViewFinanceAction` gọi `requireRoleUser(['admin'])`; zod; "Gửi thử" 5 lần/phút/admin; CSRF server action Next 14; audit mọi thao tác.
- **Q6**: admin luôn true; không có trong DB → chỉ admin theo `ROLE_SEED`; JWT bỏ qua `trigger:'update'`; cột NOT NULL.
- **Nội dung/chống trùng**: Q4 thay message có tiền bằng `ruleTriggered`; subject bỏ CR/LF, cắt 200; người nhận `bcc`, kiểm email; text-only; `claimAlertNotify` cập nhật có điều kiện.
- **N-3** đã chặn ở server: Tổng quan, Chi tiết, Cảnh báo, Báo cáo, `/api/export`, `/api/report/export`; không vào props client; tắt sắp xếp theo value.
- **e2e**: chốt DB B + cổng 3001; không mật khẩu cứng; `e2e/.auth`, `e2e/.report` trong gitignore.

## CẦN SỬA
### T-1 (Trung) Nhập liệu lộ số tiền khi tắt `canViewFinance` của data-entry (Q6 mở đường này)
- `app/[locale]/(app)/nhap-lieu/page.tsx:44-52`, `:97-101`: chỉ chặn `financial`; vẫn truyền `project.contractValue`, `fact` (`bac/pv/ev/ac/eac`), `alerts` chưa che (`ar_overdue` "… tỷ") vào `DataEntryForm`. Tắt quyền qua `UserEditor.tsx:130-145` → cảm giác an toàn giả.
- Vá: (a) che ở `nhap-lieu/page.tsx` (`maskAlertMessage`, null các trường tiền) hoặc (b) tạm ẩn nút bật/tắt với role data-entry tới khi P3A gate form.
### T-2 (Trung) Đổi vai trò ghi đè `canViewFinance`
- `src/server/actions.ts:281` `repo.setUserRole(email, role, role !== 'viewer')` → cờ bị bật lại âm thầm, không audit.
- Vá: giữ cờ hiện có khi đổi role (chỉ tự `false` khi hạ xuống viewer), audit khi cờ đổi; test "tắt quyền → đổi role → vẫn false".
### T-3 (Trung) SMTP không ghim IP → DNS rebinding lách chặn loopback/metadata
- `src/server/notify/email.ts:35-48` kiểm bằng `dns.lookup`, `:51-52` `createTransport({ host: cfg.host })` → nodemailer tự resolve lại (`resolve4/6`). Blind SSRF qua "Gửi thử".
- Vá: resolve 1 lần, kiểm mọi địa chỉ, truyền `host: addrs[0].address` + `tls: { minVersion: 'TLSv1.2', servername: cfg.host }` (+ `name` EHLO); test `createTransport` nhận IP.
### T-4 (Trung) `nodemailer@6.10.1` dính advisory cao (`<=9.1.0`)
- GHSA-mm7p-fcc7-pg87, GHSA-c7w3-x93f-qmm8, GHSA-vvjj-xcjg-gr5g, GHSA-268h-hp4c-crq3, GHSA-rcmh-qjqh-p98v, GHSA-2x7j-588g-ccc2, GHSA-p6gq-j5cr-w38f… Khả năng khai thác hiện thấp (không dùng envelope/name/raw/list/OAuth2; email qua `z.email()`).
- Vá: lên `nodemailer@^10` (hoặc > 9.1.0); peer `next-auth@4.24.7` (`^6.6.5`, tuỳ chọn) giải bằng `"overrides": { "next-auth": { "nodemailer": "$nodemailer" } }`, không `--force`.
### T-5 (Trung) Tắt quyền/đổi role có hiệu lực sau tối đa 8 giờ
- `src/lib/auth.ts:125` `maxAge: 8h`; `:140-146` `jwt` chỉ `resolveAccess` lúc đăng nhập → vẫn xem/xuất Excel số tiền tới 8 giờ.
- Vá: `jwt` đọc lại `resolveAccess(token.email)` mỗi ~5 phút (`token.accessCheckedAt`), token rỗng nếu `isActive=false`; hoặc `sessionVersion` (cần migration); tối thiểu ghi rõ trên UI.

## Thấp
- **L-1** `notify-url.ts:98-108, 121-129, 176-182`: chưa chặn `::/96` (IPv4-compatible `::7f00:1`), `64:ff9b:1::/48`, `2002::/16`, `fec0::/10`, `100::/64` → thêm vào blocklist/`embeddedIPv4` + test.
- **L-2** `webhook.ts:89-99`: `res.resume()` rút body vô hạn sau khi xoá timer; `dns.lookup` ngoài timeout → `res.destroy()` sau khi đọc status (hoặc `req.setTimeout` + giới hạn body), bọc lookup trong timeout.
- **L-3** `notify-message.ts:100-103`: Slack/Teams không escape markup (`<!channel>`, link lừa) → escape `& < >` (Slack), `[]()*_` (Teams).
- **L-4** `actions-user-finance.ts:14-21`: không kiểm boolean → 500 → `typeof !== 'boolean'` trả `Invalid input`/zod.
- **L-5** `e2e/global-setup.ts:15`: `includes('/ddc_control_tower_b')` khớp cả `_b2` → `new URL().pathname === '/ddc_control_tower_b'` + host `localhost:5433`; `reuseExistingServer` cân nhắc.
- **L-6** `actions-notify.ts:50` + `secret-box.ts:78-81`: hint 4 ký tự cuối URL webhook có thể lộ nửa token ngắn → hint `host/…`.
- **L-7** `secret-box.ts`: không xoay khoá → để sau (`v1:kid:` / `NOTIFY_SECRET_KEY_OLD`).

## Riêng N-1 (không tính phán quyết P3B)
`npm audit`: 17 lỗ hổng (3 critical, 7 high) gồm `next@14.2.35`, `next-intl` (GHSA-8f24-v5vv-gm5j open redirect) → xử lý ở nhánh nâng Next riêng. `@playwright/test@1.63.0` devDep, không advisory.

## Kết luận
Trước merge phải sửa **T-1** (hoặc chủ dự án chấp nhận rủi ro), **T-2**, **T-3**; **T-4**, **T-5** sửa hoặc ghi chấp nhận rủi ro; L-1…L-6 vá cùng lượt nếu tiện; L-7 để sau.
