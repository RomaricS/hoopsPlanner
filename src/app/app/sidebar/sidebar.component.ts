import { NgStyle } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { User } from '@angular/fire/auth';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [NgStyle, RouterLink],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  showSidebar = input<boolean>(false);

  toggleMenu = output();
  logout = output();
}
