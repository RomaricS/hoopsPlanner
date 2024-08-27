import { Component, inject, output } from '@angular/core';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
  toggleMenu = output();

  private authService = inject(AuthService);

  username = this.authService.currentUserSig()?.username ?? 'Admin';

  toggleDark() {
    const darkMode = document.querySelector('.dark-mode');
      document.body.classList.toggle('dark-mode-variables');
      darkMode!.querySelector('span:nth-child(1)')!.classList.toggle('active');
      darkMode!.querySelector('span:nth-child(2)')!.classList.toggle('active');
  }
}
