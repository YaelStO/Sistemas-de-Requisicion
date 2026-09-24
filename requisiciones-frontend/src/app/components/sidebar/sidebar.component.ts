import { Component, Input, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { RequisicionService } from '../../services/requisicion.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent implements OnInit {
  @Input() activo = 'inicio';

  notificacionesCount = 0;
  colapsada = false;

  private authService = inject(AuthService);
  private requisicionService = inject(RequisicionService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);

  ngOnInit(): void {
    this.requisicionService.notificaciones().subscribe({
      next: (data) => {
        this.notificacionesCount = data.length;
        this.cdr.markForCheck();
      },
      error: () => {
        this.notificacionesCount = 0;
        this.cdr.markForCheck();
      }
    });
  }

  get esDireccionGeneral(): boolean {
    return this.authService.rol === 'ROLE_DIRECCION_GENERAL';
  }

  get esDepartamento(): boolean {
    return this.authService.rol === 'ROLE_DEPARTAMENTO';
  }

  get esMateriales(): boolean {
    return this.authService.rol === 'ROLE_MATERIALES';
  }

  get authUsuario(): string {
    return this.authService.usuario?.username ?? '—';
  }

  get inicial(): string {
    return (this.authUsuario || '—').charAt(0).toUpperCase();
  }

  toggle(): void {
    this.colapsada = !this.colapsada;
    this.cdr.markForCheck();
  }

  get rolEtiqueta(): string {
    const rol = this.authService.rol;
    switch (rol) {
      case 'ROLE_DEPARTAMENTO': return 'DEPARTAMENTO';
      case 'ROLE_COORDINACION': return 'COORDINACIÓN';
      case 'ROLE_DIRECCION': return 'DIRECCIÓN';
      case 'ROLE_DIRECCION_GENERAL': return 'DIRECCIÓN GENERAL';
      case 'ROLE_MATERIALES': return 'MATERIALES';
      default: return 'USUARIO';
    }
  }

  cerrarSesion(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}