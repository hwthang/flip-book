import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ImageSessionService } from '../../../../core/services/image-session.service';
import { PresentationService } from '../../../presentation/services/presentation.service';
import { ImageGrid } from '../../components/image-grid/image-grid';
import { ImageUploader } from '../../components/image-uploader/image-uploader';

@Component({
  selector: 'app-image-manager-page',
  imports: [ImageUploader, ImageGrid],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="sticky top-0 z-10 border-b border-stone-200 bg-white/90 backdrop-blur">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div>
          <h1 class="text-xl font-bold tracking-tight">📖 FlipBook</h1>
          <p class="hidden text-xs text-stone-500 sm:block">Turn Your Images Into A Flipbook.</p>
        </div>
        <button
          type="button"
          class="rounded-lg bg-indigo-600 px-5 py-2 font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-stone-300"
          [disabled]="session.images().length === 0"
          (click)="presentation.open()"
        >
          Chiếu
        </button>
      </div>
    </header>

    <main class="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <app-image-uploader />
      @if (session.images().length) {
        <p class="text-sm text-stone-500">
          {{ session.images().length }} ảnh · kéo thả để sắp xếp thứ tự trang
        </p>
        <app-image-grid />
      }
    </main>
  `,
})
export class ImageManagerPage {
  protected readonly session = inject(ImageSessionService);
  protected readonly presentation = inject(PresentationService);
}
