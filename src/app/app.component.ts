import { AuthService } from './app/services/auth.service';
import { HomeComponent } from './app/home/home.component';
import { Component, inject, OnInit, signal } from '@angular/core';
import { NgClass } from '@angular/common';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { NavbarComponent } from './app/navbar/navbar.component';
import { SidebarComponent } from './app/sidebar/sidebar.component';
import { User } from './app/model/user';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    HomeComponent,
    SidebarComponent,
    NgClass,
    NavbarComponent,
    RouterOutlet,
  ],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);

  showSidebar = signal<boolean>(false);
  collapseShow = 'hidden';

  currentUserSig = signal<Omit<User, 'password'> | null>(null);

  ngOnInit(): void {
    this.authService.user$.subscribe((user: any) => {
      if (!user) {
        this.authService.currentUserSig.set(null);
        return;
      }
      this.authService.currentUserSig.set({
        email: user.email!,
        username: user.displayName!,
        photoURL: user.photoURL!,
        uid: user.uid!,
      });
    });
    if (this.route.snapshot?.url[0]?.path === 'logout') {
      this.logout();
    }
  }

  logout(): void {
    this.authService.logout();
  }

  toggleMenu(): void {
    this.showSidebar.update((state) => !state);
  }
}
