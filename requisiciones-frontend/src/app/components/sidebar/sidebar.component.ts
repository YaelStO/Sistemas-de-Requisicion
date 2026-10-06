import { Component, Input, inject, OnInit, OnDestroy, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../services/auth.service';
import { RequisicionService } from '../../services/requisicion.service';

const CLAVE_COLAPSADA = 'sidebar:colapsada';

function leerColapsada(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }
  return window.localStorage.getItem(CLAVE_COLAPSADA) === '1';
}

function guardarColapsada(colapsada: boolean): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(CLAVE_COLAPSADA, colapsada ? '1' : '0');
  }
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent implements OnInit, OnDestroy {
  @Input() activo = 'inicio';

  notificacionesCount = 0;
  colapsada = leerColapsada();
  menuAbierto = false;

  private authService = inject(AuthService);
  private requisicionService = inject(RequisicionService);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

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

    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.cerrarMenu());

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.alCambiarTamano);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.alCambiarTamano);
    }
    this.liberarScroll();
  }

  private readonly alCambiarTamano = (): void => {
    if (this.menuAbierto && window.innerWidth > 991) {
      this.cerrarMenu();
    }
  };

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
    guardarColapsada(this.colapsada);
    this.cdr.markForCheck();
  }

  alternarMenu(): void {
    this.menuAbierto = !this.menuAbierto;
    this.actualizarScroll();
    this.cdr.markForCheck();
  }

  cerrarMenu(): void {
    if (!this.menuAbierto) {
      return;
    }
    this.menuAbierto = false;
    this.actualizarScroll();
    this.cdr.markForCheck();
  }

  private actualizarScroll(): void {
    if (typeof document === 'undefined') {
      return;
    }
    document.body.style.overflow = this.menuAbierto ? 'hidden' : '';
  }

  private liberarScroll(): void {
    if (typeof document !== 'undefined' && document.body.style.overflow === 'hidden') {
      document.body.style.overflow = '';
    }
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