import { FirebaseError } from "firebase/app";

/**
 * Raised when the credentials were right but the address has never been
 * confirmed. Its own type rather than a message, because the login form has
 * something to *say* about it — a link is on its way — that no other failure
 * shares.
 */
export class EmailNotVerifiedError extends Error {
  constructor(readonly email: string) {
    super(`${email} hasn't been verified yet.`);
  }
}

const MESSAGES: Record<string, string> = {
  "auth/email-already-in-use": "An account with that email already exists.",
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/missing-password": "Please enter a password.",
  "auth/missing-email": "Please enter your email address.",
  // Firebase collapses wrong-password / unknown-email into this code when email
  // enumeration protection is on (the default for new projects).
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/user-not-found": "Incorrect email or password.",
  "auth/wrong-password": "Incorrect email or password.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/too-many-requests": "Too many attempts. Try again in a few minutes.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
  "auth/operation-not-allowed":
    "That sign-in method isn't enabled for this Firebase project.",
  // Google popup flow.
  "auth/popup-closed-by-user": "",
  "auth/cancelled-popup-request": "",
  "auth/user-cancelled": "",
  "auth/popup-blocked":
    "Your browser blocked the sign-in popup. Allow popups and try again.",
  "auth/unauthorized-domain":
    "This domain isn't authorized for Google sign-in in your Firebase project.",
  "auth/account-exists-with-different-credential":
    "That email is already registered with a different sign-in method.",
};

/**
 * Human-readable message for an auth failure, or `null` when the failure was
 * the user deliberately backing out (a dismissed popup) and needs no message.
 */
export function authErrorMessage(error: unknown): string | null {
  if (error instanceof EmailNotVerifiedError) {
    return `Verify your email first. We've sent a fresh link to ${error.email} — open it, then log in.`;
  }
  if (error instanceof FirebaseError) {
    const message = MESSAGES[error.code];
    if (message === "") return null;
    return message ?? "Something went wrong. Please try again.";
  }
  return "Something went wrong. Please try again.";
}
