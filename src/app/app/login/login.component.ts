import { NgClass } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { Router, RouterLink } from '@angular/router';
import { User } from '../model/user';
import { getErrorMessage } from '../services/utils';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-auth-form',
  standalone: true,
  imports: [ReactiveFormsModule, NgClass, RouterLink],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  loginForm = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [
      Validators.required,
      Validators.minLength(10),
    ]),
  });

  loginErr = signal<string | null>(null);

  private authService = inject(AuthService);
  private router = inject(Router);
  private _snackBar = inject(MatSnackBar);

  login(): void {
    const { password, email } = this.loginForm.getRawValue();
    const data: Omit<User, 'username'> = {
      password: password!,
      email: email!,
    };
    this.authService.login(data).subscribe({
      next: (_) => {
        this._snackBar.open('Welcome back', undefined, {
          duration: 3000,
        });
        this.router.navigateByUrl('/');
      },
      error: (err) => {
        this.loginForm.reset();
        this.loginErr.set(getErrorMessage(err.code));
        this._snackBar.open(getErrorMessage(err.code), undefined, {
          duration: 3000,
        });
      },
    });
  }

  byGoogle(): void {
    this.loginForm.reset();
    this.authService
      .googleAuth()
      .then(({user}) => {
        this._snackBar.open('Welcome', undefined, {
          duration: 3000,
        });
        this.router.navigateByUrl('/');
      })
      .catch((err) => this._snackBar.open(getErrorMessage(err.code), undefined, {
        duration: 3000,
      }));
  }
}
