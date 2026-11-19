export interface ReceiptItem {
  name: string;
  qty?: number | string | null;
  unit?: string | null;
  pricePerUnit?: number | null;
  totalPrice?: number | null;
}

export interface ReceiptResult {
  merchantName?: string | null;
  date: string | null;
  items: ReceiptItem[];
  subtotal?: number | null;
  discount?: number | null;
  tax?: number | null;
  totalAmount: number | null;
  paymentMethod?: string | null;
  receiptNote?: string | null;
}

export interface AnalyzeReceiptApiResponse {
  success: boolean;
  data?: ReceiptResult;
  message?: string;
  isRateLimited?: boolean;
}

export type AppMode = 'menu' | 'recommend' | 'receipt' | 'pasfoto';
