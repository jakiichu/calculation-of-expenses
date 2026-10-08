// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLocalStorageRepository, storageKey } from '../src/data/local-storage-repository';
import { budgetFiles } from '../src/data/budget-files';
import { BudgetError } from '../src/domain/budget';
import { budget, legacyBackup } from './fixtures';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());
const createRepository = () =>
  createLocalStorageRepository(() => localStorage, window, budgetFiles);

describe('browser persistence adapter', () => {
  it('uses the original key and reads existing data', () => {
    localStorage.setItem('balance-v1', legacyBackup);
    expect(createRepository().load().entries).toEqual(budget().entries);
    createRepository().save(budget());
    expect(budgetFiles.decode(localStorage.getItem(storageKey)!)).toEqual(budget());
  });
  it('reports corruption without overwriting the source', () => {
    localStorage.setItem(storageKey, '{broken');
    expect(() => createRepository().load()).toThrow(new BudgetError('storage-read'));
    expect(localStorage.getItem(storageKey)).toBe('{broken');
  });
  it('translates unavailable storage and quota errors', () => {
    const inaccessible = createLocalStorageRepository(
      () => {
        throw new Error('denied');
      },
      window,
      budgetFiles,
    );
    expect(() => inaccessible.load()).toThrow(new BudgetError('storage-read'));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => createRepository().save(budget())).toThrow(new BudgetError('storage-write'));
  });
  it('subscribes to its own local storage changes and cleans up listeners', () => {
    const listener = vi.fn();
    const unsubscribe = createRepository().subscribe(listener);
    window.dispatchEvent(
      new StorageEvent('storage', { key: storageKey, storageArea: sessionStorage }),
    );
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'unrelated', storageArea: localStorage }),
    );
    expect(listener).not.toHaveBeenCalled();
    window.dispatchEvent(
      new StorageEvent('storage', { key: storageKey, storageArea: localStorage }),
    );
    window.dispatchEvent(new StorageEvent('storage', { key: null, storageArea: localStorage }));
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    window.dispatchEvent(
      new StorageEvent('storage', { key: storageKey, storageArea: localStorage }),
    );
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
