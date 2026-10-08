import { describe, expect, it } from 'vitest';
import {
  BudgetError,
  markPaid,
  occurrences,
  removeEntry,
  saveEntry,
  totals,
  validateEntry,
} from '../src/domain/budget';
import { budget, rent } from './fixtures';

describe('calendar and money rules', () => {
  it('clamps day 31 for leap and ordinary February without shifting March', () => {
    expect(occurrences(budget(), '2024-02')[0]?.date).toBe('2024-02-29');
    expect(occurrences(budget(), '2024-03')[0]?.date).toBe('2024-03-31');
    expect(occurrences(budget(), '2025-02')[0]?.date).toBe('2025-02-28');
    expect(occurrences(budget(), '2023-12')).toHaveLength(0);
  });
  it('supports one-off, quarterly and yearly operations across years', () => {
    expect(occurrences(budget([{ ...rent, interval: 0 }]), '2024-02')).toHaveLength(0);
    expect(occurrences(budget([{ ...rent, interval: 3 }]), '2024-04')).toHaveLength(1);
    expect(occurrences(budget([{ ...rent, interval: 3 }]), '2024-03')).toHaveLength(0);
    expect(occurrences(budget([{ ...rent, interval: 12 }]), '2025-01')).toHaveLength(1);
  });
  it('includes the end date and excludes later occurrences', () => {
    const data = budget([{ ...rent, end: '2024-02-29' }]);
    expect(occurrences(data, '2024-02')).toHaveLength(1);
    expect(occurrences(data, '2024-03')).toHaveLength(0);
    expect(occurrences(budget([{ ...rent, end: '2024-02-28' }]), '2024-02')).toHaveLength(0);
  });
  it('isolates monthly marks and keeps planned and actual totals separate', () => {
    const data = markPaid(
      budget([rent, { ...rent, id: 'salary', type: 'income', amount: 10000000 }]),
      'salary',
      '2024-01',
      true,
    );
    expect(totals(occurrences(data, '2024-01'))).toEqual({
      income: 10000000,
      expense: 4500000,
      received: 10000000,
      spent: 0,
      balance: 5500000,
      actual: 10000000,
    });
    expect(totals(occurrences(data, '2024-02')).actual).toBe(0);
  });
  it('rejects invalid amounts, dates, intervals and identifiers without a UI', () => {
    for (const change of [
      { amount: -1 },
      { amount: 1.5 },
      { amount: Infinity },
      { date: '2024-02-31' },
      { interval: 1.5 },
      { interval: 121 },
      { end: '2023-12-01' },
      { title: ' ' },
      { id: '../bad' },
    ]) {
      expect(() => validateEntry({ ...rent, ...change })).toThrow(BudgetError);
    }
    expect(() => occurrences(budget(), '2024-13')).toThrow(BudgetError);
  });
  it('cleans marks excluded by an edited schedule without mutating original data', () => {
    const original = markPaid(budget(), 'rent', '2024-02', true);
    const edited = saveEntry(original, { ...rent, interval: 3 }, true, '2024-01', false);
    expect(edited.paid['rent:2024-02']).toBeUndefined();
    expect(original.paid['rent:2024-02']).toBe(true);
  });
  it('removes all series marks but keeps unrelated operations', () => {
    const data = markPaid(budget([rent, { ...rent, id: 'other' }]), 'rent', '2024-02', true);
    const result = removeEntry(data, 'rent');
    expect(result.entries.map((entry) => entry.id)).toEqual(['other']);
    expect(result.paid).toEqual({});
    expect(() => markPaid(result, 'rent', '2024-02', true)).toThrow(BudgetError);
  });
});
