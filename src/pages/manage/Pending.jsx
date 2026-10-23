import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Fingerprint, Link2, AlertTriangle, Check, X } from 'lucide-react';
import useManageStore from '../../stores/manageStore';
import useProfileStore from '../../stores/profileStore';
import {
  ManageHeader, Card, SectionTitle, Button, ErrorBox, Loading, Field, Select, MoneyInput, TextArea,
  PaymentMethodSelect, PartnerSelect, Sheet, ReasonSheet, useAction,
} from '../../components/manage/ui';
import { formatDate, formatDateTime } from '../../utils/dates';

/** Registrar el pago de una renovación hecha en HikCentral (complete_pending_renewal). */
function CompletePaymentSheet({ open, renewal, onClose, onDone }) {
  const { plans, partners, myPartnerId, completePendingRenewal } = useManageStore();
  const [planId, setPlanId] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [partnerId, setPartnerId] = useState('');
  const [note, setNote] = useState('');
  const { run, busy, error, setError } = useAction();

  useEffect(() => {
    if (!open || !renewal) return;
    const plan = plans.find((p) => p.id === renewal.plan_id);
    setPlanId(renewal.plan_id || '');
    setAmount(plan ? String(Math.round(Number(plan.price))) : '');
    setMethod('cash');
    setPartnerId(myPartnerId || partners.find((p) => p.is_active)?.id || '');
    setNote('');
    setError(null);
  }, [open, renewal, plans, partners, myPartnerId, setError]);

  const pickPlan = (id) => {
    setPlanId(id);
    const plan = plans.find((p) => p.id === id);
    if (plan) setAmount(String(Math.round(Number(plan.price))));
  };

  const submit = () => run(async () => {
    if (Number(amount || 0) <= 0) throw new Error('Escribe el monto pagado.');
    if (!partnerId) throw new Error('Elige el socio que recibió el dinero.');
    await completePendingRenewal({
      renewalId: renewal.id,
      amount: Number(amount),
      paymentMethod: method,
      partnerId,
      planId: planId || null,
      note,
    });
    onDone?.();
    onClose();
  });

  return (
    <Sheet
      open={open}
      title="Registrar pago"
      onClose={onClose}
      footer={(
        <Button className="w-full py-3" disabled={busy} onClick={submit}>
          {busy ? 'Guardando...' : 'Registrar pago'}
        </Button>
      )}
    >
      {renewal && (
        <div className="p-3 rounded-xl bg-[#0A0A0C] border border-white/5 text-xs text-gray-300">
          <strong className="text-white">{renewal.members?.full_name}</strong> quedó con vigencia hasta el{' '}
          <strong className="text-white">{formatDate(renewal.period_end, { withYear: true })}</strong> desde HikCentral.
        </div>
      )}
      <Field label="Plan">
        <Select value={planId} onChange={(e) => pickPlan(e.target.value)}>
          <option value="">— Sin plan —</option>
          {plans.filter((p) => p.is_active || p.id === planId).map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Monto pagado *">
        <MoneyInput value={amount} onChange={setAmount} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Medio de pago">
          <PaymentMethodSelect value={method} onChange={setMethod} />
        </Field>
        <Field label="Recibió el dinero">
          <PartnerSelect partners={partners} value={partnerId} onChange={setPartnerId} allowEmpty />
        </Field>
      </div>
      <Field label="Nota">
        <TextArea value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <ErrorBox error={error} />
    </Sheet>
  );
}

export default function Pending() {
  const { fetchPending, loadCatalogs, reviewLink, voidRenewal } = useManageStore();
  const isPartner = useProfileStore((state) => state.isPartner);
  const [data, setData] = useState(null);
  const [paying, setPaying] = useState(null);
  const [voiding, setVoiding] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const load = useAction();
  const action = useAction();

  const refresh = useCallback(async () => {
    setData(await fetchPending({ isPartner }));
  }, [fetchPending, isPartner]);

  useEffect(() => {
    load.run(async () => {
      await loadCatalogs();
      await refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  const approve = (link) => action.run(async () => {
    const who = link.profile?.full_name || 'esta cuenta';
    const msg = link.member
      ? `¿Vincular a ${who} con ${link.member.full_name} (CC ${link.document_id})?`
      : `No hay un miembro con la cédula ${link.document_id}. ¿Crearlo y vincularlo a ${who}?`;
    if (!window.confirm(msg)) return;
    await reviewLink(link.id, true);
    await refresh();
  });

  const total = data ? data.renewals.length + data.links.length + data.failed.length : 0;

  return (
    <div className="flex flex-col gap-4 pb-8">
      <ManageHeader title="Pendientes" subtitle={data ? `${total} por revisar` : 'Gestión'} />
      <ErrorBox error={load.error || action.error} />

      {!data ? (
        <Loading />
      ) : total === 0 ? (
        <Card className="text-center py-8">
          <Check className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
          <p className="text-sm font-black text-white">Todo al día</p>
          <p className="text-xs text-[#A0A0A5] mt-1">No hay pagos ni vínculos pendientes.</p>
        </Card>
      ) : null}

      {data && isPartner && data.renewals.length > 0 && (
        <>
          <SectionTitle>Renovaciones de HikCentral sin pago</SectionTitle>
          <p className="text-[11px] text-gray-400 -mt-2">
            Alguien extendió la vigencia directamente en HikCentral. Registra el pago para que entre a la caja.
          </p>
          {data.renewals.map((r) => (
            <Card key={r.id} className="flex flex-col gap-2">
              <div className="flex items-start gap-3">
                <Fingerprint className="w-5 h-5 text-[#FFC815] shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <Link to={`/manage/members/${r.member_id}`} className="text-sm font-black text-white block truncate">
                    {r.members?.full_name || 'Miembro'}
                  </Link>
                  <span className="text-[11px] text-gray-400 block">
                    {r.plan_name} · hasta {formatDate(r.period_end, { withYear: true })}
                  </span>
                  <span className="text-[10px] text-gray-500 block">Detectado {formatDateTime(r.created_at)}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => setVoiding(r)}>Anular</Button>
                <Button onClick={() => setPaying(r)}>Registrar pago</Button>
              </div>
            </Card>
          ))}
        </>
      )}

      {data && data.links.length > 0 && (
        <>
          <SectionTitle>Solicitudes de vínculo</SectionTitle>
          <p className="text-[11px] text-gray-400 -mt-2">
            Atletas que pidieron vincular su cuenta de la app con su cédula.
          </p>
          {data.links.map((l) => (
            <Card key={l.id} className="flex flex-col gap-2">
              <div className="flex items-start gap-3">
                <Link2 className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-black text-white block truncate">
                    {l.profile?.full_name || 'Atleta'}
                    {l.profile?.display_name && <span className="text-gray-400 font-bold"> @{l.profile.display_name}</span>}
                  </span>
                  <span className="text-[11px] text-gray-400 block">CC {l.document_id} · {formatDateTime(l.created_at)}</span>
                  <span className={`text-[11px] block ${l.member ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {l.member
                      ? l.member.profile_id
                        ? `${l.member.full_name} ya tiene otra cuenta vinculada`
                        : `Coincide con ${l.member.full_name}`
                      : 'No hay un miembro con esa cédula'}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="danger" onClick={() => setRejecting(l)} disabled={action.busy}>
                  <X className="w-4 h-4" /> Rechazar
                </Button>
                <Button onClick={() => approve(l)} disabled={action.busy}>
                  <Check className="w-4 h-4" /> Aprobar
                </Button>
              </div>
            </Card>
          ))}
        </>
      )}

      {data && isPartner && data.failed.length > 0 && (
        <>
          <SectionTitle>Cambios que no llegaron a HikCentral</SectionTitle>
          {data.failed.map((c) => (
            <Link key={c.id} to={`/manage/members/${c.member_id}`}>
              <Card className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-black text-white block truncate">{c.members?.full_name || 'Miembro'}</span>
                  <span className="text-[11px] text-red-300 block">{c.last_error || 'Error desconocido'}</span>
                  <span className="text-[10px] text-gray-500 block">
                    {formatDateTime(c.created_at)} · {c.attempts} intentos. Revisa la persona en HikCentral y vuelve a renovar o corregir las fechas.
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </>
      )}

      <CompletePaymentSheet
        open={!!paying}
        renewal={paying}
        onClose={() => setPaying(null)}
        onDone={() => action.run(refresh)}
      />
      <ReasonSheet
        open={!!voiding}
        title="Anular renovación de HikCentral"
        label="Motivo (ej. fue una cortesía)"
        confirmLabel="Anular"
        onClose={() => setVoiding(null)}
        onConfirm={async (reason) => {
          await voidRenewal(voiding.id, reason);
          await refresh();
        }}
      />
      <ReasonSheet
        open={!!rejecting}
        title="Rechazar vínculo"
        label="Motivo (lo verá el atleta)"
        confirmLabel="Rechazar"
        onClose={() => setRejecting(null)}
        onConfirm={async (reason) => {
          await reviewLink(rejecting.id, false, reason);
          await refresh();
        }}
      />
    </div>
  );
}
