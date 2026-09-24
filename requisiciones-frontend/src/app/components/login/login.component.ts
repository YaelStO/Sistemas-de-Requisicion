import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  username = '';
  password = '';
  errorMessage = '';
  loading = false;

  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  onLogin(): void {
    if (!this.username || !this.password) {
      this.errorMessage = 'Ingresa usuario y contraseña';
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    this.authService.login(this.username, this.password).subscribe({
      next: (res) => {
        this.loading = false;
        this.cdr.markForCheck();
        if (res.passwordExpirada) {
          this.router.navigate(['/cambiar-password']);
          return;
        }
        this.router.navigate([res.rol === 'ROLE_MATERIALES' ? '/materiales' : '/nueva-requisicion']);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage =
          typeof err.error === 'string' && err.error
            ? err.error
            : err.status === 401
              ? 'Usuario o contraseña incorrectos'
              : 'No se pudo conectar con el servidor. Verifica que el backend esté activo.';
        this.cdr.markForCheck();
      }
    });
  }
}