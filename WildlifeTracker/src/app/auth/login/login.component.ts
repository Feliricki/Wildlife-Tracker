import { Component, OnInit } from '@angular/core';
import {  Router, RouterLink } from '@angular/router';
import { FormGroup, FormControl, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';

import { BaseFormComponent } from '../../base-form.component';
import { AuthService } from '../auth.service';
import { LoginRequest } from '../login-request';
import { LoginResult } from '../login-result';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { CommonModule, NgIf } from '@angular/common';
import { NavigationSchematicComponent } from '../../schematics/navigation-schematic/navigation-schematic.component';

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.css'],
    imports: [FormsModule, ReactiveFormsModule, NgIf, CommonModule,
        MatFormFieldModule, MatInputModule,
        MatButtonModule, MatIconModule, RouterLink]
})
export class LoginComponent extends BaseFormComponent implements OnInit {
  title?: string;
  loginResult?: LoginResult;
  hide = true;

  constructor(
    private router: Router,
    private authService: AuthService) {
    super();
  }

  ngOnInit(): void {
    this.form = new FormGroup({
      username: new FormControl('', Validators.required),
      password: new FormControl('', Validators.required)
    });
  }

  onSubmit() {
    const loginRequest = <LoginRequest>{};
    loginRequest.username = this.form.controls['username'].value;
    loginRequest.password = this.form.controls['password'].value;

    this.authService
      .login(loginRequest)
      .subscribe({
        next: (response) => {
          this.loginResult = response;
          if (response.success) {
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
