import { useCallback, useEffect, useState } from 'react';
import { Plus, AlertTriangle, FileText, FileSpreadsheet, CheckCircle2, Circle, Trash2, Calculator } from 'lucide-react';
import useManageStore from '../../stores/manageStore';
import useFinanceStore from '../../stores/financeStore';
import {
  ManageHeader, Card, SectionTitle, Button, ErrorBox, Loading, Empty, Field, TextInput, TextArea, MoneyInput,
  Sheet, Money, Row, useAction, inputClass,
} from '../../components/manage/ui';
import { formatCOP } from '../../utils/currency';
import { bogotaDate, addDays, monthRange, formatDate } from '../../utils/dates';
import { exportSettlementPdf, exportSettlementExcel } from '../../utils/settlementExport';

/** Tabla por socio del resultado de calculate_settlement o de un cuadre guardado. */
function PartnerBreakdown({ partners }) {
  return (
    <div className="flex flex-col gap-2">
      {partners.map((p) => {
        const balance = Number(p.net_balance);
        return (
          <Card key={p.partner_id} className="bg-[#0A0A0C] py-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-black text-white">{p.name} <span className="text-gray-500 text-xs">{Number(p.percentage)} %</span></span>
              <span className={`text-xs font-black ${balance > 0 ? 'text-emerald-400' : balance < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                {balance > 0 ? 'Recibe ' : balance < 0 ? 'Paga ' : ''}{formatCOP(Math.abs(balance))}
              </span>
            </div>
            <Row label="Ingresos recibidos"><Money value={p.income_collected} /></Row>
            <Row label="Gastos BOX pagados"><Money value={p.box_expenses_paid} /></Row>
            <Row label="Gastos personales"><Money value={p.personal_expenses} /></Row>
            {(Number(p.transfers_given) > 0 || Number(p.transfers_received) > 0) && (
              <Row label="Entregado / recibido">
                {formatCOP(p.transfers_given)} / {formatCOP(p.transfers_received)}
              </Row>
            )}
            <Row label="Efectivo esperado"><Money value={p.expected_cash} /></Row>
            {p.declared_cash != null && (
              <Row label="Efectivo declarado">
                <Money value={p.declared_cash} />
                {Number(p.cash_difference) !== 0 && (
                  <span className={`block text-[10px] ${Number(p.cash_difference) < 0 ? 'text-red-400' : 'text-amber-400'}`}>
                    {Number(p.cash_difference) < 0 ? 'Faltan ' : 'Sobran '}{formatCOP(Math.abs(p.cash_difference))}
                  </span>
                )}
              </Row>
            )}
            <Row label="Participación"><Money value={p.gross_share} /></Row>
          </Card>
        );
      })}
    </div>
  );
}

function Totals({ s }) {
  return (
    <Card className="bg-gradient-to-br from-[#1C1C1E] to-[#292929] border-white/10">
      <Row label="Ingresos totales"><Money value={s.total_income} className="text-emerald-400" /></Row>
      <Row label="Gastos del BOX"><Money value={-Number(s.box_expenses)} className="text-red-400" /></Row>
      <Row label="Fondo de reserva"><Money value={-Number(s.reserve_fund)} /></Row>
      <div className="flex items-center justify-between pt-2">
        <span className="text-xs font-black text-white">Utilidad a repartir</span>
        <Money value={s.net_profit} className="text-xl text-[#FFC815]" />
      </div>
    </Card>
  );
}

/** Nuevo cuadre: periodo, reserva y efectivo declarado → calcular → guardar. */
function NewSettlementSheet({ open, lastEnd, onClose, onSaved }) {
  const { partners } = useManageStore();
  const { calculateSettlement, saveSettlement } = useFinanceStore();
  const active = partners.filter((p) => p.is_active);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [reserve, setReserve] = useState('');
  const [declared, setDeclared] = useState({});
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState(null);
  const { run, busy, error, setError } = useAction();

  useEffect(() => {
    if (!open) return;
    const today = bogotaDate();
    // Continúa donde cerró el último cuadre (sin pasar de hoy).
    const next = lastEnd ? addDays(lastEnd, 1) : monthRange(today).start;
    setStart(next > today ? today : next);
    setEnd(today);
    setReserve('');
    setDeclared({});
    setTitle('');
    setNotes('');
    setResult(null);
    setError(null);
  }, [open, lastEnd, setError]);

  // Cualquier cambio en los datos invalida el cálculo mostrado.
  const touch = (fn) => (v) => { fn(v); setResult(null); };

  const params = () => ({
    start,
    end,
    reserve: Number(reserve || 0),
    declaredCash: Object.fromEntries(
      Object.entries(declared).filter(([, v]) => v !== '').map(([k, v]) => [k, Number(v)]),
    ),
  });

  const calculate = () => run(async () => {
    if (!start || !end || end < start) throw new Error('Revisa las fechas del periodo.');
    setResult(await calculateSettlement(params()));
  });

  const save = () => run(async () => {
    const saved = await saveSettlement({ ...params(), title: title.trim(), notes: notes.trim() });
    onSaved?.(saved);
    onClose();
  });

  return (
    <Sheet
      open={open}
      title="Nuevo cuadre"
      onClose={onClose}
      footer={result ? (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setResult(null)} disabled={busy}>Ajustar</Button>
          <Button onClick={save} disabled={busy}>{busy ? 'Guardando...' : 'Guardar cuadre'}</Button>
        </div>
      ) : (
        <Button className="w-full py-3" onClick={calculate} disabled={busy}>
          <Calculator className="w-4 h-4" /> {busy ? 'Calculando...' : 'Calcular'}
        </Button>
      )}
    >
      {!result ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Desde">
              <input type="date" value={start} onChange={(e) => touch(setStart)(e.target.value)} className={`${inputClass} text-xs`} />
            </Field>
            <Field label="Hasta">
              <input type="date" value={end} onChange={(e) => touch(setEnd)(e.target.value)} className={`${inputClass} text-xs`} />
            </Field>
          </div>
          {lastEnd && (
            <p className="text-[10px] text-gray-500 -mt-2">El último cuadre cerró el {formatDate(lastEnd, { withYear: true })}.</p>
          )}
          <Field label="Fondo de reserva" hint="Dinero que queda en la caja del box antes de repartir.">
            <MoneyInput value={reserve} onChange={touch(setReserve)} />
          </Field>
          <SectionTitle>Efectivo que cada socio dice tener (opcional)</SectionTitle>
          <p className="text-[10px] text-gray-500 -mt-2">
            Si lo escribes, el cuadre te avisa si falta o sobra dinero frente a lo esperado.
          </p>
          {active.map((p) => (
            <Field key={p.id} label={p.name}>
              <MoneyInput
                value={declared[p.id] ?? ''}
                onChange={touch((v) => setDeclared((prev) => ({ ...prev, [p.id]: v })))}
                placeholder="Sin declarar"
              />
            </Field>
          ))}
        </>
      ) : (
        <>
          <span className="text-xs text-gray-400">
            {formatDate(result.period_start, { withYear: true })} a {formatDate(result.period_end, { withYear: true })}
          </span>
          <Totals s={result} />
          {result.has_cash_differences && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Hay diferencias entre el efectivo declarado y el esperado. Revísalas antes de guardar.</span>
            </div>
          )}
          <PartnerBreakdown partners={result.partners} />
          <SectionTitle>Transferencias</SectionTitle>
          {result.transfers.length === 0 ? (
            <p className="text-xs text-gray-400 -mt-2">Nadie le debe a nadie.</p>
          ) : result.transfers.map((t, i) => (
            <div key={i} className="flex items-center justify-between text-xs py-1">
              <span className="text-gray-300">{t.from_name} → {t.to_name}</span>
              <Money value={t.amount} className="text-white" />
            </div>
          ))}
          <Field label="Título (opcional)">
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Cuadre ${start} a ${end}`} />
          </Field>
          <Field label="Notas">
            <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </>
      )}
      <ErrorBox error={error} />
    </Sheet>
  );
}

/** Detalle de un cuadre guardado: transferencias pagadas, exportes y borrado. */
function SettlementDetailSheet({ open, settlement, onClose, onChanged }) {
  const { partners, categories } = useManageStore();
  const { setTransferPaid, deleteSettlement, fetchMovements } = useFinanceStore();
  const { run, busy, error, setError } = useAction();

  useEffect(() => {
    if (open) setError(null);
  }, [open, setError]);

  if (!settlement) return null;

  const togglePaid = (index, paid) => run(async () => {
    await setTransferPaid(settlement.id, index, paid);
    await onChanged?.();
  });

  const remove = () => run(async () => {
    if (!window.confirm('¿Eliminar este cuadre? Los pagos marcados también se anulan.')) return;
    await deleteSettlement(settlement.id);
    await onChanged?.();
    onClose();
  });

  const toExcel = () => run(async () => {
    const movements = await fetchMovements(settlement.period_start, settlement.period_end);
    await exportSettlementExcel(settlement, { movements, partners, categories });
  });

  return (
    <Sheet
      open={open}
      title={settlement.title}
      onClose={onClose}
      footer={(
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => run(() => exportSettlementPdf(settlement))} disabled={busy}>
            <FileText className="w-4 h-4" /> PDF
          </Button>
          <Button variant="secondary" onClick={toExcel} disabled={busy}>
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </Button>
        </div>
      )}
    >
      <span className="text-xs text-gray-400">
        {formatDate(settlement.period_start, { withYear: true })} a {formatDate(settlement.period_end, { withYear: true })}
      </span>
      {settlement.modified_after && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            Hubo movimientos del periodo modificados después de guardar este cuadre. El cuadre no cambia solo:
            si hace falta, elimínalo y haz uno nuevo.
          </span>
        </div>
      )}
      <Totals s={settlement} />

      <SectionTitle>Transferencias</SectionTitle>
      {(settlement.transfers || []).length === 0 ? (
        <p className="text-xs text-gray-400 -mt-2">Nadie le debe a nadie.</p>
      ) : settlement.transfers.map((t, i) => (
        <button
          key={i}
          type="button"
          disabled={busy}
          onClick={() => togglePaid(i, !t.paid_at)}
          className={`w-full p-3 rounded-xl border flex items-center gap-3 text-left tap-bounce ${
            t.paid_at ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-[#0A0A0C] border-white/10'
          }`}
        >
          {t.paid_at ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <Circle className="w-5 h-5 text-gray-500 shrink-0" />}
          <div className="flex-1 min-w-0">
            <span className="text-xs font-black text-white block truncate">{t.from_name} → {t.to_name}</span>
            <span className="text-[10px] text-gray-400">
              {t.paid_at ? `Pagada ${formatDate(t.paid_at)}` : 'Toca para marcar como pagada'}
            </span>
          </div>
          <Money value={t.amount} className="text-sm text-white" />
        </button>
      ))}

      <SectionTitle>Por socio</SectionTitle>
      <PartnerBreakdown partners={settlement.partners_snapshot || []} />

      {settlement.notes && <p className="text-xs text-gray-300">Notas: {settlement.notes}</p>}

      <Button variant="danger" onClick={remove} disabled={busy} className="mt-2">
        <Trash2 className="w-4 h-4" /> Eliminar cuadre
      </Button>
      <ErrorBox error={error} />
    </Sheet>
  );
}

export default function Settlements() {
  const { loadCatalogs } = useManageStore();
  const { fetchSettlements } = useFinanceStore();
  const [list, setList] = useState(null);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const { run, error } = useAction();

  const refresh = useCallback(async () => {
    setList(await fetchSettlements());
  }, [fetchSettlements]);

  useEffect(() => {
    run(async () => {
      await loadCatalogs();
      await refresh();
    });
  }, [loadCatalogs, refresh, run]);

  const selected = list?.find((s) => s.id === selectedId) || null;

  return (
    <div className="flex flex-col gap-3 pb-8">
      <ManageHeader
        title="Cuadres"
        action={(
          <Button onClick={() => setCreating(true)} className="px-3">
            <Plus className="w-4 h-4" /> Nuevo
          </Button>
        )}
      />
      <ErrorBox error={error} />

      {!list ? (
        <Loading />
      ) : list.length === 0 ? (
        <Empty title="Aún no hay cuadres">Haz el primero con el botón "Nuevo".</Empty>
      ) : (
        <div className="flex flex-col gap-1.5">
          {list.map((s) => {
            const pending = (s.transfers || []).filter((t) => !t.paid_at).length;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className="w-full text-left p-3.5 rounded-2xl bg-[#1C1C1E] border border-white/5 flex items-center gap-3 tap-bounce"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-black text-white block truncate">{s.title}</span>
                  <span className="text-[11px] text-gray-400 block">
                    {formatDate(s.period_start)} a {formatDate(s.period_end, { withYear: true })}
                  </span>
                  <span className={`text-[10px] font-bold ${pending ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {pending ? `${pending} ${pending === 1 ? 'transferencia pendiente' : 'transferencias pendientes'}` : 'Saldado'}
                  </span>
                  {s.modified_after && (
                    <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Movimientos modificados después
                    </span>
                  )}
                </div>
                <Money value={s.net_profit} className="text-sm text-[#FFC815] shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      <NewSettlementSheet
        open={creating}
        lastEnd={list?.[0]?.period_end}
        onClose={() => setCreating(false)}
        onSaved={async (saved) => {
          await refresh();
          setSelectedId(saved.id);
        }}
      />
      <SettlementDetailSheet
        open={!!selected}
        settlement={selected}
        onClose={() => setSelectedId(null)}
        onChanged={refresh}
      />
    </div>
  );
}
