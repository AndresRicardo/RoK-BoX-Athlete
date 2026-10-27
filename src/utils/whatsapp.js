import { formatCOP } from './currency';

// Recordatorio de deuda por WhatsApp (D41): se abre WhatsApp en el teléfono de quien
// cobra con el mensaje listo (enlace wa.me); no hay envío automático.

export const DEFAULT_DEBT_TEMPLATE = `¡Hola, {nombre}! 👋 Te saludamos de RöK BoX.

Te escribimos para recordarte, con mucho cariño, que tienes un saldo pendiente de *{total}*:
{detalle}

Cuando puedas, nos ayudas poniéndote al día en el box o por transferencia. Si ya pagaste, por favor ignora este mensaje y disculpa la molestia 🙏

¡Gracias por entrenar con nosotros! 💪`;

export const TEMPLATE_PLACEHOLDERS = [
  ['{nombre}', 'Primer nombre del miembro'],
  ['{total}', 'Saldo total pendiente'],
  ['{detalle}', 'Lista de lo que debe, una línea por deuda'],
];

const MAX_DETAIL_LINES = 6;

/**
 * Número para wa.me (solo dígitos, con indicativo) o null si no sirve.
 * Celulares colombianos de 10 dígitos (3xx...) reciben el 57; un número con "+" se
 * toma como internacional.
 */
export function whatsappPhone(raw) {
  if (!raw) return null;
  const text = String(raw).trim();
  const digits = text.replace(/\D/g, '');
  if (/^3\d{9}$/.test(digits)) return `57${digits}`;
  if (/^573\d{9}$/.test(digits)) return digits;
  if (text.startsWith('+') && digits.length >= 8 && digits.length <= 15) return digits;
  return null;
}

/** "JUAN CARLOS PÉREZ" → "Juan". */
export function firstName(fullName) {
  const word = (fullName || '').trim().split(/\s+/)[0] || '';
  if (!word) return '';
  return word.charAt(0).toLocaleUpperCase('es-CO') + word.slice(1).toLocaleLowerCase('es-CO');
}

// Intl usa espacio duro entre "$" y la cifra; en WhatsApp se ve mejor uno normal.
const money = (value) => formatCOP(value).replace(/\s/g, ' ');

function debtLine(debt) {
  const items = (debt.items || [])
    .map((i) => (Number(i.quantity) > 1 ? `${i.name} x${Number(i.quantity)}` : i.name))
    .filter(Boolean);
  const concept = debt.concept?.trim();
  let label = concept || items.join(', ') || 'Deuda';
  if (concept && items.length && !items.includes(concept)) label = `${concept} (${items.join(', ')})`;
  return `• ${label}: ${money(debt.balance)}`;
}

/** Lista de deudas abiertas, de la más antigua a la más reciente. */
export function debtDetail(debts) {
  const open = (debts || [])
    .filter((d) => Number(d.balance) > 0 && !d.voided_at)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const lines = open.slice(0, MAX_DETAIL_LINES).map(debtLine);
  const rest = open.length - MAX_DETAIL_LINES;
  if (rest > 0) lines.push(`• y ${rest} ${rest === 1 ? 'cargo más' : 'cargos más'}`);
  return lines.join('\n');
}

/** Llena la plantilla del box con los datos del miembro. */
export function buildDebtReminder({ template, fullName, total, debts }) {
  const values = {
    nombre: firstName(fullName),
    total: money(total),
    detalle: debtDetail(debts),
  };
  return (template?.trim() ? template : DEFAULT_DEBT_TEMPLATE)
    .replace(/\{(nombre|total|detalle)\}/g, (_, key) => values[key])
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function whatsappUrl(phone, text) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

// ---------------------------------------------------------------------
// WhatsApp o WhatsApp Business. Solo Android deja elegir la app (intent con el
// paquete); en iPhone y en el computador wa.me abre la que el sistema decida.
// ---------------------------------------------------------------------
export const WHATSAPP_APPS = {
  whatsapp: { label: 'WhatsApp', pkg: 'com.whatsapp' },
  business: { label: 'WhatsApp Business', pkg: 'com.whatsapp.w4b' },
};

const APP_PREF_KEY = 'rokbox.whatsappApp';

export function canChooseWhatsappApp() {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
}

/** Abre la app indicada; si no está instalada, Chrome sigue a wa.me. */
export function whatsappAppUrl(app, phone, text) {
  const { pkg } = WHATSAPP_APPS[app];
  const query = `phone=${phone}&text=${encodeURIComponent(text)}`;
  const fallback = encodeURIComponent(whatsappUrl(phone, text));
  return `intent://send/?${query}#Intent;scheme=whatsapp;package=${pkg};S.browser_fallback_url=${fallback};end`;
}

// La elección se recuerda por teléfono (cada uno tiene sus apps instaladas).
export function getPreferredWhatsappApp() {
  try {
    const value = localStorage.getItem(APP_PREF_KEY);
    return WHATSAPP_APPS[value] ? value : null;
  } catch {
    return null;
  }
}

export function setPreferredWhatsappApp(app) {
  try {
    if (app) localStorage.setItem(APP_PREF_KEY, app);
    else localStorage.removeItem(APP_PREF_KEY);
  } catch {
    // Sin almacenamiento (modo privado): se vuelve a preguntar la próxima vez.
  }
}
