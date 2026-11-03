import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export type DisplayMode = 'single' | 'double';

@Component({
  selector: 'app-presentation-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2 text-slate-700">
      <div class="flex min-w-0 flex-1 items-center gap-3">
        <button type="button" class="btn" aria-label="Đóng" title="Đóng (Esc)" (click)="close.emit()">←</button>
        <span class="hidden truncate font-semibold sm:block">FlipBook</span>
      </div>

      <div class="flex items-center gap-1">
        <button type="button" class="btn" aria-label="Trang đầu" (click)="first.emit()">«</button>
        <button type="button" class="btn" aria-label="Trang trước" (click)="prev.emit()">‹</button>
        <label class="flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-sm tabular-nums">
          <input
            type="number"
            min="1"
            [max]="total()"
            [value]="page()"
            class="w-9 bg-transparent text-right outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            aria-label="Số trang"
            (keydown.enter)="jump($event)"
            (change)="jump($event)"
          />
          <span class="text-slate-400">/ {{ total() }}</span>
        </label>
        <button type="button" class="btn" aria-label="Trang sau" (click)="next.emit()">›</button>
        <button type="button" class="btn" aria-label="Trang cuối" (click)="last.emit()">»</button>
      </div>

      <div class="flex min-w-0 flex-1 items-center justify-end gap-1">
        <div class="hidden items-center sm:flex">
          <button type="button" class="btn" aria-label="Thu nhỏ" (click)="zoomOut.emit()">−</button>
          <span class="w-12 text-center text-sm tabular-nums">{{ zoomPercent() }}%</span>
          <button type="button" class="btn" aria-label="Phóng to" (click)="zoomIn.emit()">+</button>
        </div>
        <div class="hidden rounded-lg bg-slate-100 p-0.5 sm:flex">
          <button
            type="button"
            class="mode"
            [class.active]="mode() === 'single'"
            aria-label="Một trang"
            title="Một trang"
            (click)="modeChange.emit('single')"
          >
            ▯
          </button>
          <button
            type="button"
            class="mode"
            [class.active]="mode() === 'double'"
            [disabled]="!canDouble()"
            aria-label="Hai trang"
            title="Hai trang"
            (click)="modeChange.emit('double')"
          >
            ▯▯
          </button>
        </div>
        <button type="button" class="btn" aria-label="Toàn màn hình" title="Toàn màn hình" (click)="fullscreen.emit()">⛶</button>
      </div>
    </div>
  `,
  styles: `
    .btn {
      min-width: 2.25rem;
      height: 2.25rem;
      border-radius: 0.5rem;
      font-size: 1.25rem;
      line-height: 1;
    }
    .btn:hover {
      background: rgb(241 245 249);
    }
    .mode {
      height: 2rem;
      padding: 0 0.6rem;
      border-radius: 0.4rem;
      font-size: 0.9rem;
    }
    .mode.active {
      background: #fff;
      box-shadow: 0 1px 2px rgb(0 0 0 / 0.15);
    }
    .mode:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  `,
})
export class PresentationToolbar {
  readonly page = input.required<number>();
  readonly total = input.required<number>();
  readonly zoomPercent = input.required<number>();
  readonly mode = input.required<DisplayMode>();
  readonly canDouble = input.required<boolean>();

  readonly close = output<void>();
  readonly first = output<void>();
  readonly prev = output<void>();
  readonly next = output<void>();
  readonly last = output<void>();
  readonly goto = output<number>();
  readonly zoomIn = output<void>();
  readonly zoomOut = output<void>();
  readonly modeChange = output<DisplayMode>();
  readonly fullscreen = output<void>();

  protected jump(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (Number.isFinite(value)) this.goto.emit(value);
  }
}
