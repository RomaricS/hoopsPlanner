import { Component, inject, signal } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { SidebarComponent } from "../sidebar/sidebar.component";
import { NgClass } from '@angular/common';
import { NavbarComponent } from '../navbar/navbar.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [SidebarComponent, NgClass, NavbarComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  private authService = inject(AuthService);

  showSidebar = signal<boolean>(false);
  collapseShow = "hidden";
  logout(): void {
    console.log('out')
    this.authService.logout();
  }

  toggleMenu(): void {
    this.showSidebar.update(state => !state);
  }
}
