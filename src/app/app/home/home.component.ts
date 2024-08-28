import { Component, computed, inject, OnInit } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { NgClass } from '@angular/common';
import { NavbarComponent } from '../navbar/navbar.component';
import { ActivatedRoute } from '@angular/router';
import { User } from '../model/user';
import { PlayersListComponent } from '../../players-list/players-list.component';
import { Event, EventStatus } from '../model/event';
import { EventsService } from '../services/events.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [SidebarComponent, NgClass, NavbarComponent, PlayersListComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private authService = inject(AuthService);
  private eventsService = inject(EventsService);
  private route = inject(ActivatedRoute);

  currentUserSig = this.authService.currentUserSig;
  upcomingEventSig = this.eventsService.eventsQuerySig;

  currentPrice = computed(() => {
    const event = this.upcomingEventSig()[0];
    if (event?.attendees > 0) {
      return Math.round(event?.price / event?.attendees);
    }
    return event?.price;
  });

  ngOnInit(): void {
    this.eventsService.getEventsByStatus(EventStatus.upcoming);
    if (this.route.snapshot?.url[0]?.path === 'logout') {
      this.logout();
    }
  }

  logout(): void {
    this.authService.logout();
  }

  formatDate(eventDay: number): string {
    const date = new Date(eventDay);
    return new Intl.DateTimeFormat('fr-FR').format(date);
  }

  addMe(user: Omit<User, 'password'>, ev: Event): void {
    // TODO finish the edit, but check data struct too, not perfect IMo
    console.log(user, ev)
  }
}
