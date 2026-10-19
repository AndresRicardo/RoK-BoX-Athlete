// Formateadores de valores deportivos (extraidos de PRs.jsx y Benchmarks.jsx
// para reutilizar en perfil publico y feed).

// PRs: strength -> lb, reps -> reps, benchmark -> tiempo m:ss
export function formatPrValue(pr) {
  if (pr.type === 'strength') return `${pr.value_numeric} lb`;
  if (pr.type === 'reps') return `${pr.value_numeric} reps`;
  const total = Math.round(pr.value_numeric);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Benchmarks segun su unidad.
export function formatBenchmarkResult(b) {
  if (b.result_unit === 'time_seconds') {
    const total = Math.round(b.result_value);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  if (b.result_unit === 'rounds_reps') {
    const total = Math.round(b.result_value);
    const r = Math.floor(total / 1000);
    const e = total % 1000;
    if (e === 0) return `${r} rounds`;
    return `${r} + ${e}`;
  }
  return `${Math.round(b.result_value)} reps`;
}

// Parsea 'YYYY-MM-DD' como fecha LOCAL. new Date(str) la interpretaria
// como medianoche UTC y en zonas UTC- se muestra el dia anterior.
export function parseLocalDate(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number);
  return new Date(y, m - 1, d);
}

// 'YYYY-MM-DD' de hoy en hora local, para valores por defecto y max de
// inputs type="date". toISOString() devolveria la fecha UTC.
export function todayInputValue() {
  const n = new Date();
  const mm = String(n.getMonth() + 1).padStart(2, '0');
  const dd = String(n.getDate()).padStart(2, '0');
  return `${n.getFullYear()}-${mm}-${dd}`;
}

export function formatShortDate(dateStr) {
  return parseLocalDate(dateStr).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
