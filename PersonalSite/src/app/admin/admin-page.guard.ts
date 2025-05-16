import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { map } from 'rxjs';

export const adminPageGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  return authService.hasAdminAuthorization().pipe(
    map((status) => {
      if (!status) {
        // NOTE:Redirect on a failed validation result
        return router.createUrlTree(["/page-not-found"]);
      }

      return true;
    })
  )
};
