import type { CurrentUser } from '@/lib/session';
import { logActivity } from '@/lib/activity';
import { savePhotoFile } from '@/lib/uploads';
import { revalidateTag } from 'next/cache';
import { profileTag } from './cache';
import { canWriteProject } from './authz';
import { addPhotoSchema, photoFileSchema } from './validation';
import { repo } from './repo';

export type AddPhotoResult = { ok: true; id: number } | { ok: false; error: string; status: 400 | 403 };

/**
 * Logic dùng chung cho `addPhotoAction` (server action) và route `POST /api/photo-upload`
 * (route để client đo được tiến trình byte qua XMLHttpRequest - server action không báo được).
 * Thứ tự kiểm giữ như cũ: quyền trước validate.
 */
export async function addPhotoForUser(user: CurrentUser, formData: FormData): Promise<AddPhotoResult> {
  const projectId = Number(formData.get('projectId'));
  const yearMonth = String(formData.get('yearMonth') ?? '');
  const caption = String(formData.get('caption') ?? '');
  const file = formData.get('file');

  if (!(await canWriteProject(user, projectId))) return { ok: false, error: 'Forbidden', status: 403 };

  const parsed = addPhotoSchema.safeParse({ projectId, yearMonth, caption });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input', status: 400 };

  if (!(file instanceof File)) return { ok: false, error: 'No file', status: 400 };
  const fileParsed = photoFileSchema.safeParse({ type: file.type, size: file.size });
  if (!fileParsed.success) return { ok: false, error: fileParsed.error.issues[0]?.message ?? 'Invalid file', status: 400 };

  const url = await savePhotoFile(parsed.data.projectId, parsed.data.yearMonth, file);
  const photo = await repo.addPhoto(parsed.data.projectId, parsed.data.yearMonth, url, parsed.data.caption, user.email);
  await logActivity(user, 'add_photo', `project ${parsed.data.projectId} · ${parsed.data.yearMonth}`);
  revalidateTag(profileTag);
  return { ok: true, id: photo.id };
}
