import { FirebaseError } from "firebase/app";

const MESSAGES: Record<string, string> = {
  "auth/email-already-in-use": "An account with that email already exists.",
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/missing-password": "Please enter a password.",
  // Firebase collapses wrong-password / unknown-email into this code when email
  // enumeration protection is on (the default for new projects).
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/user-not-found": "Incorrect email or password.",
  "auth/wrong-password": "Incorrect email or password.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/too-many-requests": "Too many attempts. Try again in a few minutes.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
  "auth/operation-not-allowed":
    "Email/password sign-in isn't enabled for this Firebase project.",
};

export function authErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    return MESSAGES[error.code] ?? "Something went wrong. Please try again.";
  }
  return "Something went wrong. Please try again.";
}
