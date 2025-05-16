import { catchError, of } from "rxjs";
import { AuthService } from "./auth.service";

export function authInitializer(authService: AuthService) {
  return () => authService.init()
    .pipe(
      catchError(() => of())
    );
}
