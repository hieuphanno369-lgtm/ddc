PHAN QUYET BAO MAT: LO HONG

# Danh gia bao mat P3E Task 5-8 (nhanh feature/p3e-c-task5-8, commit 453a2cd)

Ket luan: CAN SUA - 1 muc Trung, 3 muc Thap, 3 thong tin. Khong co lo hong muc Cao.
Skill da dung: ddc-tower:security-review. Soi code tinh tren git diff main...HEAD, doc DB ddc_control_tower_c qua mcp__postgres (read-only). Khong pentest dong.
Ghi chu: security-reviewer chi co quyen doc, file nay do phien dieu phoi (C) ghi lai nguyen van tu bao cao cua no.

## S-1 (Trung) - Dat lai mat khau khong gioi han tan suat, bcrypt chay truoc khi kiem token: tu choi dich vu CPU khong can dang nhap
- File: src/server/password-reset.ts:175-179, src/server/actions-password-reset.ts:37-39.
- resetPasswordWithToken goi hashPassword(input.newPassword) (bcryptjs hashSync cost 10, JS thuan, khoang 70-100 ms, CHAN event loop) ngay trong doi so cua consumeResetToken, tuc la TRUOC khi biet token co ton tai.
- Nhanh loc token chi kiem dang /^[A-Za-z0-9_-]{43}$/, chuoi rac nao du 43 ky tu cung qua.
- submitPasswordResetAction la server action cong khai, khong co reserveThrottle nao (khac voi dang nhap: login-guard.ts:69 dat cho IP TRUOC bcrypt).
- Tai hien: tren trang /vi/dat-lai-mat-khau, goi server action submitPasswordResetAction lap lai voi token = 'A' x 43, newPassword = confirm = '12345678'. Moi lan ton 1 bcrypt dong bo + 1 transaction DB. Khoang 10-15 request/giay la du lam 1 tien trinh Node ban 100% CPU.
- Cach va:
  1. Chi hash sau khi token hop le: goi store.peekResetToken(hash, now) truoc, false thi tra invalid_token ngay; peek ok moi hashPassword roi consumeResetToken (consume van giu dieu kien nguyen tu).
  2. Them reserveThrottle('reset_submit_ip', ipKey, ...) o dau resetPasswordWithToken (vd 20/15 phut), giong login-guard.
  3. (Nen) doi sang hash bat dong bo (bcryptjs.hash) de khong chan event loop.
- Test do can them: token dung dang nhung khong ton tai -> hashPassword KHONG duoc goi (spy); qua gioi han IP -> invalid_token, khong cham DB token.

## S-2 (Thap) - Tu doi mat khau khong vo hieu phien cu va khong vo hieu token dat lai con han
- File: src/server/actions.ts changePasswordAction (khong bump passwordChangedAt); src/server/repo/prisma-repo-auth.ts:91-97 setPassword khong xoa password_reset_token.
- Kich ban: nguoi dung nghi lo mat khau, tu doi trong Cai dat -> phien cua ke tan cong van song toi 8 gio. Link dat lai (30 phut) phat truoc do van dung duoc sau khi mat khau da doi (ca khi admin dat mat khau tam).
- Theo quyet dinh Q2 = b (chi admin/email moi bump). De xuat chu du an xem lai: tu doi cung bump passwordChangedAt (giu phien hien tai), setPassword/changePassword danh dau usedAt cho moi token con han cua email.

## S-3 (Thap) - Oracle do ton tai tai khoan qua thoi gian va qua cua so 24h
- File: src/server/login-guard.ts:74-80 va 82-87.
- Nhanh "tai khoan that dang khoa" chi chay bcrypt gia roi tra ngay; nhanh "email la" chay bcrypt gia + recordThrottle + countThrottle (2 luot DB). Chenh vai ms, do duoc khi lay trung binh, trai voi y do L1.
- failedLoginCount cua tai khoan that khong co cua so thoi gian, email la chi dem trong 24h (trung gioi han K6 da chap nhan).
- Cach va (tuy chon): nhanh locked cung chay 1 truy van cung chi phi de can thoi gian.

## S-4 (Thap) - Khoa tai khoan bi dung de tu choi dich vu co chu dich (ca admin)
- File: src/server/login-guard.ts:105-110, prisma-repo-auth.ts:46-72.
- Ai biet email deu khoa vinh vien duoc tai khoan co mat khau bang 5 lan sai. Chi admin hoac `npm run unlock-account` mo duoc. Dung thiet ke D3, chi ghi nhan. De xuat: canh bao admin khi tai khoan admin bi khoa, theo doi activity_log `login_locked`.

## Thong tin (khong can sua ngay)
- I-1: consumeResetToken (prisma-repo-auth.ts:153-162) dung updateMany co loc quan he `user`, nguyen tu nho 1 lenh UPDATE. (Phien dieu phoi: da co test real-db K4 "2 request dong thoi cung 1 token, chi 1 thang" trong src/server/repo/prisma-repo-auth-real-db.test.ts tu 453a2cd, xanh -> muc nay da dong.)
- I-2: token trong query string /dat-lai-mat-khau?token=... se vao access log cua reverse proxy. Nen them vao checklist deploy: loc query `token` khoi access log.
- I-3: unlockAccountAction (actions-account-lock.ts:29) goi email.trim() khi chua kiem kieu -> loi 500 neu khong phai chuoi (chi admin). Nen dung z.string() tren input tho; tempPassword nen co max length.

## Da kiem, DAT
- Token: randomBytes(32) base64url, DB chi luu SHA-256 (unique index), TTL 30 phut, dung 1 lan, cap moi thi xoa token cu. Dat lai xong vo hieu moi token cua email. GET chi peek.
- Enumeration o quen mat khau: moi nhanh tra `accepted`; phan doc tai khoan/sinh token/gui mail chay nen; email la khong vao log.
- Rate limit xin link: IP 10/gio dat cho truoc, email 3/gio, nguyen tu bang pg_advisory_xact_lock. Dang nhap: IP 20/15 phut dat cho truoc bcrypt.
- Dem sai/khoa: increment nguyen tu, lockedAt gan co dieu kien lockedAt IS NULL. Khoa khong lan sang tai khoan khac.
- Vo hieu phien: token.pwdAt luc dang nhap, kiem lai moi 5 phut, fail-closed voi token cu.
- Quyen admin: unlockAccountAction dung requireRoleUser(['admin']); admin page khong gui passwordHash. Lenh CLI khong qua HTTP.
- CSRF/redirect mo: chi server action, khong co callbackUrl dong.
- Email: link tu NEXTAUTH_URL, locale whitelist, khong header injection.
- Log: khong log token, mat khau, dia chi nhan.
- Migration: 2 bang moi co RLS, FK CASCADE, co rollback.
- Secret: khong co secret that trong diff.

---

PHAN QUYET BAO MAT VONG 2: LO HONG

## Vong 2 (security-reviewer, commit e6aeb96)

CAN SUA - 1 muc Cao (R2-1, moi phat sinh do vong sua), 1 muc Thap (R2-2).
S-1, S-3, I-3 da dong that. S-2 dong mot nua: phan server dung, phan giu phien qua `update()` mo ra R2-1.
Soi tinh `git diff a3977c6..e6aeb96`, doc next-auth 4.24.15 `core/routes/session.js`, `middleware.ts`, kiem cot `auth_throttle` (read-only). Khong pentest dong, R2-1 suy ra tu doc code.
Ghi chu: security-reviewer chi co quyen doc, phien dieu phoi (C) ghi lai tu bao cao cua no.

### R2-1 (Cao, MOI) - Phien da bi vo hieu tu goi `update()` de hoi sinh
- File: src/lib/auth.ts:182-190 (nhanh `trigger === 'update'` trong callback jwt); client o src/components/layout/ChangePasswordModal.tsx:56.
- Goc loi: nhanh update chi dua vao token.email trong cookie; goi applyAccountToToken (dat invalid=false neu isActive), ghi pwdAt = passwordChangedAt moi nhat, return som bo qua phep so changedAtMs > token.pwdAt.
- `POST /api/auth/session` (kem csrfToken tu `GET /api/auth/csrf`) mo cho moi ai giu cookie phien; next-auth khong phan biet phien vua doi mat khau voi phien bi danh cap.
- Du lieu `session` tu client KHONG duoc dung (role/email/canViewFinance doc lai tu DB), tai khoan isActive=false van bi chan.
- Khai thac 1: ke tan cong giu cookie; nan nhan doi mat khau (tu doi/admin dat tam/dat lai qua email); sau <=5 phut cookie bi danh invalid=true; ke tan cong goi csrf roi POST /api/auth/session {"csrfToken":"...","data":{}} -> invalid=false, pwdAt moi, phien song tiep va gia han 8 gio moi lan.
- Khai thac 2: goi update() dinh ky moi vai phut -> pwdAt luon moi nhat, phep so S8 khong bao gio ban.
- Hau qua: doi mat khau khong con da duoc phien cua ke chiem cookie; S8 va muc tieu S-2 mat tac dung.
- Cach va 1 (de xuat): bo logic lam moi trong nhanh update (tra token nguyen trang hoac chay dung logic kiem lai, khong bao gio ha invalid tu true ve false). changePasswordAction tu cap lai cookie phien phia server ngay sau setPassword (doc token hien tai, dat pwdAt = moc vua ghi, encode bang next-auth/jwt cung secret + maxAge, cookies().set). Chi request da qua kiem mat khau hien tai moi lam moi duoc pwdAt. Client bo update() va SessionProvider long.
- Cach va 2: proof HMAC(NEXTAUTH_SECRET, email|passwordChangedAtMs) tra ve tu action, update({ pwdProof }), nhanh update chi lam moi khi token.invalid !== true + proof khop (timingSafeEqual) + moc con moi (< 2 phut).
- Test do can them: token { email, pwdAt: 0, invalid: true } + trigger 'update' + DB passwordChangedAt moi -> invalid van true; token { email, pwdAt: 0, accessCheckedAt: now } + trigger 'update' khong proof -> invalid === true.

### R2-2 (Thap) - Khoa 'unknown' dung chung cho reset_submit_ip
- File: src/server/password-reset.ts:193-196, src/lib/client-ip.ts:58-61.
- Proxy khong gui x-forwarded-for/x-real-ip -> moi nguoi chung khoa 'unknown', 20 token rac khoa chuc nang dat lai mat khau cua ca he thong 15 phut. Cung loai R3 dang nhap da chap nhan.
- Dua vao checklist deploy: bat buoc cau hinh header IP + TRUSTED_PROXY_HOPS, theo doi canh bao warnUnknownIpOnce.

### Kiem tung muc vong 1
- S-1: DA DONG. reserveThrottle dau ham (password-reset.ts:195), peekResetToken (:202) truoc hashPassword (:205), bcryptjs.hash bat dong bo. Ghi chu: verifyPassword van dung compareSync, nen doi sang compare bat dong bo cho nhat quan.
- S-2: DONG MOT NUA. Server bump passwordChangedAt; setPassword huy token dat lai trong cung transaction (prisma-repo-auth.ts:91-103), mock giong het. Phan giu phien gay R2-1.
- S-3: DA DONG. Nhanh khoa chay bcrypt gia + 1 INSERT + 1 SELECT; 'login_locked_probe' khong lam phinh bang (bi chan boi login_fail_ip, pruneAuthData don sau 24h, cot kind la text).
- I-3: DA DONG (actions-account-lock.ts:35 typeof truoc trim, tempPassword .max(72)).
- S-4, I-2: chu du an chot chi ghi nhan.

### Diem moi khac, DAT
- getDummyHash cache Promise: khong co duong reject thuc te, khong mo DoS.
- SessionProvider long: khong lo du lieu; bo duoc neu va R2-1 theo cach 1.
- Callback jwt khong doc tham so `session` -> khong mass-assignment.
- Khong secret moi, khong SQL noi chuoi.
