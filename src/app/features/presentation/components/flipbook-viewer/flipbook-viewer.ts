import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  computed,
  effect,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { PageFlip } from 'page-flip';
import { ImageItem } from '../../../../core/models/image-item.model';
import { ImageSessionService } from '../../../../core/services/image-session.service';
import { PresentationToolbar } from '../presentation-toolbar/presentation-toolbar';

const FALLBACK_RATIO = 3 / 4;

@Component({
  selector: 'app-flipbook-viewer',
  imports: [PresentationToolbar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative flex h-full w-full flex-col bg-neutral-900' },
  template: `
    <button
      type="button"
      class="absolute right-4 top-4 z-10 h-10 w-10 rounded-full bg-white/15 text-xl text-white hover:bg-white/30"
      aria-label="Đóng"
      (click)="closed.emit()"
    >
      ✕
    </button>
    <div #stage class="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4">
      <div #book></div>
    </div>
    <div class="shrink-0 pb-4">
      <app-presentation-toolbar
        [label]="label()"
        (prev)="prev()"
        (next)="next()"
        (fullscreen)="toggleFullscreen()"
      />
    </div>
  `,
})
export class FlipbookViewer implements OnDestroy {
  readonly closed = output<void>();

  private readonly session = inject(ImageSessionService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly bookHost = viewChild.required<ElementRef<HTMLElement>>('book');

  private flip: PageFlip | null = null;
  private buildToken = 0;

  private readonly pageIndex = signal(0);
  private readonly pageCount = signal(0);
  protected readonly label = computed(() =>
    this.pageCount() ? `${this.pageIndex() + 1} / ${this.pageCount()}` : '',
  );

  constructor() {
    effect(() => {
      const images = this.session.images();
      void this.build(images);
    });
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight') this.next();
    else if (event.key === 'ArrowLeft') this.prev();
  }

  protected next(): void {
    this.flip?.flipNext();
  }

  protected prev(): void {
    this.flip?.flipPrev();
  }

  protected toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void this.host.nativeElement.requestFullscreen?.();
  }

  ngOnDestroy(): void {
    this.buildToken++;
    this.destroyFlip();
    if (document.fullscreenElement) void document.exitFullscreen();
  }

  private destroyFlip(): void {
    this.flip?.destroy();
    this.flip = null;
  }

  private async build(images: ImageItem[]): Promise<void> {
    const token = ++this.buildToken;
    this.destroyFlip();
    const container = this.bookHost().nativeElement;
    container.replaceChildren();
    if (!images.length) {
      this.pageCount.set(0);
      this.closed.emit();
      return;
    }

    const ratio = await this.measureRatio(images[0].previewUrl);
    if (token !== this.buildToken) return;

    const { clientWidth, clientHeight } = this.stage().nativeElement;
    const availW = Math.max(clientWidth - 32, 200);
    const availH = Math.max(clientHeight - 32, 200);
    // Always show a single page so an odd page count never leaves a gap.
    const pageW = Math.floor(Math.min(availW, availH * ratio));
    const pageH = Math.floor(pageW / ratio);
    container.style.width = `${pageW}px`;
    container.style.height = `${pageH}px`;

    const flip = new PageFlip(container, {
      width: pageW,
      height: pageH,
      size: 'fixed',
      showCover: false,
      usePortrait: true,
      mobileScrollSupport: false,
      maxShadowOpacity: 0.5,
      flippingTime: 700,
    });
    flip.loadFromHTML(images.map((img) => this.createPage(img)));
    flip.on('flip', (e) => this.pageIndex.set(e.data as number));
    this.flip = flip;
    this.pageIndex.set(0);
    this.pageCount.set(flip.getPageCount());
  }

  private createPage(image: ImageItem): HTMLElement {
    const page = document.createElement('div');
    page.style.background = '#fff';
    const img = document.createElement('img');
    img.src = image.previewUrl;
    img.alt = image.name;
    img.draggable = false;
    img.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;';
    page.appendChild(img);
    return page;
  }

  private measureRatio(url: string): Promise<number> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () =>
        resolve(
          img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : FALLBACK_RATIO,
        );
      img.onerror = () => resolve(FALLBACK_RATIO);
      img.src = url;
    });
  }
}
