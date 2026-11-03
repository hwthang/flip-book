import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/image-manager/pages/image-manager-page/image-manager-page').then(
        (m) => m.ImageManagerPage,
      ),
  },
  { path: '**', redirectTo: '' },
];
