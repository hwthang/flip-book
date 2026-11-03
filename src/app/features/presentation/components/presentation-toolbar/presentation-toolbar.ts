import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-presentation-toolbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center justify-center gap-3 text-white">
      <button type="button" class="btn" aria-label="Trang trước" (click)="prev.emit()">‹</button>
      <span class="min-w-24 text-center text-sm tabular-nums">{{ label() }}</span>
      <button type="button" class="btn" aria-label="Trang sau" (click)="next.emit()">›</button>
      <button type="button" class="btn" aria-label="Toàn màn hình" (click)="fullscreen.emit()">⛶</button>
    </div>
  `,
  styles: `
    .btn {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 9999px;
      background: rgb(255 255 255 / 0.15);
      font-size: 1.25rem;
    }
    .btn:hover {
      background: rgb(255 255 255 / 0.3);
    }
  `,
})
export class PresentationToolbar {
  readonly label = input.required<string>();
  readonly prev = output<void>();
  readonly next = output<void>();
  readonly fullscreen = output<void>();
}
