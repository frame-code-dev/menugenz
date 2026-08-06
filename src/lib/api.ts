import { AnalyzeApiResponse } from '@/types/menu';

export async function analyzeMenuImage(file: File): Promise<AnalyzeApiResponse> {
  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch('/api/menu/analyze', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        message: data.message || 'Gagal membaca gambar.',
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
