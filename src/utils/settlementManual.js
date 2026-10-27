// Autocompletar en el cuadre manual (D42): con la fórmula del efectivo esperado
//   efectivo = ingresos − gastos BOX − gastos personales − entregado + recibido
// se despeja el único dato que falte entre ingresos, gastos BOX, gastos personales y
// efectivo. Entregado y recibido vacíos cuentan como 0 (lo normal es que no haya).

export const SOLVABLE_FIELDS = [
  ['income_collected', 'Ingresos recibidos'],
  ['box_expenses_paid', 'Gastos BOX pagados'],
  ['personal_expenses', 'Gastos personales'],
  ['declared_cash', 'Efectivo que tiene'],
];

const LABELS = Object.fromEntries(SOLVABLE_FIELDS);

const isEmpty = (v) => v === undefined || v === null || String(v).trim() === '';
const num = (v) => (isEmpty(v) ? 0 : Number(v));

/**
 * values: { income_collected, box_expenses_paid, personal_expenses, transfers_given,
 *           transfers_received, declared_cash } como texto (vacío = sin dato).
 * Devuelve uno de:
 *   { ok: true, field, label, value }            → valor calculado (entero, ≥ 0)
 *   { ok: false, reason: 'missing', missing }    → faltan 2 o más datos (labels)
 *   { ok: false, reason: 'complete' }            → no falta nada
 *   { ok: false, reason: 'negative', field, label, value } → el resultado no tiene sentido
 */
export function solveManualField(values = {}) {
  const missing = SOLVABLE_FIELDS.filter(([key]) => isEmpty(values[key])).map(([key]) => key);
  if (missing.length === 0) return { ok: false, reason: 'complete' };
  if (missing.length > 1) return { ok: false, reason: 'missing', missing: missing.map((k) => LABELS[k]) };

  const field = missing[0];
  const income = num(values.income_collected);
  const box = num(values.box_expenses_paid);
  const personal = num(values.personal_expenses);
  const cash = num(values.declared_cash);
  const net = num(values.transfers_received) - num(values.transfers_given);

  const value = {
    income_collected: cash + box + personal - net,
    box_expenses_paid: income - personal + net - cash,
    personal_expenses: income - box + net - cash,
    declared_cash: income - box - personal + net,
  }[field];

  if (value < 0) return { ok: false, reason: 'negative', field, label: LABELS[field], value };
  return { ok: true, field, label: LABELS[field], value: Math.round(value) };
}
