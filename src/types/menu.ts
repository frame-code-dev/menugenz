export interface MenuResult {
  date: string | null;
  recipients: string[];
  menus: string[];
  mbgNote?: string;
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
