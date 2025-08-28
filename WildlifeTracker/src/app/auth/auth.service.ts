import { Injectable, WritableSignal, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, tap, of } from 'rxjs';

import { environment } from './../../environments/environment';
import { LoginRequest } from './login-request';
import { LoginResult } from './login-result';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private _authStatus = new Subject<boolean>();
  public authStatus = this._authStatus.asObservable();

  private tokenKey = "WildlifeTrackerToken";

  private _isAdmin: WritableSignal<boolean> = signal(false);
  public isAdmin = this._isAdmin.asReadonly();

  constructor(private httpClient: HttpClient) {
  }

  hasAdminAuthorization(): Observable<boolean> {
    if (!this.isAuthenticated()) {
      this._isAdmin.set(false);
      return of(false);
    }

    const url = environment.baseUrl + "api/Account/IsAdmin";
    return this.httpClient.get<boolean>(url).pipe(
      tap(response => this._isAdmin.set(response))
    );
  }


  isAuthenticated(): boolean {
    return this.getToken() !== null;
  }

  get getIsAdmin() {
    return this.isAdmin;
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  init(): Observable<boolean> {
    if (this.isAuthenticated())
      this.setAuthStatus(true);

    // we don't care about the result. Just that it updates the
    // the _isAdmin signal appropriately
    return this.hasAdminAuthorization();
  }

  login(loginRequest: LoginRequest): Observable<LoginResult> {
    const url = environment.baseUrl + "api/Account/Login";
    return this.httpClient.post<LoginResult>(url, loginRequest)
      .pipe(
        tap(loginResult => {
          if (loginResult.success && loginResult.token) {
            localStorage.setItem(this.tokenKey, loginResult.token);
            if (loginResult.roles.includes("Administrator")) {
              this._isAdmin.set(true);
            }
            this.setAuthStatus(true);
          }
        }),
      );
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    this.setAuthStatus(false);
    this._isAdmin.set(false);
  }

  private setAuthStatus(isAuthenticated: boolean): void {
    this._authStatus.next(isAuthenticated);
  }
}
