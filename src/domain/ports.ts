import type { Budget, Occurrence } from './budget';

export interface BudgetRepository {
  load(): Budget;
  save(budget: Budget): void;
  subscribe(onChange: () => void): () => void;
}

export interface BudgetFiles {
  decode(text: string): Budget;
  encode(budget: Budget): string;
  csv(rows: readonly Occurrence[]): string;
}
