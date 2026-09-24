import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { NuevaRequisicionComponent } from './components/nueva-requisicion/nueva-requisicion.component';
import { GestionUsuariosComponent } from './components/gestion-usuarios/gestion-usuarios.component';
import { GestionAreasComponent } from './components/gestion-areas/gestion-areas.component';
import { CambiarPasswordComponent } from './components/cambiar-password/cambiar-password.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { BandejaSolicitudesComponent } from './components/bandeja-solicitudes/bandeja-solicitudes.component';
import { AutorizacionDetalleComponent } from './components/autorizacion-detalle/autorizacion-detalle.component';
import { HistorialEventosComponent } from './components/historial-eventos/historial-eventos.component';
import { SolicitudesEnProcesoComponent } from './components/solicitudes-en-proceso/solicitudes-en-proceso.component';
import { CentroNotificacionesComponent } from './components/centro-notificaciones/centro-notificaciones.component';
import { MaterialesComponent } from './components/materiales/materiales.component';
import { authGuard, rolGuard } from './services/auth.guard';

const ROLES_RECEPTORES = ['ROLE_COORDINACION', 'ROLE_DIRECCION', 'ROLE_DIRECCION_GENERAL', 'ROLE_MATERIALES'];
const ROLES_CREADORES = ['ROLE_DEPARTAMENTO', 'ROLE_COORDINACION', 'ROLE_DIRECCION', 'ROLE_DIRECCION_GENERAL'];

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'cambiar-password', component: CambiarPasswordComponent, canActivate: [authGuard] },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'nueva-requisicion', component: NuevaRequisicionComponent, canActivate: [authGuard, rolGuard(ROLES_CREADORES)] },
  { path: 'bandeja-solicitudes/area/:areaId', component: BandejaSolicitudesComponent, canActivate: [authGuard, rolGuard(ROLES_RECEPTORES)] },
  { path: 'bandeja-solicitudes', component: BandejaSolicitudesComponent, canActivate: [authGuard, rolGuard(ROLES_RECEPTORES)] },
  { path: 'solicitudes-en-proceso', component: SolicitudesEnProcesoComponent, canActivate: [authGuard] },
  { path: 'centro-notificaciones', component: CentroNotificacionesComponent, canActivate: [authGuard] },
  { path: 'autorizacion-detalle/:id', component: AutorizacionDetalleComponent, canActivate: [authGuard] },
  { path: 'historial-eventos', component: HistorialEventosComponent, canActivate: [authGuard] },
  { path: 'historial-eventos/:id', component: HistorialEventosComponent, canActivate: [authGuard] },
  { path: 'gestion-usuarios', component: GestionUsuariosComponent, canActivate: [rolGuard(['ROLE_DIRECCION_GENERAL'])] },
  { path: 'gestion-areas', component: GestionAreasComponent, canActivate: [rolGuard(['ROLE_DIRECCION_GENERAL'])] },
  { path: 'materiales', component: MaterialesComponent, data: { vista: 'aprobadas' }, canActivate: [authGuard, rolGuard(['ROLE_MATERIALES'])] },
  { path: 'materiales/proceso', component: MaterialesComponent, data: { vista: 'proceso' }, canActivate: [authGuard, rolGuard(['ROLE_MATERIALES'])] },
  { path: '**', redirectTo: 'dashboard' }
];