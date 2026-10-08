import { useState } from 'react';
import type { EntryType, Occurrence } from '../../domain/budget';
import { categoryLabels, money, repeatText } from '../format';

interface OperationsProps {
  readonly rows: readonly Occurrence[];
  readonly onAdd: () => void;
  readonly onEdit: (id: string) => void;
  readonly onDelete: (id: string) => void;
  readonly onPaid: (id: string, paid: boolean) => void;
  readonly onExport: () => void;
}

export function Operations({ rows, onAdd, onEdit, onDelete, onPaid, onExport }: OperationsProps) {
  const [filter, setFilter] = useState<EntryType | 'all'>('all');
  const [search, setSearch] = useState('');
  const tabs = [
    { id: 'all', title: 'Все' },
    { id: 'income', title: 'Доходы' },
    { id: 'expense', title: 'Расходы' },
  ] as const;
  const visible = rows.filter(
    (row) =>
      (filter === 'all' || row.type === filter) &&
      `${row.title} ${categoryLabels[row.category]}`
        .toLocaleLowerCase('ru')
        .includes(search.trim().toLocaleLowerCase('ru')),
  );
  return (
    <section className="panel operations">
      <div className="panel-heading">
        <div>
          <h2>Операции</h2>
          <p>
            Операций: {rows.length} · регулярных: {rows.filter((row) => row.interval).length}
          </p>
        </div>
        <button className="subtle" onClick={onExport}>
          Выгрузить CSV ↗
        </button>
      </div>
      <div className="filters">
        <div className="tabs" aria-label="Фильтр операций">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              aria-pressed={filter === tab.id}
              className={filter === tab.id ? 'active' : ''}
              onClick={() => setFilter(tab.id)}
            >
              {tab.title}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Найти операцию"
          aria-label="Поиск операций"
        />
      </div>
      {visible.length ? (
        visible.map((row) => (
          <article className="transaction" key={row.key}>
            <div className={`transaction-icon ${row.type}`}>
              {row.type === 'income' ? '↙' : '↗'}
            </div>
            <div className="transaction-info">
              <strong>{row.title}</strong>
              <div>
                {categoryLabels[row.category]}{' '}
                <span>
                  ·{' '}
                  {new Date(`${row.date}T12:00:00`).toLocaleDateString('ru', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
                {row.interval > 0 && <span className="repeat">↻ {repeatText(row.interval)}</span>}
              </div>
            </div>
            <div className={`transaction-value ${row.type}`}>
              {row.type === 'income' ? '+' : '−'}
              {money(row.amount)}
              <label className="status">
                <input
                  type="checkbox"
                  checked={row.paid}
                  onChange={(event) => onPaid(row.id, event.target.checked)}
                  aria-label={`${row.type === 'income' ? 'Получено' : 'Оплачено'}: ${row.title}`}
                />
                {row.paid ? (row.type === 'income' ? 'Получено' : 'Оплачено') : 'По плану'}
              </label>
            </div>
            <div className="row-actions">
              <button
                onClick={() => onEdit(row.id)}
                aria-label={`Изменить ${row.title}`}
                title="Изменить"
              >
                ✎
              </button>
              <button
                onClick={() => onDelete(row.id)}
                aria-label={`Удалить ${row.title}`}
                title="Удалить"
              >
                ×
              </button>
            </div>
          </article>
        ))
      ) : (
        <div className="empty">
          <div>≋</div>
          <h3>{rows.length ? 'Ничего не нашлось' : 'Начнём с чистого листа'}</h3>
          <p>
            {rows.length ? (
              'Измените поиск или выберите другой фильтр.'
            ) : (
              <>
                Добавьте зарплату и первую трату.
                <br />
                Здесь появится ваш финансовый месяц.
              </>
            )}
          </p>
          {rows.length === 0 && (
            <button className="subtle" onClick={onAdd}>
              ＋ Добавить первую операцию
            </button>
          )}
        </div>
      )}
    </section>
  );
}
