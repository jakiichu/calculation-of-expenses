import type { Budget, Entry } from '../src/domain/budget';

export const rent: Entry = {
  id: 'rent',
  title: 'Аренда',
  type: 'expense',
  amount: 4500000,
  date: '2024-01-31',
  interval: 1,
  end: '',
  category: 'housing',
};

export const budget = (entries: readonly Entry[] = [rent]): Budget => ({ entries, paid: {} });

// Actual version-1 shape emitted before the React migration.
export const legacyBackup = JSON.stringify({
  version: 1,
  entries: [
    {
      id: 'rent',
      title: 'Аренда',
      type: 'expense',
      amount: 4500000,
      date: '2024-01-31',
      interval: 1,
      end: '',
      category: 'Жильё',
    },
  ],
  paid: { 'rent:2024-02': true },
});
