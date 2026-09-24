import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { isSameOrigin } from '@/lib/same-origin';
import { addPhotoForUser } from '@/server/photo-service';

export const dynamic = 'force-dynamic';

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

  const formData = await req.formData();
  const r = await addPhotoForUser(user, formData);
  if (r.ok) return NextResponse.json({ ok: true, id: r.id }, { status: 200 });
  return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
}
