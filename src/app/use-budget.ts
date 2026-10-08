import { useCallback, useEffect, useState } from 'react';
import type { BudgetService, SaveEntryCommand } from '../domain/budget-service';
import { emptyBudget } from '../domain/budget';
import type { Budget } from '../domain/budget';
import { errorMessage } from './format';

interface BudgetState {
  readonly budget: Budget;
  readonly storageError: string | null;
}

export function useBudget(service: BudgetService) {
  const load = useCallback((): BudgetState => {
    try {
      return { budget: service.load(), storageError: null };
    } catch (error) {
      return { budget: emptyBudget(), storageError: errorMessage(error) };
    }
  }, [service]);
  const [state, setState] = useState(load);
  const [notice, setNotice] = useState<{ message: string } | null>(null);

  useEffect(() => {
    const unsubscribe = service.subscribe(() => setState(load()));
    setState(load());
    return unsubscribe;
  }, [service, load]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  function commit(action: () => Budget, message?: string): void {
    const budget = action();
    setState({ budget, storageError: null });
    if (message) setNotice({ message });
  }

  return {
    ...state,
    notice: notice?.message ?? null,
    notify: (message: string) => setNotice({ message }),
    saveEntry: (command: SaveEntryCommand) =>
      commit(() => service.saveEntry(command), 'Операция сохранена'),
    removeEntry: (id: string) => commit(() => service.removeEntry(id), 'Операция удалена'),
    markPaid: (id: string, month: string, paid: boolean) =>
      commit(() => service.markPaid(id, month, paid)),
    restore: (text: string) => commit(() => service.restore(text), 'Данные восстановлены'),
  };
}
