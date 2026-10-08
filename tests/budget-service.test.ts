import { describe, expect, it, vi } from 'vitest';
import { createBudgetService } from '../src/domain/budget-service';
import type { BudgetRepository } from '../src/domain/ports';
import { BudgetError, emptyBudget } from '../src/domain/budget';
import { budgetFiles } from '../src/data/budget-files';
import { budget, legacyBackup, rent } from './fixtures';

function setup() {
  let current = emptyBudget();
  const repository: BudgetRepository = {
    load: vi.fn(() => current),
    save: vi.fn((next) => {
      current = next;
    }),
    subscribe: () => () => {},
  };
  const service = createBudgetService(repository, budgetFiles, () => 'generated-id');
  return {
    repository,
    service,
    externalWrite: (next: typeof current) => {
      current = next;
    },
  };
}

describe('application transactions', () => {
  it('creates, marks, edits and removes through the repository contract', () => {
    const { service } = setup();
    service.saveEntry({ entry: rent, month: '2024-02', paid: true });
    expect(service.load().entries[0]?.id).toBe('generated-id');
    expect(service.load().paid['generated-id:2024-01']).toBe(true);
    service.markPaid('generated-id', '2024-02', true);
    service.saveEntry({
      id: 'generated-id',
      entry: { ...rent, amount: 5000000 },
      month: '2024-02',
      paid: true,
    });
    expect(service.load().entries[0]?.amount).toBe(5000000);
    service.removeEntry('generated-id');
    expect(service.load()).toEqual(emptyBudget());
  });
  it('reads latest persisted state before a command, preserving other-tab additions', () => {
    const { service, externalWrite } = setup();
    service.load();
    externalWrite(budget());
    service.saveEntry({ entry: { ...rent, title: 'Новая' }, month: '2024-01', paid: false });
    expect(service.load().entries).toHaveLength(2);
  });
  it('does not write on validation or read failure; propagates write failure', () => {
    const { service, repository } = setup();
    expect(() =>
      service.saveEntry({ entry: { ...rent, amount: 0 }, month: '2024-01', paid: false }),
    ).toThrow(BudgetError);
    expect(repository.save).not.toHaveBeenCalled();
    vi.mocked(repository.load).mockImplementation(() => {
      throw new BudgetError('storage-read');
    });
    expect(() => service.saveEntry({ entry: rent, month: '2024-01', paid: false })).toThrow(
      BudgetError,
    );
    expect(repository.save).not.toHaveBeenCalled();
    vi.mocked(repository.save).mockImplementation(() => {
      throw new BudgetError('storage-write');
    });
    expect(() => service.restore(legacyBackup)).toThrow(BudgetError);
  });
  it('previewing an import does not save; invalid import never overwrites', () => {
    const { service, repository } = setup();
    service.readBackup(legacyBackup);
    expect(repository.save).not.toHaveBeenCalled();
    expect(() => service.restore('{')).toThrow(BudgetError);
    expect(repository.save).not.toHaveBeenCalled();
    service.restore(legacyBackup);
    expect(JSON.parse(service.exportBackup())).toEqual(JSON.parse(legacyBackup));
  });
  it('rejects an edit of an entry deleted in another tab', () => {
    const { service, repository } = setup();
    expect(() =>
      service.saveEntry({ id: 'rent', entry: rent, month: '2024-01', paid: false }),
    ).toThrow(BudgetError);
    expect(repository.save).not.toHaveBeenCalled();
  });
});
