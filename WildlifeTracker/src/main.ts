import { importProvidersFrom, isDevMode, inject, provideAppInitializer } from '@angular/core';
import { AppComponent } from './app/app.component';
import { provideAnimations } from '@angular/platform-browser/animations';
import { AppRoutingModule } from './app/app-routing.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { BrowserModule, bootstrapApplication } from '@angular/platform-browser';
import { AuthInterceptor } from './app/auth/auth.interceptor';
import { HTTP_INTERCEPTORS, withInterceptorsFromDi, provideHttpClient } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { authInitializer } from './app/auth/auth-initializer';
import { AuthService } from './app/auth/auth.service';


bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(BrowserModule, FormsModule, ReactiveFormsModule, AppRoutingModule),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    provideAppInitializer(() => {
        const initializerFn = (authInitializer)(inject(AuthService));
        return initializerFn();
      }),
    provideHttpClient(withInterceptorsFromDi()),
    provideAnimations(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
})
  .catch(err => console.error(err));
