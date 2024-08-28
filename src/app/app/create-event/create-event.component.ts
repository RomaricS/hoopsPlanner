import { Component, inject } from '@angular/core';
import {
  FormControl,
  FormsModule,
  ReactiveFormsModule
} from '@angular/forms';

import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule, MatLabel } from '@angular/material/form-field';
import { MatSelect } from '@angular/material/select';
import { MatOption, provideNativeDateAdapter } from '@angular/material/core';
import { EventDuration, EventStatus, Event, EventPrice } from '../model/event';
import { EventsService } from '../services/events.service';

@Component({
  selector: 'app-create-event',
  standalone: true,
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatSelect,
    MatLabel,
    MatOption,
    FormsModule,
    ReactiveFormsModule,
  ],
  providers: [provideNativeDateAdapter()],
  templateUrl: './create-event.component.html',
  styleUrl: './create-event.component.scss',
})
export class CreateEventComponent {
  startsAt = new FormControl(null);
  eventDate = new FormControl(null);
  duration = new FormControl<EventDuration>(EventDuration.hour);
  durations = [
    { value: '1 hour', viewValue: EventDuration.hour },
    { value: '1 hour 30', viewValue: EventDuration.hourHalf },
    { value: '2 hours', viewValue: EventDuration.double },
  ];

  private eventsService = inject(EventsService);

  save(): void {
    console.log(this.eventDate.value, this.startsAt.value, this.duration.value);
    if (!this.eventDate.value || !this.startsAt.value || !this.duration.value) {
      return;
    }
    const event: Event = {
      eventDay: (new Date(this.eventDate.value)).getTime(),
      status: EventStatus.upcoming,
      fullyPaid: false,
      attendees: 0,
      price: this.getPrice(this.duration.value),
      duration: this.duration.value,
      startsAt: this.startsAt.value,
      players: [],
      payments: [],
    }
    this.eventsService.createEvent(event);
  }

  private getPrice(duration: EventDuration): EventPrice {
    switch(duration) {
      case EventDuration.hour: return EventPrice.hour;
      case EventDuration.hourHalf: return EventPrice.hourHalf;
      default: return EventPrice.double;
    }
  }
}
