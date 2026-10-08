import { BudgetError, validMonth } from '../domain/budget';
import type { BudgetErrorCode, Category } from '../domain/budget';

export const categoryLabels: Record<Category, string> = {
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

export const money = (cents: number): string =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100);

export function localDate(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function shiftMonth(month: string, delta: number): string {
  const date = new Date(`${month}-15T12:00:00`);
  date.setMonth(date.getMonth() + delta);
  const next = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  return validMonth(next) ? next : month;
}

export const repeatText = (interval: number): string =>
  interval === 0
    ? 'Не повторять'
    : interval === 1
      ? 'Ежемесячно'
      : interval === 12
        ? 'Ежегодно'
        : `Раз в ${interval} мес.`;

const errorMessages: Record<BudgetErrorCode, string> = {
  'invalid-entry': 'Проверьте название, сумму, период повторения и даты операции.',
  'invalid-month': 'Выберите корректный месяц.',
  'invalid-backup': 'Файл повреждён или не является резервной копией «Баланса».',
  'unsupported-version': 'Эта версия резервной копии не поддерживается.',
  'entry-not-found': 'Операция уже изменена или удалена. Обновите страницу.',
  'entry-limit': 'Достигнут лимит: 10 000 операций.',
  'storage-read':
    'Не удалось прочитать сохранённые данные. Они не перезаписаны. Проверьте доступ к хранилищу или загрузите JSON-копию.',
  'storage-write': 'Не удалось сохранить данные. Проверьте доступ к хранилищу и свободное место.',
  'file-too-large': 'Файл слишком большой. Максимум — 5 МБ.',
};

export function errorMessage(error: unknown): string {
  return error instanceof BudgetError
    ? errorMessages[error.code]
    : 'Не удалось выполнить действие. Попробуйте ещё раз.';
}
