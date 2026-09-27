# P7-C2 - Thay đổi (coder ghi dần theo task)

## Task 7: Gỡ hằng giai đoạn cứng, bỏ chữ "7 giai đoạn"

- Xoá `STAGE_ORDER`, `STAGE_CALC_MODE`, `calcStageContributions` + `StageContribution` (`src/lib/stages.ts`), `VALUE_CHAIN_COLUMNS` (`value-chain-view.ts`), `stageKey` (`labels.ts`), re-export `STAGE_ORDER` ở `src/data/seed/erp.ts`.
- Tham số `order`/`weights` của `findCurrentStage`, `calcChainPctActual`, `chainFooterSummary`, `stage-timeline`, `evm` thành bắt buộc (không còn mặc định cứng).
- `src/server/actions.ts`: `stagesOrder` luôn là mảng (rỗng khi không có chain) để khớp `order` bắt buộc; hành vi không đổi.
- i18n: xoá nhóm `stage`; bỏ số "7" ở `form.stageSection`, `projectForm.steps.s5`, `projectForm.sec.weights.title`, `projectForm.help.projectType` (vi + en).
- Comment có "7 giai đoạn"/tên hằng cũ đã sửa (kể cả 1 dòng comment trong `app/globals.css`).
- Test gỡ: 5 test gắn với hằng đã xoá (3 test `calcStageContributions` trong `stages.test.ts`, 2 test `VALUE_CHAIN_COLUMNS` trong `value-chain-view.test.ts`); 4 test khác đổi tên cho khớp `order` truyền vào (1 ở `stages.test.ts`, 1 ở `value-chain-view.test.ts`, 2 ở `stage-timeline.test.ts`).
- Test mới: `src/lib/stages-nguon-dong.test.ts` (2 test tĩnh), chạy ĐỎ trước khi gỡ xong (7 file còn nhắc hằng cũ), sau đó XANH.
- Test dùng 7 mã cũ chuyển sang hằng cục bộ `LEGACY7_STAGE_CODES = SEED_STAGE_CODES.slice(0, 7)`.
- Kết quả: `npx tsc --noEmit` sạch; `npm test` 211 file / 2451 test XANH (trước Task 7: 210 / 2454).
