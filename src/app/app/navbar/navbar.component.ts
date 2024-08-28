import { Component, input, output } from '@angular/core';
import { User } from '../model/user';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
  toggleMenu = output();

  currentUser = input.required<Omit<User, 'password'> | null>();

  toggleDark() {
    const darkMode = document.querySelector('.dark-mode');
      document.body.classList.toggle('dark-mode-variables');
      darkMode!.querySelector('span:nth-child(1)')!.classList.toggle('active');
      darkMode!.querySelector('span:nth-child(2)')!.classList.toggle('active');
  }
}
