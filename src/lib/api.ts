import { AnalyzeApiResponse } from '@/types/menu';
import { AnalyzeReceiptApiResponse } from '@/types/receipt';
import {
  RecommendMenuApiResponse,
  RecommendMenuRequest,
} from '@/types/recommendation';
import {
  compressImageForAnalysis,
  DIRECT_VIDEO_MAX_BYTES,
  extractVideoKeyframes,
  isVideoFile,
} from '@/lib/video';

async function parseResponseData(response: Response, defaultErrorMsg: string): Promise<Record<string, unknown>> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return (await response.json()) as Record<string, unknown>;
    } catch {
      return { success: false, message: defaultErrorMsg };
    }
  }

  if (response.status === 413) {
    return {
      success: false,
      message: 'Ukuran media terlalu besar untuk dikirim. Silakan gunakan file yang lebih ringan.',
    };
  }

  return {
    success: false,
    message:
      response.status >= 500
        ? 'Layanan server sedang sibuk atau sedang memuat ulang. Silakan coba sesaat lagi.'
        : defaultErrorMsg,
  };
}

export interface AnalyzeMenuOptions {
  onVideoExtractProgress?: (percent: number) => void;
}

/**
 * Analyze menu image OR video using hybrid strategy:
 * - Image: sent directly via FormData('image')
 * - Small video (<= 3.5 MB): sent directly via FormData('media') so visual & audio are analyzed
 * - Larger video (> 3.5 MB): 6 HD keyframes extracted in browser via <video> + <canvas>
 */
export async function analyzeMenuImage(
  file: File,
  options?: AnalyzeMenuOptions
): Promise<AnalyzeApiResponse> {
  const formData = new FormData();

  try {
    if (isVideoFile(file)) {
      formData.append('mediaType', 'video');
      if (file.size <= DIRECT_VIDEO_MAX_BYTES) {
        formData.append('media', file);
      } else {
        const extracted = await extractVideoKeyframes(
          file,
          6,
          options?.onVideoExtractProgress
        );
        for (const frame of extracted.frames) {
          formData.append('frames', frame);
        }
      }
    } else {
      const optimizedImage = await compressImageForAnalysis(file, 1280, 0.84);
      formData.append('mediaType', 'image');
      formData.append('image', optimizedImage);
    }

    const response = await fetch('/api/menu/analyze', {
      method: 'POST',
      body: formData,
    });

    const data = await parseResponseData(response, 'Gagal membaca media menu.');

    if (!response.ok) {
      return {
        success: false,
        message:
          (typeof data.message === 'string' && data.message) ||
          'Gagal membaca media menu.',
        isRateLimited: response.status === 429,
      };
    }

    return data as unknown as AnalyzeApiResponse;
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Terjadi kesalahan koneksi.',
    };
  }
}

export async function analyzeReceiptImage(file: File): Promise<AnalyzeReceiptApiResponse> {
  const formData = new FormData();

  try {
    const optimizedImage = await compressImageForAnalysis(file, 1600, 0.88);
    formData.append('image', optimizedImage);

    const response = await fetch('/api/receipt/analyze', {
      method: 'POST',
      body: formData,
    });

    const data = await parseResponseData(response, 'Gagal membaca gambar struk.');

    if (!response.ok) {
      return {
        success: false,
        message:
          (typeof data.message === 'string' && data.message) ||
          'Gagal membaca gambar struk.',
        isRateLimited: response.status === 429,
      };
    }

    return data as unknown as AnalyzeReceiptApiResponse;
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Terjadi kesalahan koneksi.',
    };
  }
}

export async function fetchMenuRecommendation(
  payload: RecommendMenuRequest
): Promise<RecommendMenuApiResponse> {
  try {
    const response = await fetch('/api/menu/recommend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await parseResponseData(
      response,
      'Gagal menyusun rekomendasi menu MBG.'
    );

    if (!response.ok) {
      return {
        success: false,
        message:
          (typeof data.message === 'string' && data.message) ||
          'Gagal menyusun rekomendasi menu MBG.',
        isRateLimited: response.status === 429,
      };
    }

    return data as unknown as RecommendMenuApiResponse;
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Terjadi kesalahan koneksi.',
    };
  }
}
