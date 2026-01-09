export interface LimitExceededDetails {
  limitKey: string;
  allowed: number;
  current: number;
  scope: 'user' | 'global' | 'scenario';
}

export class LimitExceededError extends Error {
  readonly code = 'LIMIT_EXCEEDED';
  constructor(public readonly details: LimitExceededDetails, message = 'Limit exceeded') {
    super(message);
    this.name = 'LimitExceededError';
  }
}
