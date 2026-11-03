import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  ViewEncapsulation,
  computed,
  effect,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { ImageItem } from '../../../../core/models/image-item.model';

/** Duration of one page turn; keep in sync with `--cfb-t` in the styles below. */
const TURN_MS = 700;
const MAX_STAGGER_MS = 70;
const JUMP_SPREAD_MS = 500;

interface Leaf {
  /** Includes the display mode so switching modes recreates the elements instead of animating them. */
  key: string;
  index: number;
  front: ImageItem;
  back: ImageItem | null;
}

/**
 * Page-flip book built from CSS 3D transforms only. Each leaf is a sheet of paper with a front
 * and a back face that rotates around the spine (`transform-origin: left`); angular code just
 * toggles classes, and `transition` does the animation.
 *
 * - single: one page at a time, every image is its own leaf and flips off to the left.
 * - double: a spread, the first image is a lone cover on the right; leaf k holds images 2k and 2k+1.
 *
 * `position` is the number of leaves already flipped to the left.
 */
@Component({
  selector: 'app-css-flipbook',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'block shrink-0' },
  template: `
    <div
      class="cfb"
      [class.cfb-double]="double()"
      [class.cfb-single]="!double()"
      [style.--cfb-w]="pageWidth() + 'px'"
      [style.--cfb-h]="pageHeight() + 'px'"
      [style.--cfb-cols]="double() ? 2 : 1"
      [style.transform]="shift()"
      (pointerdown)="onPointerDown($event)"
      (pointerup)="onPointerUp($event)"
    >
      @for (leaf of leaves(); track leaf.key) {
        <div
          class="cfb-leaf"
          [class.flipped]="leaf.index < position()"
          [class.turning]="turning().has(leaf.index)"
          [class.next]="leaf.index === position()"
          [class.prev]="leaf.index === position() - 1"
          [style.z-index]="zIndex(leaf.index)"
          [style.--cfb-d]="(turning().has(leaf.index) ? delays[leaf.index] ?? 0 : 0) + 'ms'"
        >
          <div class="cfb-face cfb-front">
            <img [src]="leaf.front.previewUrl" [alt]="leaf.front.name" draggable="false" decoding="async" />
          </div>
          <div class="cfb-face cfb-back">
            @if (leaf.back; as back) {
              <img [src]="back.previewUrl" [alt]="back.name" draggable="false" decoding="async" />
            }
          </div>
        </div>
      }
      <button
        type="button"
        class="cfb-zone cfb-zone-prev"
        [class.off]="position() <= 0"
        tabindex="-1"
        aria-label="Trang trước"
        (click)="zoneClick(-1)"
      ></button>
      <button
        type="button"
        class="cfb-zone cfb-zone-next"
        [class.off]="position() >= maxPosition()"
        tabindex="-1"
        aria-label="Trang sau"
        (click)="zoneClick(1)"
      ></button>
    </div>
  `,
  styles: `
    .cfb {
      --cfb-t: 700ms;
      --cfb-ease: cubic-bezier(0.645, 0.045, 0.355, 1);
      position: relative;
      width: calc(var(--cfb-w) * var(--cfb-cols));
      height: var(--cfb-h);
      perspective: 2600px;
      touch-action: pan-y;
      user-select: none;
      -webkit-user-select: none;
      transition: transform var(--cfb-t) var(--cfb-ease);
    }

    .cfb-leaf {
      position: absolute;
      top: 0;
      left: calc(var(--cfb-w) * (var(--cfb-cols) - 1));
      width: var(--cfb-w);
      height: var(--cfb-h);
      transform-origin: left center;
      transform-style: preserve-3d;
      transition: transform var(--cfb-t) var(--cfb-ease) var(--cfb-d, 0ms);
      pointer-events: none;
      will-change: transform;
    }
    .cfb-leaf.flipped {
      transform: rotateY(-180deg);
    }
    .cfb-leaf.turning {
      box-shadow: 0 0 36px rgb(0 0 0 / 0.35);
    }

    .cfb-face {
      position: absolute;
      inset: 0;
      overflow: hidden;
      background: #f8f9fa;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
    }
    .cfb-back {
      transform: rotateY(180deg);
    }
    .cfb-face img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
      pointer-events: none;
    }
    /* soft shade along the spine, only visible in the two-page spread */
    .cfb-double .cfb-face::after {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: linear-gradient(to right, rgb(0 0 0 / 0.22), transparent 10%);
    }
    .cfb-double .cfb-back::after {
      background: linear-gradient(to left, rgb(0 0 0 / 0.22), transparent 10%);
    }
    /* in single mode the underside of a turning page is just plain paper */
    .cfb-single .cfb-back {
      background: linear-gradient(to left, #d7dce2, #eceff2 40%);
    }

    /* single mode: a page that has turned away fades out once it has landed off-screen */
    .cfb-single .cfb-leaf {
      transition:
        transform var(--cfb-t) var(--cfb-ease) var(--cfb-d, 0ms),
        opacity 0s linear var(--cfb-d, 0ms);
    }
    .cfb-single .cfb-leaf.flipped {
      opacity: 0;
      transition:
        transform var(--cfb-t) var(--cfb-ease) var(--cfb-d, 0ms),
        opacity 150ms linear calc(var(--cfb-d, 0ms) + var(--cfb-t) * 0.7);
    }

    /* edge hot-zones: click to turn, hover to lift the page like a peeled corner */
    .cfb-zone {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 18%;
      z-index: 5000;
      cursor: pointer;
      background: none;
      border: 0;
      padding: 0;
    }
    .cfb-zone-prev {
      left: 0;
    }
    .cfb-zone-next {
      right: 0;
    }
    .cfb-zone.off {
      pointer-events: none;
    }

    .cfb:has(.cfb-zone-next:hover:not(.off)) .cfb-leaf.next:not(.turning) {
      transform: rotateY(-9deg);
      transition-duration: 250ms;
      transition-delay: 0ms;
    }
    .cfb-double:has(.cfb-zone-prev:hover:not(.off)) .cfb-leaf.prev:not(.turning) {
      transform: rotateY(-171deg);
      transition-duration: 250ms;
      transition-delay: 0ms;
    }
    .cfb-single:has(.cfb-zone-prev:hover:not(.off)) .cfb-leaf.prev:not(.turning) {
      opacity: 1;
      transform: rotateY(-86deg);
      transition:
        transform 250ms var(--cfb-ease),
        opacity 0s;
    }

    @media (prefers-reduced-motion: reduce) {
      .cfb {
        --cfb-t: 1ms;
      }
    }
  `,
})
export class CssFlipbook implements OnDestroy {
  readonly images = input.required<ImageItem[]>();
  readonly pageWidth = input.required<number>();
  readonly pageHeight = input.required<number>();
  readonly double = input(false);
  /** Zero-based index of the page to show; in a spread this is the left page. */
  readonly page = input(0);
  readonly pageChange = output<number>();

  protected readonly leaves = computed<Leaf[]>(() => {
    const images = this.images();
    const double = this.double();
    const prefix = double ? 'd' : 's';
    if (!double) {
      return images.map((front, index) => ({ key: prefix + index, index, front, back: null }));
    }
    const result: Leaf[] = [];
    for (let i = 0; i < images.length; i += 2) {
      result.push({ key: prefix + i / 2, index: i / 2, front: images[i], back: images[i + 1] ?? null });
    }
    return result;
  });

  /** Highest reachable position; with an odd count in a spread the last leaf's back stays blank, so it is never shown. */
  protected readonly maxPosition = computed(() => {
    const count = this.images().length;
    return this.double() ? Math.floor(count / 2) : Math.max(count - 1, 0);
  });

  protected readonly position = linkedSignal(() =>
    this.clamp(this.toPosition(this.page(), this.double())),
  );

  protected readonly turning = signal<ReadonlySet<number>>(new Set());
  protected readonly delays: number[] = [];

  /** Re-centres a lone cover or back cover so the book never sits half empty. */
  protected readonly shift = computed(() => {
    if (!this.double()) return 'none';
    const position = this.position();
    const half = this.pageWidth() / 2;
    if (position === 0) return `translateX(${-half}px)`;
    if (position === this.maxPosition() && this.images().length % 2 === 0) return `translateX(${half}px)`;
    return 'none';
  });

  private readonly turnGen = new Map<number, number>();
  private gen = 0;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private swipeStart: { x: number; y: number } | null = null;
  private swiped = false;

  constructor() {
    effect(() => this.pageChange.emit(this.pageOf(this.position())));
  }

  next(): void {
    this.move(this.position() + 1);
  }

  prev(): void {
    this.move(this.position() - 1);
  }

  /** @param page zero-based image index */
  goTo(page: number): void {
    this.move(this.toPosition(page, this.double()));
  }

  ngOnDestroy(): void {
    this.timers.forEach(clearTimeout);
  }

  protected zIndex(index: number): number {
    const flipped = index < this.position();
    const base = flipped ? index : this.leaves().length - index;
    return this.turning().has(index) ? 1000 + base : base;
  }

  protected zoneClick(direction: 1 | -1): void {
    if (this.swiped) {
      this.swiped = false;
      return;
    }
    if (direction === 1) this.next();
    else this.prev();
  }

  protected onPointerDown(event: PointerEvent): void {
    this.swiped = false;
    this.swipeStart = { x: event.clientX, y: event.clientY };
  }

  protected onPointerUp(event: PointerEvent): void {
    const start = this.swipeStart;
    this.swipeStart = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    this.swiped = true;
    if (dx < 0) this.next();
    else this.prev();
  }

  private move(target: number): void {
    const from = this.position();
    const to = this.clamp(target);
    if (from === to) return;

    const distance = Math.abs(to - from);
    // A long jump cascades: each sheet starts a little after the previous one.
    const step = distance > 1 ? Math.min(MAX_STAGGER_MS, JUMP_SPREAD_MS / (distance - 1)) : 0;
    const gen = ++this.gen;
    const moved: number[] = [];
    for (let i = 0; i < distance; i++) {
      const leaf = to > from ? from + i : from - 1 - i;
      this.delays[leaf] = i * step;
      this.turnGen.set(leaf, gen);
      moved.push(leaf);
    }

    this.turning.update((set) => new Set([...set, ...moved]));
    this.position.set(to);

    const timer = setTimeout(
      () => {
        this.timers.delete(timer);
        this.turning.update((set) => {
          const rest = new Set(set);
          moved.forEach((leaf) => {
            if (this.turnGen.get(leaf) === gen) rest.delete(leaf);
          });
          return rest;
        });
      },
      TURN_MS + (distance - 1) * step + 60,
    );
    this.timers.add(timer);
  }

  private toPosition(page: number, double: boolean): number {
    return double ? Math.ceil(page / 2) : page;
  }

  private pageOf(position: number): number {
    return this.double() ? (position === 0 ? 0 : 2 * position - 1) : position;
  }

  private clamp(position: number): number {
    return Math.min(Math.max(position, 0), this.maxPosition());
  }
}
