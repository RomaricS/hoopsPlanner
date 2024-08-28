import { Component, inject, OnInit, signal } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { NgClass } from '@angular/common';
import { NavbarComponent } from '../navbar/navbar.component';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { User } from '../model/user';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [SidebarComponent, NgClass, NavbarComponent, RouterOutlet],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);

  showSidebar = signal<boolean>(false);
  collapseShow = 'hidden';

  currentUserSig = signal<Omit<User, 'password'> | null>(null);

  ngOnInit(): void {
    this.authService.user$.subscribe((user: any) => {
      if (user) {
        this.currentUserSig.update(() => ({
          email: user.email!,
          username: user.displayName!,
          emailVerified: user.emailVerified,
          photoURL: user.photoURL!,
        }));
      }
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
