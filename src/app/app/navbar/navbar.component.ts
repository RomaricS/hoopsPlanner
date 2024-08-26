import { Component, output } from '@angular/core';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
  toggleMenu = output();

  toggleDark() {
    const darkMode = document.querySelector('.dark-mode');
      document.body.classList.toggle('dark-mode-variables');
      darkMode!.querySelector('span:nth-child(1)')!.classList.toggle('active');
      darkMode!.querySelector('span:nth-child(2)')!.classList.toggle('active');
  }
}
