export interface User {
  email: string;
  password: string;
  username: string;
  emailVerified?: boolean;
  photoURL?: string;
  uid?: string;
};
