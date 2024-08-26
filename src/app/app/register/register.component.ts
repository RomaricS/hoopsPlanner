import { NgClass } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { User } from '../model/user';
import { Router, RouterLink } from '@angular/router';
import { getErrorMessage } from '../services/utils';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, NgClass, RouterLink],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  registerForm = new FormGroup({
    username: new FormControl('', [Validators.required]),
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [
      Validators.required,
      Validators.minLength(10),
    ]),
    rePassword: new FormControl('', [
      Validators.required,
      Validators.minLength(10),
      this.confirmPassvalidator(),
    ]),
  });

  private authService = inject(AuthService);
  private router = inject(Router);
  private _snackBar = inject(MatSnackBar);

  registrationErr = signal<string | null>(null);

  create(): void {
    const { username, password, email } = this.registerForm.getRawValue();
    const data: User = {
      username: username!,
      password: password!,
      email: email!,
    };
    this.authService.register(data).subscribe({
      next: (_) => {
        this.router.navigateByUrl('/');
        this._snackBar.open('Welcome to the team', undefined, {
          duration: 3000,
        });
      },
      error: (err) => {
        this.registerForm.reset();
        this.registrationErr.set(getErrorMessage(err.code));
        this._snackBar.open(getErrorMessage(err.code), undefined, {
          duration: 3000,
        });
      },
    });
  }

  // Custom validator for Confirm Password
  confirmPassvalidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value;

      if (!value) {
        return null;
      }

      return this.registerForm.controls.password.value === value
        ? null
        : { passwordMismatch: true };
    };
  }

  byGoogle(): void {
    this.registerForm.reset();
    this.authService
      .googleAuth()
      .then(() => {
        this._snackBar.open('Welcome', undefined, {
          duration: 3000,
        });
        this.router.navigateByUrl('/');
      })
      .catch((err) =>
        this._snackBar.open(getErrorMessage(err.code), undefined, {
          duration: 3000,
        })
      );
  }
}
