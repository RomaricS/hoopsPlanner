export interface Event {
  eventDay: number;
  status: EventStatus;
  fullyPaid: boolean;
  attendees: number;
  price: EventPrice;
  duration: EventDuration;
  startsAt: string;
  players: string[];
  payments: string[];
  id?: string;
};

export enum EventStatus {
  upcoming = 'upcoming',
  past = 'past',
  canceled = 'canceled',
};

export enum EventPrice {
  hour = 60,
  hourHalf = 90,
  double = 120,
  fullHour = 100,
  fullHourHalf = 150,
  fullDouble = 200,
};

export enum EventDuration {
  hour = 60,
  hourHalf = 90,
  double = 120,
};

export interface EventPayment {
  id: string;
  eventId: string;
  playerId: string;
  amount: number;
  paid: boolean;
};
