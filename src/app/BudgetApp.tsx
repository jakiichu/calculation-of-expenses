import { useRef, useState } from 'react';
import type { BudgetService } from '../domain/budget-service';
import { occurrences, validMonth } from '../domain/budget';
import type { Entry } from '../domain/budget';
import { downloadFile, readBackupFile } from './browser-files';
import { errorMessage, localDate, shiftMonth } from './format';
import { useBudget } from './use-budget';
import { EntryEditor } from './components/EntryEditor';
import { Modal } from './components/Modal';
import { Operations } from './components/Operations';
import { CategoryBreakdown, SummaryCards } from './components/Overview';

type DialogState =
  | { type: 'editor'; entry?: Entry; recurring: boolean }
  | { type: 'delete'; entry: Entry }
  | { type: 'import'; text: string; count: number }
  | null;

export function BudgetApp({ service }: { readonly service: BudgetService }) {
  const model = useBudget(service);
  const [month, setMonth] = useState(() => localDate().slice(0, 7));
  const [dialog, setDialog] = useState<DialogState>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rows = occurrences(model.budget, month);
  const closeDialog = () => setDialog(null);
  const add = (recurring = false) => setDialog({ type: 'editor', recurring });

  function perform(action: () => void) {
    try {
      action();
    } catch (error) {
      model.notify(errorMessage(error));
    }
  }

  async function importFile(file: File) {
    try {
      const text = await readBackupFile(file);
      const budget = service.readBackup(text);
      setDialog({ type: 'import', text, count: budget.entries.length });
    } catch (error) {
      model.notify(errorMessage(error));
    }
  }

  function confirm() {
    perform(() => {
      if (dialog?.type === 'delete') model.removeEntry(dialog.entry.id);
      if (dialog?.type === 'import') model.restore(dialog.text);
      closeDialog();
    });
  }

  return (
    <>
      <aside className="sidebar">
        <a className="brand" href="/">
          баланс<span className="brand-dot">.</span>
        </a>
        <div className="brand-sub">Личные финансы, спокойно.</div>
        <div className="nav-active">
          <span>▦</span> Обзор месяца
        </div>
        <div className="sidebar-bottom">
          <span className="privacy-dot" /> Только на вашем устройстве
          <p>
            Без аккаунта и сервера.
            <br />
            Ваши деньги — ваше дело.
          </p>
        </div>
      </aside>
      <main>
        <header>
          <div className="eyebrow">МОИ ФИНАНСЫ</div>
          <div className="tools">
            <button className="subtle" onClick={() => fileRef.current?.click()}>
              ↓ Загрузить
            </button>
            <button
              className="subtle"
              onClick={() =>
                perform(() =>
                  downloadFile(
                    service.exportBackup(),
                    `balance-${localDate()}.json`,
                    'application/json',
                  ),
                )
              }
            >
              ↑ Резервная копия
            </button>
            <input
              ref={fileRef}
              aria-label="JSON-копия"
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void importFile(file);
              }}
            />
          </div>
        </header>
        <section className="page-heading">
          <div>
            <h1>
              Всё под контролем<span>.</span>
            </h1>
            <p>Зарплата, повседневные траты и планы на месяц.</p>
          </div>
          <button className="primary" onClick={() => add()}>
            ＋ Добавить операцию
          </button>
        </section>
        {model.storageError && (
          <p className="storage-error" role="alert">
            {model.storageError}
          </p>
        )}
        <section className="month-bar">
          <div className="month-control">
            <button
              onClick={() => setMonth(shiftMonth(month, -1))}
              disabled={month === '1900-01'}
              aria-label="Предыдущий месяц"
            >
              ‹
            </button>
            <input
              value={month}
              onChange={(event) => {
                if (validMonth(event.target.value)) setMonth(event.target.value);
              }}
              type="month"
              min="1900-01"
              max="9999-12"
              aria-label="Месяц"
            />
            <button
              onClick={() => setMonth(shiftMonth(month, 1))}
              disabled={month === '9999-12'}
              aria-label="Следующий месяц"
            >
              ›
            </button>
          </div>
          <button className="subtle" onClick={() => setMonth(localDate().slice(0, 7))}>
            Текущий месяц ↗
          </button>
          <span className="save-note">
            {model.storageError ? 'Хранилище недоступно' : '✓ Сохраняется на устройстве'}
          </span>
        </section>
        <SummaryCards rows={rows} />
        <div className="content-grid">
          <Operations
            rows={rows}
            onAdd={() => add()}
            onEdit={(id) => {
              const entry = model.budget.entries.find((item) => item.id === id);
              if (entry) setDialog({ type: 'editor', entry, recurring: entry.interval > 0 });
            }}
            onDelete={(id) => {
              const entry = model.budget.entries.find((item) => item.id === id);
              if (entry) setDialog({ type: 'delete', entry });
            }}
            onPaid={(id, paid) => perform(() => model.markPaid(id, month, paid))}
            onExport={() =>
              perform(() =>
                downloadFile(
                  service.exportMonth(month),
                  `balance-${month}.csv`,
                  'text/csv;charset=utf-8',
                ),
              )
            }
          />
          <div className="right-column">
            <CategoryBreakdown rows={rows} />
            <section className="tip">
              <div className="tip-icon">↻</div>
              <h3>Повторяется? Запланируйте.</h3>
              <p>
                Аренда каждый месяц, страховка раз в год. Добавьте один раз — мы учтём их в нужных
                месяцах.
              </p>
              <button onClick={() => add(true)}>Добавить регулярную трату ↗</button>
            </section>
          </div>
        </div>
        <footer>
          <span>Меньше тревоги. Больше ясности.</span>
          <span>Храните JSON-копию, чтобы не потерять данные при очистке браузера.</span>
        </footer>
      </main>
      {dialog?.type === 'editor' && (
        <EntryEditor
          entry={dialog.entry}
          month={month}
          recurring={dialog.recurring}
          paid={dialog.entry ? model.budget.paid[`${dialog.entry.id}:${month}`] === true : false}
          onSave={model.saveEntry}
          onClose={closeDialog}
        />
      )}
      {(dialog?.type === 'delete' || dialog?.type === 'import') && (
        <Modal
          title={dialog.type === 'delete' ? 'Удалить операцию?' : 'Загрузить резервную копию?'}
          onClose={closeDialog}
        >
          <p>
            {dialog.type === 'import'
              ? `В файле ${dialog.count} операций. Загрузка заменит все текущие данные. При необходимости сначала сохраните свою резервную копию.`
              : dialog.entry.interval
                ? `«${dialog.entry.title}»: будет удалена вся серия во всех месяцах. Чтобы завершить повторения, задайте дату окончания через редактирование.`
                : `Операция «${dialog.entry.title}» будет удалена.`}
          </p>
          <div className="confirm-buttons">
            <button onClick={closeDialog}>Отмена</button>
            <button className="primary" onClick={confirm}>
              Подтвердить
            </button>
          </div>
        </Modal>
      )}
      {model.notice && (
        <div id="toast" role="status">
          {model.notice}
        </div>
      )}
    </>
  );
}
