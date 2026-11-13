import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Receipt, ExternalLink } from 'lucide-react';
import useManageStore from '../../stores/manageStore';
import { receiptUrl } from '../../stores/paymentStore';
import {
  Card, Button, ErrorBox, Loading, Field, Select, MoneyInput, TextArea, PaymentMethodSelect, PartnerSelect,
  Sheet, Money, useAction,
} from './ui';
import { formatCOP, paymentMethodLabel } from '../../utils/currency';
import { formatDateTime } from '../../utils/dates';

// Pagos reportados por atletas (D52): tarjeta en Pendientes y hoja para confirmarlos.

export function reportConcept(r) {
  if (r.covers_membership && r.covers_debt) return 'Mensualidad y saldo';
  return r.covers_membership ? 'Mensualidad' : 'Saldo pendiente';
}

/** Comprobante con URL firmada: imagen (toca para abrirla completa) o enlace al PDF. */
export function ReceiptPreview({ path, className = 'w-20 h-20' }) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    setFailed(false);
    receiptUrl(path).then((u) => {
      if (!alive) return;
      if (u) setUrl(u);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [path]);

  const isImage = /\.(png|jpe?g|webp)$/i.test(path || '');
  if (failed) return <span className="text-[10px] text-red-400">No se pudo cargar el comprobante</span>;
  if (!url) return <div className={`${className} rounded-xl bg-[#0A0A0C] animate-pulse shrink-0`} />;
  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0" aria-label="Ver comprobante completo">
        <img src={url} alt="Comprobante" className={`${className} rounded-xl object-cover bg-white`} />
      </a>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`${className} rounded-xl bg-[#0A0A0C] border border-white/10 flex flex-col items-center justify-center gap-1 text-[#FFC815] shrink-0`}
    >
      <FileText className="w-6 h-6" />
      <span className="text-[10px] font-black flex items-center gap-0.5">Abrir <ExternalLink className="w-3 h-3" /></span>
    </a>
  );
}

export function PaymentReportCard({ report, onApprove, onReject }) {
  return (
    <Card className="flex flex-col gap-2.5">
      <div className="flex items-start gap-3">
        <ReceiptPreview path={report.receipt_path} />
        <div className="flex-1 min-w-0">
          <Link to={`/manage/members/${report.member_id}`} className="text-sm font-black text-white block truncate">
            {report.members?.full_name || 'Miembro'}
          </Link>
          <Money value={report.amount} className="text-lg text-[#FFC815] block" />
          <span className="text-[11px] text-gray-300 block">
            {reportConcept(report)} · {paymentMethodLabel(report.payment_method)}
            {report.account_label ? ` a ${report.account_label}` : ''}
          </span>
          <span className="text-[10px] text-gray-500 block">Reportado {formatDateTime(report.created_at)}</span>
        </div>
      </div>
      {report.note && (
        <p className="text-[11px] text-gray-300 p-2 rounded-lg bg-[#0A0A0C] border border-white/5">“{report.note}”</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => onReject(report)}>Rechazar</Button>
        <Button onClick={() => onApprove(report)}>Confirmar</Button>
      </div>
    </Card>
  );
}

const toNum = (v) => Number(v || 0);

/**
 * Confirmar un pago reportado: renovar con un plan (el valor cobrado puede ser menor al
 * precio de lista; la diferencia queda como descuento) y/o abonar a las deudas, de la más
 * antigua a la más reciente. Todo en un solo RPC (approve_payment_report).
 */
export function ApproveReportSheet({ report, onClose, onDone }) {
  const { plans, partners, myPartnerId, fetchMemberStatus, approvePaymentReport } = useManageStore();
  const [status, setStatus] = useState(null);
  const [renew, setRenew] = useState(false);
  const [planId, setPlanId] = useState('');
  const [value, setValue] = useState('');
  const [payDebt, setPayDebt] = useState(false);
  const [debtAmount, setDebtAmount] = useState('');
  const [method, setMethod] = useState('transfer');
  const [partnerId, setPartnerId] = useState('');
  const [note, setNote] = useState('');
  const load = useAction();
  const { run, busy, error, setError } = useAction();

  const activePlans = useMemo(() => plans.filter((p) => p.is_active), [plans]);
  const planPrice = (id) => toNum(plans.find((p) => p.id === id)?.price);

  // Valores sugeridos: la mensualidad hasta el precio del plan y el resto a las deudas.
  const suggest = (id, wantsRenew, wantsDebt, balance) => {
    const reported = toNum(report.amount);
    const membership = wantsRenew && id ? Math.min(planPrice(id), reported) : 0;
    setValue(wantsRenew && id ? String(Math.round(membership)) : '');
    const rest = wantsDebt ? Math.min(balance, Math.max(reported - membership, 0)) : 0;
    setDebtAmount(rest > 0 ? String(Math.round(rest)) : '');
  };

  useEffect(() => {
    if (!report) return;
    setStatus(null);
    setError(null);
    setNote('');
    setMethod(report.payment_method);
    setPartnerId(myPartnerId || partners.find((p) => p.is_active)?.id || '');
    load.run(async () => {
      const s = await fetchMemberStatus(report.member_id);
      setStatus(s);
      const current = activePlans.find((p) => p.id === s?.plan_id);
      const id = current?.id || activePlans.find((p) => p.kind === 'period')?.id || activePlans[0]?.id || '';
      const balance = toNum(s?.debt_balance);
      const wantsRenew = report.covers_membership;
      const wantsDebt = report.covers_debt && balance > 0;
      setPlanId(id);
      setRenew(wantsRenew);
      setPayDebt(wantsDebt);
      suggest(id, wantsRenew, wantsDebt, balance);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report]);

  if (!report) return null;
  const balance = toNum(status?.debt_balance);
  const registered = (renew ? toNum(value) : 0) + (payDebt ? toNum(debtAmount) : 0);
  const diff = registered - toNum(report.amount);

  const submit = () => run(async () => {
    if (!renew && !payDebt) throw new Error('Marca qué vas a registrar: la renovación, el abono o ambos.');
    if (renew && !planId) throw new Error('Elige el plan.');
    if (renew && toNum(value) > planPrice(planId)) {
      throw new Error(`El valor de la mensualidad no puede superar el precio del plan (${formatCOP(planPrice(planId))}).`);
    }
    if (payDebt && !(toNum(debtAmount) > 0)) throw new Error('Escribe el valor del abono.');
    if (payDebt && toNum(debtAmount) > balance) throw new Error(`El abono supera el saldo (${formatCOP(balance)}).`);
    if (registered > 0 && !partnerId) throw new Error('Elige el socio que recibió el dinero.');
    if (diff !== 0 && !window.confirm(
      `Vas a registrar ${formatCOP(registered)} y el atleta reportó ${formatCOP(report.amount)}. ¿Continuar?`,
    )) return;
    await approvePaymentReport({
      reportId: report.id,
      partnerId,
      paymentMethod: method,
      planId: renew ? planId : null,
      membershipAmount: toNum(value),
      debtAmount: payDebt ? toNum(debtAmount) : 0,
      note,
    });
    onDone?.();
    onClose();
  });

  return (
    <Sheet
      open={!!report}
      title="Confirmar pago"
      onClose={onClose}
      footer={(
        <Button className="w-full py-3" disabled={busy || !status} onClick={submit}>
          {busy ? 'Guardando...' : `Confirmar ${formatCOP(registered)}`}
        </Button>
      )}
    >
      <div className="flex items-start gap-3">
        <ReceiptPreview path={report.receipt_path} className="w-24 h-24" />
        <div className="min-w-0 text-xs">
          <span className="text-sm font-black text-white block">{report.members?.full_name}</span>
          <span className="text-gray-300 block">
            Reportó <strong className="text-[#FFC815]">{formatCOP(report.amount)}</strong> · {reportConcept(report).toLowerCase()}
          </span>
          <span className="text-gray-400 block">
            {paymentMethodLabel(report.payment_method)}{report.account_label ? ` a ${report.account_label}` : ''}
          </span>
          <span className="text-[10px] text-gray-500 block">Revisa que el dinero haya llegado antes de confirmar.</span>
        </div>
      </div>

      {!status ? (
        load.error ? <ErrorBox error={load.error} /> : <Loading />
      ) : (
        <>
          <Card className="flex flex-col gap-2.5 bg-[#0A0A0C]">
            <label className="flex items-center gap-2 text-sm font-black text-white">
              <input
                type="checkbox"
                checked={renew}
                onChange={(e) => {
                  setRenew(e.target.checked);
                  suggest(planId, e.target.checked, payDebt, balance);
                }}
                className="accent-[#FFC815] w-4 h-4"
              />
              Renovar mensualidad
            </label>
            {renew && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Plan">
                  <Select
                    value={planId}
                    onChange={(e) => {
                      setPlanId(e.target.value);
                      suggest(e.target.value, renew, payDebt, balance);
                    }}
                  >
                    {activePlans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </Select>
                </Field>
                <Field label="Valor cobrado" hint={planId ? `Lista: ${formatCOP(planPrice(planId))}` : null}>
                  <MoneyInput value={value} onChange={setValue} />
                </Field>
              </div>
            )}
            {renew && toNum(value) < planPrice(planId) && (
              <span className="text-[10px] text-gray-400">
                La diferencia ({formatCOP(planPrice(planId) - toNum(value))}) queda como descuento.
              </span>
            )}
          </Card>

          <Card className="flex flex-col gap-2.5 bg-[#0A0A0C]">
            <label className={`flex items-center gap-2 text-sm font-black ${balance > 0 ? 'text-white' : 'text-gray-500'}`}>
              <input
                type="checkbox"
                checked={payDebt}
                disabled={balance <= 0}
                onChange={(e) => {
                  setPayDebt(e.target.checked);
                  suggest(planId, renew, e.target.checked, balance);
                }}
                className="accent-[#FFC815] w-4 h-4"
              />
              Abonar a deudas {balance > 0 ? `(saldo ${formatCOP(balance)})` : '(no tiene saldo)'}
            </label>
            {payDebt && (
              <Field label="Valor del abono" hint="Se aplica de la deuda más antigua a la más reciente.">
                <MoneyInput value={debtAmount} onChange={setDebtAmount} />
              </Field>
            )}
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Medio de pago">
              <PaymentMethodSelect value={method} onChange={setMethod} />
            </Field>
            <Field label="Recibió el dinero">
              <PartnerSelect partners={partners} value={partnerId} onChange={setPartnerId} allowEmpty />
            </Field>
          </div>
          <Field label="Nota (opcional)">
            <TextArea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Pago reportado en la app" />
          </Field>

          <div className={`p-2.5 rounded-xl text-[11px] font-bold flex items-center gap-2 ${
            diff === 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
          }`}
          >
            <Receipt className="w-4 h-4 shrink-0" />
            {diff === 0
              ? `Registras ${formatCOP(registered)}, lo mismo que reportó.`
              : `Registras ${formatCOP(registered)} de ${formatCOP(report.amount)} reportados (${diff > 0 ? 'más' : 'menos'} ${formatCOP(Math.abs(diff))}).`}
          </div>
        </>
      )}
      <ErrorBox error={error} />
    </Sheet>
  );
}
