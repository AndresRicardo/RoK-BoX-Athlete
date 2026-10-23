import { useEffect, useMemo, useState } from 'react';
import useManageStore from '../../stores/manageStore';
import {
  Sheet, Field, Select, TextInput, TextArea, MoneyInput, PaymentMethodSelect, PartnerSelect,
  Button, ErrorBox, Money, useAction,
} from './ui';
import { formatDate } from '../../utils/dates';

export function planDuration(plan) {
  if (!plan) return '';
  const parts = [];
  if (plan.duration_months) parts.push(`${plan.duration_months} ${plan.duration_months === 1 ? 'mes' : 'meses'}`);
  if (plan.duration_days) parts.push(`${plan.duration_days} ${plan.duration_days === 1 ? 'día' : 'días'}`);
  const duration = parts.join(' y ');
  return plan.kind === 'class_pack' ? `${plan.class_count} clases · vigencia máx. ${duration}` : duration;
}

// Renovar la membresía de un miembro (renew_membership). El ingreso y el comando
// hacia HikCentral se generan en la base.
export default function RenewSheet({ open, status, onClose, onDone }) {
  const { plans, partners, myPartnerId, renewMembership } = useManageStore();
  const activePlans = plans.filter((p) => p.is_active);
  const [planId, setPlanId] = useState('');
  const [discount, setDiscount] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [method, setMethod] = useState('cash');
  const [partnerId, setPartnerId] = useState('');
  const [note, setNote] = useState('');
  const { run, busy, error } = useAction();

  useEffect(() => {
    if (!open) return;
    const current = activePlans.find((p) => p.id === status?.plan_id);
    setPlanId(current?.id || activePlans[0]?.id || '');
    setDiscount('');
    setDiscountReason('');
    setMethod('cash');
    setPartnerId(myPartnerId || partners.find((p) => p.is_active)?.id || '');
    setNote('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const plan = plans.find((p) => p.id === planId);
  const price = Number(plan?.price || 0);
  const amount = Math.max(0, price - Number(discount || 0));

  // Igual que el servidor: si sigue vigente, la nueva vigencia continúa desde el fin actual.
  const startsOn = useMemo(() => {
    const until = status?.valid_until ? new Date(status.valid_until) : null;
    return until && until > new Date() ? until : new Date();
  }, [status?.valid_until]);

  const submit = () => run(async () => {
    if (!planId) throw new Error('Elige un plan.');
    if (Number(discount || 0) > price) throw new Error('El descuento no puede superar el precio.');
    if (Number(discount || 0) > 0 && !discountReason.trim()) throw new Error('Escribe el motivo del descuento.');
    if (amount > 0 && !partnerId) throw new Error('Elige el socio que recibe el dinero.');
    await renewMembership({
      memberId: status.member_id,
      planId,
      paymentMethod: method,
      partnerId: amount > 0 ? partnerId : null,
      discount: Number(discount || 0),
      discountReason,
      note,
    });
    onDone?.();
    onClose();
  });

  return (
    <Sheet
      open={open}
      title={`Renovar · ${status?.full_name || ''}`}
      onClose={onClose}
      footer={(
        <Button className="w-full py-3" disabled={busy || !planId} onClick={submit}>
          {busy ? 'Renovando...' : <>Renovar por <Money value={amount} /></>}
        </Button>
      )}
    >
      <Field label="Plan" hint={planDuration(plan)}>
        <Select value={planId} onChange={(e) => setPlanId(e.target.value)}>
          {activePlans.length === 0 && <option value="">No hay planes activos</option>}
          {activePlans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {new Intl.NumberFormat('es-CO').format(p.price)}
            </option>
          ))}
        </Select>
      </Field>

      <div className="p-3 rounded-xl bg-[#0A0A0C] border border-white/5 text-xs text-gray-300">
        Empieza el <strong className="text-white">{formatDate(startsOn, { withYear: true })}</strong>
        {status?.valid_until && new Date(status.valid_until) > new Date()
          ? ' (al terminar la vigencia actual).'
          : ' (hoy).'}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Descuento">
          <MoneyInput value={discount} onChange={setDiscount} />
        </Field>
        <Field label="A pagar">
          <div className="px-3.5 py-2.5 rounded-xl bg-[#0A0A0C] border border-white/5">
            <Money value={amount} className="text-sm text-[#FFC815]" />
          </div>
        </Field>
      </div>
      {Number(discount || 0) > 0 && (
        <Field label="Motivo del descuento *">
          <TextInput value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} placeholder="Ej. Precio especial familiar" />
        </Field>
      )}

      {amount > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Medio de pago">
            <PaymentMethodSelect value={method} onChange={setMethod} />
          </Field>
          <Field label="Recibe el dinero">
            <PartnerSelect partners={partners} value={partnerId} onChange={setPartnerId} allowEmpty />
          </Field>
        </div>
      )}

      <Field label="Nota">
        <TextArea value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      {!status?.hik_person_id && (
        <p className="text-[11px] text-orange-400">
          Este miembro aún no está en HikCentral: la vigencia se enviará al torniquete cuando lo registren allá con su cédula.
        </p>
      )}
      <ErrorBox error={error} />
    </Sheet>
  );
}
