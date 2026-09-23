# Đánh giá cuối — Đợt 2 (khớp mock-up 100%)

**PHAN QUYET: CAN SUA** (= DUYET CO DIEU KIEN — 2 việc nhỏ trước merge, không có lỗi đúng đắn/bảo mật đáng chặn)

Skill: `ddc-tower:code-review`. Phạm vi `git diff main...HEAD`: 10 commit `feat(parity):` (8438794→719b6bd), docs e8f57b4, fix 8da0486 + 78ba1b2. 70 file, +7758/−2196 (phần lớn `.bangiao/`).

## Cổng reviewer tự chạy
- `npx tsc --noEmit`: exit 0.
- `npm test`: 51 file, 708/708 xanh.
- `npm run build`: không chạy (ghi `.next/`, vượt quyền chỉ đọc). Build sạch cuối ở 719b6bd, trước 2 commit fix.

## 1. Khớp plan — Có
- Đủ 10 Task đúng thứ tự, mỗi Task 1 commit; mọi mục "Tester soi kỹ" có code + test.
- Lệch có chủ ý Q4 (tuần tracking kết thúc ở ngày cuối có số liệu), Q5 (cột chênh lệch dùng `dayVariance` Run 1), Q2 (`/overview`, `/report` không đổi) — đúng mô tả.
- G-1…G-20 không làm, đúng plan.
- i18n vi/en không lệch key; `messages.test.ts` thêm 11 file nguồn; chuỗi có `<b>` render qua `t.rich`.
- CSS mới trong `@layer components`; keyframe đổi tên `cdShine`/`cdPulse`.

## 2. Giá trị test — Phần lớn có
- Cao: `actions-key-milestones.test.ts` (quyền admin/PIC/data-entry không PIC/viewer/BOD, Forbidden không đổi dữ liệu dự án 4, tên rỗng, dự án không tồn tại); `prisma-repo-key-milestones.test.ts`, `project-queries.test.ts` (520/486, 72/63); `projects-detail-page-render.test.ts` (render thật theo vai trò).
- Hạn chế: khối `measureAndClampTip` trong `tooltip-position.test.ts` dùng phần tử giả viết theo giả thuyết debugger → chứng minh nhất quán, không chứng minh hành vi trình duyệt. Bằng chứng thật là phép đo Playwright vòng 2.
- Chưa có test bắt tràn ngang mobile (vitest môi trường `node`).

## 3. Bảo mật / hiệu năng / đúng đắn
- Đúng đắn: không lỗi chặn. `ChartTip.tsx` sau 78ba1b2 đúng hướng (đặt `left:0` trước khi đo, `useLayoutEffect`). Luồng lưu mốc trong `DataEntryForm` lưu sau `saveMonthlyData` thành công, lỗi riêng qua `msSaveErr`. `?step=` so whitelist `STEPS`.
- Hiệu năng (để sau): `src/server/project-queries.ts:49-50, 84-85, 122-123, 164` gọi `getDailyManpower`/`getDailyEquipment` 3–4 lần/lần render; `page.tsx:90-100` await tuần tự (pattern có sẵn). Sau này gộp đọc hoặc `Promise.all`.
- Bảo mật: đồng ý DAT. 78ba1b2 chỉ đụng hình học tooltip, không cần soi lại. L-1 (`page.tsx:96`), L-2 (`actions.ts:210`), L-3 (`key-milestones.ts:9-11`, nên `JSON.stringify(rows)`) — để sau.
- a11y/chất lượng (không chặn): `KeyMilestoneEditor.tsx` ô tên/ngày thiếu `aria-label`, hàng `key={i}`; `HelpTip.tsx:4` `aria-label` ghi đè nội dung bong bóng (nên `aria-describedby`); `ChartTip.tsx` comment `eslint-disable` trỏ plugin không cấu hình.

## GOP-3 — tràn ngang mobile: CẦN VÁ TRƯỚC MERGE
- Do Đợt 2 gây ra: `HelpTip` đặt vào 2 Card `overflow-visible` trên trang chi tiết (`page.tsx:227/231`, `WeeklyTrackingCard.tsx:33/36`).
- Nguyên nhân: `.bub` `width:268px` khi ẩn chỉ `opacity:0; visibility:hidden` (`app/globals.css:350-357`) — vẫn tính vào vùng cuộn.
- Hậu quả: điện thoại cuộn/lắc ngang ~70px; bấm "?" bong bóng có thể bị cắt.
- Plan Bước 9 (`ke-hoach.md:2144`) yêu cầu kiểm 390px. Hai lần đo của tester mâu thuẫn (vòng 1 không tràn; vòng 2 `scrollWidth 504 > 433`), có thể do scaling 10/9 → phải đo lại sau vá.
- Hướng vá: ẩn hẳn `.bub` khi không hiện (`display:none`, hoặc giữ fade bằng `@starting-style`), thêm `max-width:calc(100vw - 24px)`.
- Tiêu chí đóng: `/vi/projects/1`, `/vi/projects/17`, `/en/projects/1`, 390px, sáng + tối: `scrollWidth <= innerWidth` (đo theo `innerWidth` thật); bấm "?" bong bóng hiện trọn.

## Rủi ro build
- `SELF_SIGNED_CERT_IN_CHAIN` gần như chắc do proxy/CA nội bộ; `next/font/google` ở `app/[locale]/layout.tsx:5` không đổi.
- Rủi ro 2 commit fix phá build ngoài font: thấp (1 file `'use client'`, 1 module thuần, CSS hợp lệ, không export lạ, không ESLint config). Chỉ build thật xác nhận được ranh giới server/client + bundle.
- Cách chạy: `NODE_EXTRA_CA_CERTS=<pem CA nội bộ> npm run build`, hoặc máy/CI mạng sạch, hoặc `NEXT_FONT_GOOGLE_MOCKED_RESPONSES`.

## Trước merge
1. Vá GOP-3 (`app/globals.css:350-364`) + đo lại theo tiêu chí đóng.
2. `npm run build` sạch một lần trên HEAD sau vá, kèm `tsc` + `npm test` (≥708 xanh).

## Để sau merge
- L-1, L-2, L-3; I-3 (chủ dự án xác nhận Backup có được ghi không).
- Gộp đọc `getDailyManpower`/`getDailyEquipment` lặp.
- a11y `KeyMilestoneEditor`, `HelpTip`.
- GOP-1 (Recharts `defaultProps`), GOP-2 (`DataEntryForm` cần `.slice(0,10)` cho input date) — có từ trước.
- G-1…G-20 chờ chủ dự án.

Sau khi 2 việc trước merge xong có bằng chứng → **CHOT**.

*(Reviewer không có công cụ ghi file; điều phối viên chép lại nội dung báo cáo.)*
