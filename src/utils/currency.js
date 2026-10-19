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
