// Fechas de negocio en hora de Bogotá (UTC-5 todo el año, sin horario de verano).

const TZ = 'America/Bogota';
const BOGOTA_OFFSET = '-05:00';

/** Fecha 'YYYY-MM-DD' de un instante en hora de Bogotá (por defecto, hoy). */
export function bogotaDate(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(value));
}

/** Instante ISO del inicio del día 'YYYY-MM-DD' en Bogotá. */
export function bogotaDayStart(dateStr) {
  return new Date(`${dateStr}T00:00:00${BOGOTA_OFFSET}`).toISOString();
}

/** Último segundo del día 'YYYY-MM-DD' en Bogotá (fin de una vigencia). */
export function bogotaDayLastSecond(dateStr) {
  return new Date(`${dateStr}T23:59:59${BOGOTA_OFFSET}`).toISOString();
}

/** Instante ISO del inicio del día siguiente: sirve como límite exclusivo de un rango. */
export function bogotaDayEnd(dateStr) {
  return bogotaDayStart(addDays(dateStr, 1));
}

/** Instante ISO para guardar una fecha elegida por el usuario: hoy conserva la hora actual. */
export function bogotaDateToTimestamp(dateStr) {
  if (!dateStr || dateStr === bogotaDate()) return new Date().toISOString();
  return new Date(`${dateStr}T12:00:00${BOGOTA_OFFSET}`).toISOString();
}

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Primer y último día del mes de 'YYYY-MM-DD', desplazado `offset` meses. */
export function monthRange(dateStr = bogotaDate(), offset = 0) {
  const [y, m] = dateStr.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1 + offset, 1));
  const last = new Date(Date.UTC(y, m + offset, 0));
  return { start: first.toISOString().slice(0, 10), end: last.toISOString().slice(0, 10) };
}

export function monthLabel(dateStr) {
  const label = new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('es-CO', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** "23 oct 2026" (o sin año si es el actual). */
export function formatDate(value, { withYear } = {}) {
  if (!value) return '—';
  const d = typeof value === 'string' && value.length === 10 ? new Date(`${value}T12:00:00${BOGOTA_OFFSET}`) : new Date(value);
  const showYear = withYear ?? bogotaDate(d).slice(0, 4) !== bogotaDate().slice(0, 4);
  return d.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    ...(showYear ? { year: 'numeric' } : {}),
    timeZone: TZ,
  });
}

/** "23 oct, 4:05 p. m." */
export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-CO', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: TZ,
  });
}
