import { Routes } from '@angular/router';
import { AuthenticationComponent } from './app/authentication/authentication.component';
import { RegisterComponent } from './app/register/register.component';
import { HomeComponent } from './app/home/home.component';
import { AuthGuard } from './app/guards/auth-guard';

export const routes: Routes = [
  { path: 'home', component: HomeComponent, canActivate: [AuthGuard] },
  { path: 'logout', component: HomeComponent, canActivate: [AuthGuard] },
  { path: 'login', component: AuthenticationComponent },
  { path: 'register', component: RegisterComponent },
  { path: '', redirectTo: '/home', pathMatch: 'full' },
];
