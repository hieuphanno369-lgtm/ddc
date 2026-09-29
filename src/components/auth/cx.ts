/** Ghép tên lớp CSS module, bỏ giá trị falsy. */
export function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(' ');
}
