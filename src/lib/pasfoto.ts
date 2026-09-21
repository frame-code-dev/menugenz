import { PasFotoSizeOption, PasFotoQuality, TransformState } from '@/types/pasfoto';

export const PAS_FOTO_SIZES: PasFotoSizeOption[] = [
  {
    id: '2x3',
    label: '2x3 cm',
    widthMm: 20,
    heightMm: 27.5,
    widthCmStr: '2,0 x 2,75 cm',
    widthMmStr: '20 x 27,5 mm',
    widthInchStr: '~0,8 x 1,1 inci',
    kegunaan: 'Kartu pelajar, dokumen pelengkap',
    aspectRatio: 20 / 27.5,
  },
  {
    id: '3x4',
    label: '3x4 cm',
    widthMm: 27.9,
    heightMm: 38.1,
    widthCmStr: '2,79 x 3,81 cm',
    widthMmStr: '27,9 x 38,1 mm',
    widthInchStr: '~1,1 x 1,5 inci',
    note: '(sering ditulis 2,8 x 3,8 cm)',
    kegunaan: 'Ijazah, SKCK, lamaran kerja',
    aspectRatio: 27.9 / 38.1,
  },
  {
    id: '4x6',
    label: '4x6 cm',
    widthMm: 38.1,
    heightMm: 55.9,
    widthCmStr: '3,81 x 5,59 cm',
    widthMmStr: '38,1 x 55,9 mm',
    widthInchStr: '~1,5 x 2,2 inci',
    note: '(sering ditulis 3,8 x 5,6 cm)',
    kegunaan: 'Paspor, visa, buku nikah',
    aspectRatio: 38.1 / 55.9,
  },
];

/**
 * Mendapatkan resolusi pixel berdasarkan DPI dan dimensi mm
 */
export function getPixelDimensions(
  widthMm: number,
  heightMm: number,
  quality: PasFotoQuality
): { widthPx: number; heightPx: number } {
  let dpi = 300; // default Tinggi (Rekomendasi)
  if (quality === 'standard') dpi = 150;
  if (quality === 'maximum') dpi = 600;

  const mmToInch = 25.4;
  const widthPx = Math.round((widthMm / mmToInch) * dpi);
  const heightPx = Math.round((heightMm / mmToInch) * dpi);

  return { widthPx, heightPx };
}

/**
 * Merender hasil crop pas foto ke dalam Canvas offscreen dan memicu unduhan file gambar
 */
export async function downloadCroppedPasFoto(
  imageElement: HTMLImageElement,
  sizeOption: PasFotoSizeOption,
  transform: TransformState,
  quality: PasFotoQuality,
  containerDisplayWidth: number,
  containerDisplayHeight: number,
  filename?: string
): Promise<void> {
  const { widthPx, heightPx } = getPixelDimensions(
    sizeOption.widthMm,
    sizeOption.heightMm,
    quality
  );

  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context tidak tersedia.');
  }

  // Aktifkan rendering kualitas tinggi
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Fill background putih default
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, widthPx, heightPx);

  // Skala rasio antara canvas output aktual dengan dimensi display frame di layar
  const scaleX = widthPx / containerDisplayWidth;
  const scaleY = heightPx / containerDisplayHeight;

  ctx.save();

  // Pindahkan pusat ke tengah canvas frame
  ctx.translate(widthPx / 2, heightPx / 2);

  // Terapkan translasi offset (pan) yang disesuaikan skala
  ctx.translate(transform.panX * scaleX, transform.panY * scaleY);

  // Terapkan rotasi
  ctx.rotate((transform.rotate * Math.PI) / 180);

  // Terapkan zoom
  ctx.scale(transform.zoom, transform.zoom);

  // Hitung ukuran gambar dasar yang dimuat proporsional terhadap display frame
  // Di layar, gambar default di-scale dengan rumus 'cover' atau fit ke frame
  const imgAspect = imageElement.naturalWidth / imageElement.naturalHeight;
  const frameAspect = containerDisplayWidth / containerDisplayHeight;

  let drawBaseWidth: number;
  let drawBaseHeight: number;

  if (imgAspect > frameAspect) {
    drawBaseHeight = heightPx;
    drawBaseWidth = heightPx * imgAspect;
  } else {
    drawBaseWidth = widthPx;
    drawBaseHeight = widthPx / imgAspect;
  }

  // Gambar gambar di tengah
  ctx.drawImage(
    imageElement,
    -drawBaseWidth / 2,
    -drawBaseHeight / 2,
    drawBaseWidth,
    drawBaseHeight
  );

  ctx.restore();

  // Konversi canvas ke blob jpeg dan trigger download
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return resolve();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const defaultName = `PasFoto_${sizeOption.id}_${Date.now()}.jpg`;
        a.href = url;
        a.download = filename || defaultName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        resolve();
      },
      'image/jpeg',
      0.95
    );
  });
}
