import { inject, Injectable, signal } from '@angular/core';
import {
  Auth,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  user,
  UserCredential,
} from '@angular/fire/auth';
import { from, Observable } from 'rxjs';
import { User } from '../model/user';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private firebaseAuth = inject(Auth);

  user$ = user(this.firebaseAuth);
  currentUserSig = signal<Omit<User, 'password'> | null | undefined>(undefined);

  register({ username, email, password }: User): Observable<void> {
    const promise = createUserWithEmailAndPassword(
      this.firebaseAuth,
      email,
      password
    ).then((resp) => updateProfile(resp.user, { displayName: username }));

    return from(promise);
  }

  login ({ email, password}: Omit<User, 'username'>): Observable<void> {
    const promise = signInWithEmailAndPassword(
      this.firebaseAuth,
      email,
      password
    ).then(() => {});

    return from(promise);
  }

  googleAuth(): Promise<UserCredential> {
    return signInWithPopup(this.firebaseAuth, new GoogleAuthProvider())
  }

  logout(): Observable<void> {
    return from(signOut(this.firebaseAuth));
  }
}
