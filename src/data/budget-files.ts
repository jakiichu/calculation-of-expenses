import { BudgetError, validMonth, validateEntry } from '../domain/budget';
import type { Budget, Category, Entry, Occurrence } from '../domain/budget';
import type { BudgetFiles } from '../domain/ports';

// Version 1 uses Russian category names. Keep the wire format compatible with the original app.
const legacyCategories: Record<Category, string> = {
  salary: 'Зарплата',
  housing: 'Жильё',
  groceries: 'Продукты',
  transport: 'Транспорт',
  subscriptions: 'Подписки',
  health: 'Здоровье',
  shopping: 'Покупки',
  leisure: 'Отдых',
  other: 'Другое',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function parseEntry(value: unknown): Entry {
  if (!isRecord(value)) throw new BudgetError('invalid-backup');
  let category: Category | undefined;
  for (const key of Object.keys(legacyCategories) as Category[]) {
    if (legacyCategories[key] === value.category) category = key;
  }
  if (
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    (value.type !== 'income' && value.type !== 'expense') ||
    typeof value.amount !== 'number' ||
    typeof value.date !== 'string' ||
    typeof value.interval !== 'number' ||
    typeof value.end !== 'string' ||
    category === undefined
  )
    throw new BudgetError('invalid-backup');
  return validateEntry({
    id: value.id,
    title: value.title,
    type: value.type,
    amount: value.amount,
    category,
    date: value.date,
    interval: value.interval,
    end: value.end,
  });
}

function decode(text: string): Budget {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new BudgetError('invalid-backup');
  }
  if (!isRecord(value)) throw new BudgetError('invalid-backup');
  if (value.version !== 1) throw new BudgetError('unsupported-version');
  if (!Array.isArray(value.entries) || value.entries.length > 10000 || !isRecord(value.paid))
    throw new BudgetError('invalid-backup');
  let entries: Entry[];
  try {
    entries = value.entries.map(parseEntry);
  } catch {
    throw new BudgetError('invalid-backup');
  }
  const ids = new Set(entries.map((entry) => entry.id));
  if (ids.size !== entries.length) throw new BudgetError('invalid-backup');
  const paid: Record<string, boolean> = {};
  for (const [key, state] of Object.entries(value.paid)) {
    const split = key.lastIndexOf(':');
    if (
      !ids.has(key.slice(0, split)) ||
      !validMonth(key.slice(split + 1)) ||
      typeof state !== 'boolean'
    )
      throw new BudgetError('invalid-backup');
    paid[key] = state;
  }
  return { entries, paid };
}

function csv(rows: readonly Occurrence[]): string {
  const cell = (value: string): string =>
    `"${value.replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"', '""')}"`;
  const values = [
    ['Дата', 'Название', 'Тип', 'Категория', 'Сумма, ₽', 'Статус'],
    ...rows.map((row) => [
      row.date,
      row.title,
      row.type === 'income' ? 'Доход' : 'Расход',
      legacyCategories[row.category],
      (row.amount / 100).toFixed(2).replace('.', ','),
      row.paid ? 'Проведено' : 'План',
    ]),
  ];
  return '\uFEFF' + values.map((row) => row.map(cell).join(';')).join('\r\n');
}

export const budgetFiles: BudgetFiles = {
  decode,
  encode: (budget) =>
    JSON.stringify(
      {
        version: 1,
        entries: budget.entries.map((entry) => ({
          ...entry,
          category: legacyCategories[entry.category],
        })),
        paid: budget.paid,
      },
      null,
      2,
    ),
  csv,
};
