import { Component, inject, OnInit } from '@angular/core';
import { AuthService } from './app/services/auth.service';
import { HomeComponent } from "./app/home/home.component";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [HomeComponent],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  private authService = inject(AuthService);

  ngOnInit(): void {
    this.authService.user$.subscribe((user: any) => {
      if (!user) {
        this.authService.currentUserSig.set(null);
        return;
      }
      this.authService.currentUserSig.set({
        email: user.email!,
        username: user.displayName!,
      });
    });
  }
}
