import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Fingerprint, Link2, AlertTriangle, Check, X, UserSearch, UserPlus } from 'lucide-react';
import useManageStore from '../../stores/manageStore';
import useProfileStore from '../../stores/profileStore';
import {
  ManageHeader, Card, SectionTitle, Button, ErrorBox, Loading, Field, Select, MoneyInput, TextArea,
  PaymentMethodSelect, PartnerSelect, Sheet, ReasonSheet, StatusBadge, TextInput, useAction,
} from '../../components/manage/ui';
import { formatDate, formatDateTime } from '../../utils/dates';
import { PaymentReportCard, ApproveReportSheet } from '../../components/manage/PaymentReportSheets';

const normalize = (text) => (text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const FAILED_HINT = {
  set_validity: 'Revisa la persona en HikCentral y vuelve a renovar o corregir las fechas.',
  update_person: 'Revisa la cédula del miembro (solo números) y vuelve a guardarla.',
};

/**
 * Aprobar un vínculo cuya cédula no tiene ningún miembro: se elige el miembro (normalmente
 * importado de HikCentral sin "Cc") y recibe la cédula, también en HikCentral (D48).
 */
function ChooseMemberSheet({ open, link, onClose, onDone }) {
  const { fetchMembers, reviewLink } = useManageStore();
  const [members, setMembers] = useState(null);
  const [search, setSearch] = useState('');
  const { run, busy, error, setError } = useAction();

  useEffect(() => {
    if (!open || !link) return;
    setSearch(link.profile?.full_name || '');
    setError(null);
    setMembers(null);
    run(async () => setMembers(await fetchMembers()));
  }, [open, link, fetchMembers, run, setError]);

  // Sin cuenta vinculada, ordenados por cuántas palabras de la búsqueda coinciden.
  const candidates = useMemo(() => {
    if (!members) return [];
    const tokens = normalize(search).split(/\s+/).filter((t) => t.length > 1);
    return members
      .filter((m) => m.is_active && !m.profile_id)
      .map((m) => {
        const name = normalize(m.full_name);
        const score = tokens.filter((t) => name.includes(t) || (m.document_id || '').includes(t)).length;
        return { m, score };
      })
      .filter(({ score }) => tokens.length === 0 || score > 0)
      .sort((a, b) => b.score - a.score || a.m.full_name.localeCompare(b.m.full_name))
      .slice(0, 30)
      .map(({ m }) => m);
  }, [members, search]);

  if (!link) return null;
  const who = link.profile?.full_name || 'esta cuenta';

  const choose = (m) => run(async () => {
    const where = m.hik_person_id ? ' y en HikCentral' : '';
    if (!window.confirm(`¿Vincular a ${who} con ${m.full_name}? La cédula ${link.document_id} quedará en el miembro${where}.`)) return;
    await reviewLink(link.id, true, null, m.member_id);
    onDone?.();
    onClose();
  });

  const createNew = () => run(async () => {
    if (!window.confirm(`¿Crear un miembro nuevo con la cédula ${link.document_id} y vincularlo a ${who}? Hazlo solo si la persona aún no está en HikCentral.`)) return;
    await reviewLink(link.id, true);
    onDone?.();
    onClose();
  });

  return (
    <Sheet
      open={open}
      title="Elegir miembro"
      onClose={onClose}
      footer={(
        <Button variant="secondary" className="w-full py-3" disabled={busy} onClick={createNew}>
          <UserPlus className="w-4 h-4" /> No está: crear miembro nuevo
        </Button>
      )}
    >
      <div className="p-3 rounded-xl bg-[#0A0A0C] border border-white/5 text-xs text-gray-300">
        <strong className="text-white">{who}</strong> pidió vincularse con la CC{' '}
        <strong className="text-white">{link.document_id}</strong>, pero ningún miembro la tiene. Elige quién es:
        la cédula se guarda en el miembro y en HikCentral, aunque su membresía esté vencida.
      </div>
      <Field label="Buscar por nombre o cédula">
        <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre" />
      </Field>
      <ErrorBox error={error} />
      {!members ? (
        <Loading />
      ) : candidates.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">Sin coincidencias. Prueba con otra parte del nombre.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {candidates.map((m) => {
            const otherDoc = m.document_id && m.document_id !== link.document_id;
            return (
              <button
                key={m.member_id}
                type="button"
                disabled={busy || otherDoc}
                onClick={() => choose(m)}
                className="w-full text-left p-3 rounded-xl bg-[#0A0A0C] border border-white/5 flex items-center gap-3 tap-bounce disabled:opacity-50"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-black text-white block truncate">{m.full_name}</span>
                  <span className="text-[11px] text-gray-400 block">
                    {otherDoc ? `Ya tiene la CC ${m.document_id}` : 'Sin cédula'}
                    {m.hik_person_id ? ' · en HikCentral' : ' · no está en HikCentral'}
                  </span>
                </div>
                <StatusBadge status={m.status} />
              </button>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}

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
  const { fetchPending, loadCatalogs, reviewLink, voidRenewal, rejectPaymentReport } = useManageStore();
  const isPartner = useProfileStore((state) => state.isPartner);
  const [data, setData] = useState(null);
  const [paying, setPaying] = useState(null);
  const [voiding, setVoiding] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [choosing, setChoosing] = useState(null);
  const [confirmingReport, setConfirmingReport] = useState(null);
  const [rejectingReport, setRejectingReport] = useState(null);
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

  const approve = (link) => {
    // Sin miembro con esa cédula: se elige el miembro (o se crea uno nuevo) en la hoja.
    if (!link.member) {
      setChoosing(link);
      return;
    }
    action.run(async () => {
      const who = link.profile?.full_name || 'esta cuenta';
      if (!window.confirm(`¿Vincular a ${who} con ${link.member.full_name} (CC ${link.document_id})?`)) return;
      await reviewLink(link.id, true);
      await refresh();
    });
  };

  const total = data ? data.renewals.length + data.links.length + data.failed.length + data.reports.length : 0;

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
          <p className="text-xs text-[#A0A0A5] mt-1">No hay pagos reportados, pagos ni vínculos pendientes.</p>
        </Card>
      ) : null}

      {data && data.reports.length > 0 && (
        <>
          <SectionTitle>Pagos reportados por atletas</SectionTitle>
          <p className="text-[11px] text-gray-400 -mt-2">
            Revisa que el dinero haya llegado a la cuenta y confirma: se renueva la mensualidad o se abona la deuda.
          </p>
          {data.reports.map((r) => (
            <PaymentReportCard key={r.id} report={r} onApprove={setConfirmingReport} onReject={setRejectingReport} />
          ))}
        </>
      )}

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
                      : 'Ningún miembro tiene esa cédula: elige quién es'}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="danger" onClick={() => setRejecting(l)} disabled={action.busy}>
                  <X className="w-4 h-4" /> Rechazar
                </Button>
                <Button onClick={() => approve(l)} disabled={action.busy}>
                  {l.member
                    ? <><Check className="w-4 h-4" /> Aprobar</>
                    : <><UserSearch className="w-4 h-4" /> Elegir miembro</>}
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
                    {formatDateTime(c.created_at)} · {c.attempts} intentos. {FAILED_HINT[c.command] || FAILED_HINT.set_validity}
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
      <ChooseMemberSheet
        open={!!choosing}
        link={choosing}
        onClose={() => setChoosing(null)}
        onDone={() => action.run(refresh)}
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
      <ApproveReportSheet
        report={confirmingReport}
        onClose={() => setConfirmingReport(null)}
        onDone={() => load.run(refresh)}
      />
      <ReasonSheet
        open={!!rejectingReport}
        title="Rechazar pago reportado"
        label="Motivo (lo verá el atleta; ej. no vemos la transferencia)"
        confirmLabel="Rechazar"
        onClose={() => setRejectingReport(null)}
        onConfirm={async (reason) => {
          await rejectPaymentReport(rejectingReport.id, reason);
          await refresh();
        }}
      />
    </div>
  );
}
