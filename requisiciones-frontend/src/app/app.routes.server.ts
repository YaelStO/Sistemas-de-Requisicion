import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Server },
  { path: 'login', renderMode: RenderMode.Server },
  { path: 'dashboard', renderMode: RenderMode.Server },
  { path: 'nueva-requisicion', renderMode: RenderMode.Server },
  { path: 'bandeja-solicitudes', renderMode: RenderMode.Server },
  { path: 'autorizacion-detalle/:id', renderMode: RenderMode.Server },
  { path: 'historial-eventos', renderMode: RenderMode.Server },
  { path: 'gestion-usuarios', renderMode: RenderMode.Server },
  { path: '**', renderMode: RenderMode.Server }
];