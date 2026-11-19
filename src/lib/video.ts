export const VALID_IMAGE_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const;

export const VALID_VIDEO_MIMES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/3gpp',
  'video/x-m4v',
] as const;

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const VIDEO_MAX_BYTES = 50 * 1024 * 1024; // 50 MB
export const DIRECT_VIDEO_MAX_BYTES = 3.5 * 1024 * 1024; // 3.5 MB (safe for Vercel 4.5MB limit)

export function isImageFile(file: File): boolean {
  if (VALID_IMAGE_MIMES.includes(file.type as (typeof VALID_IMAGE_MIMES)[number])) {
    return true;
  }
  return /\.(jpe?g|png|webp)$/i.test(file.name);
}

export function isVideoFile(file: File): boolean {
  if (file.type.startsWith('video/')) {
    return true;
  }
  return /\.(mp4|webm|mov|m4v|3gp)$/i.test(file.name);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export interface ExtractedVideoResult {
  frames: File[];
  durationSeconds: number;
  width: number;
  height: number;
}

/**
 * Extract evenly distributed HD keyframes from a video file in the browser
 * using HTML5 <video> + <canvas> so large phone videos stay fast, Vercel-safe,
 * and 100% Zero-Data Retention.
 */
export async function extractVideoKeyframes(
  file: File,
  frameCount = 6,
  onProgress?: (percent: number) => void
): Promise<ExtractedVideoResult> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';
    video.src = objectUrl;

    const cleanup = () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(objectUrl);
    };

    const fail = (msg: string) => {
      cleanup();
      reject(new Error(msg));
    };

    const timeoutId = window.setTimeout(() => {
      fail('Waktu pembacaan video habis. Coba video dengan format MP4/WEBM standar.');
    }, 25000);

    video.onerror = () => {
      window.clearTimeout(timeoutId);
      fail('Browser tidak dapat memutar format video ini. Gunakan format MP4, MOV, atau WEBM.');
    };

    video.onloadedmetadata = async () => {
      try {
        const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;
        const naturalWidth = video.videoWidth || 1280;
        const naturalHeight = video.videoHeight || 720;

        // Resize to max 1024px long side to keep total upload < 1.2 MB
        const maxSide = 1024;
        const scale = Math.min(1, maxSide / Math.max(naturalWidth, naturalHeight));
        const targetWidth = Math.max(240, Math.round(naturalWidth * scale));
        const targetHeight = Math.max(240, Math.round(naturalHeight * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          window.clearTimeout(timeoutId);
          return fail('Canvas tidak tersedia di browser ini.');
        }

        const count = duration < 2 ? Math.min(3, frameCount) : frameCount;
        const timestamps: number[] = [];
        for (let i = 0; i < count; i++) {
          const ratio = count === 1 ? 0.5 : 0.08 + (0.84 * i) / (count - 1);
          timestamps.push(Math.min(duration - 0.05, Math.max(0.05, duration * ratio)));
        }

        const frames: File[] = [];

        for (let i = 0; i < timestamps.length; i++) {
          const targetTime = timestamps[i];
          await new Promise<void>((resSeek, rejSeek) => {
            const onSeeked = () => {
              video.removeEventListener('seeked', onSeeked);
              video.removeEventListener('error', onSeekErr);
              resSeek();
            };
            const onSeekErr = () => {
              video.removeEventListener('seeked', onSeeked);
              video.removeEventListener('error', onSeekErr);
              rejSeek(new Error('Gagal mengambil frame video.'));
            };
            video.addEventListener('seeked', onSeeked, { once: true });
            video.addEventListener('error', onSeekErr, { once: true });
            video.currentTime = targetTime;
          });

          ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

          const blob = await new Promise<Blob | null>((resBlob) =>
            canvas.toBlob(resBlob, 'image/jpeg', 0.82)
          );

          if (blob) {
            frames.push(
              new File([blob], `frame-${i + 1}.jpg`, {
                type: 'image/jpeg',
              })
            );
          }

          if (onProgress) {
            onProgress(Math.round(((i + 1) / timestamps.length) * 100));
          }
        }

        window.clearTimeout(timeoutId);
        cleanup();

        if (frames.length === 0) {
          return reject(new Error('Tidak ada frame yang berhasil diekstrak dari video.'));
        }

        resolve({
          frames,
          durationSeconds: duration,
          width: naturalWidth,
          height: naturalHeight,
        });
      } catch (err) {
        window.clearTimeout(timeoutId);
        cleanup();
        reject(err instanceof Error ? err : new Error('Gagal memproses video di browser.'));
      }
    };
  });
}

/**
 * Resize & compress large phone photos client-side before sending to AI Vision
 * while leaving the user's original File untouched for preview/download/WhatsApp share.
 */
export async function compressImageForAnalysis(
  file: File,
  maxDimension = 1280,
  quality = 0.84
): Promise<File> {
  // Skip small files (< 400 KB) to avoid unnecessary re-encoding
  if (file.size <= 400 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    const finishOriginal = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.onerror = finishOriginal;
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const scale = Math.min(1, maxDimension / Math.max(w, h));
        const targetW = Math.max(1, Math.round(w * scale));
        const targetH = Math.max(1, Math.round(h * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) return finishOriginal();

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, targetW, targetH);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            if (!blob || blob.size >= file.size) {
              return resolve(file);
            }
            const cleanName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
            resolve(new File([blob], cleanName, { type: 'image/jpeg' }));
          },
          'image/jpeg',
          quality
        );
      } catch {
        finishOriginal();
      }
    };

    img.src = objectUrl;
  });
}
