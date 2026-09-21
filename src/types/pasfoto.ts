export type PasFotoSizeId = '2x3' | '3x4' | '4x6';

export type PasFotoQuality = 'high' | 'standard' | 'maximum';

export interface PasFotoSizeOption {
  id: PasFotoSizeId;
  label: string;
  widthMm: number;
  heightMm: number;
  widthCmStr: string;
  widthMmStr: string;
  widthInchStr: string;
  note?: string;
  kegunaan: string;
  aspectRatio: number; // width / height
}

export interface PasFotoSettings {
  showFrame: boolean;
  showGrid: boolean;
  quality: PasFotoQuality;
}

export interface TransformState {
  zoom: number; // 1 = 100%
  rotate: number; // degrees
  panX: number; // px
  panY: number; // px
}
