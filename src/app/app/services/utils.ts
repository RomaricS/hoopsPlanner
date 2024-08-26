export const getErrorMessage = (code: string) => {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'There already exists an account with the given email address';
    case 'auth/invalid-email':
      return 'The email address is not valid';
    case 'auth/invalid-credential':
      return 'The email address or password is not valid';
    case 'auth/user-disabled':
      return 'The user corresponding to the given email has been disabled';
    case 'auth/user-not-found':
      return 'There is no user corresponding to the given email';
    case 'auth/wrong-password':
      return 'The password is invalid for the given email';
    default:
      return 'An error occured, try again.';
  }
};
