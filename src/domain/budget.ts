export const categoryIds = [
  'salary',
  'housing',
  'groceries',
  'transport',
  'subscriptions',
  'health',
  'shopping',
  'leisure',
  'other',
] as const;
export type Category = (typeof categoryIds)[number];
export type EntryType = 'income' | 'expense';

export interface Entry {
  readonly id: string;
  readonly title: string;
  readonly type: EntryType;
  /** Integer kopecks. */
  readonly amount: number;
  readonly category: Category;
  readonly date: string;
  /** 0 = one-off; otherwise an interval in months. */
  readonly interval: number;
  readonly end: string;
}

export interface Budget {
  readonly entries: readonly Entry[];
  readonly paid: Readonly<Record<string, boolean>>;
}

export interface Occurrence extends Entry {
  readonly key: string;
  readonly paid: boolean;
}

export type BudgetErrorCode =
  | 'invalid-entry'
  | 'invalid-month'
  | 'invalid-backup'
  | 'unsupported-version'
  | 'entry-not-found'
  | 'entry-limit'
  | 'storage-read'
  | 'storage-write'
  | 'file-too-large';

export class BudgetError extends Error {
  constructor(readonly code: BudgetErrorCode) {
    super(code);
    this.name = 'BudgetError';
  }
}

export const emptyBudget = (): Budget => ({ entries: [], paid: {} });

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '9999-12-31')
    return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const validMonth = (month: string): boolean => validDate(`${month}-01`);

export function validateEntry(entry: Entry): Entry {
  if (
    !/^[a-zA-Z0-9-]{1,80}$/.test(entry.id) ||
    !entry.title.trim() ||
    entry.title.length > 100 ||
    !['income', 'expense'].includes(entry.type) ||
    !categoryIds.includes(entry.category) ||
    !Number.isSafeInteger(entry.amount) ||
    entry.amount <= 0 ||
    entry.amount > 100000000000 ||
    !validDate(entry.date) ||
    !Number.isInteger(entry.interval) ||
    entry.interval < 0 ||
    entry.interval > 120 ||
    (entry.end !== '' && (!validDate(entry.end) || entry.end < entry.date))
  ) {
    throw new BudgetError('invalid-entry');
  }
  return { ...entry, title: entry.title.trim() };
}

const monthNumber = (value: string): number =>
  Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7)) - 1;

export function occurrences(budget: Budget, month: string): Occurrence[] {
  if (!validMonth(month)) throw new BudgetError('invalid-month');
  return budget.entries
    .flatMap((entry): Occurrence[] => {
      const difference = monthNumber(month) - monthNumber(entry.date);
      if (
        difference < 0 ||
        (entry.interval === 0 ? difference !== 0 : difference % entry.interval !== 0)
      )
        return [];
      const lastDay = new Date(
        Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
      ).getUTCDate();
      const day = Math.min(Number(entry.date.slice(8)), lastDay);
      const date = `${month}-${String(day).padStart(2, '0')}`;
      if (entry.end && date > entry.end) return [];
      const key = `${entry.id}:${month}`;
      return [{ ...entry, date, key, paid: budget.paid[key] === true }];
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

export function totals(rows: readonly Occurrence[]) {
  const result = { income: 0, expense: 0, received: 0, spent: 0 };
  for (const row of rows) {
    result[row.type] += row.amount;
    if (row.paid) result[row.type === 'income' ? 'received' : 'spent'] += row.amount;
  }
  return {
    ...result,
    balance: result.income - result.expense,
    actual: result.received - result.spent,
  };
}

export function saveEntry(
  budget: Budget,
  input: Entry,
  editing: boolean,
  month: string,
  paid: boolean,
): Budget {
  const entry = validateEntry(input);
  if (!validMonth(month)) throw new BudgetError('invalid-month');
  const exists = budget.entries.some((item) => item.id === entry.id);
  if (editing && !exists) throw new BudgetError('entry-not-found');
  if (!editing && exists) throw new BudgetError('invalid-entry');
  if (!editing && budget.entries.length >= 10000) throw new BudgetError('entry-limit');
  const entries = editing
    ? budget.entries.map((item) => (item.id === entry.id ? entry : item))
    : [...budget.entries, entry];
  // An edited schedule may no longer include previously marked months.
  const marks = Object.fromEntries(
    Object.entries(budget.paid).filter(
      ([key]) =>
        !key.startsWith(`${entry.id}:`) ||
        occurrences({ entries: [entry], paid: {} }, key.slice(key.lastIndexOf(':') + 1)).length > 0,
    ),
  );
  if (occurrences({ entries: [entry], paid: {} }, month).length)
    marks[`${entry.id}:${month}`] = paid;
  return { entries, paid: marks };
}

export function removeEntry(budget: Budget, id: string): Budget {
  if (!budget.entries.some((entry) => entry.id === id)) throw new BudgetError('entry-not-found');
  return {
    entries: budget.entries.filter((entry) => entry.id !== id),
    paid: Object.fromEntries(
      Object.entries(budget.paid).filter(([key]) => !key.startsWith(`${id}:`)),
    ),
  };
}

export function markPaid(budget: Budget, id: string, month: string, paid: boolean): Budget {
  if (!occurrences(budget, month).some((entry) => entry.id === id))
    throw new BudgetError('entry-not-found');
  return { ...budget, paid: { ...budget.paid, [`${id}:${month}`]: paid } };
}
