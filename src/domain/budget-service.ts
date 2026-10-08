import { markPaid, occurrences, removeEntry, saveEntry } from './budget';
import type { Budget, Entry } from './budget';
import type { BudgetFiles, BudgetRepository } from './ports';

export interface SaveEntryCommand {
  readonly entry: Omit<Entry, 'id'>;
  readonly id?: string;
  readonly month: string;
  readonly paid: boolean;
}

export interface BudgetService {
  load(): Budget;
  subscribe(onChange: () => void): () => void;
  saveEntry(command: SaveEntryCommand): Budget;
  removeEntry(id: string): Budget;
  markPaid(id: string, month: string, paid: boolean): Budget;
  readBackup(text: string): Budget;
  restore(text: string): Budget;
  exportBackup(): string;
  exportMonth(month: string): string;
}

export function createBudgetService(
  repository: BudgetRepository,
  files: BudgetFiles,
  createId: () => string,
): BudgetService {
  function commit(budget: Budget): Budget {
    repository.save(budget);
    return budget;
  }

  return {
    load: () => repository.load(),
    subscribe: (onChange) => repository.subscribe(onChange),
    saveEntry: (command) =>
      commit(
        saveEntry(
          repository.load(),
          { ...command.entry, id: command.id ?? createId() },
          command.id !== undefined,
          command.id ? command.month : command.entry.date.slice(0, 7),
          command.paid,
        ),
      ),
    removeEntry: (id) => commit(removeEntry(repository.load(), id)),
    markPaid: (id, month, paid) => commit(markPaid(repository.load(), id, month, paid)),
    readBackup: (text) => files.decode(text),
    restore: (text) => commit(files.decode(text)),
    exportBackup: () => files.encode(repository.load()),
    exportMonth: (month) => files.csv(occurrences(repository.load(), month)),
  };
}
