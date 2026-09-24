import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { isSameOrigin } from '@/lib/same-origin';
import { addPhotoForUser } from '@/server/photo-service';
import { PHOTO_MAX_BYTES } from '@/server/validation';

export const dynamic = 'force-dynamic';

// F3 (danh-gia.md, vong sua 1): chan body qua lon TRUOC khi doc req.formData() (formData buffer
// toan bo request vao bo nho). Cong them 64KB cho phan multipart boundary/header cua form-data.
const MAX_CONTENT_LENGTH = PHOTO_MAX_BYTES + 64 * 1024;

/**
 * Route (thay vì server action) để client đo được tiến trình byte qua XMLHttpRequest.upload.
 * Cùng logic quyền/validate với `addPhotoAction` (dùng chung `addPhotoForUser`).
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req.headers)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const contentLengthHeader = req.headers.get('content-length');
  const contentLength = contentLengthHeader === null ? NaN : Number(contentLengthHeader);
  if (!Number.isFinite(contentLength) || contentLength > MAX_CONTENT_LENGTH) {
    return NextResponse.json({ ok: false, error: 'Payload too large' }, { status: 413 });
  }

  const formData = await req.formData();
  const r = await addPhotoForUser(user, formData);
  if (r.ok) return NextResponse.json({ ok: true, id: r.id }, { status: 200 });
  return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
}
