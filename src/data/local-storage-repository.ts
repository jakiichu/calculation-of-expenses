import { BudgetError, emptyBudget } from '../domain/budget';
import type { BudgetFiles, BudgetRepository } from '../domain/ports';

export const storageKey = 'balance-v1';

export function createLocalStorageRepository(
  getStorage: () => Pick<Storage, 'getItem' | 'setItem'>,
  events: Pick<Window, 'addEventListener' | 'removeEventListener'>,
  files: BudgetFiles,
): BudgetRepository {
  return {
    load() {
      try {
        const value = getStorage().getItem(storageKey);
        return value === null ? emptyBudget() : files.decode(value);
      } catch {
        throw new BudgetError('storage-read');
      }
    },
    save(budget) {
      try {
        getStorage().setItem(storageKey, files.encode(budget));
      } catch {
        throw new BudgetError('storage-write');
      }
    },
    subscribe(onChange) {
      const listener = (event: StorageEvent) => {
        if (event.key !== storageKey && event.key !== null) return;
        try {
          if (event.storageArea !== getStorage()) return;
        } catch {
          onChange();
          return;
        }
        onChange();
      };
      events.addEventListener('storage', listener);
      return () => events.removeEventListener('storage', listener);
    },
  };
}
