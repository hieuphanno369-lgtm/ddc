'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { overallPercent, precheckPhotos } from '@/lib/photo-upload';
import { PHOTO_MAX_BYTES } from '@/server/validation';
import { IconCloudUpload } from '@/components/icons';

interface UploadLine {
  name: string;
  msg: string;
}

/** Upload 1 file qua XHR (thay vì server action) để đọc được tiến trình byte. */
function uploadOne(
  projectId: number,
  yearMonth: string,
  file: File,
  onProgress: (loaded: number) => void,
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const fd = new FormData();
    fd.set('projectId', String(projectId));
    fd.set('yearMonth', yearMonth);
    fd.set('caption', '');
    fd.set('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/photo-upload');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded);
    };
    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText) as { ok: boolean; error?: string };
        if (xhr.status === 200 && body.ok) resolve({ ok: true });
        else resolve({ ok: false, error: body.error ?? xhr.statusText });
      } catch {
        resolve({ ok: false, error: xhr.statusText || 'Lỗi tải ảnh' });
      }
    };
    xhr.onerror = () => resolve({ ok: false, error: xhr.statusText || 'Lỗi mạng' });
    xhr.send(fd);
  });
}

export function PhotoDropzone(props: {
  projectId: number;
  yearMonth: string;
  disabled?: boolean;
  onUploaded: () => void;
}) {
  const t = useTranslations();
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ i: number; n: number; pct: number } | null>(null);
  const [lines, setLines] = useState<UploadLine[]>([]);

  const busy = props.disabled || uploading;

  async function handleFiles(files: FileList | null) {
    if (busy) return;
    const list = Array.from(files ?? []);
    if (list.length === 0) return;

    const { accepted, rejected } = precheckPhotos(list, PHOTO_MAX_BYTES);
    const mb = PHOTO_MAX_BYTES / 1024 / 1024;
    const newLines: UploadLine[] = rejected.map((r) => ({
      name: r.name,
      msg: r.reason === 'not_image'
        ? t('dataGuard.photo.notImage', { name: r.name })
        : t('dataGuard.photo.tooBig', { name: r.name, mb }),
    }));
    setLines(newLines);

    if (accepted.length === 0) return;

    setUploading(true);
    let doneBytes = 0;
    const totalBytes = accepted.reduce((sum, f) => sum + f.size, 0);
    let successCount = 0;
    try {
      for (let i = 0; i < accepted.length; i++) {
        const file = accepted[i];
        setProgress({ i: i + 1, n: accepted.length, pct: overallPercent(doneBytes, 0, totalBytes) });
        const res = await uploadOne(props.projectId, props.yearMonth, file, (loaded) => {
          setProgress({ i: i + 1, n: accepted.length, pct: overallPercent(doneBytes, loaded, totalBytes) });
        });
        doneBytes += file.size;
        if (res.ok) {
          successCount++;
        } else {
          setLines((prev) => [...prev, { name: file.name, msg: t('dataGuard.photo.failed', { name: file.name, msg: res.error ?? '' }) }]);
        }
      }
    } finally {
      setUploading(false);
      setProgress(null);
    }
    if (successCount > 0) props.onUploaded();
  }

  function openPicker() {
    if (busy) return;
    inputRef.current?.click();
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={busy ? -1 : 0}
        aria-disabled={busy}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (busy) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPicker();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          if (!busy) setActive(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setActive(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setActive(false);
          if (!busy) void handleFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1 px-4 py-6 text-center transition-colors duration-fast ${busy ? 'pointer-events-none opacity-60' : ''}`}
        style={{
          border: `1px dashed ${active ? 'var(--accent)' : 'var(--sep-2)'}`,
          borderRadius: 'var(--r-md)',
          background: active ? 'var(--accent-tint)' : undefined,
        }}
      >
        <IconCloudUpload size={32} className="text-brand" />
        <span className="text-footnote font-medium">{t('dataGuard.photo.dropTitle')}</span>
        <span className="hintline">{t('dataGuard.photo.dropHint', { mb: PHOTO_MAX_BYTES / 1024 / 1024 })}</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {progress && (
        <div className="mt-2">
          <p className="hintline">{t('dataGuard.photo.uploading', { i: progress.i, n: progress.n, pct: progress.pct })}</p>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.pct}
            style={{ height: 6, borderRadius: 999, background: 'var(--fill)', overflow: 'hidden' }}
          >
            <div style={{ height: '100%', width: `${progress.pct}%`, background: 'var(--accent)', transition: 'width .2s' }} />
          </div>
        </div>
      )}

      {lines.map((l, i) => (
        <p key={i} className="hintline" style={{ color: 'var(--danger)' }}>{l.msg}</p>
      ))}
    </div>
  );
}
