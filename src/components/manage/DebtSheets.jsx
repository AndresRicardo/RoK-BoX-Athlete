import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Search, PackageCheck, PackageX } from 'lucide-react';
import useManageStore from '../../stores/manageStore';
import {
  Sheet, Field, Select, TextInput, TextArea, MoneyInput, PaymentMethodSelect, PartnerSelect,
  Button, ErrorBox, Money, StatusBadge, DEBT_STATUS, ReasonSheet, useAction, inputClass,
} from './ui';
import { formatCOP, paymentMethodLabel } from '../../utils/currency';
import { formatDate, formatDateTime } from '../../utils/dates';

const fold = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const CATEGORY_LABELS = { store: 'Tienda', equipment: 'Implementos', other: 'Otros' };

/** Buscador de miembro para cuando la deuda no se abre desde su ficha. */
function MemberPicker({ value, onChange }) {
  const { members, membersLoaded, fetchMembers } = useManageStore();
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!membersLoaded) fetchMembers().catch(() => {});
  }, [membersLoaded, fetchMembers]);

  const selected = members.find((m) => m.member_id === value);
  const matches = useMemo(() => {
    const f = fold(q.trim());
    if (f.length < 2) return [];
    return members
      .filter((m) => m.is_active && (fold(m.full_name).includes(f) || (m.document_id || '').includes(f)))
      .slice(0, 6);
  }, [members, q]);

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-[#0A0A0C] border border-[#FFC815]/40">
        <span className="text-sm font-bold text-white truncate">{selected.full_name}</span>
        <button type="button" onClick={() => onChange('')} className="text-[11px] font-black text-[#FFC815]">
          Cambiar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o cédula"
          className={`${inputClass} pl-9`}
        />
      </div>
      {matches.map((m) => (
        <button
          key={m.member_id}
          type="button"
          onClick={() => { onChange(m.member_id); setQ(''); }}
          className="text-left px-3 py-2 rounded-lg bg-[#292929] text-xs font-bold text-white"
        >
          {m.full_name} {m.document_id && <span className="text-gray-400 font-normal">· {m.document_id}</span>}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// Nueva deuda (create_debt)
// ---------------------------------------------------------------------
export function NewDebtSheet({ open, memberId: fixedMemberId, memberName, onClose, onDone }) {
  const { products, createDebt } = useManageStore();
  const activeProducts = products.filter((p) => p.is_active);
  const [memberId, setMemberId] = useState('');
  const [concept, setConcept] = useState('');
  const [items, setItems] = useState([]);
  const [productId, setProductId] = useState('');
  const [freeName, setFreeName] = useState('');
  const [freePrice, setFreePrice] = useState('');
  const { run, busy, error, setError } = useAction();

  useEffect(() => {
    if (!open) return;
    setMemberId(fixedMemberId || '');
    setConcept('');
    setItems([]);
    setProductId('');
    setFreeName('');
    setFreePrice('');
    setError(null);
  }, [open, fixedMemberId, setError]);

  const total = items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0);

  const addProduct = () => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setItems((prev) => {
      const existing = prev.find((it) => it.product_id === p.id);
      if (existing) {
        return prev.map((it) => (it === existing ? { ...it, quantity: it.quantity + 1 } : it));
      }
      return [...prev, { key: crypto.randomUUID(), product_id: p.id, name: p.name, quantity: 1, unit_price: Number(p.price), delivery_status: 'delivered' }];
    });
    setProductId('');
  };

  const addFree = () => {
    if (!freeName.trim() || freePrice === '') return;
    setItems((prev) => [...prev, {
      key: crypto.randomUUID(), product_id: null, name: freeName.trim(), quantity: 1,
      unit_price: Number(freePrice), delivery_status: 'delivered',
    }]);
    setFreeName('');
    setFreePrice('');
  };

  const updateItem = (key, patch) => setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  const submit = () => run(async () => {
    if (!memberId) throw new Error('Elige el miembro.');
    if (items.length === 0) throw new Error('Agrega al menos un ítem.');
    await createDebt({
      memberId,
      concept: concept.trim(),
      items: items.map(({ product_id, name, quantity, unit_price, delivery_status }) => ({
        product_id, name, quantity, unit_price, delivery_status,
      })),
    });
    onDone?.();
    onClose();
  });

  return (
    <Sheet
      open={open}
      title={memberName ? `Nueva deuda · ${memberName}` : 'Nueva deuda'}
      onClose={onClose}
      footer={(
        <Button className="w-full py-3" disabled={busy || items.length === 0} onClick={submit}>
          {busy ? 'Guardando...' : <>Cargar <Money value={total} /></>}
        </Button>
      )}
    >
      {!fixedMemberId && (
        <Field label="Miembro *">
          <MemberPicker value={memberId} onChange={setMemberId} />
        </Field>
      )}

      <Field label="Concepto (opcional)">
        <TextInput value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Ej. Compras de octubre" />
      </Field>

      <Field label="Agregar del catálogo">
        <div className="flex gap-2">
          <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Elegir producto</option>
            {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
              const list = activeProducts.filter((p) => p.category === cat);
              if (list.length === 0) return null;
              return (
                <optgroup key={cat} label={label}>
                  {list.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} · {formatCOP(p.price)}</option>
                  ))}
                </optgroup>
              );
            })}
          </Select>
          <Button variant="secondary" onClick={addProduct} disabled={!productId} aria-label="Agregar producto">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </Field>

      <Field label="O un ítem libre">
        <div className="grid grid-cols-[1fr_7rem_auto] gap-2 items-start">
          <TextInput value={freeName} onChange={(e) => setFreeName(e.target.value)} placeholder="Descripción" />
          <input
            type="text"
            inputMode="numeric"
            value={freePrice}
            onChange={(e) => setFreePrice(e.target.value.replace(/\D/g, ''))}
            placeholder="Precio"
            className={inputClass}
          />
          <Button variant="secondary" onClick={addFree} disabled={!freeName.trim() || freePrice === ''} aria-label="Agregar ítem">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </Field>

      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((it) => (
            <div key={it.key} className="p-3 rounded-xl bg-[#0A0A0C] border border-white/5 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-white truncate">{it.name}</span>
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev.filter((x) => x.key !== it.key))}
                  className="text-gray-500 hover:text-red-400"
                  aria-label="Quitar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 items-center">
                <input
                  type="number"
                  min="1"
                  value={it.quantity}
                  onChange={(e) => updateItem(it.key, { quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  className={`${inputClass} py-1.5 text-xs`}
                  aria-label="Cantidad"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={it.unit_price}
                  onChange={(e) => updateItem(it.key, { unit_price: Number(e.target.value.replace(/\D/g, '') || 0) })}
                  className={`${inputClass} py-1.5 text-xs`}
                  aria-label="Precio unitario"
                />
                <Money value={it.quantity * it.unit_price} className="text-xs text-white text-right" />
              </div>
              <label className="flex items-center gap-2 text-[11px] text-gray-300">
                <input
                  type="checkbox"
                  checked={it.delivery_status === 'pending'}
                  onChange={(e) => updateItem(it.key, { delivery_status: e.target.checked ? 'pending' : 'delivered' })}
                  className="accent-[#FFC815]"
                />
                Pendiente por entregar
              </label>
            </div>
          ))}
        </div>
      )}
      <ErrorBox error={error} />
    </Sheet>
  );
}

// ---------------------------------------------------------------------
// Abono (insert debt_payments)
// ---------------------------------------------------------------------
export function PaymentSheet({ open, debt, onClose, onDone }) {
  const { partners, myPartnerId, addDebtPayment } = useManageStore();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [partnerId, setPartnerId] = useState('');
  const [note, setNote] = useState('');
  const { run, busy, error, setError } = useAction();

  useEffect(() => {
    if (!open) return;
    setAmount(debt ? String(Math.round(Number(debt.balance || 0))) : '');
    setMethod('cash');
    setPartnerId(myPartnerId || partners.find((p) => p.is_active)?.id || '');
    setNote('');
    setError(null);
  }, [open, debt, myPartnerId, partners, setError]);

  const submit = () => run(async () => {
    const value = Number(amount || 0);
    if (value <= 0) throw new Error('Escribe el monto del abono.');
    if (value > Number(debt.balance)) throw new Error(`El abono supera el saldo (${formatCOP(debt.balance)}).`);
    if (!partnerId) throw new Error('Elige el socio que recibe el dinero.');
    await addDebtPayment({ debtId: debt.id, amount: value, paymentMethod: method, partnerId, note });
    onDone?.();
    onClose();
  });

  return (
    <Sheet
      open={open}
      title="Registrar abono"
      onClose={onClose}
      footer={(
        <Button className="w-full py-3" disabled={busy} onClick={submit}>
          {busy ? 'Guardando...' : 'Registrar abono'}
        </Button>
      )}
    >
      {debt && (
        <div className="p-3 rounded-xl bg-[#0A0A0C] border border-white/5 text-xs">
          <span className="text-gray-400">{debt.member_name} · saldo </span>
          <Money value={debt.balance} className="text-[#FFC815]" />
        </div>
      )}
      <Field label="Monto *">
        <MoneyInput value={amount} onChange={setAmount} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Medio de pago">
          <PaymentMethodSelect value={method} onChange={setMethod} />
        </Field>
        <Field label="Recibe el dinero">
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

// ---------------------------------------------------------------------
// Venta de contado (register_sale)
// ---------------------------------------------------------------------
export function SaleSheet({ open, onClose, onDone }) {
  const { products, partners, myPartnerId, registerSale } = useManageStore();
  const activeProducts = products.filter((p) => p.is_active);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState('');
  const [method, setMethod] = useState('cash');
  const [partnerId, setPartnerId] = useState('');
  const [note, setNote] = useState('');
  const { run, busy, error, setError } = useAction();

  useEffect(() => {
    if (!open) return;
    setProductId('');
    setQuantity(1);
    setUnitPrice('');
    setMethod('cash');
    setPartnerId(myPartnerId || partners.find((p) => p.is_active)?.id || '');
    setNote('');
    setError(null);
  }, [open, myPartnerId, partners, setError]);

  const pickProduct = (id) => {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    setUnitPrice(p ? String(Math.round(Number(p.price))) : '');
  };

  const total = quantity * Number(unitPrice || 0);

  const submit = () => run(async () => {
    if (!productId) throw new Error('Elige el producto.');
    if (!partnerId) throw new Error('Elige el socio que recibe el dinero.');
    await registerSale({
      productId,
      quantity,
      paymentMethod: method,
      partnerId,
      unitPrice: Number(unitPrice || 0),
      note,
    });
    onDone?.();
    onClose();
  });

  return (
    <Sheet
      open={open}
      title="Venta de contado"
      onClose={onClose}
      footer={(
        <Button className="w-full py-3" disabled={busy || !productId} onClick={submit}>
          {busy ? 'Guardando...' : <>Registrar venta por <Money value={total} /></>}
        </Button>
      )}
    >
      <Field label="Producto *">
        <Select value={productId} onChange={(e) => pickProduct(e.target.value)}>
          <option value="">Elegir producto</option>
          {activeProducts.map((p) => (
            <option key={p.id} value={p.id}>{p.name} · {formatCOP(p.price)}</option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Cantidad">
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className={inputClass}
          />
        </Field>
        <Field label="Precio unitario">
          <MoneyInput value={unitPrice} onChange={setUnitPrice} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Medio de pago">
          <PaymentMethodSelect value={method} onChange={setMethod} />
        </Field>
        <Field label="Recibe el dinero">
          <PartnerSelect partners={partners} value={partnerId} onChange={setPartnerId} allowEmpty />
        </Field>
      </div>
      <Field label="Nota">
        <TextArea value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <p className="text-[10px] text-gray-500">La venta de contado no crea deuda: entra directo a la caja del socio que recibe.</p>
      <ErrorBox error={error} />
    </Sheet>
  );
}

// ---------------------------------------------------------------------
// Detalle de una deuda: ítems, abonos, entrega y anulación
// ---------------------------------------------------------------------
export function DebtDetailSheet({ open, debt, onClose, onChanged }) {
  const { partners, setItemDelivery, deleteDebtPayment, voidDebt } = useManageStore();
  const [paying, setPaying] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const { run, busy, error, setError } = useAction();

  useEffect(() => {
    if (open) setError(null);
  }, [open, setError]);

  if (!debt) return null;
  const partnerName = (id) => partners.find((p) => p.id === id)?.name || '—';
  const isOpen = ['pending', 'partial'].includes(debt.status);

  const toggleDelivery = (item) => run(async () => {
    await setItemDelivery(item.id, item.delivery_status === 'pending' ? 'delivered' : 'pending');
    onChanged?.();
  });

  const removePayment = (payment) => run(async () => {
    if (!window.confirm(`¿Anular el abono de ${formatCOP(payment.amount)}? También se anula el ingreso en la caja.`)) return;
    await deleteDebtPayment(payment.id);
    onChanged?.();
  });

  return (
    <>
      <Sheet
        open={open && !paying && !voiding}
        title={debt.member_name}
        onClose={onClose}
        footer={isOpen ? (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="danger" onClick={() => setVoiding(true)} disabled={busy || debt.payments.length > 0}>
              Anular
            </Button>
            <Button onClick={() => setPaying(true)} disabled={busy}>Abonar</Button>
          </div>
        ) : null}
      >
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] text-gray-400 block">
              {debt.concept || 'Deuda'} · {formatDate(debt.created_at)}
            </span>
            <Money value={debt.balance} className="text-2xl text-white" />
            <span className="text-[11px] text-gray-400 block">
              de {formatCOP(debt.total_amount)} · abonado {formatCOP(debt.paid_amount)}
            </span>
          </div>
          <StatusBadge status={debt.status} map={DEBT_STATUS} />
        </div>

        {debt.void_reason && (
          <p className="text-[11px] text-gray-400">Anulada: {debt.void_reason}</p>
        )}

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#A0A0A5]">Ítems</span>
          {debt.items.map((it) => (
            <div key={it.id} className="flex items-center gap-2 py-2 border-b border-white/5 last:border-0">
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-white block truncate">
                  {it.name}{it.quantity > 1 ? ` x${it.quantity}` : ''}
                </span>
                <span className="text-[10px] text-gray-400">{formatCOP(it.unit_price)} c/u</span>
              </div>
              {debt.status !== 'voided' && (
                <button
                  type="button"
                  onClick={() => toggleDelivery(it)}
                  disabled={busy}
                  className={`px-2 py-1 rounded-lg text-[10px] font-black flex items-center gap-1 border ${
                    it.delivery_status === 'pending'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  {it.delivery_status === 'pending'
                    ? <><PackageX className="w-3 h-3" /> Por entregar</>
                    : <><PackageCheck className="w-3 h-3" /> Entregado</>}
                </button>
              )}
              <Money value={it.subtotal ?? it.quantity * it.unit_price} className="text-xs text-white w-20 text-right" />
            </div>
          ))}
        </div>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#A0A0A5]">Abonos</span>
          {debt.payments.length === 0 ? (
            <p className="text-xs text-gray-500 py-2">Sin abonos.</p>
          ) : debt.payments.map((p) => (
            <div key={p.id} className="flex items-center gap-2 py-2 border-b border-white/5 last:border-0">
              <div className="flex-1 min-w-0">
                <Money value={p.amount} className="text-xs text-emerald-400" />
                <span className="text-[10px] text-gray-400 block truncate">
                  {formatDateTime(p.paid_at)} · {paymentMethodLabel(p.payment_method)} · recibió {partnerName(p.received_by_partner)}
                </span>
                {p.note && <span className="text-[10px] text-gray-500 block">{p.note}</span>}
              </div>
              {debt.status !== 'voided' && (
                <button
                  type="button"
                  onClick={() => removePayment(p)}
                  disabled={busy}
                  className="text-gray-500 hover:text-red-400 p-1"
                  aria-label="Anular abono"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
        {isOpen && debt.payments.length > 0 && (
          <p className="text-[10px] text-gray-500">Para anular la deuda, primero anula sus abonos.</p>
        )}
        <ErrorBox error={error} />
      </Sheet>

      <PaymentSheet
        open={open && paying}
        debt={debt}
        onClose={() => setPaying(false)}
        onDone={onChanged}
      />
      <ReasonSheet
        open={open && voiding}
        title="Anular deuda"
        confirmLabel="Anular deuda"
        onClose={() => setVoiding(false)}
        onConfirm={async (reason) => {
          await voidDebt(debt.id, reason);
          onChanged?.();
          onClose();
        }}
      />
    </>
  );
}

/** Concepto de la deuda con sus ítems: "Consumo · Agua, Barra". */
export function debtLabel(debt) {
  return [debt.concept, debt.items.map((i) => i.name).join(', ')].filter(Boolean).join(' · ') || 'Deuda';
}

/** Fila de una deuda. Dentro del grupo de una persona (`compact`) no repite el nombre. */
export function DebtRow({ debt, onClick, compact = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl border flex items-center gap-3 tap-bounce ${
        compact ? 'p-2.5 bg-[#0A0A0C] border-white/5' : 'p-3 bg-[#1C1C1E] border-white/5'
      }`}
    >
      <div className="flex-1 min-w-0">
        {compact ? (
          <>
            <span className="text-xs font-black text-white block truncate">{debtLabel(debt)}</span>
            <span className="text-[11px] text-[#A0A0A5] block">{formatDate(debt.created_at)}</span>
          </>
        ) : (
          <>
            <span className="text-sm font-black text-white block truncate">{debt.member_name}</span>
            <span className="text-[11px] text-[#A0A0A5] block truncate">
              {debtLabel(debt)} · {formatDate(debt.created_at)}
            </span>
          </>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <Money value={debt.status === 'voided' ? debt.total_amount : debt.balance} className="text-sm text-white" />
        <StatusBadge status={debt.status} map={DEBT_STATUS} />
      </div>
    </button>
  );
}

