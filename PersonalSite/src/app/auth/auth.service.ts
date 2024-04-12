import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, tap } from 'rxjs';

import { environment } from './../../environments/environment';
import { LoginRequest } from './login-request';
import { LoginResult } from './login-result';

// TODO: Test this service
@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private _authStatus = new Subject<boolean>();
  public authStatus = this._authStatus.asObservable();
  public tokenKey = "tokenKey";

  constructor(private httpClient: HttpClient) {

  }

  isAuthenticated(): boolean {
    return this.getToken() !== null;
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  init(): void {
    if (this.isAuthenticated())
      this.setAuthStatus(true);
  }

  login(loginRequest: LoginRequest): Observable<LoginResult> {
    const url = environment.baseUrl + "api/Account/Login";
    // The generic type 'LoginResult' is the return type of the response
    return this.httpClient.post<LoginResult>(url, loginRequest)
      .pipe(
        tap(loginResult => {
          if (loginResult.success && loginResult.token) {
            localStorage.setItem(this.tokenKey, loginResult.token);
            this.setAuthStatus(true);
          }
        }),
      );
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    this.setAuthStatus(false);
  }

  private setAuthStatus(isAuthenticated: boolean): void {
    this._authStatus.next(isAuthenticated);
  }
}
