import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-cambiar-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SidebarComponent],
  templateUrl: './cambiar-password.component.html',
  styleUrl: './cambiar-password.component.scss'
})
export class CambiarPasswordComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  username = this.authService.usuario?.username ?? '';
  passwordActual = '';
  passwordNueva = '';
  confirmar = '';
  mensaje = '';
  error = '';
  guardando = false;

  get esObligatorio(): boolean {
    return this.authService.passwordExpirada;
  }

  get usernameOriginal(): string {
    return this.authService.usuario?.username ?? '';
  }

  get cambiaUsuario(): boolean {
    return this.username.trim() !== this.usernameOriginal;
  }

  cambiar(): void {
    this.mensaje = '';
    this.error = '';

    if (!this.username.trim()) {
      this.error = 'Ingresa tu nombre de usuario de acceso.';
      this.cdr.markForCheck();
      return;
    }
    if (!this.passwordActual) {
      this.error = 'Ingresa tu contraseña actual.';
      this.cdr.markForCheck();
      return;
    }

    const hayPasswordNueva = !!this.passwordNueva;
    if (hayPasswordNueva && this.passwordNueva.length < 6) {
      this.error = 'La nueva contraseña debe tener al menos 6 caracteres.';
      this.cdr.markForCheck();
      return;
    }
    if (hayPasswordNueva && this.passwordNueva !== this.confirmar) {
      this.error = 'Las contraseñas no coinciden.';
      this.cdr.markForCheck();
      return;
    }
    if (hayPasswordNueva && this.passwordNueva === this.passwordActual) {
      this.error = 'La nueva contraseña debe ser diferente a la actual.';
      this.cdr.markForCheck();
      return;
    }

    this.guardando = true;
    this.cdr.markForCheck();

    const usernameNuevo = this.cambiaUsuario ? this.username.trim() : null;
    this.authService
      .cambiarPassword(this.passwordActual, hayPasswordNueva ? this.passwordNueva : '', usernameNuevo)
      .subscribe({
        next: () => {
          this.guardando = false;
          if (hayPasswordNueva) {
            this.authService.marcarPasswordActualizada();
          }
          this.cdr.markForCheck();

          if (this.cambiaUsuario) {
            this.authService.logout();
            setTimeout(() => this.router.navigate(['/login']), 600);
            this.mensaje = 'Usuario actualizado. Inicia sesión con tu nuevo usuario de acceso.';
          } else {
            this.mensaje = 'Contraseña actualizada correctamente.';
            setTimeout(() => this.router.navigate(['/dashboard']), 800);
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.guardando = false;
          this.error = typeof err.error === 'string' ? err.error : 'No se pudieron actualizar tus credenciales.';
          this.cdr.markForCheck();
        }
      });
  }
}