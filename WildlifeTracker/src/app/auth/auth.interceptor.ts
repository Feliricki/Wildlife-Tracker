import { Injectable } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor() {
    return;
  }

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    let cloned = request.clone();

    // Only attach the token if sending a request to my backend
    if (cloned.url.startsWith("/api")){
      if (localStorage.getItem("WildlifeTrackerToken") !== null){
        cloned = cloned.clone({
          setHeaders: {
            Authorization: `Bearer ${localStorage.getItem("WildlifeTrackerToken")}`
          }
        });
      }
    }

    if (request.method === "JSONP") {
      return next.handle(cloned);
    }
    return next.handle(cloned);
  }
}
