export class DataForSeoError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(`DataForSEO ${status}: ${message}`);
    this.status = status;
  }
}
