export type CaptionStyle = 'formal_santai' | 'ringkas' | 'sosmed';

export type MenuMediaType = 'image' | 'video';

export interface MenuResult {
  date: string | null;
  recipients: string[];
  menus: string[];
  mbgNote?: string;
  openingHook?: string;
  closingNote?: string;
  mediaType?: MenuMediaType;
}

export interface AnalyzeApiResponse {
  success: boolean;
  data?: MenuResult;
  message?: string;
  isRateLimited?: boolean;
}

export type ProcessingStep =
  | 'idle'
  | 'reading_image'
  | 'reading_ocr'
  | 'identifying_food'
  | 'generating_caption'
  | 'completed'
  | 'error';
