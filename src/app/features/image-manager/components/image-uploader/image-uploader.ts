import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ImageSessionService } from '../../../../core/services/image-session.service';

@Component({
  selector: 'app-image-uploader',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label
      class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors"
      [class]="dragging() ? 'border-indigo-500 bg-indigo-50' : 'border-stone-300 bg-white hover:border-indigo-400'"
      (dragover)="onDragOver($event)"
      (dragleave)="dragging.set(false)"
      (drop)="onDrop($event)"
    >
      <span class="text-4xl" aria-hidden="true">🖼️</span>
      <span class="font-medium">Chọn hoặc kéo thả ảnh vào đây</span>
      <span class="text-sm text-stone-500">JPG, PNG, WebP, GIF, AVIF · tối đa 20MB mỗi ảnh</span>
      <input
        type="file"
        multiple
        class="sr-only"
        [accept]="session.acceptAttr"
        (change)="onSelect($event)"
      />
    </label>

    @if (session.errors().length) {
      <div role="alert" class="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        <div class="mb-1 flex items-center justify-between">
          <strong>Một số ảnh không thể tải lên</strong>
          <button type="button" class="underline" (click)="session.clearErrors()">Đóng</button>
        </div>
        <ul class="list-disc pl-5">
          @for (e of session.errors(); track $index) {
            <li>{{ e }}</li>
          }
        </ul>
      </div>
    }
  `,
})
export class ImageUploader {
  protected readonly session = inject(ImageSessionService);
  protected readonly dragging = signal(false);

  protected onSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.session.addImages(Array.from(input.files ?? []));
    input.value = '';
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    this.session.addImages(Array.from(event.dataTransfer?.files ?? []));
  }
}
