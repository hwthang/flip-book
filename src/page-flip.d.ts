declare module 'page-flip' {
  export interface FlipSetting {
    width: number;
    height: number;
    size?: 'fixed' | 'stretch';
    showCover?: boolean;
    usePortrait?: boolean;
    mobileScrollSupport?: boolean;
    maxShadowOpacity?: number;
    flippingTime?: number;
    [key: string]: unknown;
  }

  export class PageFlip {
    constructor(element: HTMLElement, settings: Partial<FlipSetting>);
    loadFromHTML(items: HTMLElement[] | NodeListOf<HTMLElement>): void;
    loadFromImages(items: string[]): void;
    on(event: string, callback: (e: { data: unknown }) => void): PageFlip;
    flipNext(corner?: 'top' | 'bottom'): void;
    flipPrev(corner?: 'top' | 'bottom'): void;
    getPageCount(): number;
    getCurrentPageIndex(): number;
    flip(page: number, corner?: 'top' | 'bottom'): void;
    getFlipController(): object;
    destroy(): void;
  }
}
