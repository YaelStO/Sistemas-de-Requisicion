import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.token;

  if (!token) {
    return next(req);
  }

  const cloned = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` }
  });

  return next(cloned).pipe(
    catchError((error: HttpErrorResponse) => {
      // 401 = el token ya no es válido (expirado, clave JWT regenerada, usuario
      // desactivado). 403 = el usuario sí está autenticado pero sin permiso, y en
      // ese caso la pantalla debe mostrar el error, no cerrar la sesión.
      if (error.status === 401 && !req.url.includes('/auth/login')) {
        authService.logout();
        inject(Router).navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
