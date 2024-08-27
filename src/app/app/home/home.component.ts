import { Component, inject, OnInit, signal } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { SidebarComponent } from "../sidebar/sidebar.component";
import { NgClass } from '@angular/common';
import { NavbarComponent } from '../navbar/navbar.component';
import { ActivatedRoute } from '@angular/router';


@Component({
  selector: 'app-home',
  standalone: true,
  imports: [SidebarComponent, NgClass, NavbarComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);

  showSidebar = signal<boolean>(false);
  collapseShow = "hidden";

  ngOnInit(): void {
    if (this.route.snapshot?.url[0]?.path === 'logout') {
      this.logout();
    }
  }

  logout(): void {
    this.authService.logout();
  }

  toggleMenu(): void {
    this.showSidebar.update(state => !state);
  }
}
