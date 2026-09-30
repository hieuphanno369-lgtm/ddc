PHAN QUYET BAO MAT: CHOT (vong 7, commit 899a852; cac vong truoc giu nguyen ben duoi lam lich su)

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

---

PHAN QUYET BAO MAT VONG 3: LO HONG

## Vong 3 (security-reviewer, commit ece0d95)

CAN SUA - R2-1 da dong that; 2 muc Trung moi (R3-1 race tu nguon cu nhung nay dung duoc de giu phien, R3-2 co tu truoc), 2 muc Thap, R2-2 ghi nhan.
Soi tinh `git diff 5221e84..ece0d95`, doc next-auth 4.24.15 (jwt/index.js, core/lib/cookie.js, core/init.js, utils/detect-origin.js, next/index.js, core/routes/session.js), middleware.ts, src/lib/session.ts, prisma-repo-auth.ts. Khong pentest dong.
Ghi chu: security-reviewer chi co quyen doc, phien dieu phoi (C) ghi lai tu bao cao cua no.

### Kiem R2-1: DA DONG
- auth.ts:189-197 nhanh update khong goi applyAccountToToken, khong ghi pwdAt, chi dat invalid=true khi changedAtMs > pwdAt; khong co lenh dat invalid=false.
- Chi 2 cho ghi token.pwdAt: nhanh dang nhap (auth.ts:208) va reissueSessionCookie (auth.ts:274), goi duy nhat tai actions.ts:369 sau verifyPassword (:365) va setPassword (:368).
- GET /api/auth/session: applyAccountToToken ha invalid nhung phep so pwdAt ngay sau (auth.ts:222-223) dat lai true.
- Phien invalid goi changePasswordAction: session.user.email = null, getCurrentUser null, action tra Forbidden.
- Cookie moi: salt "" khop core, ten cookie va thuoc tinh khop defaultCookies, suy https giong getToken; lech thi fail-closed.
- getServerSession app router co setCookie rong, khong ghi de cookie vua cap.
- Loi nuot trong reissue deu fail-closed, log chi e.name.
- S-3 voi verifyPassword bat dong bo: 4 nhanh deu await 1 lan bcrypt; khong cho nao thieu await.

### R3-1 (Trung) - Race giua kiem mat khau va setPassword: ke giu mat khau + phien vo hieu hoa duoc admin dat mat khau tam va dat lai qua email
- File: src/server/actions.ts:364-369; src/lib/auth.ts:272-274; src/server/repo/prisma-repo-auth.ts:91-103 (mock-repo-auth.ts:105).
- changePasswordAction kiem currentPassword o T1, bam mat khau moi, setPassword vo dieu kien (updateMany where { email }) o T2; reissueSessionCookie doc LAI passwordChangedAt tu DB.
- Khai thac: ke tan cong biet mat khau + co phien chay vong lap doi mat khau P1->P2->...; khi admin unlockAccountAction(tempPassword) (actions-account-lock.ts:51) hoac nan nhan resetPasswordWithToken ghi vao giua T1..T2, setPassword cua ke tan cong ghi de, passwordChangedAt = moc cua ke tan cong, cookie cap lai pwdAt moi nhat, phien ke tan cong song tiep. Xac suat trung cua so cao (uoc >70%).
- Cach va: (1) compare-and-swap: setPasswordIfHash(email, oldHash, newHash, nowIso) updateMany where { email, passwordHash: oldHash }, count 0 thi tra 'current' va khong reissue; (2) kiem gia tri tra ve cua setPassword; (3) reissueSessionCookie(email, changedAtIso) dat pwdAt dung moc vua ghi, DB co moc moi hon thi invalid=true.
- Test do: ben thu ba doi hash giua verify va setPassword -> action tra 'current', reissue khong goi; reissue voi DB passwordChangedAt > moc truyen vao -> invalid=true.

### R3-2 (Trung, co tu truoc) - changePasswordAction la oracle doan mat khau khong gioi han, vuot khoa 5 lan
- File: src/server/actions.ts:362-367.
- Sai currentPassword chi tra 'current', khong registerFailedLogin, khong reserveThrottle. Ai giu cookie phien doan mat khau hien tai khong gioi han; doan trung thi doi mat khau va (nho reissue) chiem han tai khoan. Moi lan ton 1 bcrypt tren main thread.
- Tai hien: goi changePasswordAction('sai-1','MatKhauMoi123') lap N lan; failedLoginCount/lockedAt khong doi, auth_throttle khong co dong moi.
- Cach va: reserveThrottle('change_pwd_fail', email, ...) truoc verifyPassword (vd 5/15 phut theo email + theo IP), dung thi release. Qua nguong xu ly theo chot cua chu du an.
- Test do: 6 lan sai lien tiep -> lan 6 bi tu choi truoc bcrypt (spy verifyPassword khong goi).

### R3-3 (Thap) - Kiem lai dinh ky doc DB moi request sau 5 phut
- File: src/lib/auth.ts:213-225 + next/index.js:118.
- Khong co SessionProvider nen cookie gan nhu khong duoc encode lai; accessCheckedAt dung yen tu luc dang nhap, sau 5 phut MOI request server component chay getAccountState. Fail-closed, nhung tai DB tang theo thoi gian phien.

### R3-4 (Thap) - Nhanh update bo qua kiem isActive trong phan hoi POST /api/auth/session
- File: src/lib/auth.ts:189-197. Tai khoan vua bi tat (chua qua 5 phut) van nhan role/canViewFinance trong JSON. Them `if (!account || !account.isActive) token.invalid = true;` cho nhat quan "chi siet".

### R2-2: ghi nhan (checklist deploy).

### Diem khac, DAT
- Token cap lai giai ma tu cookie cua chinh request, bat buoc token.email === user.email.
- encode dat lai iat/exp/jti, maxAge 8h khop session.
- Cookie chunk (>4KB) khong xu ly: fail-closed.
- ChangePasswordModal khong con duong client goi update().
- Khong secret moi, khong SQL noi chuoi, log khong chua token/mat khau.

### Chot cua chu du an (2026-09-28)
- R3-2: sai mat khau hien tai o man Doi mat khau tinh CHUNG vao bo dem khoa 5 lan cua dang nhap (registerFailedLogin); du nguong thi khoa tai khoan, phien hien tai bi dang xuat, can admin mo khoa.

## Vong 4 (security-reviewer, commit 61805e8)

CAN SUA - R3-1 dong (con R4-3, R4-4 Thap); R3-2 thu tu kiem dung chot nhung viec da phien khong co hieu luc phia server (R4-1 Trung).
Soi tinh `git diff df636b1..61805e8`. Ghi chu: security-reviewer chi co quyen doc, phien dieu phoi (C) ghi lai tu bao cao cua no; phien C da doi chieu R4-1 voi auth.ts:84.

### R4-1 (Trung) - Khoa do doan mat khau hien tai khong da duoc phien ke tan cong
- File: src/server/actions.ts:414; src/lib/auth.ts:76-87, 225-232, 331-336.
- invalidateCurrentSessionCookie chi sua cookie phia client, server khong luu dau vet thu hoi; jwt/applyAccountToToken khong xet lockedAt (Q1=a).
- Duong 1: ke tan cong bo qua Set-Cookie, giu cookie cu C0 -> van dung duoc toi 8h.
- Duong 2: cookie C1 invalid=true, accessCheckedAt khong doi -> sau 5 phut nhanh kiem dinh ky goi applyAccountToToken dat invalid=false (auth.ts:84), vd qua GET /api/auth/session (middleware khong chan /api).
- Cach va: (a) thu hoi phia server khi khoa (vd bump passwordChangedAt -> dang xuat moi phien; hoac sid + bang revoked_session chi da 1 phien) - can chu du an chot; (b) invalid "dinh": nhanh kiem dinh ky khong bao gio ha invalid.
- Test do: cookie goc C0 sau 5 lan sai + tua qua 5 phut -> jwt tra invalid=true; token da invalid + tua qua 5 phut -> van invalid=true.

### R4-2 (Thap) - Goi song song vuot nguong 5 lan truoc khi khoa
- File: src/server/actions.ts:384-411 (cung mau login-guard.ts:78-126). lockedAt doc 1 lan truoc bcrypt, throttle chi theo IP (20/15 phut).
- Cach va: dat cho theo email truoc bcrypt (reserveThrottle theo email, limit = LOGIN_LOCK_THRESHOLD), ap ca login-guard.

### R4-3 (Thap) - Phat hien race trong reissueSessionCookie dua vao so moc gio
- File: src/server/actions.ts:426-431; src/lib/auth.ts:319. Lech dong ho nhieu instance hoac trung mili giay co the bo sot.
- Cach va: truyen newHash, invalid khi account.passwordHash !== newHash.

### R4-4 (Thap) - CAS khong kem lockedAt: null / isActive: true; khong kiem isActive truoc khi doi
- Cach va: tra 'current' khi !account.isActive; them isActive: true, lockedAt: null vao where cua setPasswordIfHash (Prisma + bo nho).

### R4-5 (Thap, ghi nhan) - Khoa 'unknown' dung chung cho change_pwd_fail_ip (cung mau R2-2).

### Diem DAT
- R3-1: CAS o READ COMMITTED dung, khong ABA (bcrypt co salt), nhanh thua CAS khong cap cookie.
- R3-2: thu tu locked -> throttle IP -> bcrypt -> registerFailedLogin / release + resetFailedLogin dung chot; tai khoan chi-Google khong dem (L7).
- R3-4 dat; R3-3 ghi nhan chap nhan duoc.
- ChangePasswordModal + createPortal: chi render sau thao tac client, khong cham document luc SSR, khong XSS.

### Chot cua chu du an vong 4 (2026-09-28)
- R4-1 (a): khoa do doan sai mat khau hien tai -> dang xuat MOI phien cua tai khoan (thu hoi phia server, bump passwordChangedAt), khong lam sid/bang thu hoi.
- R4-2: sua CA 2 man (Doi mat khau va Dang nhap): giu cho luot doan theo tai khoan truoc bcrypt, nguong 5 dung ca khi goi song song.

## Vong 5 (security-reviewer, commit 9f937b5)

CAN SUA (moi phat hien deu Thap) - R4-1, R4-3, R4-4 dong; R4-2 chua dat chot "nguong 5 dung ca khi goi song song".
Ghi chu: security-reviewer chi co quyen doc, phien dieu phoi (C) ghi lai tu bao cao cua no.

### R5-1 (Thap) - Ban so le van qua 5 luot bcrypt
- File: login-guard.ts:125-149; actions.ts:415-438.
- (a) releaseThrottle trong finally ngay sau bcrypt, TRUOC registerFailedLogin; (b) remaining = 5 - failedLoginCount tu ban doc dau ham (cu).
- Kich ban: R1..R5 giu 5 cho; R6 doc count=0; R1 xong bcrypt rut cho; R6 dat cho thanh cong -> luot bcrypt thu 6. Kenh phu: luot dung rut cho IP, luot sai giu -> do han muc IP biet luot nao dung.
- Cach va: ham kho moi kiem nguyen tu trong giao dich giu cho (advisory lock theo kind:email, doc failedLoginCount/lockedAt tu DB, tu choi khi lockedAt hoac failedLoginCount + so cho giu >= nguong); rut cho SAU registerFailedLogin/resetFailedLogin (try/finally). Bat bien: cho giu + luot sai da ghi <= 5.
- Test do: ca A (registerFailedLogin cua R1 treo, bat dau R6) va ca B (R6 doc xong dung lai, R1 chay tron, tha R6) -> verifyPassword chi 5 lan; cho ca 2 man.

### R5-2 (Thap) - Cua so 5 giay het han khi server bi don tai
- File: login-policy.ts:55; reserveThrottle ghi createdAt = nowIso luc request bat dau; bcryptjs JS thuan cham theo tai.
- Cach va: cua so 2-10 phut (chi de don dong mo coi), createdAt lay gio luc dat cho.

### R5-3 (Thap) - Nhanh het cho tra locked ngay, do duoc email co mat khau qua thoi gian
- File: login-guard.ts:131-135. Cach va: di y het nhanh lockedAt (bcrypt gia + login_locked_probe). Man Doi mat khau khong can.

### R5-4 (Thap) - logActivity nem loi truoc revokeSessions -> tai khoan khoa nhung phien khong bi thu hoi
- File: actions.ts:440-448. Cach va: revokeSessions + invalidateCurrentSessionCookie truoc, boc logActivity try/catch.

### R5-5 (Thap, can chu du an chot) - Luot khoa o man Dang nhap khong da phien (Q1=a); doan 4 lan o Doi MK + lan 5 o Dang nhap de ne bi da. Tong luot doan van 5.
- Tuy chon chat hon: actions.ts:395, tai khoan da khoa thi goi invalidateCurrentSessionCookie.

### R5-6 (Thap, ghi nhan) - revokeSessions dung nowIso dau request, co the keo passwordChangedAt lui. Nen dung new Date() hoac GREATEST.

### Diem DAT
- R4-1: justLocked dung 1 loi goi thang; 2 duong vuot (bo qua Set-Cookie, hoi sinh qua GET /api/auth/session) da chan; khong con nhanh nao ha invalid cho token cu (reissue khong toi duoc voi cookie invalid vi getCurrentUser tra null).
- R4-3 so hash dat; R4-4 dat; setPassword/consumeResetToken/unlock khong doi.
- He qua phu: phien invalid khong hoi sinh khi admin mo khoa/bat lai - chap nhan duoc, fail-closed.

### Chot cua chu du an vong 5 (2026-09-28)
- R5-5: phien co doi mat khau tren tai khoan DA KHOA thi bi dang xuat ngay (invalidateCurrentSessionCookie o nhanh lockedAt cua changePasswordAction); Q1=a o man Dang nhap giu nguyen.
- He qua phu R4-1b: DONG Y phien da vo hieu khong tu song lai khi admin mo khoa/bat lai tai khoan (phai dang nhap lai).

## Vong 6 (security-reviewer, commit d467732)

CAN SUA - R5-1 dat trong tung man; chot R3-2 + R4-2 chua dat khi goi cheo 2 man (R6-1). R5-2..R5-6 dat; khong hoi quy R2-1, R3-1, R3-2, R4-1..R4-4.
Ghi chu: security-reviewer chi co quyen doc, phien dieu phoi (C) ghi lai tu bao cao cua no.

### R6-1 (Thap, lech chot chu du an) - Cho giu tach theo kind, 2 man dem rieng, tong toi 10 luot bcrypt truoc khi khoa
- File: login-guard.ts:139; actions.ts:418-424; prisma-repo-auth.ts:146,149; mock-repo-auth.ts:163.
- Cach va: 2 man dung chung 1 kind (`account_guess`), test cheo man (kho bo nho, real-db, tich hop).

### R6-2 (Thap, ghi nhan) - Ca B cua login-guard khong tai hien kich ban "doc cu"; man Doi mat khau thieu ca A/B.

### R6-3 (Thap, ghi nhan) - Nhanh het cho o Dang nhap chay them 1 giao dich DB so voi nhanh da khoa/email la (chenh vai round-trip, nho so voi bcrypt; muon cham phai tu khoa tai khoan).

### R6-4 (Thap, ghi nhan) - 2 nhanh tra locked do race (reserveAccountGuess null, resetFailedLogin false) khong da cookie; lan goi ke tiep bi da.

### R6-5 (Thap, ghi nhan) - createdAt/sinceIso theo dong ho app; chi sai khi lech dong ho giua instance > 5 phut.

### Diem DAT
- Bat bien trong 1 man dung (advisory lock, doc tuoi, try/finally); registerFailedLogin khong lay lock van an toan (nghieng ve chat hon).
- R5-2..R5-6 dat; chot R4-1b dat; khong SQL noi chuoi, khong secret, log sach.

## Vong 7 (security-reviewer, xac nhan, commit 899a852)

CHOT - khong con muc Trung tro len, cac chot cua chu du an deu dat.
Ghi chu: security-reviewer chi co quyen doc, phien dieu phoi (C) ghi lai tu bao cao cua no.
- R6-1 DONG: `reserveAccountGuess(email, ...)` 1 kind `account_guess` o ca Prisma va bo nho, tsc chan cho goi cu; test tich hop cheo man tai hien dung.
- R6-4 DONG: chi da phien khi tai khoan that su da khoa; het cho do luot song song khong da.
- R7-1 (Thap, ghi nhan): ke tan cong khoa tai khoan qua Dang nhap roi nan nhan vao Doi mat khau thi bi da phien - dung chot R5-5.
- R7-2 (Thap, ghi nhan): reviewer khong chay real-db; phien C da chay tren DB _c sau 899a852 (xem thay-doi.md).
- Hoi quy: khong (R2-1, R3-1, R3-2, R4-1..R4-4, R5-1..R5-6, Q1=a).
