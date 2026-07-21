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

export function formatShortDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
