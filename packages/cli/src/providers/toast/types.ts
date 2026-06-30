export enum ToastVariant {
  SUCCESS = "success",
  ERROR = "error",
  INFO = "info",
}

export interface ToastOptions {
  message: string;
  variant?: ToastVariant;
  duration?: number;
}

export const DEFAULT_DURATION = 3000;
