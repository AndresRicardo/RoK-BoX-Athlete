import { useState } from 'react';
import { CalendarCheck, ChevronDown, ChevronUp } from 'lucide-react';
import useMembershipStore from '../stores/membershipStore';
import { formatCOP, paymentMethodLabel } from '../utils/currency';

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

export default function PaymentHistory() {
  const { member, renewals } = useMembershipStore();
  const [expanded, setExpanded] = useState(false);

  if (!member) return null;

  const visible = expanded ? renewals : renewals.slice(0, 3);

  return (
    <div className="w-full p-4 rounded-2xl bg-[#1C1C1E] border border-white/5">
      <div className="flex items-center gap-2 mb-3">
        <CalendarCheck className="w-4 h-4 text-[#FFC815]" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#A0A0A5]">
          Pagos de membresía
        </span>
      </div>

      {renewals.length === 0 ? (
        <p className="text-xs text-[#A0A0A5]">Aún no hay pagos registrados en la app.</p>
      ) : (
        <div className="flex flex-col divide-y divide-white/5">
          {visible.map((r) => (
            <div key={r.id} className="py-2.5 first:pt-0 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-sm font-bold text-white block truncate">
                  {r.plan_name}
                  {r.classes ? ` · ${r.classes} clases` : ''}
                </span>
                <span className="text-[11px] text-[#A0A0A5]">
                  {fmtDate(r.period_start)} → {fmtDate(r.period_end)}
                </span>
              </div>
              <div className="text-right shrink-0">
                {r.payment_status === 'pending' ? (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
                    Por confirmar
                  </span>
                ) : (
                  <>
                    <span className="text-sm font-black text-white block">{formatCOP(r.amount)}</span>
                    <span className="text-[11px] text-[#A0A0A5]">{paymentMethodLabel(r.payment_method)}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {renewals.length > 3 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 w-full flex items-center justify-center gap-1 text-xs font-bold text-[#FFC815] tap-bounce"
        >
          {expanded ? (
            <>Ver menos <ChevronUp className="w-4 h-4" /></>
          ) : (
            <>Ver todos ({renewals.length}) <ChevronDown className="w-4 h-4" /></>
          )}
        </button>
      )}
    </div>
  );
}
