import { AnalyzeApiResponse } from '@/types/menu';
import { AnalyzeReceiptApiResponse } from '@/types/receipt';

async function parseResponseData(response: Response, defaultErrorMsg: string): Promise<any> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch {
      return { success: false, message: defaultErrorMsg };
    }
  }

  // If response is HTML or text (e.g. 500 / 502 / 504 server error page)
  return {
    success: false,
    message: response.status >= 500
      ? 'Layanan server sedang sibuk atau sedang memuat ulang. Silakan coba sesaat lagi.'
      : defaultErrorMsg,
  };
}

export async function analyzeMenuImage(file: File): Promise<AnalyzeApiResponse> {
  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch('/api/menu/analyze', {
      method: 'POST',
      body: formData,
    });

    const data = await parseResponseData(response, 'Gagal membaca gambar menu.');

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Gagal membaca gambar menu.',
        isRateLimited: response.status === 429,
      };
    }

    return data as AnalyzeApiResponse;
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Terjadi kesalahan koneksi.',
    };
  }
}

export async function analyzeReceiptImage(file: File): Promise<AnalyzeReceiptApiResponse> {
  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch('/api/receipt/analyze', {
      method: 'POST',
      body: formData,
    });

    const data = await parseResponseData(response, 'Gagal membaca gambar struk.');

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Gagal membaca gambar struk.',
        isRateLimited: response.status === 429,
      };
    }

    return data as AnalyzeReceiptApiResponse;
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Terjadi kesalahan koneksi.',
    };
  }
}


