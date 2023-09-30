import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormGroup, FormControl, Validators, AbstractControl, AsyncValidatorFn } from '@angular/forms';

import { BaseFormComponent } from '../base-form.component';
import { AuthService } from './auth.service';
import { LoginRequest } from './login-request';
import { LoginResult } from './login-result';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent extends BaseFormComponent implements OnInit {
  title?: string;
  loginResult?: LoginResult;
  hide: boolean = true;

  constructor(
    private activatedRoute: ActivatedRoute,
    private router: Router,
    private authService: AuthService)
  {
    super();
  }

  ngOnInit(): void {
    this.form = new FormGroup({
      username: new FormControl('', Validators.required),
      password: new FormControl('', Validators.required)
    });
  }

  onSubmit() {
    let loginRequest = <LoginRequest>{};
    loginRequest.username = this.form.controls['username'].value;
    loginRequest.password = this.form.controls['password'].value;
    
    this.authService
      .login(loginRequest)
      .subscribe({
        next: (response) => {
          console.log(response);
          this.loginResult = response;
          if (response.success){
            this.router.navigate(['/']);
          }
        },
        error: (err) => {
          console.log(err);
          if (err.status == 401) {
            this.loginResult = err.error;
          }
        },
        complete: () => console.log("Completed get request for Login Component.")
      });
  }
}
