import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor
} from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor() {
    return;
  }

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const cloned = request.clone();
    if (request.method === "JSONP") {
      // TODO : finish implementing CSP here.
      // let cloned = request.clone({
      //   setHeaders: {
      //     "Content-Security-Policy":
      //       "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googleapis.com https://*.gstatic.com *.google.com https://*.ggpht.com *.googleusercontent.com blob:;" +
      //       "img- src 'self' https://*.googleapis.com https://*.gstatic.com *.google.com  *.googleusercontent.com data:;" +
      //       "frame- src *.google.com;connect - src 'self' https://*.googleapis.com *.google.com https://*.gstatic.com  data: blob:;" +
      //       "font - src https://fonts.gstatic.com; style - src 'self' 'unsafe-inline' https://fonts.googleapis.com;" + "worker - src blob: ; "
      //   },
      // });
      console.log("Sending jsonp request with uri: " + cloned.url);
      return next.handle(cloned);
    }
    //let cloned = request.clone();
    return next.handle(request);
  }
}
