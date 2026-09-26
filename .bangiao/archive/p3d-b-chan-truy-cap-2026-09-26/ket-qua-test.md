# P3D-B - Chan truy cap khi chua dang nhap: ket qua kiem thu doc lap (Tester)

Skill da dung: `test-driven-development`, `verification-before-completion`.

## Ket luan: XANH

Khong tim thay loi. Toan bo cong doc lap deu xanh, khong sua code san pham.

## 1. Test doc lap (Vitest, moi - khong sua test cua coder)

File: `src/server/middleware-auth.qa.test.ts` (19 ca, KHONG dung chung file voi
`middleware-auth.test.ts` cua coder).

Ba nhom theo yeu cau:
- **Duong chay thuan loi:** admin da dang nhap vao `/vi/overview` cho qua; chua dang nhap
  vao `/vi/overview` bi day ve login.
- **Bien da neu ten:**
  - Token `invalid = true` (tai khoan bi khoa) -> ve `/vi/login`; vao `/vi/login` khong tao
    vong lap (van cho qua).
  - Token thieu `role` -> phai duoc coi la `viewer`: vao `/vi/overview` cho qua, vao
    `/vi/import` (duong cam cua viewer) bi day ve `/vi/overview` (khong phai ve login);
    vao `/vi/login` cung khong tao vong lap.
  - Duong dan khong co locale (`/projects`, `/`) -> giao het cho next-intl, khong tu goi
    `getToken`.
  - Duong dan khong ton tai khi chua dang nhap (`/vi/duong-dan-la-lung-khong-co-that`,
    `/en/duong-dan-khong-ton-tai`) -> ve dung `/{locale}/login`, khong lo danh sach trang that.
  - `/vi/login` khong bi redirect vong voi ca 4 vai da dang nhap (admin, bod, viewer,
    data-entry) - khong chi rieng admin nhu test cua coder.
  - RBAC `DENIED` giu nguyen: viewer vao `/vi/admin` -> ve `/vi/overview`; data-entry vao
    `/vi/overview` -> ve `/vi/nhap-lieu`.
- **Truong hop phai that bai (tu choi dung nhu ky vong):** chua dang nhap khong the doc
  `/vi/projects/1` (phai bi day ve login, khong duoc `passedThrough`); viewer khong the vao
  `/vi/ho-so-du-an` (phai bi tu choi ve `/vi/overview`, khong duoc cho qua).

**Ket qua:** `npx vitest run src/server/middleware-auth.qa.test.ts` -> **19/19 xanh**.

## 2. Kiem trinh duyet that (Playwright MCP)

Dev server tu bat rieng tren cong 3001 (khong dung cai da tat sau `npm run test:e2e`).

| Buoc | Ket qua |
|---|---|
| Chua dang nhap mo `/vi/projects/1` | Bi dua ve `/vi/login`, dung nhu ky vong |
| Giao dien trang login (1440px) | Khong vo, hien du logo/form/nut (anh `01-login-1440.png`) |
| Dang nhap admin (that, go email/mat khau tu `.env`) | Vao duoc `/vi/overview` |
| `/vi/overview` (1440px) | Render du KPI/chart/bang, khong crash (anh `02-overview-1440.png`) |
| `/vi/projects/1` (1440px) | Mo chi tiet du an binh thuong, khong loi (anh `03-project-detail-1440.png`) |
| `/vi/overview` (390px, mobile) | Layout co dinh lai dung, khong vo (anh `04-overview-390.png`) |

Anh luu trong `.bangiao/anh-test/`. Console co 3 canh bao (khong phai loi): `Warning:
defaultProps will be removed...` tu thu vien `recharts` (XAxis/YAxis/ReferenceLine), khong
lien quan P3D-B, khong lam vo trang - khong bao la loi.

## 3. Cong chung

| Lenh | Ket qua |
|---|---|
| `npx tsc --noEmit` | 0 loi |
| `npm test` | **200 file / 2159 test xanh** (moc coder de lai 199/2140; tang dung +1 file/+19 test la file QA moi, khong test nao khac doi) |
| `npm run test:e2e` (Playwright, toan bo) | **60/60 xanh** (dung moc coder de lai) |

Khong gap su co moi truong (khong co tien trinh nao chiem nham cong 3001 truoc khi bat dev
server rieng; da dung dung tien trinh node cua `DDC_Control_Tower-B` (PID xac nhan qua
`CommandLine` tro dung thu muc nay) sau khi xong, khong dung tien trinh cua tai khoan A).

## 4. Pham vi khong kiem lai

Khong chay lai toan bo cac ca chi tiet coder da chung minh day du (vd toan bo 42 ca trong
`e2e/09-chan-chua-dang-nhap.spec.ts` da chay qua `npm run test:e2e` chung), chi viet doc lap
them cac bien gia tri nhat theo yeu cau va soi lai bang trinh duyet that.
