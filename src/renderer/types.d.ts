import type { CometApi } from '../preload';

declare global {
  interface Window {
    comet: CometApi;
  }
}

export {};
