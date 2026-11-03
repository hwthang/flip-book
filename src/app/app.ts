import { Component, OnDestroy, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ImageSessionService } from './core/services/image-session.service';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  template: '<router-outlet />',
})
export class App implements OnDestroy {
  private readonly session = inject(ImageSessionService);

  ngOnDestroy(): void {
    this.session.clear();
  }
}
