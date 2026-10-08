// @vitest-environment jsdom
import { StrictMode } from 'react';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BudgetApp } from '../src/app/BudgetApp';
import { createBudgetService } from '../src/domain/budget-service';
import { createLocalStorageRepository, storageKey } from '../src/data/local-storage-repository';
import { budgetFiles } from '../src/data/budget-files';
import { legacyBackup } from './fixtures';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function setup() {
  let count = 0;
  const repository = createLocalStorageRepository(() => localStorage, window, budgetFiles);
  const service = createBudgetService(repository, budgetFiles, () => `test-${++count}`);
  render(
    <StrictMode>
      <BudgetApp service={service} />
    </StrictMode>,
  );
  return { user: userEvent.setup(), repository };
}

it('creates a recurring expense, marks one month, edits and deletes the series', async () => {
  const { user, repository } = setup();
  await user.click(screen.getByRole('button', { name: 'Добавить регулярную трату ↗' }));
  await user.type(screen.getByLabelText('Название'), 'Аренда');
  await user.type(screen.getByLabelText('Сумма, ₽'), '45000.50');
  await user.click(screen.getByRole('button', { name: 'Сохранить операцию' }));
  expect(repository.load().entries[0]?.amount).toBe(4500050);
  expect(screen.getByText('Аренда')).toBeTruthy();
  await user.click(screen.getByRole('checkbox', { name: 'Оплачено: Аренда' }));
  await user.click(screen.getByRole('button', { name: 'Следующий месяц' }));
  expect(
    (screen.getByRole('checkbox', { name: 'Оплачено: Аренда' }) as HTMLInputElement).checked,
  ).toBe(false);
  await user.click(screen.getByRole('button', { name: 'Изменить Аренда' }));
  await user.clear(screen.getByLabelText('Название'));
  await user.type(screen.getByLabelText('Название'), 'Квартира');
  await user.click(screen.getByRole('button', { name: 'Сохранить операцию' }));
  expect(repository.load().entries[0]?.title).toBe('Квартира');
  await user.click(screen.getByRole('button', { name: 'Удалить Квартира' }));
  await user.click(screen.getByRole('button', { name: 'Подтвердить' }));
  expect(repository.load()).toEqual({ entries: [], paid: {} });
});

it('does not show a failed write as a successful operation', async () => {
  const { user } = setup();
  await user.click(screen.getByRole('button', { name: '＋ Добавить операцию' }));
  await user.type(screen.getByLabelText('Название'), 'Покупка');
  await user.type(screen.getByLabelText('Сумма, ₽'), '500');
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('quota');
  });
  await user.click(screen.getByRole('button', { name: 'Сохранить операцию' }));
  expect(screen.getByRole('alert').textContent).toContain('Не удалось сохранить');
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(localStorage.getItem(storageKey)).toBeNull();
});

it('imports a legacy backup only after confirmation and allows cancellation', async () => {
  const { user, repository } = setup();
  const file = new File([legacyBackup], 'backup.json', { type: 'application/json' });
  // jsdom does not implement File.text in every supported version.
  Object.defineProperty(file, 'text', { value: async () => legacyBackup });
  await user.upload(screen.getByLabelText('JSON-копия'), file);
  await screen.findByRole('dialog', { name: 'Загрузить резервную копию?' });
  expect(repository.load().entries).toHaveLength(0);
  await user.click(screen.getByRole('button', { name: 'Отмена' }));
  expect(repository.load().entries).toHaveLength(0);
  await user.upload(screen.getByLabelText('JSON-копия'), file);
  await screen.findByRole('dialog', { name: 'Загрузить резервную копию?' });
  await user.click(screen.getByRole('button', { name: 'Подтвердить' }));
  await waitFor(() => expect(repository.load().entries).toHaveLength(1));
  expect(repository.load().paid['rent:2024-02']).toBe(true);
  expect(screen.getByText('Аренда')).toBeTruthy();
});

it('warns about unreadable saved data without replacing it', () => {
  localStorage.setItem(storageKey, '{bad');
  setup();
  expect(screen.getByRole('alert').textContent).toContain('Не удалось прочитать');
  expect(localStorage.getItem(storageKey)).toBe('{bad');
});

it('filters operation names and switches income/expense tabs', async () => {
  localStorage.setItem(storageKey, legacyBackup);
  const { user } = setup();
  await user.click(screen.getByRole('button', { name: 'Доходы' }));
  expect(screen.queryByText('Аренда')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Все' }));
  expect(screen.getByText('Аренда')).toBeTruthy();
  await user.type(screen.getByRole('searchbox'), 'не найдено');
  expect(screen.queryByText('Аренда')).toBeNull();
  expect(screen.getByText('Ничего не нашлось')).toBeTruthy();
});
