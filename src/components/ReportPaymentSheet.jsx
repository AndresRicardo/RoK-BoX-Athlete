import { useEffect, useState } from 'react';
import { Upload, FileText, CheckCircle2 } from 'lucide-react';
import {
  Sheet, Field, Select, MoneyInput, TextArea, Button, ErrorBox, useAction,
} from './manage/ui';
import usePaymentStore, { RECEIPT_ACCEPT, receiptProblem } from '../stores/paymentStore';
import { paymentMethodLabel } from '../utils/currency';
import { shrinkImage } from '../utils/images';

// El efectivo se paga en el box: no se reporta desde la app.
const METHODS = ['nequi', 'daviplata', 'bre_b', 'transfer', 'card', 'other'];

/** Medio de pago probable según el nombre de la cuenta del box. */
function guessMethod(label) {
  const text = (label || '').toLowerCase();
  if (text.includes('nequi')) return 'nequi';
  if (text.includes('daviplata')) return 'daviplata';
  if (/bre.?b|llave/.test(text)) return 'bre_b';
  return 'transfer';
}

/**
 * "Ya pagué" (D52): el atleta reporta el pago con su comprobante. El staff lo confirma
 * desde Pendientes y ahí se renueva la mensualidad o se abona la deuda.
 */
export default function ReportPaymentSheet({ open, onClose, accounts, membershipDue, debtDue, suggestedAmount }) {
  const reportPayment = usePaymentStore((state) => state.reportPayment);
  const [coversMembership, setCoversMembership] = useState(false);
  const [coversDebt, setCoversDebt] = useState(false);
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [method, setMethod] = useState('transfer');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [note, setNote] = useState('');
  const [done, setDone] = useState(false);
  const { run, busy, error, setError } = useAction();

  useEffect(() => {
    if (!open) return;
    setCoversMembership(membershipDue || !debtDue);
    setCoversDebt(debtDue);
    setAmount(suggestedAmount > 0 ? String(Math.round(suggestedAmount)) : '');
    const first = accounts?.[0];
    setAccountId(first?.id || '');
    setMethod(guessMethod(first?.label));
    setFile(null);
    setNote('');
    setDone(false);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) {
      setPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pickAccount = (id) => {
    setAccountId(id);
    const account = accounts.find((a) => a.id === id);
    if (account) setMethod(guessMethod(account.label));
  };

  const pickFile = (e) => run(async () => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    const ready = await shrinkImage(picked);
    const problem = receiptProblem(ready);
    if (problem) throw new Error(problem);
    setFile(ready);
  });

  const submit = () => run(async () => {
    if (!coversMembership && !coversDebt) throw new Error('Marca qué pagaste.');
    if (!(Number(amount) > 0)) throw new Error('Escribe el valor que pagaste.');
    await reportPayment({
      amount: Number(amount),
      coversMembership,
      coversDebt,
      paymentMethod: method,
      accountId: accountId || null,
      file,
      note: note.trim(),
    });
    setDone(true);
  });

  const footer = done ? (
    <Button className="w-full py-3" onClick={onClose}>Listo</Button>
  ) : (
    <Button className="w-full py-3" disabled={busy} onClick={submit}>
      {busy ? 'Enviando...' : 'Enviar al box'}
    </Button>
  );

  return (
    <Sheet open={open} title="Reportar pago" onClose={onClose} footer={footer}>
      {done ? (
        <div className="flex flex-col items-center text-center gap-2 py-6">
          <CheckCircle2 className="w-12 h-12 text-emerald-400" />
          <span className="text-base font-black text-white">¡Recibimos tu reporte!</span>
          <span className="text-xs text-[#A0A0A5] max-w-xs">
            El box revisará tu comprobante. Cuando lo confirme, tu mensualidad o tu saldo se actualizan en la app
            y te llega un aviso.
          </span>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#A0A0A5]">¿Qué pagaste?</span>
            <label className="flex items-center gap-2 text-sm font-bold text-white">
              <input
                type="checkbox"
                checked={coversMembership}
                onChange={(e) => setCoversMembership(e.target.checked)}
                className="accent-[#FFC815] w-4 h-4"
              />
              Mensualidad
            </label>
            {debtDue && (
              <label className="flex items-center gap-2 text-sm font-bold text-white">
                <input
                  type="checkbox"
                  checked={coversDebt}
                  onChange={(e) => setCoversDebt(e.target.checked)}
                  className="accent-[#FFC815] w-4 h-4"
                />
                Saldo pendiente (tienda o implementos)
              </label>
            )}
          </div>

          <Field label="Valor que pagaste">
            <MoneyInput value={amount} onChange={setAmount} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            {accounts?.length > 0 && (
              <Field label="¿A dónde?">
                <Select value={accountId} onChange={(e) => pickAccount(e.target.value)}>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                  <option value="">Otra cuenta</option>
                </Select>
              </Field>
            )}
            <Field label="Medio">
              <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                {METHODS.map((m) => <option key={m} value={m}>{paymentMethodLabel(m)}</option>)}
              </Select>
            </Field>
          </div>

          {/* Fuera de Field (un <label>): el selector de archivo tiene su propio label. */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#A0A0A5]">Comprobante</span>
            <label className="p-3 rounded-xl border border-dashed border-white/15 bg-[#0A0A0C] flex items-center gap-3 cursor-pointer tap-bounce">
              {preview ? (
                <img src={preview} alt="Comprobante" className="w-16 h-16 rounded-lg object-cover shrink-0" />
              ) : file ? (
                <FileText className="w-8 h-8 text-[#FFC815] shrink-0" />
              ) : (
                <Upload className="w-6 h-6 text-gray-500 shrink-0" />
              )}
              <span className="text-xs font-bold text-white min-w-0 truncate">
                {file ? file.name : 'Toca para adjuntar la captura o el PDF'}
              </span>
              <input type="file" accept={RECEIPT_ACCEPT} className="hidden" onChange={pickFile} />
            </label>
            {file && <span className="text-[10px] text-gray-500">Toca de nuevo para cambiarlo.</span>}
          </div>

          <Field label="Nota (opcional)">
            <TextArea
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej. pagué desde la cuenta de mi esposa"
            />
          </Field>
        </>
      )}
      <ErrorBox error={error} />
    </Sheet>
  );
}
