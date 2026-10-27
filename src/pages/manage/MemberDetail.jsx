import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  RefreshCw, Ticket, Undo2, Lock, Unlock, Pencil, Plus, CalendarRange, Fingerprint, Smartphone,
  CheckCircle2, Clock3, AlertTriangle, MessageCircle,
} from 'lucide-react';
import useManageStore from '../../stores/manageStore';
import useProfileStore from '../../stores/profileStore';
import {
  ManageHeader, Card, SectionTitle, StatusBadge, Button, ErrorBox, Loading, Money, Row, Sheet, Field,
  ReasonSheet, useAction, inputClass,
} from '../../components/manage/ui';
import RenewSheet from '../../components/manage/RenewSheet';
import MemberFormSheet from '../../components/manage/MemberFormSheet';
import WhatsAppReminderSheet from '../../components/manage/WhatsAppReminderSheet';
import { NewDebtSheet, DebtDetailSheet, DebtRow } from '../../components/manage/DebtSheets';
import { formatDate, formatDateTime, bogotaDate, bogotaDayStart, bogotaDayLastSecond } from '../../utils/dates';
import { formatCOP } from '../../utils/currency';
import { paymentMethodLabel } from '../../utils/currency';

const COMMAND_STATUS = {
  pending: 'En cola',
  processing: 'Aplicando',
  done: 'Aplicado',
  failed: 'Falló',
  cancelled: 'Cancelado',
};

/** Corrección manual de fechas (solo socios). */
function ValiditySheet({ open, status, onClose, onDone }) {
  const setMembershipValidity = useManageStore((state) => state.setMembershipValidity);
  const [from, setFrom] = useState('');
  const [until, setUntil] = useState('');
  const { run, busy, error, setError } = useAction();

  useEffect(() => {
    if (!open) return;
    setFrom(status?.valid_from ? bogotaDate(status.valid_from) : bogotaDate());
    setUntil(status?.valid_until ? bogotaDate(status.valid_until) : bogotaDate());
    setError(null);
  }, [open, status, setError]);

  const submit = () => run(async () => {
    if (!from || !until || until < from) throw new Error('Revisa las fechas.');
    // Igual que private.period_end: la vigencia llega hasta las 23:59:59 del último día.
    await setMembershipValidity(status.member_id, bogotaDayStart(from), bogotaDayLastSecond(until));
    onDone?.();
    onClose();
  });

  return (
    <Sheet
      open={open}
      title="Corregir vigencia"
      onClose={onClose}
      footer={(
        <Button className="w-full py-3" disabled={busy} onClick={submit}>
          {busy ? 'Guardando...' : 'Guardar fechas'}
        </Button>
      )}
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Desde">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputClass} text-xs`} />
        </Field>
        <Field label="Vence">
          <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className={`${inputClass} text-xs`} />
        </Field>
      </div>
      <p className="text-[11px] text-gray-400">
        Solo cambia las fechas: no crea una renovación ni un ingreso. El cambio se envía a HikCentral.
      </p>
      <ErrorBox error={error} />
    </Sheet>
  );
}

export default function MemberDetail() {
  const { id } = useParams();
  const { fetchMemberDetail, loadCatalogs, consumeClass, undoClassUsage, setMemberAccess, voidRenewal, partners, fetchMembers } = useManageStore();
  const isPartner = useProfileStore((state) => state.isPartner);
  const [data, setData] = useState(null);
  const [sheet, setSheet] = useState(null); // 'renew' | 'edit' | 'debt' | 'whatsapp' | 'validity' | 'void:<id>'
  const [selectedDebt, setSelectedDebt] = useState(null);
  const load = useAction();
  const action = useAction();

  const refresh = useCallback(async () => {
    const detail = await fetchMemberDetail(id);
    setData(detail);
    setSelectedDebt((prev) => (prev ? detail.debts.find((d) => d.id === prev.id) || null : null));
    fetchMembers().catch(() => {});
  }, [fetchMemberDetail, fetchMembers, id]);

  useEffect(() => {
    load.run(async () => {
      await loadCatalogs();
      await refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!data) {
    return (
      <div className="flex flex-col gap-3">
        <ManageHeader title="Miembro" back="/manage/members" />
        {load.error ? <ErrorBox error={load.error} /> : <Loading />}
      </div>
    );
  }

  const { status: s, member, renewals, usages, debts, commands } = data;
  if (!s || !member) {
    return (
      <div className="flex flex-col gap-3">
        <ManageHeader title="Miembro" back="/manage/members" />
        <ErrorBox error="Miembro no encontrado." />
      </div>
    );
  }

  const isPack = s.plan_kind === 'class_pack';
  const lastCommand = commands[0];
  const activeUsages = usages.filter((u) => !u.undone_at);
  const openDebts = debts.filter((d) => ['pending', 'partial'].includes(d.status));
  const partnerName = (pid) => partners.find((p) => p.id === pid)?.name || '—';

  const doUseClass = () => action.run(async () => {
    await consumeClass(s.member_id);
    await refresh();
  });

  const doUndo = (usage) => action.run(async () => {
    await undoClassUsage(usage.id);
    await refresh();
  });

  const doToggleAccess = () => action.run(async () => {
    const enable = !s.access_enabled;
    const msg = enable
      ? '¿Desbloquear el acceso? Se restaura la vigencia en HikCentral.'
      : '¿Bloquear el acceso? En HikCentral la vigencia termina ahora mismo.';
    if (!window.confirm(msg)) return;
    await setMemberAccess(s.member_id, enable);
    await refresh();
  });

  return (
    <div className="flex flex-col gap-4 pb-8">
      <ManageHeader
        title={s.full_name}
        subtitle={s.document_id ? `CC ${s.document_id}` : 'Sin cédula'}
        back="/manage/members"
        action={(
          <Button variant="secondary" className="px-3" onClick={() => setSheet('edit')} aria-label="Editar datos">
            <Pencil className="w-4 h-4" />
          </Button>
        )}
      />

      {/* Membresía */}
      <Card className="flex flex-col gap-3 bg-gradient-to-br from-[#1C1C1E] to-[#292929] border-white/10">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A0A0A5] block">
              {s.plan_name || 'Sin plan'}
            </span>
            {s.valid_until ? (
              <span className="text-lg font-black text-white">
                Vence {formatDate(s.valid_until, { withYear: true })}
              </span>
            ) : (
              <span className="text-lg font-black text-gray-400">Sin vigencia</span>
            )}
            {s.days_left != null && s.status !== 'no_membership' && (
              <span className="text-[11px] text-gray-400 block">
                {s.days_left >= 0 ? `${s.days_left} días restantes` : `Vencida hace ${Math.abs(s.days_left)} días`}
              </span>
            )}
          </div>
          <StatusBadge status={s.status} />
        </div>

        {isPack && (
          <div>
            <div className="flex justify-between text-[11px] font-bold mb-1">
              <span className="text-gray-300">Tiquetera</span>
              <span className={s.classes_left <= 2 ? 'text-amber-400' : 'text-white'}>
                {s.classes_left} de {s.classes_total} clases
              </span>
            </div>
            <div className="h-2 rounded-full bg-[#0A0A0C] overflow-hidden">
              <div
                className={`h-full ${s.classes_left <= 2 ? 'bg-amber-400' : 'bg-[#FFC815]'}`}
                style={{ width: `${s.classes_total ? (s.classes_left / s.classes_total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        <div className={`grid gap-2 ${isPack ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <Button onClick={() => setSheet('renew')} disabled={!member.is_active}>
            <RefreshCw className="w-4 h-4" /> Renovar
          </Button>
          {isPack && (
            <Button variant="secondary" onClick={doUseClass} disabled={action.busy || !(s.classes_left > 0)}>
              <Ticket className="w-4 h-4" /> Descontar clase
            </Button>
          )}
        </div>

        {isPartner && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant={s.access_enabled ? 'danger' : 'secondary'} onClick={doToggleAccess} disabled={action.busy}>
              {s.access_enabled ? <><Lock className="w-4 h-4" /> Bloquear</> : <><Unlock className="w-4 h-4" /> Desbloquear</>}
            </Button>
            <Button variant="secondary" onClick={() => setSheet('validity')}>
              <CalendarRange className="w-4 h-4" /> Fechas
            </Button>
          </div>
        )}

        {/* Estado en HikCentral */}
        <div className="flex items-center gap-2 text-[11px] pt-2 border-t border-white/5">
          {!s.hik_person_id ? (
            <>
              <Fingerprint className="w-4 h-4 text-orange-400 shrink-0" />
              <span className="text-orange-300">
                No está en HikCentral. Regístralo allá con su cédula en el campo "Cc" y el PC del box lo vincula solo.
              </span>
            </>
          ) : s.hik_sync_pending ? (
            <>
              <Clock3 className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-amber-300">Enviando el cambio al torniquete...</span>
            </>
          ) : lastCommand?.status === 'failed' ? (
            <>
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span className="text-red-300">El último cambio no llegó a HikCentral: {lastCommand.last_error || 'error desconocido'}</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-gray-300">
                Sincronizado con HikCentral{s.hik_synced_at ? ` ${formatDateTime(s.hik_synced_at)}` : ''}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <Smartphone className={`w-4 h-4 shrink-0 ${s.profile_id ? 'text-sky-400' : 'text-gray-600'}`} />
          <span className="text-gray-300">{s.profile_id ? 'Vinculado a una cuenta de la app' : 'Sin cuenta en la app'}</span>
        </div>
      </Card>

      <ErrorBox error={action.error} />

      {/* Datos */}
      {(s.phone || s.email || member.notes || !member.is_active) && (
        <Card>
          {s.phone && <Row label="Teléfono"><a href={`tel:${s.phone}`} className="text-[#FFC815]">{s.phone}</a></Row>}
          {s.email && <Row label="Email">{s.email}</Row>}
          {member.notes && <Row label="Notas">{member.notes}</Row>}
          {!member.is_active && <Row label="Estado">Inactivo (eliminado en HikCentral)</Row>}
        </Card>
      )}

      {/* Clases usadas */}
      {isPack && activeUsages.length > 0 && (
        <>
          <SectionTitle>Clases descontadas</SectionTitle>
          <Card className="py-2">
            {activeUsages.slice(0, 5).map((u, idx) => (
              <div key={u.id} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0 text-xs">
                <span className="text-gray-300">{formatDateTime(u.used_at)}</span>
                {idx === 0 && (
                  <button
                    type="button"
                    onClick={() => doUndo(u)}
                    disabled={action.busy}
                    className="text-[11px] font-black text-[#FFC815] flex items-center gap-1"
                  >
                    <Undo2 className="w-3.5 h-3.5" /> Deshacer
                  </button>
                )}
              </div>
            ))}
          </Card>
        </>
      )}

      {/* Deudas */}
      <SectionTitle
        action={(
          <div className="flex items-center gap-3">
            {Number(s.debt_balance) > 0 && (
              <button type="button" onClick={() => setSheet('whatsapp')} className="text-[11px] font-black text-[#25D366] flex items-center gap-1">
                <MessageCircle className="w-3.5 h-3.5" /> Recordar
              </button>
            )}
            <button type="button" onClick={() => setSheet('debt')} className="text-[11px] font-black text-[#FFC815] flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Nueva deuda
            </button>
          </div>
        )}
      >
        Deudas {openDebts.length > 0 && `· saldo ${formatCOP(s.debt_balance)}`}
      </SectionTitle>
      {debts.length === 0 ? (
        <p className="text-xs text-gray-500 -mt-2">Sin deudas.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {debts.slice(0, 10).map((d) => (
            <DebtRow key={d.id} debt={d} onClick={() => setSelectedDebt(d)} />
          ))}
        </div>
      )}

      {/* Renovaciones */}
      <SectionTitle>Historial de membresía</SectionTitle>
      {renewals.length === 0 ? (
        <p className="text-xs text-gray-500 -mt-2">Sin renovaciones registradas.</p>
      ) : (
        <Card className="py-1">
          {renewals.map((r) => (
            <div key={r.id} className={`py-2.5 border-b border-white/5 last:border-0 ${r.voided_at ? 'opacity-50' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-white truncate">{r.plan_name}</span>
                {r.voided_at ? (
                  <span className="text-[10px] font-bold text-gray-400">Anulada</span>
                ) : r.payment_status === 'pending' ? (
                  <span className="text-[10px] font-bold text-[#FFC815]">Pago pendiente</span>
                ) : (
                  <Money value={r.amount} className="text-xs text-emerald-400" />
                )}
              </div>
              <span className="text-[10px] text-gray-400 block">
                {formatDate(r.period_start)} → {formatDate(r.period_end, { withYear: true })}
                {r.origin === 'hikcentral' && ' · hecha en HikCentral'}
                {r.payment_status === 'paid' && r.amount > 0 && ` · ${paymentMethodLabel(r.payment_method)} · recibió ${partnerName(r.received_by_partner)}`}
              </span>
              {r.discount > 0 && (
                <span className="text-[10px] text-gray-500 block">Descuento {formatCOP(r.discount)}: {r.discount_reason}</span>
              )}
              {r.void_reason && <span className="text-[10px] text-gray-500 block">Motivo: {r.void_reason}</span>}
              {isPartner && !r.voided_at && (
                <button
                  type="button"
                  onClick={() => setSheet(`void:${r.id}`)}
                  className="mt-1 text-[10px] font-black text-red-400"
                >
                  Anular
                </button>
              )}
            </div>
          ))}
        </Card>
      )}

      <RenewSheet open={sheet === 'renew'} status={s} onClose={() => setSheet(null)} onDone={refresh} />
      <MemberFormSheet open={sheet === 'edit'} member={member} onClose={() => setSheet(null)} onSaved={refresh} />
      <ValiditySheet open={sheet === 'validity'} status={s} onClose={() => setSheet(null)} onDone={refresh} />
      <NewDebtSheet
        open={sheet === 'debt'}
        memberId={s.member_id}
        memberName={s.full_name}
        onClose={() => setSheet(null)}
        onDone={refresh}
      />
      <WhatsAppReminderSheet
        open={sheet === 'whatsapp'}
        memberId={s.member_id}
        onClose={() => {
          setSheet(null);
          refresh();
        }}
      />
      <DebtDetailSheet
        open={!!selectedDebt}
        debt={selectedDebt}
        onClose={() => setSelectedDebt(null)}
        onChanged={refresh}
      />
      <ReasonSheet
        open={sheet?.startsWith('void:')}
        title="Anular renovación"
        confirmLabel="Anular renovación"
        onClose={() => setSheet(null)}
        onConfirm={async (reason) => {
          await voidRenewal(sheet.slice(5), reason);
          await refresh();
        }}
      />
      <p className="text-[10px] text-gray-500 text-center">
        Anular una renovación anula su ingreso, pero no cambia la vigencia: corrígela con "Fechas".
      </p>
    </div>
  );
}
