import { Routes } from '@angular/router';
import { AuthenticationComponent } from './app/authentication/authentication.component';
import { RegisterComponent } from './app/register/register.component';
import { HomeComponent } from './app/home/home.component';
import { AuthGuard } from './app/guards/auth-guard';
import { CreateEventComponent } from './app/create-event/create-event.component';
import { ListEventsComponent } from './list-events/list-events.component';

export const routes: Routes = [
  { path: 'home', component: HomeComponent, canActivate: [AuthGuard] },
  { path: 'logout', component: HomeComponent, canActivate: [AuthGuard] },
  { path: 'create', component: CreateEventComponent, canActivate: [AuthGuard] },
  { path: 'events', component: ListEventsComponent, canActivate: [AuthGuard] },
  { path: 'login', component: AuthenticationComponent },
  { path: 'register', component: RegisterComponent },
  { path: '', redirectTo: '/home', pathMatch: 'full' },
];
