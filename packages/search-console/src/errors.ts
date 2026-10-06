export class GoogleNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleNotConfiguredError";
  }
}

export class GoogleAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleAuthError";
  }
}
