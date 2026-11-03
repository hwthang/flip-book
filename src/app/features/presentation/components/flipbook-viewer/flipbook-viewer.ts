import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  afterNextRender,
  computed,
  effect,
  inject,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { ImageSessionService } from '../../../../core/services/image-session.service';
import { CssFlipbook } from '../css-flipbook/css-flipbook';
import { DisplayMode, PresentationToolbar } from '../presentation-toolbar/presentation-toolbar';

const FALLBACK_RATIO = 3 / 4;
const MIN_SPREAD_WIDTH = 600;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.25;

@Component({
  selector: 'app-flipbook-viewer',
  imports: [PresentationToolbar, CssFlipbook],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex h-full w-full flex-col bg-slate-100' },
  template: `
    <app-presentation-toolbar
      [page]="pageIndex() + 1"
      [total]="pageCount()"
      [zoomPercent]="zoomPercent()"
      [mode]="activeMode()"
      [canDouble]="canDouble()"
      (close)="closed.emit()"
      (first)="goTo(1)"
      (prev)="prev()"
      (next)="next()"
      (last)="goTo(pageCount())"
      (goto)="goTo($event)"
      (zoomIn)="changeZoom(1)"
      (zoomOut)="changeZoom(-1)"
      (modeChange)="mode.set($event)"
      (fullscreen)="toggleFullscreen()"
    />
    <div #stage class="flex min-h-0 flex-1 overflow-auto p-4">
      @if (layout(); as l) {
        <app-css-flipbook
          class="m-auto"
          [images]="session.images()"
          [pageWidth]="l.pageWidth"
          [pageHeight]="l.pageHeight"
          [double]="l.double"
          [page]="pageIndex()"
          (pageChange)="pageIndex.set($event)"
        />
      }
    </div>
  `,
})
export class FlipbookViewer implements OnDestroy {
  readonly closed = output<void>();

  protected readonly session = inject(ImageSessionService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly book = viewChild(CssFlipbook);
  private resizeObserver: ResizeObserver | null = null;

  protected readonly pageIndex = signal(0);
  protected readonly pageCount = computed(() => this.session.images().length);
  protected readonly mode = signal<DisplayMode>('single');
  private readonly zoom = signal(1);
  protected readonly zoomPercent = computed(() => Math.round(this.zoom() * 100));

  private readonly stageSize = signal({ width: 0, height: 0 });
  private readonly ratio = signal<number | null>(null);

  /** A spread needs a wide stage and more than one image. */
  protected readonly canDouble = computed(
    () => this.stageSize().width - 32 >= MIN_SPREAD_WIDTH && this.pageCount() > 1,
  );

  protected readonly layout = computed(() => {
    const ratio = this.ratio();
    const { width, height } = this.stageSize();
    if (ratio === null || !width) return null;
    const double = this.mode() === 'double' && this.canDouble();
    const availW = Math.max(width - 32, 200);
    const availH = Math.max(height - 32, 200);
    const fitW = double ? availW / 2 : availW;
    const pageWidth = Math.floor(Math.min(fitW, availH * ratio) * this.zoom());
    return { double, pageWidth, pageHeight: Math.floor(pageWidth / ratio) };
  });

  protected readonly activeMode = computed<DisplayMode>(() => (this.layout()?.double ? 'double' : 'single'));

  constructor() {
    effect(() => {
      const first = this.session.images()[0];
      if (!first) {
        untracked(() => this.closed.emit());
        return;
      }
      // Pages are sized from the first image's proportions.
      let stale = false;
      const img = new Image();
      img.onload = () => {
        if (!stale) this.ratio.set(img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : FALLBACK_RATIO);
      };
      img.onerror = () => {
        if (!stale) this.ratio.set(FALLBACK_RATIO);
      };
      img.src = first.previewUrl;
      return () => (stale = true);
    });

    effect(() => {
      // Zooming past the stage: start from the middle of the overflow.
      this.layout();
      const stage = this.stage().nativeElement;
      requestAnimationFrame(() => {
        stage.scrollLeft = (stage.scrollWidth - stage.clientWidth) / 2;
        stage.scrollTop = (stage.scrollHeight - stage.clientHeight) / 2;
      });
    });

    afterNextRender(() => {
      const stage = this.stage().nativeElement;
      const measure = () =>
        this.stageSize.set({ width: stage.clientWidth, height: stage.clientHeight });
      measure();
      this.resizeObserver = new ResizeObserver(measure);
      this.resizeObserver.observe(stage);
    });
  }

  @HostListener('document:keydown', ['$event'])
  protected onKey(event: KeyboardEvent): void {
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === 'ArrowRight') this.next();
    else if (event.key === 'ArrowLeft') this.prev();
  }

  protected next(): void {
    this.book()?.next();
  }

  protected prev(): void {
    this.book()?.prev();
  }

  /** @param page 1-based page number */
  protected goTo(page: number): void {
    const count = this.pageCount();
    if (!count) return;
    this.book()?.goTo(Math.min(Math.max(Math.round(page), 1), count) - 1);
  }

  protected changeZoom(direction: 1 | -1): void {
    this.zoom.update((z) => Math.min(Math.max(z + direction * ZOOM_STEP, ZOOM_MIN), ZOOM_MAX));
  }

  protected toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void this.host.nativeElement.requestFullscreen?.();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (document.fullscreenElement) void document.exitFullscreen();
  }
}
