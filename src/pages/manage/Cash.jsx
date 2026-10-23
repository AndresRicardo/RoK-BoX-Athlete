import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Minus, Plus, Trash2 } from 'lucide-react';
import useManageStore from '../../stores/manageStore';
import useFinanceStore, { cashTotals } from '../../stores/financeStore';
import {
  ManageHeader, Card, Chips, Segmented, Button, ErrorBox, Loading, Empty, Field, Select, TextInput, TextArea,
  MoneyInput, PaymentMethodSelect, PartnerSelect, Sheet, Money, Row, useAction, inputClass,
} from '../../components/manage/ui';
import { paymentMethodLabel } from '../../utils/currency';
import { bogotaDate, bogotaDateToTimestamp, monthRange, monthLabel, formatDate } from '../../utils/dates';

const SOURCE_LABELS = {
  manual: 'Ingreso manual',
  sale: 'Venta de contado',
  membership: 'Membresía',
  debt_payment: 'Abono a deuda',
};

const KIND_FILTERS = [
  ['all', 'Todo'],
  ['income', 'Ingresos'],
  ['BOX', 'Gastos BOX'],
  ['PERSONAL', 'Personales'],
  ['transfer', 'Entregas'],
];

/** Gasto, ingreso manual o entrega entre socios: crear o editar. */
function MovementSheet({ open, kind, row, onClose, onDone }) {
  const { partners, categories, myPartnerId } = useManageStore();
  const { saveExpense, saveIncome, saveTransfer } = useFinanceStore();
  const [form, setForm] = useState({});
  const { run, busy, error, setError } = useAction();

  useEffect(() => {
    if (!open) return;
    setError(null);
    const otherPartner = partners.find((p) => p.is_active && p.id !== myPartnerId)?.id || '';
    if (kind === 'expense') {
      setForm({
        title: row?.title || '',
        amount: row ? String(Math.round(row.amount)) : '',
        scope: row?.scope || 'BOX',
        categoryId: row?.category_id || '',
        method: row?.payment_method || 'cash',
        date: row ? bogotaDate(row.spent_at) : bogotaDate(),
        note: row?.note || '',
      });
    } else if (kind === 'income') {
      setForm({
        concept: row?.concept || '',
        amount: row ? String(Math.round(row.amount)) : '',
        method: row?.payment_method || 'cash',
        date: row ? bogotaDate(row.received_at) : bogotaDate(),
        note: row?.note || '',
      });
    } else {
      setForm({
        toPartner: row?.to_partner || otherPartner,
        amount: row ? String(Math.round(row.amount)) : '',
        date: row ? bogotaDate(row.transferred_at) : bogotaDate(),
        note: row?.note || '',
      });
    }
  }, [open, kind, row, partners, myPartnerId, setError]);

  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value?.target ? value.target.value : value }));

  // Conserva la hora original si no cambió el día.
  const when = (original, date) => (original && bogotaDate(original) === date ? original : bogotaDateToTimestamp(date));

  const submit = () => run(async () => {
    if (!myPartnerId) throw new Error('Tu cuenta no está asociada a un socio. Revisa Ajustes → Socios.');
    if (Number(form.amount || 0) <= 0) throw new Error('Escribe el monto.');
    if (kind === 'expense') {
      if (!form.title.trim()) throw new Error('Escribe en qué se gastó.');
      await saveExpense({
        id: row?.id,
        partner_id: myPartnerId,
        title: form.title.trim(),
        amount: Number(form.amount),
        scope: form.scope,
        category_id: form.categoryId || null,
        payment_method: form.method,
        spent_at: when(row?.spent_at, form.date),
        note: form.note.trim() || null,
      });
    } else if (kind === 'income') {
      if (!form.concept.trim()) throw new Error('Escribe el concepto.');
      await saveIncome({
        id: row?.id,
        partner_id: myPartnerId,
        concept: form.concept.trim(),
        amount: Number(form.amount),
        ...(row ? {} : { source: 'manual' }),
        payment_method: form.method,
        received_at: when(row?.received_at, form.date),
        note: form.note.trim() || null,
      });
    } else {
      if (!form.toPartner) throw new Error('Elige a qué socio le entregaste el dinero.');
      await saveTransfer({
        id: row?.id,
        from_partner: myPartnerId,
        to_partner: form.toPartner,
        amount: Number(form.amount),
        transferred_at: when(row?.transferred_at, form.date),
        note: form.note.trim() || null,
      });
    }
    onDone?.();
    onClose();
  });

  const titles = { expense: 'gasto', income: 'ingreso', transfer: 'entrega a socio' };
  const activeCategories = categories.filter((c) => !c.archived_at || c.id === form.categoryId);

  return (
    <Sheet
      open={open}
      title={`${row ? 'Editar' : 'Nuevo'} ${titles[kind] || ''}`}
      onClose={onClose}
      footer={(
        <Button className="w-full py-3" disabled={busy} onClick={submit}>
          {busy ? 'Guardando...' : 'Guardar'}
        </Button>
      )}
    >
      {kind === 'expense' && (
        <>
          <Segmented
            options={[['BOX', 'Gasto del BOX'], ['PERSONAL', 'Gasto personal']]}
            value={form.scope}
            onChange={set('scope')}
          />
          <p className="text-[10px] text-gray-500 -mt-2">
            {form.scope === 'BOX'
              ? 'Lo pagaste tú, pero es del box: se descuenta de la utilidad de todos.'
              : 'Es tuyo: se descuenta solo de tu parte en el cuadre.'}
          </p>
          <Field label="Descripción *">
            <TextInput value={form.title || ''} onChange={set('title')} placeholder="Ej. Bandas elásticas" />
          </Field>
        </>
      )}
      {kind === 'income' && (
        <Field label="Concepto *">
          <TextInput value={form.concept || ''} onChange={set('concept')} placeholder="Ej. Clase de prueba" />
        </Field>
      )}
      {kind === 'transfer' && (
        <Field label="Le entregué a">
          <PartnerSelect
            partners={partners.filter((p) => p.id !== myPartnerId)}
            value={form.toPartner}
            onChange={set('toPartner')}
            allowEmpty
          />
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Monto *">
          <MoneyInput value={form.amount || ''} onChange={set('amount')} />
        </Field>
        <Field label="Fecha">
          <input type="date" value={form.date || ''} onChange={set('date')} className={`${inputClass} text-xs`} />
        </Field>
      </div>

      {kind !== 'transfer' && (
        <div className={`grid gap-3 ${kind === 'expense' ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <Field label="Medio de pago">
            <PaymentMethodSelect value={form.method || 'cash'} onChange={set('method')} />
          </Field>
          {kind === 'expense' && (
            <Field label="Categoría">
              <Select value={form.categoryId || ''} onChange={set('categoryId')}>
                <option value="">Sin categoría</option>
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon_emoji} {c.name}</option>
                ))}
              </Select>
            </Field>
          )}
        </div>
      )}

      <Field label="Nota">
        <TextArea value={form.note || ''} onChange={set('note')} />
      </Field>
      <ErrorBox error={error} />
    </Sheet>
  );
}

export default function Cash() {
  const { partners, categories, myPartnerId, loadCatalogs } = useManageStore();
  const { fetchMovements, deleteExpense, deleteIncome, deleteTransfer } = useFinanceStore();
  const [monthOffset, setMonthOffset] = useState(0);
  const [partnerId, setPartnerId] = useState(null);
  const [kindFilter, setKindFilter] = useState('all');
  const [movements, setMovements] = useState(null);
  const [editing, setEditing] = useState(null); // { kind, row }
  const load = useAction();
  const action = useAction();

  const range = monthRange(bogotaDate(), monthOffset);

  const refresh = useCallback(async () => {
    setMovements(await fetchMovements(range.start, range.end));
  }, [fetchMovements, range.start, range.end]);

  useEffect(() => {
    load.run(async () => {
      await loadCatalogs();
      await refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  const viewing = partnerId || myPartnerId || partners[0]?.id;
  const isMine = viewing === myPartnerId;
  const partnerName = (id) => partners.find((p) => p.id === id)?.name || '—';
  const categoryById = Object.fromEntries(categories.map((c) => [c.id, c]));

  const totals = movements && viewing ? cashTotals(movements, viewing) : null;

  // Lista unificada de movimientos del socio, del más reciente al más antiguo.
  const items = useMemo(() => {
    if (!movements || !viewing) return [];
    const list = [
      ...movements.incomes.filter((i) => i.partner_id === viewing).map((i) => ({
        kind: 'income', id: i.id, row: i, at: i.received_at, amount: Number(i.amount), sign: 1,
        title: i.concept, sub: `${SOURCE_LABELS[i.source]} · ${paymentMethodLabel(i.payment_method)}`,
        editable: ['manual', 'sale'].includes(i.source),
      })),
      ...movements.expenses.filter((e) => e.partner_id === viewing).map((e) => ({
        kind: 'expense', scope: e.scope, id: e.id, row: e, at: e.spent_at, amount: Number(e.amount), sign: -1,
        title: e.title,
        sub: `${e.scope === 'BOX' ? 'Gasto BOX' : 'Gasto personal'}${e.category_id ? ` · ${categoryById[e.category_id]?.icon_emoji || ''} ${categoryById[e.category_id]?.name || ''}` : ''}`,
        editable: true,
      })),
      ...movements.transfers.filter((t) => t.from_partner === viewing || t.to_partner === viewing).map((t) => ({
        kind: 'transfer', id: t.id, row: t, at: t.transferred_at, amount: Number(t.amount),
        sign: t.from_partner === viewing ? -1 : 1,
        title: t.from_partner === viewing ? `Entregado a ${partnerName(t.to_partner)}` : `Recibido de ${partnerName(t.from_partner)}`,
        sub: t.settlement_id ? 'Pago de cuadre (no afecta la caja)' : 'Entrega entre socios',
        editable: t.from_partner === viewing && !t.settlement_id,
      })),
    ];
    return list
      .filter((it) => {
        if (kindFilter === 'all') return true;
        if (kindFilter === 'BOX' || kindFilter === 'PERSONAL') return it.kind === 'expense' && it.scope === kindFilter;
        return it.kind === kindFilter;
      })
      .sort((a, b) => new Date(b.at) - new Date(a.at));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movements, viewing, kindFilter, categories, partners]);

  const remove = (it) => action.run(async () => {
    if (!window.confirm(`¿Eliminar "${it.title}"?`)) return;
    if (it.kind === 'expense') await deleteExpense(it.id);
    else if (it.kind === 'income') await deleteIncome(it.id);
    else await deleteTransfer(it.id);
    await refresh();
  });

  const icons = {
    income: <ArrowDownLeft className="w-4 h-4 text-emerald-400" />,
    expense: <ArrowUpRight className="w-4 h-4 text-red-400" />,
    transfer: <ArrowLeftRight className="w-4 h-4 text-sky-400" />,
  };

  return (
    <div className="flex flex-col gap-3 pb-8">
      <ManageHeader title="Caja" subtitle={isMine ? 'Mi caja' : `Caja de ${partnerName(viewing)}`} />

      {partners.filter((p) => p.is_active).length > 1 && (
        <Chips
          options={partners.filter((p) => p.is_active).map((p) => [p.id, p.id === myPartnerId ? `${p.name} (yo)` : p.name])}
          value={viewing}
          onChange={setPartnerId}
        />
      )}

      <div className="flex items-center justify-between px-1">
        <button type="button" onClick={() => setMonthOffset((m) => m - 1)} className="p-2 rounded-lg bg-[#1C1C1E] tap-bounce" aria-label="Mes anterior">
          <ChevronLeft className="w-4 h-4 text-gray-300" />
        </button>
        <span className="text-sm font-black text-white">{monthLabel(range.start)}</span>
        <button
          type="button"
          onClick={() => setMonthOffset((m) => Math.min(0, m + 1))}
          disabled={monthOffset === 0}
          className="p-2 rounded-lg bg-[#1C1C1E] tap-bounce disabled:opacity-30"
          aria-label="Mes siguiente"
        >
          <ChevronRight className="w-4 h-4 text-gray-300" />
        </button>
      </div>

      <ErrorBox error={load.error || action.error} />

      {!myPartnerId && partners.length > 0 && (
        <p className="text-[11px] text-amber-400">
          Tu cuenta no está asociada a ningún socio: puedes ver las cajas, pero no registrar movimientos.
        </p>
      )}

      {totals ? (
        <Card className="bg-gradient-to-br from-[#1C1C1E] to-[#292929] border-white/10">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#A0A0A5] block">Efectivo esperado en su poder</span>
          <Money value={totals.expected} className={`text-2xl ${totals.expected < 0 ? 'text-red-400' : 'text-white'}`} />
          <div className="mt-2">
            <Row label="Ingresos recibidos"><Money value={totals.income} className="text-emerald-400" /></Row>
            <Row label="Gastos del BOX pagados"><Money value={-totals.box} className="text-red-400" /></Row>
            <Row label="Gastos personales"><Money value={-totals.personal} className="text-red-400" /></Row>
            <Row label="Entregado a socios"><Money value={-totals.given} /></Row>
            <Row label="Recibido de socios"><Money value={totals.received} /></Row>
          </div>
        </Card>
      ) : (
        <Loading />
      )}

      {isMine && myPartnerId && (
        <div className="grid grid-cols-3 gap-2">
          <Button variant="secondary" className="px-2" onClick={() => setEditing({ kind: 'expense' })}>
            <Minus className="w-4 h-4" /> Gasto
          </Button>
          <Button variant="secondary" className="px-2" onClick={() => setEditing({ kind: 'income' })}>
            <Plus className="w-4 h-4" /> Ingreso
          </Button>
          <Button variant="secondary" className="px-2" onClick={() => setEditing({ kind: 'transfer' })}>
            <ArrowLeftRight className="w-4 h-4" /> Entrega
          </Button>
        </div>
      )}

      <Chips options={KIND_FILTERS} value={kindFilter} onChange={setKindFilter} />

      {movements && items.length === 0 ? (
        <Empty title="Sin movimientos en este mes" />
      ) : (
        <div className="flex flex-col gap-1.5">
          {items.map((it) => {
            const canEdit = isMine && it.editable;
            return (
              <div key={`${it.kind}-${it.id}`} className="p-3 rounded-2xl bg-[#1C1C1E] border border-white/5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#0A0A0C] flex items-center justify-center shrink-0">{icons[it.kind]}</div>
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => setEditing({ kind: it.kind, row: it.row })}
                  className="flex-1 min-w-0 text-left"
                >
                  <span className="text-xs font-black text-white block truncate">{it.title}</span>
                  <span className="text-[10px] text-gray-400 block truncate">{formatDate(it.at)} · {it.sub}</span>
                </button>
                <Money value={it.sign * it.amount} className={`text-xs shrink-0 ${it.sign > 0 ? 'text-emerald-400' : 'text-white'}`} />
                {canEdit && (
                  <button type="button" onClick={() => remove(it)} className="p-1 text-gray-600 hover:text-red-400" aria-label="Eliminar">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-gray-500">
        Los ingresos de membresías y abonos se crean solos y se corrigen desde su origen (la ficha del miembro o la deuda).
        Solo puedes editar tus propios movimientos.
      </p>

      <MovementSheet
        open={!!editing}
        kind={editing?.kind}
        row={editing?.row}
        onClose={() => setEditing(null)}
        onDone={() => action.run(refresh)}
      />
    </div>
  );
}
