import type { Occurrence } from '../../domain/budget';
import { categoryIds, totals } from '../../domain/budget';
import { categoryLabels, money } from '../format';

export function SummaryCards({ rows }: { readonly rows: readonly Occurrence[] }) {
  const summary = totals(rows);
  return (
    <section className="cards">
      <article className="card balance">
        <div className="card-label">
          Останется по плану <span>↗</span>
        </div>
        <strong>{money(summary.balance)}</strong>
        <div id="actual">По проведённым: {money(summary.actual)}</div>
        <div className="balance-decoration" />
      </article>
      <article className="card">
        <div className="card-label">
          Доходы за месяц <span className="income-icon">↙</span>
        </div>
        <strong>{money(summary.income)}</strong>
        <div className="card-foot">Получено: {money(summary.received)}</div>
      </article>
      <article className="card">
        <div className="card-label">
          Расходы за месяц <span className="expense-icon">↗</span>
        </div>
        <strong>{money(summary.expense)}</strong>
        <div className="card-foot">Оплачено: {money(summary.spent)}</div>
      </article>
    </section>
  );
}

export function CategoryBreakdown({ rows }: { readonly rows: readonly Occurrence[] }) {
  const groups = categoryIds
    .map((category) => ({
      category,
      amount: rows
        .filter((row) => row.type === 'expense' && row.category === category)
        .reduce((sum, row) => sum + row.amount, 0),
    }))
    .filter((group) => group.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const total = groups.reduce((sum, group) => sum + group.amount, 0);
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>На что уходят деньги</h2>
          <p>Расходы по плану</p>
        </div>
      </div>
      {groups.length ? (
        groups.map((group, index) => (
          <div className="category-row" key={group.category}>
            <div>
              <span>
                <i style={{ background: `var(--chart-${index % 4})` }} />
                {categoryLabels[group.category]}
              </span>
              <strong>{money(group.amount)}</strong>
            </div>
            <div className="bar">
              <span
                style={{
                  width: `${(group.amount / total) * 100}%`,
                  background: `var(--chart-${index % 4})`,
                }}
              />
            </div>
          </div>
        ))
      ) : (
        <div className="category-empty">
          <div className="empty-chart">₽</div>
          <p>
            Добавьте расходы,
            <br />
            чтобы увидеть распределение
          </p>
        </div>
      )}
    </section>
  );
}
