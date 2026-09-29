export class GoogleNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleNotConfiguredError";
  }
}

export class GoogleNotConnectedError extends Error {
  constructor(userId: string) {
    super(`No Google connection for user ${userId}`);
    this.name = "GoogleNotConnectedError";
  }
}

export class GoogleAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleAuthError";
  }
}
