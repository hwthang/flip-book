import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { Injectable, inject } from '@angular/core';
import { FlipbookViewer } from '../components/flipbook-viewer/flipbook-viewer';

@Injectable({ providedIn: 'root' })
export class PresentationService {
  private readonly overlay = inject(Overlay);
  private overlayRef: OverlayRef | null = null;

  open(): void {
    if (this.overlayRef) return;

    const ref = this.overlay.create({
      positionStrategy: this.overlay.position().global().top('0').left('0'),
      width: '100vw',
      height: '100dvh',
      scrollStrategy: this.overlay.scrollStrategies.block(),
      disposeOnNavigation: true,
    });
    this.overlayRef = ref;

    const viewer = ref.attach(new ComponentPortal(FlipbookViewer));
    viewer.instance.closed.subscribe(() => this.close());
    ref.keydownEvents().subscribe((e) => {
      if (e.key === 'Escape') this.close();
    });
  }

  close(): void {
    this.overlayRef?.dispose();
    this.overlayRef = null;
  }
}
