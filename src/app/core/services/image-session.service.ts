import { Injectable, signal } from '@angular/core';
import { ImageItem } from '../models/image-item.model';

export const MAX_IMAGES = 100;
export const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

@Injectable({ providedIn: 'root' })
export class ImageSessionService {
  private readonly _images = signal<ImageItem[]>([]);
  private readonly _errors = signal<string[]>([]);

  readonly images = this._images.asReadonly();
  readonly errors = this._errors.asReadonly();
  readonly acceptAttr = ACCEPTED_TYPES.join(',');

  addImages(files: File[]): void {
    const errors: string[] = [];
    const accepted: File[] = [];
    let room = MAX_IMAGES - this._images().length;

    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        errors.push(`"${file.name}" không phải định dạng ảnh được hỗ trợ.`);
      } else if (file.size > MAX_FILE_SIZE) {
        errors.push(`"${file.name}" vượt quá ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
      } else if (room <= 0) {
        errors.push(`"${file.name}" bị bỏ qua: tối đa ${MAX_IMAGES} ảnh.`);
      } else {
        accepted.push(file);
        room--;
      }
    }

    this._errors.set(errors);
    if (!accepted.length) return;

    const added: ImageItem[] = accepted.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      name: file.name,
      order: 0,
    }));
    this._images.update((list) => this.reindex([...list, ...added]));
  }

  removeImage(id: string): void {
    const target = this._images().find((i) => i.id === id);
    if (!target) return;
    URL.revokeObjectURL(target.previewUrl);
    this._images.update((list) => this.reindex(list.filter((i) => i.id !== id)));
  }

  reorderImages(images: ImageItem[]): void {
    this._images.set(this.reindex(images));
  }

  moveImage(from: number, to: number): void {
    if (from === to) return;
    const list = [...this._images()];
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    this.reorderImages(list);
  }

  clearErrors(): void {
    this._errors.set([]);
  }

  clear(): void {
    this._images().forEach((i) => URL.revokeObjectURL(i.previewUrl));
    this._images.set([]);
    this._errors.set([]);
  }

  private reindex(list: ImageItem[]): ImageItem[] {
    return list.map((item, index) => ({ ...item, order: index }));
  }
}
