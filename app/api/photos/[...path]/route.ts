import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/session';
import { readPhotoFile } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

/**
 * Stream ảnh hiện trường đã ghi vào `data/uploads` (ngoài public/).
 * `ProjectPhoto.url` lưu path tương đối → client gọi `/api/photos/<url>`.
 */
export async function GET(_req: NextRequest, { params }: { params: { path: string[] } }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const photo = await readPhotoFile((params.path ?? []).join('/'));
  if (!photo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return new Response(new Uint8Array(photo.bytes), {
    headers: {
      'Content-Type': photo.contentType,
      'Cache-Control': 'private, max-age=3600',
      // F1 (danh-gia.md): trình duyệt không được tự suy content-type khác Content-Type header,
      // và nếu lỡ có file cũ định dạng lạ lọt qua thì cũng không được thực thi script khi mở trực tiếp.
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}
