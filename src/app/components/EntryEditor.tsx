import { useState } from 'react';
import type { FormEvent } from 'react';
import type { SaveEntryCommand } from '../../domain/budget-service';
import { categoryIds } from '../../domain/budget';
import type { Category, Entry, EntryType } from '../../domain/budget';
import { categoryLabels, errorMessage, localDate, repeatText } from '../format';
import { Modal } from './Modal';

interface EntryEditorProps {
  readonly entry?: Entry;
  readonly month: string;
  readonly recurring: boolean;
  readonly paid: boolean;
  readonly onSave: (command: SaveEntryCommand) => void;
  readonly onClose: () => void;
}

interface EntryForm {
  title: string;
  amount: string;
  type: EntryType;
  category: Category;
  date: string;
  interval: string;
  end: string;
  paid: boolean;
}

export function EntryEditor({ entry, month, recurring, paid, onSave, onClose }: EntryEditorProps) {
  const [form, setForm] = useState<EntryForm>(() => ({
    title: entry?.title ?? '',
    amount: entry ? String(entry.amount / 100) : '',
    type: entry?.type ?? 'expense',
    category: entry?.category ?? 'other',
    date: entry?.date ?? (month === localDate().slice(0, 7) ? localDate() : `${month}-01`),
    interval: String(entry?.interval ?? (recurring ? 1 : 0)),
    end: entry?.end ?? '',
    paid,
  }));
  const [error, setError] = useState<string | null>(null);
  function update<K extends keyof EntryForm>(key: K, value: EntryForm[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }
  const intervals = [...new Set([0, 1, 2, 3, 6, 12, Number(form.interval)])].sort((a, b) => a - b);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      onSave({
        id: entry?.id,
        month,
        paid: form.paid,
        entry: {
          title: form.title,
          type: form.type,
          category: form.category,
          amount: Math.round(Number(form.amount) * 100),
          date: form.date,
          interval: Number(form.interval),
          end: Number(form.interval) ? form.end : '',
        },
      });
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }

  return (
    <Modal title={entry ? 'Изменить операцию' : 'Новая операция'} onClose={onClose}>
      <form onSubmit={submit}>
        <label>
          Тип
          <select
            value={form.type}
            onChange={(event) => {
              const type = event.target.value === 'income' ? 'income' : 'expense';
              setForm((previous) => ({
                ...previous,
                type,
                category: type === 'income' ? 'salary' : 'other',
              }));
            }}
          >
            <option value="expense">Расход</option>
            <option value="income">Доход / зарплата</option>
          </select>
        </label>
        <label>
          Название
          <input
            value={form.title}
            onChange={(event) => update('title', event.target.value)}
            maxLength={100}
            placeholder="Например, аренда квартиры"
            required
          />
        </label>
        <div className="form-grid">
          <label>
            Сумма, ₽
            <input
              value={form.amount}
              onChange={(event) => update('amount', event.target.value)}
              type="number"
              min="0.01"
              max="1000000000"
              step="0.01"
              inputMode="decimal"
              required
            />
          </label>
          <label>
            Категория
            <select
              value={form.category}
              onChange={(event) => {
                const category = categoryIds.find((id) => id === event.target.value);
                if (category) update('category', category);
              }}
            >
              {categoryIds.map((category) => (
                <option key={category} value={category}>
                  {categoryLabels[category]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Дата первой операции
            <input
              value={form.date}
              onChange={(event) => update('date', event.target.value)}
              type="date"
              min="1900-01-01"
              max="9999-12-31"
              required
            />
          </label>
          <label>
            Повторение
            <select
              value={form.interval}
              onChange={(event) => update('interval', event.target.value)}
            >
              {intervals.map((interval) => (
                <option key={interval} value={interval}>
                  {repeatText(interval)}
                </option>
              ))}
            </select>
          </label>
        </div>
        {Number(form.interval) > 0 && (
          <label>
            Повторять до (необязательно)
            <input
              value={form.end}
              onChange={(event) => update('end', event.target.value)}
              type="date"
              min={form.date || '1900-01-01'}
              max="9999-12-31"
            />
          </label>
        )}
        <label className="check-label">
          <input
            checked={form.paid}
            onChange={(event) => update('paid', event.target.checked)}
            type="checkbox"
          />
          {entry ? 'Проведено в выбранном месяце' : 'Первая операция уже оплачена / получена'}
        </label>
        <p className="form-hint">
          {entry
            ? 'Изменения затронут всю серию, включая прошлые месяцы. Отметка оплаты относится только к выбранному месяцу.'
            : 'Повторения учитываются автоматически. В коротком месяце используется его последний день.'}
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" type="submit">
          Сохранить операцию
        </button>
      </form>
    </Modal>
  );
}
