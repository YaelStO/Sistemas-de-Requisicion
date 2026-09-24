import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  const path = route.routeConfig?.path ?? '';
  if (authService.passwordExpirada && path !== 'cambiar-password') {
    return router.createUrlTree(['/cambiar-password']);
  }

  return true;
};

export const rolGuard = (rolesPermitidos: string[]): CanActivateFn => {
  return (route: ActivatedRouteSnapshot) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isAuthenticated()) {
      return router.createUrlTree(['/login']);
    }
    const path = route.routeConfig?.path ?? '';
    if (authService.passwordExpirada && path !== 'cambiar-password') {
      return router.createUrlTree(['/cambiar-password']);
    }
    const rolActual = authService.rol;
    if (rolActual && rolesPermitidos.includes(rolActual)) {
      return true;
    }
    if (rolActual === 'ROLE_MATERIALES') {
      return router.createUrlTree(['/materiales']);
    }
    return router.createUrlTree(['/nueva-requisicion']);
  };
};