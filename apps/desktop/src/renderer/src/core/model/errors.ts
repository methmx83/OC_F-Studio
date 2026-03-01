export interface ValidationIssue {
  field: string;
  message: string;
}

export class ValidationError extends Error {
  public readonly issues: readonly ValidationIssue[];

  public constructor(message: string, issues: ValidationIssue[]) {
    super(message);
    this.name = 'ValidationError';
    this.issues = issues;
  }
}