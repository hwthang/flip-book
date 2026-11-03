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
import { PageFlip } from 'page-flip';
import { ImageItem } from '../../../../core/models/image-item.model';
import { ImageSessionService } from '../../../../core/services/image-session.service';
import { DisplayMode, PresentationToolbar } from '../presentation-toolbar/presentation-toolbar';

const FALLBACK_RATIO = 3 / 4;
const MIN_SPREAD_WIDTH = 600;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.25;
const FLIP_DURATION_MS = 300;

type Point = { x: number; y: number };

/** Parts of StPageFlip's FlipController that the typings don't expose. */
interface FlipControllerInternals {
  calc: { getDirection(): number; getCorner(): string; getPosition(): Point } | null;
  render: { finishAnimation(): void; convertToPage(pos: Point): Point };
  showCorner(pos: Point): void;
  checkState(...states: string[]): boolean;
  setState(state: string): void;
  start(pos: Point): boolean;
  do(pos: Point): void;
  animateFlippingTo(from: Point, to: Point, turn: boolean): void;
}

@Component({
  selector: 'app-flipbook-viewer',
  imports: [PresentationToolbar],
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
      <div #frame class="m-auto shrink-0"></div>
    </div>
  `,
})
export class FlipbookViewer implements OnDestroy {
  readonly closed = output<void>();

  private readonly session = inject(ImageSessionService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly frame = viewChild.required<ElementRef<HTMLElement>>('frame');

  private flip: PageFlip | null = null;
  private buildToken = 0;
  private resizeObserver: ResizeObserver | null = null;
  private resizeTimer: ReturnType<typeof setTimeout> | undefined;

  protected readonly pageIndex = signal(0);
  protected readonly pageCount = signal(0);
  protected readonly mode = signal<DisplayMode>('single');
  /** Mode actually in use: a spread needs a wide stage and more than one image. */
  protected readonly activeMode = signal<DisplayMode>('single');
  protected readonly canDouble = signal(true);
  private readonly zoom = signal(1);
  protected readonly zoomPercent = computed(() => Math.round(this.zoom() * 100));
  private readonly layoutTick = signal(0);

  constructor() {
    effect(() => {
      const images = this.session.images();
      const mode = this.mode();
      const zoom = this.zoom();
      this.layoutTick();
      untracked(() => void this.build(images, mode, zoom));
    });

    afterNextRender(() => {
      const stage = this.stage().nativeElement;
      let lastW = stage.clientWidth;
      let lastH = stage.clientHeight;
      this.resizeObserver = new ResizeObserver(() => {
        if (stage.clientWidth === lastW && stage.clientHeight === lastH) return;
        lastW = stage.clientWidth;
        lastH = stage.clientHeight;
        clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(() => this.layoutTick.update((n) => n + 1), 150);
      });
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
    this.flip?.flipNext();
  }

  protected prev(): void {
    this.flip?.flipPrev();
  }

  /** @param page 1-based page number */
  protected goTo(page: number): void {
    const count = this.pageCount();
    if (!this.flip || !count) return;
    this.flip.flip(Math.min(Math.max(Math.round(page), 1), count) - 1);
  }

  protected changeZoom(direction: 1 | -1): void {
    this.zoom.update((z) => Math.min(Math.max(z + direction * ZOOM_STEP, ZOOM_MIN), ZOOM_MAX));
  }

  protected toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void this.host.nativeElement.requestFullscreen?.();
  }

  ngOnDestroy(): void {
    this.buildToken++;
    clearTimeout(this.resizeTimer);
    this.resizeObserver?.disconnect();
    this.destroyFlip();
    if (document.fullscreenElement) void document.exitFullscreen();
  }

  private destroyFlip(): void {
    this.flip?.destroy();
    this.flip = null;
  }

  private async build(images: ImageItem[], mode: DisplayMode, zoom: number): Promise<void> {
    const token = ++this.buildToken;
    const startPage = Math.min(this.pageIndex(), Math.max(images.length - 1, 0));
    this.destroyFlip();
    // The lib removes its container on destroy(), so every build gets a fresh one.
    const container = document.createElement('div');
    this.frame().nativeElement.replaceChildren(container);
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
    const canDouble = availW >= MIN_SPREAD_WIDTH && images.length > 1;
    const double = mode === 'double' && canDouble;
    this.canDouble.set(canDouble);
    this.activeMode.set(double ? 'double' : 'single');

    const fitW = double ? availW / 2 : availW;
    const pageW = Math.floor(Math.min(fitW, availH * ratio) * zoom);
    const pageH = Math.floor(pageW / ratio);
    // The lib forces its own container to width:100%, so size the frame around it:
    // a block narrower than two pages makes it pick portrait (single page) mode, and
    // exactly two pages wide gives the spread.
    const frame = this.frame().nativeElement;
    frame.style.width = `${double ? pageW * 2 : pageW}px`;
    frame.style.height = `${pageH}px`;

    const flip = new PageFlip(container, {
      width: pageW,
      height: pageH,
      size: 'fixed',
      startPage,
      showCover: double,
      usePortrait: !double,
      mobileScrollSupport: false,
      maxShadowOpacity: 0.5,
      flippingTime: FLIP_DURATION_MS,
    });
    flip.loadFromHTML(images.map((img) => this.createPage(img)));
    if (!double) this.enableBackCornerPeel(flip, pageW, pageH);
    flip.on('flip', (e) => this.pageIndex.set(e.data as number));
    this.flip = flip;
    // When zoomed past the stage, start from the middle of the overflow.
    const stage = this.stage().nativeElement;
    stage.scrollLeft = (stage.scrollWidth - stage.clientWidth) / 2;
    stage.scrollTop = (stage.scrollHeight - stage.clientHeight) / 2;
    this.pageIndex.set(startPage);
    this.pageCount.set(flip.getPageCount());
  }

  /**
   * In portrait mode the lib's own hover fold for "previous" sits one page-width left of
   * the canvas, so the left corners never peel. Drive the same controller ourselves:
   * hovering a left corner pulls the previous page's corner in over the current page,
   * and leaving eases it back without turning the page.
   */
  private enableBackCornerPeel(flip: PageFlip, pageW: number, pageH: number): void {
    const ctl = flip.getFlipController() as unknown as FlipControllerInternals;
    const libShowCorner = ctl.showCorner.bind(ctl);
    const zone = Math.hypot(pageW, pageH) / 5;

    const releaseBackFold = () => {
      const calc = ctl.calc;
      if (!calc || calc.getDirection() !== 1) return;
      const corner = calc.getCorner();
      ctl.setState('read');
      ctl.render.finishAnimation();
      ctl.animateFlippingTo(calc.getPosition(), { x: pageW, y: corner === 'bottom' ? pageH : 0 }, false);
    };

    ctl.showCorner = (pos) => {
      if (!ctl.checkState('read', 'fold_corner')) return;
      const inLeftCorner =
        pos.x >= 0 && pos.x < zone && pos.y >= 0 && pos.y < pageH && (pos.y < zone || pos.y > pageH - zone);

      if (inLeftCorner) {
        if (!ctl.calc && !ctl.start(pos)) return;
        if (ctl.calc?.getDirection() !== 1) return;
        ctl.setState('fold_corner');
        ctl.do(ctl.render.convertToPage(pos));
      } else {
        releaseBackFold();
        libShowCorner(pos);
      }
    };
  }

  private createPage(image: ImageItem): HTMLElement {
    const page = document.createElement('div');
    page.style.background = '#f8f9fa';
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
