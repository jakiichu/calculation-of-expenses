import { createBudgetService } from '../domain/budget-service';
import { budgetFiles } from '../data/budget-files';
import { createLocalStorageRepository } from '../data/local-storage-repository';

export function createServices() {
  const repository = createLocalStorageRepository(() => window.localStorage, window, budgetFiles);
  return { budget: createBudgetService(repository, budgetFiles, () => crypto.randomUUID()) };
}
