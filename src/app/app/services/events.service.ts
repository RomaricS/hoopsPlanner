import { inject, Injectable, signal } from '@angular/core';
import { Event, EventStatus } from '../model/event';
import {
  addDoc,
  collection,
  collectionData,
  CollectionReference,
  DocumentReference,
  Firestore,
  getDocs,
  query,
  where,
} from '@angular/fire/firestore';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class EventsService {
  private firestore = inject(Firestore);
  eventsCollection: CollectionReference | undefined;

  eventsQuerySig = signal<Event[]>([]);

  constructor() {
    this.eventsCollection = collection(this.firestore, 'events');
  }

  createEvent(event: Event): void {
    addDoc(this.eventsCollection!, event).then(
      (documentReference: DocumentReference) => {
        // the documentReference provides access to the newly created document
        console.log(documentReference);
      }
    );
  }

  getAllEvents() {
    return collectionData(this.eventsCollection);
  }

  // Get the ref of the specified event
  async getEventsRef(filter: number): Promise<void> {
    const querySnapshot = await getDocs(this.eventsCollection!);
    querySnapshot.forEach((doc: any) => {
      if (doc.data()?.eventDay === filter) {
        this.eventsQuerySig.set([
          {
            ...doc.data(),
            uid: doc.id,
          }
        ]);
      }
    });
  }

  async getEventsByStatus(
    status: EventStatus = EventStatus.upcoming
  ): Promise<void> {
    const appQuery = query(
      collection(this.firestore, 'events'),
      where('status', '==', status)
    );
    const promise = await collectionData(appQuery);

    promise.subscribe((events: Event[]) => {
      this.getEventsRef(events[0]?.eventDay);
    });
  }
}
