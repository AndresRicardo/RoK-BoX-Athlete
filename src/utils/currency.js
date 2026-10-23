/**
 * Formatea un valor numérico a Pesos Colombianos (COP) sin decimales.
 * Ejemplos: 15000 -> "$ 15.000", 120000 -> "$ 120.000"
 */
export function formatCOP(amount) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(num);
}

const PAYMENT_METHOD_LABELS = {
  cash: 'Efectivo',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  bre_b: 'Bre-B',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  other: 'Otro',
};

/** Nombre en español del medio de pago (dominio public.payment_method). */
export function paymentMethodLabel(method) {
  return PAYMENT_METHOD_LABELS[method] || method || '—';
}
