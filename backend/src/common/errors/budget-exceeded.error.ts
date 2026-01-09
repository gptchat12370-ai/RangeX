export interface BudgetExceededDetails {
  currentMonthCost: number;
  projectedSessionCost: number;
  softLimit: number;
  hardLimit: number;
  isHardBlock: boolean;
}

export class BudgetExceededError extends Error {
  readonly code = 'BUDGET_EXCEEDED';
  constructor(public readonly details: BudgetExceededDetails, message = 'Budget exceeded') {
    super(message);
    this.name = 'BudgetExceededError';
  }
}
