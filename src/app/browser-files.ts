import { BudgetError } from '../domain/budget';

export async function readBackupFile(file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) throw new BudgetError('file-too-large');
  return file.text();
}

export function downloadFile(content: string, name: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
