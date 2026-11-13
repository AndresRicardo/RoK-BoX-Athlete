import { useEffect, useState } from 'react';
import {
  Copy, Check, MessageCircle, Landmark, Download, CalendarClock, ShoppingBag, Info, X, Receipt, Clock3,
  CheckCircle2, XCircle,
} from 'lucide-react';
import { Sheet, Loading, ErrorBox } from './manage/ui';
import { supabase } from '../supabase/client';
import useMembershipStore from '../stores/membershipStore';
import useDebtStore from '../stores/debtStore';
import useProfileStore from '../stores/profileStore';
import usePaymentStore from '../stores/paymentStore';
import { formatCOP } from '../utils/currency';
import { formatDate } from '../utils/dates';
import { dueText, whatsappPhone, whatsappUrl } from '../utils/whatsapp';
import { timeAgo } from '../utils/time';
import ReportPaymentSheet from './ReportPaymentSheet';

// Estados de la membresía en los que el atleta ve "Pagar" (D51).
export const PAYABLE_MEMBERSHIP = ['overdue', 'expiring_soon', 'no_classes'];

/** Qué tiene por pagar el atleta: mensualidad (vencida, por vencer o sin clases) y deudas. */
export function usePayables() {
  const membership = useMembershipStore((state) => state.membership);
  const totalPending = useDebtStore((state) => state.totalPending);
  const membershipDue = Boolean(membership && PAYABLE_MEMBERSHIP.includes(membership.dynamicStatus));
  const debtDue = Number(totalPending) > 0;
  return { membership, membershipDue, debtDue, totalPending: Number(totalPending) || 0, any: membershipDue || debtDue };
}

function membershipLine(m) {
  if (m.dynamicStatus === 'no_classes') return 'Ya usaste todas las clases de tu tiquetera';
  const text = dueText(m.days_left ?? m.daysRemaining);
  return `${text.charAt(0).toUpperCase()}${text.slice(1)} (${formatDate(m.valid_until)})`;
}

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value.replace(/\s+/g, ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copia el número:', value);
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-black flex items-center gap-1 tap-bounce ${
        copied ? 'bg-emerald-500/15 text-emerald-400' : 'bg-[#292929] text-white'
      }`}
    >
      {copied ? <><Check className="w-3.5 h-3.5" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
    </button>
  );
}

// Guarda el QR para abrirlo desde la app del banco ("pagar con QR" → galería). En el
// teléfono se ofrece compartir/guardar la imagen; si no se puede, se descarga.
async function saveQr(url, label) {
  const blob = await (await fetch(url)).blob();
  const ext = blob.type.split('/')[1] || 'png';
  const name = `QR ${label}.${ext === 'jpeg' ? 'jpg' : ext}`;
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function AccountCard({ account, onZoom }) {
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      await saveQr(account.qrUrl, account.label);
    } catch {
      window.open(account.qrUrl, '_blank', 'noopener');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3.5 rounded-2xl bg-[#0A0A0C] border border-white/10 flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <Landmark className="w-4 h-4 text-[#FFC815] shrink-0" />
        <span className="text-sm font-black text-white">{account.label}</span>
      </div>

      {account.account_number && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-lg font-black text-white tabular-nums tracking-wide break-all">{account.account_number}</span>
          <CopyButton value={account.account_number} />
        </div>
      )}

      {(account.holder_name || account.holder_document) && (
        <span className="text-[11px] text-[#A0A0A5]">
          A nombre de {[account.holder_name, account.holder_document && `CC/NIT ${account.holder_document}`].filter(Boolean).join(' · ')}
        </span>
      )}
      {account.notes && <span className="text-[11px] text-gray-300">{account.notes}</span>}

      {account.qrUrl && (
        <div className="flex flex-col items-center gap-2 pt-1">
          <button type="button" onClick={() => onZoom(account)} className="tap-bounce" aria-label={`Ampliar QR de ${account.label}`}>
            <img src={account.qrUrl} alt={`QR de ${account.label}`} className="w-44 h-44 rounded-xl bg-white p-1.5 object-contain" />
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg bg-[#292929] text-white text-[11px] font-black flex items-center gap-1.5 tap-bounce disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" /> {saving ? 'Guardando...' : 'Guardar QR'}
          </button>
        </div>
      )}
    </div>
  );
}

const DAY_MS = 24 * 60 * 60 * 1000;

function reportConcept(r) {
  if (r.covers_membership && r.covers_debt) return 'mensualidad y saldo';
  return r.covers_membership ? 'mensualidad' : 'saldo pendiente';
}

/** Pagos reportados: en revisión, y los revisados en los últimos días. */
function MyReports({ reports, onCancel, busyId }) {
  const now = Date.now();
  const visible = reports.filter((r) => r.status === 'pending'
    || (r.status === 'rejected' && now - new Date(r.reviewed_at).getTime() < 14 * DAY_MS)
    || (r.status === 'approved' && now - new Date(r.reviewed_at).getTime() < 3 * DAY_MS));
  if (visible.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      {visible.map((r) => (
        <div
          key={r.id}
          className={`p-3 rounded-2xl border flex items-start gap-2.5 ${
            r.status === 'pending' ? 'bg-sky-500/10 border-sky-500/30'
              : r.status === 'approved' ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-red-500/10 border-red-500/30'
          }`}
        >
          {r.status === 'pending' ? <Clock3 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            : r.status === 'approved' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              : <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />}
          <div className="flex-1 min-w-0 text-[11px]">
            <span className="font-black text-white block">
              {r.status === 'pending' ? 'Pago en revisión' : r.status === 'approved' ? 'Pago confirmado' : 'Pago no confirmado'}
              {' · '}{formatCOP(r.amount)}
            </span>
            <span className="text-gray-300 block">
              {reportConcept(r)}{r.account_label ? ` · ${r.account_label}` : ''} · reportado {timeAgo(r.created_at)}
            </span>
            {r.status === 'rejected' && r.review_note && <span className="text-red-300 block">Motivo: {r.review_note}</span>}
          </div>
          {r.status === 'pending' && (
            <button
              type="button"
              disabled={busyId === r.id}
              onClick={() => onCancel(r)}
              className="text-[10px] font-black text-gray-400 shrink-0 disabled:opacity-50"
            >
              Cancelar
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * "Pagar" del atleta (D51): qué debe y los medios de pago del box (cuenta, llave o QR).
 * "Ya pagué" reporta el pago con el comprobante (D52) y el staff lo confirma desde
 * Pendientes; el WhatsApp del box queda como alternativa.
 */
export default function PaySheet({ open, onClose }) {
  const { membership, membershipDue, debtDue, totalPending } = usePayables();
  const member = useMembershipStore((state) => state.member);
  const debts = useDebtStore((state) => state.debts);
  // Al abrir desde un aviso push, la membresía y las deudas pueden estar cargando.
  const membershipLoading = useMembershipStore((state) => state.loading);
  const debtsLoading = useDebtStore((state) => state.loading);
  const loadingOwed = membershipLoading || debtsLoading;
  const profile = useProfileStore((state) => state.profile);
  const {
    info, loading, error, fetchPaymentInfo, reports, fetchMyReports, cancelReport,
  } = usePaymentStore();
  const [planPrice, setPlanPrice] = useState(null);
  const [zoom, setZoom] = useState(null);
  const [reporting, setReporting] = useState(false);
  const [cancelling, setCancelling] = useState(null);
  const [cancelError, setCancelError] = useState(null);

  useEffect(() => {
    if (!open) return;
    fetchPaymentInfo();
    fetchMyReports();
    setZoom(null);
    setReporting(false);
    setCancelError(null);
  }, [open, fetchPaymentInfo, fetchMyReports]);

  const cancel = async (report) => {
    if (!window.confirm(`¿Cancelar el reporte de ${formatCOP(report.amount)}? El box ya no lo revisará.`)) return;
    setCancelling(report.id);
    setCancelError(null);
    try {
      await cancelReport(report.id);
    } catch (err) {
      setCancelError(err.message);
    } finally {
      setCancelling(null);
    }
  };

  // Precio de lista del plan actual (si sigue disponible), como referencia.
  useEffect(() => {
    if (!open || !membershipDue || !membership?.plan_id) {
      setPlanPrice(null);
      return undefined;
    }
    let alive = true;
    supabase.from('membership_plans').select('price, is_active').eq('id', membership.plan_id).maybeSingle()
      .then(({ data }) => {
        if (alive) setPlanPrice(data?.is_active && Number(data.price) > 0 ? Number(data.price) : null);
      });
    return () => {
      alive = false;
    };
  }, [open, membershipDue, membership?.plan_id]);

  const openDebts = (debts || []).filter((d) => ['pending', 'partial'].includes(d.status));
  const total = (membershipDue ? planPrice || 0 : 0) + (debtDue ? totalPending : 0);
  const totalKnown = !membershipDue || planPrice != null;

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || member?.full_name || '';
  const concepts = [membershipDue && 'mi mensualidad', debtDue && 'mi saldo pendiente'].filter(Boolean).join(' y ');
  const proofText = [
    `Hola 👋 Soy ${fullName}${member?.document_id ? ` (CC ${member.document_id})` : ''}.`,
    `Acabo de pagar ${concepts || 'en el box'}${totalKnown && total > 0 ? ` por ${formatCOP(total).replace(/\s/g, ' ')}` : ''}.`,
    'Te envío el comprobante 🧾',
  ].join(' ');
  const proofPhone = whatsappPhone(info?.whatsapp);

  const footer = (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setReporting(true)}
        className="w-full py-3 rounded-xl bg-[#FFC815] text-black font-black text-xs flex items-center justify-center gap-1.5 tap-bounce"
      >
        <Receipt className="w-4 h-4" /> Ya pagué: reportar pago
      </button>
      {proofPhone && (
        <a
          href={whatsappUrl(proofPhone, proofText)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] font-bold text-[#25D366] flex items-center justify-center gap-1"
        >
          <MessageCircle className="w-3.5 h-3.5" /> o envía el comprobante por WhatsApp
        </a>
      )}
    </div>
  );

  return (
    <>
      <Sheet open={open} title="Pagar" onClose={onClose} footer={footer}>
        <MyReports reports={reports} onCancel={cancel} busyId={cancelling} />
        <ErrorBox error={cancelError} />
        {/* Qué paga */}
        <div className="flex flex-col gap-2">
          {membershipDue && (
            <div className="p-3 rounded-2xl bg-[#292929]/60 border border-white/5 flex items-start gap-3">
              <CalendarClock className={`w-5 h-5 shrink-0 mt-0.5 ${membership.dynamicStatus === 'expiring_soon' ? 'text-amber-400' : 'text-red-400'}`} />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-black text-white block">
                  Mensualidad{membership.plan_name && membership.plan_name !== 'Sin plan' ? ` · ${membership.plan_name}` : ''}
                </span>
                <span className="text-[11px] text-[#A0A0A5] block">{membershipLine(membership)}</span>
              </div>
              <span className="text-sm font-black text-white shrink-0">
                {planPrice != null ? formatCOP(planPrice) : <span className="text-[11px] text-gray-400 font-bold">Consulta el valor</span>}
              </span>
            </div>
          )}
          {debtDue && (
            <div className="p-3 rounded-2xl bg-[#292929]/60 border border-white/5 flex items-start gap-3">
              <ShoppingBag className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-black text-white block">Saldo pendiente</span>
                <span className="text-[11px] text-[#A0A0A5] block">
                  {openDebts.length} {openDebts.length === 1 ? 'cuenta' : 'cuentas'} de tienda o implementos
                </span>
              </div>
              <span className="text-sm font-black text-white shrink-0">{formatCOP(totalPending)}</span>
            </div>
          )}
          {membershipDue && debtDue && totalKnown && (
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-[#A0A0A5]">Total</span>
              <span className="text-xl font-black text-[#FFC815]">{formatCOP(total)}</span>
            </div>
          )}
          {membershipDue && planPrice != null && (
            <p className="text-[10px] text-gray-500 px-1">
              Es el valor de lista de tu plan. Si tienes un precio especial o quieres cambiar de plan, paga el valor acordado con el box.
            </p>
          )}
          {!membershipDue && !debtDue && loadingOwed && <Loading />}
          {!membershipDue && !debtDue && !loadingOwed && (
            <p className="text-xs text-[#A0A0A5]">Estás al día. Aquí tienes los medios de pago del box para cuando los necesites.</p>
          )}
        </div>

        {/* Cómo paga */}
        <span className="text-[11px] font-black uppercase tracking-wider text-[#A0A0A5] pt-1">Medios de pago</span>
        {!info ? (
          error ? <ErrorBox error={error} /> : loading ? <Loading /> : null
        ) : info.accounts.length === 0 ? (
          <p className="text-xs text-[#A0A0A5]">
            El box aún no ha publicado sus medios de pago en la app. Puedes pagar directamente en el box.
          </p>
        ) : (
          info.accounts.map((a) => <AccountCard key={a.id} account={a} onZoom={setZoom} />)
        )}

        {info?.instructions && (
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-[#292929]/60 text-[11px] text-gray-300">
            <Info className="w-3.5 h-3.5 text-[#FFC815] shrink-0 mt-0.5" />
            <span className="whitespace-pre-line">{info.instructions}</span>
          </div>
        )}
        <p className="text-[10px] text-gray-500">
          Después de pagar, toca "Ya pagué" y adjunta el comprobante: tu pago aparece en la app cuando el box lo
          confirma. También puedes pagar en efectivo en el box.
        </p>
      </Sheet>
      <ReportPaymentSheet
        open={open && reporting}
        onClose={() => {
          setReporting(false);
          fetchMyReports();
        }}
        accounts={info?.accounts || []}
        membershipDue={membershipDue}
        debtDue={debtDue}
        suggestedAmount={totalKnown ? total : (debtDue ? totalPending : 0)}
      />
      {open && zoom && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center gap-4 p-6"
          onClick={() => setZoom(null)}
        >
          <button
            type="button"
            onClick={() => setZoom(null)}
            aria-label="Cerrar"
            className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-[#292929] flex items-center justify-center text-white"
          >
            <X className="w-5 h-5" />
          </button>
          <img src={zoom.qrUrl} alt={`QR de ${zoom.label}`} className="w-full max-w-sm rounded-2xl bg-white p-3 object-contain" />
          <span className="text-sm font-black text-white">{zoom.label}</span>
        </div>
      )}
    </>
  );
}
