import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, X, AlertCircle, Inbox } from 'lucide-react';
import { formatCOP, paymentMethodLabel } from '../../utils/currency';

// Piezas de interfaz compartidas por las pantallas de Gestión (estética v2).

export const PAYMENT_METHODS = ['cash', 'nequi', 'daviplata', 'bre_b', 'transfer', 'card', 'other'];

export const MEMBERSHIP_STATUS = {
  active: { label: 'Al día', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  expiring_soon: { label: 'Por vencer', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  overdue: { label: 'Vencida', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
  no_classes: { label: 'Sin clases', className: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  disabled: { label: 'Bloqueado', className: 'bg-red-500/15 text-red-400 border-red-500/30' },
  no_membership: { label: 'Sin membresía', className: 'bg-white/5 text-gray-400 border-white/10' },
};

export const DEBT_STATUS = {
  pending: { label: 'Pendiente', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  partial: { label: 'Abonada', className: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
  paid: { label: 'Pagada', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  voided: { label: 'Anulada', className: 'bg-white/5 text-gray-400 border-white/10' },
};

export const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl bg-[#0A0A0C] border border-white/10 text-sm font-bold text-white placeholder-gray-600 focus:outline-none focus:border-[#FFC815] disabled:opacity-50';

export function Badge({ className = '', children }) {
  return (
    <span className={`px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wide whitespace-nowrap ${className}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status, map = MEMBERSHIP_STATUS }) {
  const info = map[status] || { label: status || '—', className: 'bg-white/5 text-gray-400 border-white/10' };
  return <Badge className={info.className}>{info.label}</Badge>;
}

export function ManageHeader({ title, subtitle, back = '/manage', action }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {back && (
          <Link
            to={back}
            aria-label="Volver"
            className="w-9 h-9 shrink-0 rounded-xl bg-[#1C1C1E] border border-white/5 flex items-center justify-center text-gray-300 tap-bounce"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
        )}
        <div className="min-w-0">
          {subtitle && (
            <span className="text-[10px] font-bold text-[#A0A0A5] uppercase tracking-wider block">{subtitle}</span>
          )}
          <h2 className="text-xl font-black text-white tracking-tight truncate">{title}</h2>
        </div>
      </div>
      {action}
    </div>
  );
}

export function Card({ className = '', children, ...props }) {
  return (
    <div className={`p-4 rounded-2xl bg-[#1C1C1E] border border-white/5 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function SectionTitle({ children, action }) {
  return (
    <div className="flex items-center justify-between mt-1">
      <span className="text-xs font-bold text-[#A0A0A5] uppercase tracking-wider">{children}</span>
      {action}
    </div>
  );
}

export function Button({ variant = 'primary', className = '', children, ...props }) {
  const styles = {
    primary: 'bg-[#FFC815] text-black',
    secondary: 'bg-[#292929] text-white border border-white/10',
    danger: 'bg-red-500/15 text-red-400 border border-red-500/30',
    ghost: 'text-[#FFC815]',
  };
  return (
    <button
      type="button"
      className={`py-2.5 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 tap-bounce disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Chips({ options, value, onChange }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`px-3 py-1.5 rounded-full text-[11px] font-black whitespace-nowrap border transition-colors ${
            value === key
              ? 'bg-[#FFC815] text-black border-[#FFC815]'
              : 'bg-[#1C1C1E] text-gray-300 border-white/10'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function Segmented({ options, value, onChange }) {
  return (
    <div className="flex p-1 rounded-xl bg-[#1C1C1E] border border-white/5">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-colors ${
            value === key ? 'bg-white text-black' : 'text-gray-400'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-[11px] font-bold uppercase tracking-wider text-[#A0A0A5]">{label}</span>
      {children}
      {hint && <span className="text-[10px] text-gray-500">{hint}</span>}
    </label>
  );
}

export function TextInput(props) {
  return <input type="text" className={inputClass} {...props} />;
}

export function TextArea(props) {
  return <textarea rows={2} className={`${inputClass} resize-none`} {...props} />;
}

export function Select({ children, ...props }) {
  return (
    <select className={`${inputClass} text-xs`} {...props}>
      {children}
    </select>
  );
}

/** Monto en pesos: solo dígitos, con la cifra formateada debajo. */
export function MoneyInput({ value, onChange, placeholder = '0', ...props }) {
  return (
    <div className="flex flex-col gap-0.5">
      <input
        type="text"
        inputMode="numeric"
        className={inputClass}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        {...props}
      />
      {value !== '' && <span className="text-[10px] text-gray-400 font-bold">{formatCOP(value)}</span>}
    </div>
  );
}

export function PaymentMethodSelect({ value, onChange }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      {PAYMENT_METHODS.map((m) => (
        <option key={m} value={m}>{paymentMethodLabel(m)}</option>
      ))}
    </Select>
  );
}

export function PartnerSelect({ partners, value, onChange, allowEmpty = false }) {
  return (
    <Select value={value || ''} onChange={(e) => onChange(e.target.value)}>
      {allowEmpty && <option value="">— Elegir socio —</option>}
      {partners.filter((p) => p.is_active || p.id === value).map((p) => (
        <option key={p.id} value={p.id}>{p.name}</option>
      ))}
    </Select>
  );
}

export function ErrorBox({ error }) {
  if (!error) return null;
  return (
    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2">
      <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
      <span>{error}</span>
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="p-6 rounded-2xl bg-[#1C1C1E] border border-white/5 text-center">
      <Inbox className="w-7 h-7 text-[#FFC815] mx-auto mb-2 opacity-50" />
      <p className="text-sm font-bold text-white">{title}</p>
      {children && <p className="text-xs text-[#A0A0A5] mt-1">{children}</p>}
    </div>
  );
}

export function Loading({ children = 'Cargando...' }) {
  return <div className="p-8 text-center text-xs text-[#A0A0A5]">{children}</div>;
}

/** Hoja inferior (bottom sheet) para formularios y detalles. */
export function Sheet({ open, title, onClose, children, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#1C1C1E] rounded-t-3xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh] animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-white/5">
          <h3 className="text-base font-black text-white truncate">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="w-8 h-8 rounded-lg bg-[#292929] flex items-center justify-center text-gray-300 tap-bounce shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3.5">{children}</div>
        {footer && <div className="px-5 pt-3 pb-5 safe-bottom border-t border-white/5">{footer}</div>}
      </div>
    </div>
  );
}

/** Hoja para pedir un motivo (anular, rechazar...). */
export function ReasonSheet({ open, title, label = 'Motivo', confirmLabel = 'Confirmar', danger = true, required = true, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const { run, busy, error } = useAction();

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  const submit = () => run(async () => {
    if (required && !reason.trim()) throw new Error('Escribe el motivo.');
    await onConfirm(reason.trim());
    onClose();
  });

  return (
    <Sheet
      open={open}
      title={title}
      onClose={onClose}
      footer={(
        <Button variant={danger ? 'danger' : 'primary'} className="w-full py-3" disabled={busy} onClick={submit}>
          {busy ? 'Guardando...' : confirmLabel}
        </Button>
      )}
    >
      <Field label={label}>
        <TextArea value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
      </Field>
      <ErrorBox error={error} />
    </Sheet>
  );
}

/** Ejecuta una acción asíncrona y expone su estado (ocupado / error). */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const run = useCallback(async (fn) => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(err?.message || 'Ocurrió un error');
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);

  return { run, busy, error, setError };
}

export function Money({ value, className = '' }) {
  return <span className={`font-black tabular-nums ${className}`}>{formatCOP(value)}</span>;
}

export function Row({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/5 last:border-0 text-xs">
      <span className="text-[#A0A0A5]">{label}</span>
      <span className="font-bold text-white text-right">{children}</span>
    </div>
  );
}
