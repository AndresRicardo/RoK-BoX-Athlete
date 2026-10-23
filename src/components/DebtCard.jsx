import { useState } from 'react';
import { ShoppingBag, AlertTriangle, CheckCircle, ChevronRight, X, Receipt, Package, ArrowDownLeft } from 'lucide-react';
import useDebtStore from '../stores/debtStore';
import { formatCOP, paymentMethodLabel } from '../utils/currency';

export default function DebtCard() {
  const { debts, totalPending, loading } = useDebtStore();
  const [showDetail, setShowDetail] = useState(false);

  const pendingDebts = debts.filter((d) => d.status === 'pending' || d.status === 'partial');

  if (loading && debts.length === 0) {
    return (
      <div className="w-full p-4 rounded-2xl bg-[#1C1C1E] border border-white/5 animate-pulse min-h-[90px]" />
    );
  }

  const hasDebt = totalPending > 0;

  return (
    <>
      <div
        onClick={() => setShowDetail(true)}
        className={`w-full p-4 sm:p-5 rounded-2xl cursor-pointer tap-bounce transition-all ${
          hasDebt
            ? 'bg-gradient-to-br from-[#1C1C1E] via-[#292929] to-[#1C1C1E] border border-amber-500/30 shadow-lg'
            : 'bg-[#1C1C1E] border border-white/5'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl ${
                hasDebt
                  ? 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
                  : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
              }`}
            >
              {hasDebt ? <ShoppingBag className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#A0A0A5]">
                  Deudas de Tienda / Implementos
                </span>
                {hasDebt && (
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500/20 text-amber-400">
                    {pendingDebts.length} {pendingDebts.length === 1 ? 'cuenta' : 'cuentas'}
                  </span>
                )}
              </div>
              <div className="text-xl font-black text-white mt-0.5">
                {hasDebt ? formatCOP(totalPending) : 'Al Día ($ 0)'}
              </div>
            </div>
          </div>

          <div className="flex items-center text-xs font-bold text-gray-400 gap-1">
            <span>{hasDebt ? 'Ver detalle' : 'Historial'}</span>
            <ChevronRight className="w-4 h-4 text-[#FFC815]" />
          </div>
        </div>
      </div>

      {/* Modal / Bottom Sheet de Detalle de Deudas */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm animate-fade-in p-0 sm:p-4">
          <div
            className="w-full max-w-md bg-[#1C1C1E] rounded-t-3xl sm:rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[85vh] animate-slide-up overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#FFC815]/10 text-[#FFC815]">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Detalle de Cobros</h3>
                  <p className="text-xs text-[#A0A0A5]">Implementos y compras registradas</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDetail(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Total balance banner */}
            <div className="p-4 bg-[#292929]/70 border-b border-white/5 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-[#A0A0A5] uppercase tracking-wider block">
                  Total Pendiente por Pagar
                </span>
                <span className="text-2xl font-black text-[#FFC815] mt-0.5 block">
                  {formatCOP(totalPending)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-400 block">Pago presencial</span>
                <span className="text-xs font-bold text-gray-200">Efectivo / Nequi / Datafono</span>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-white/5 p-4 space-y-3">
              {debts.length === 0 ? (
                <div className="p-8 text-center text-sm text-[#A0A0A5]">
                  No tienes cargos registrados en la tienda.
                </div>
              ) : (
                debts.map((item) => {
                  const isVoided = item.status === 'voided';
                  const isPaid = item.status === 'paid';
                  const isPartial = item.status === 'partial';

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl bg-[#0A0A0C] border border-white/5 flex flex-col gap-2.5"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-gray-400">
                              {new Date(item.created_at).toLocaleDateString('es-CO', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-white mt-1">{item.concept}</h4>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-sm font-black text-white block">
                            {formatCOP(item.amount)}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                              isVoided
                                ? 'bg-zinc-700/40 text-zinc-400'
                                : isPaid
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : isPartial
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {isVoided ? 'Anulado' : isPaid ? 'Pagado' : isPartial ? `Resta ${formatCOP(item.balance)}` : 'Pendiente'}
                          </span>
                        </div>
                      </div>

                      {/* Items desglosados */}
                      {item.items && item.items.length > 0 && (
                        <div className="bg-[#1C1C1E] p-2.5 rounded-lg border border-white/5 flex flex-col gap-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#A0A0A5] flex items-center gap-1">
                            <Package className="w-3 h-3 text-[#FFC815]" />
                            <span>Productos incluidos:</span>
                          </span>
                          {item.items.map((it) => (
                            <div key={it.id} className="flex items-center justify-between text-xs text-gray-300">
                              <span>
                                {it.name} {it.quantity > 1 ? `× ${it.quantity}` : ''}
                                {it.delivery_status === 'pending' && (
                                  <span className="ml-1.5 text-[10px] font-bold text-amber-400">Por entregar</span>
                                )}
                              </span>
                              <span className="font-semibold text-white">{formatCOP(it.subtotal)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Abonos registrados */}
                      {item.payments && item.payments.length > 0 && (
                        <div className="bg-[#1C1C1E]/60 p-2.5 rounded-lg border border-emerald-500/20 flex flex-col gap-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                            <ArrowDownLeft className="w-3 h-3" />
                            <span>Abonos realizados:</span>
                          </span>
                          {item.payments.map((pmt) => (
                            <div key={pmt.id} className="flex items-center justify-between text-xs text-emerald-300">
                              <span>
                                {new Date(pmt.paid_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} • {paymentMethodLabel(pmt.payment_method)}
                              </span>
                              <span className="font-bold">+ {formatCOP(pmt.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {isVoided && item.void_reason && (
                        <p className="text-xs text-[#A0A0A5] bg-[#1C1C1E] p-2 rounded-lg italic">
                          Anulado: {item.void_reason}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/10 bg-[#1C1C1E] text-center">
              <p className="text-xs text-[#A0A0A5]">
                Para abonar o saldar tus cuentas, acércate a la recepción o con tu coach en el box.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
