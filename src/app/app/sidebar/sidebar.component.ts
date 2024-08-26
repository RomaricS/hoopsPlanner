import { NgStyle } from '@angular/common';
import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [NgStyle],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  showSidebar = input<boolean>(false);

  toggleMenu = output();
  logout = output();

  logoutFn(): boolean {
    this.logout.emit();
    return false;
  }
}
