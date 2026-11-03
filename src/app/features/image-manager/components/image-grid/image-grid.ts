import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ImageSessionService } from '../../../../core/services/image-session.service';

@Component({
  selector: 'app-image-grid',
  imports: [CdkDropList, CdkDrag, CdkDragPlaceholder],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      cdkDropList
      cdkDropListOrientation="mixed"
      class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
      (cdkDropListDropped)="drop($event)"
    >
      @for (image of session.images(); track image.id) {
        <figure
          cdkDrag
          class="group relative cursor-grab overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-stone-200 active:cursor-grabbing"
        >
          <img
            [src]="image.previewUrl"
            [alt]="image.name"
            loading="lazy"
            decoding="async"
            draggable="false"
            class="aspect-[3/4] w-full object-cover"
          />
          <span class="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-xs font-semibold text-white">
            {{ image.order + 1 }}
          </span>
          <button
            type="button"
            class="absolute right-2 top-2 rounded-full bg-black/70 px-2 text-white hover:bg-red-600"
            [attr.aria-label]="'Xóa ' + image.name"
            (click)="session.removeImage(image.id)"
          >
            ✕
          </button>
          <figcaption class="truncate px-2 py-1.5 text-xs text-stone-600">{{ image.name }}</figcaption>
          <div *cdkDragPlaceholder class="aspect-[3/4] rounded-xl bg-indigo-100"></div>
        </figure>
      }
    </div>
  `,
})
export class ImageGrid {
  protected readonly session = inject(ImageSessionService);

  protected drop(event: CdkDragDrop<unknown>): void {
    this.session.moveImage(event.previousIndex, event.currentIndex);
  }
}
