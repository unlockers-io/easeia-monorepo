export type DomainErrorIssue = { message: string; path: string };

export type DomainErrorStatus = 400 | 401 | 403 | 404 | 409 | 422 | 500;

export class DomainError extends Error {
  readonly code: string;
  readonly httpStatus: DomainErrorStatus;
  readonly issues?: ReadonlyArray<DomainErrorIssue>;

  constructor(
    message: string,
    code: string,
    httpStatus: DomainErrorStatus,
    issues?: ReadonlyArray<DomainErrorIssue>,
  ) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
    this.issues = issues;
  }
}
