import { describe, expect, it } from 'vitest';
import { budgetFiles } from '../src/data/budget-files';
import { BudgetError, occurrences } from '../src/domain/budget';
import { budget, legacyBackup, rent } from './fixtures';

describe('version-1 backups and CSV', () => {
  it('reads old backups and exports the same format with all marks intact', () => {
    const restored = budgetFiles.decode(legacyBackup);
    expect(restored).toEqual({ ...budget(), paid: { 'rent:2024-02': true } });
    expect(JSON.parse(budgetFiles.encode(restored))).toEqual(JSON.parse(legacyBackup));
    expect(budgetFiles.decode(budgetFiles.encode(restored))).toEqual(restored);
  });
  it('rejects malformed and unsupported documents before replacing anything', () => {
    const entry = { ...rent, category: 'Жильё' };
    for (const value of [
      null,
      {},
      { version: 2 },
      { version: 1, entries: [entry, entry], paid: {} },
      { version: 1, entries: [{ ...entry, amount: '100' }], paid: {} },
      { version: 1, entries: [{ ...entry, amount: -1 }], paid: {} },
      { version: 1, entries: [entry], paid: { 'missing:2024-01': true } },
      { version: 1, entries: [entry], paid: { 'rent:2024-13': true } },
      { version: 1, entries: [entry], paid: { 'rent:2024-01': 'true' } },
    ]) {
      expect(() => budgetFiles.decode(JSON.stringify(value))).toThrow(BudgetError);
    }
    expect(() => budgetFiles.decode('{')).toThrow(BudgetError);
  });
  it('escapes Excel formulas and quotes, preserves decimal amounts and UTF-8 BOM', () => {
    const rows = occurrences(budget([{ ...rent, title: '=SUM(1;2)"' }]), '2024-01');
    const csv = budgetFiles.csv(rows);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"\'=SUM(1;2)"""');
    expect(csv).toContain('"45000,00"');
    expect(csv).toContain('"Жильё"');
  });
});
