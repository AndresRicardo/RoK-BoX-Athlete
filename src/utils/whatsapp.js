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

// Indicativos para los números guardados sin él. Colombia primero (es el valor por defecto).
export const COUNTRY_CODES = [
  ['57', 'Colombia'],
  ['58', 'Venezuela'],
  ['593', 'Ecuador'],
  ['51', 'Perú'],
  ['507', 'Panamá'],
  ['52', 'México'],
  ['1', 'EE. UU. / Canadá'],
  ['34', 'España'],
  ['54', 'Argentina'],
  ['56', 'Chile'],
  ['55', 'Brasil'],
];

const COLOMBIA = '57';

/**
 * Número para wa.me (solo dígitos, con indicativo) o null si no sirve.
 * - Celular colombiano sin indicativo (10 dígitos, empieza por 3): se le pone el 57.
 * - Con indicativo de Colombia (57, +57 o 0057): debe seguir un celular de 10 dígitos.
 * - Con "+" o "00" y otro indicativo: se toma como internacional.
 * Un número de otro país guardado sin indicativo no se puede adivinar: hay que
 * corregirlo eligiendo el país (phoneWithCountry).
 */
export function whatsappPhone(raw) {
  if (!raw) return null;
  const text = String(raw).trim();
  let digits = text.replace(/\D/g, '');
  const international = text.startsWith('+') || digits.startsWith('00');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (!international && /^3\d{9}$/.test(digits)) return `${COLOMBIA}${digits}`;
  if (digits.startsWith(COLOMBIA)) return /^573\d{9}$/.test(digits) ? digits : null;
  if (international && digits.length >= 8 && digits.length <= 15) return digits;
  return null;
}

/** Por qué un número guardado no sirve, para mostrarlo a quien cobra. */
export function phoneProblem(raw) {
  if (!raw?.trim()) return 'Sin celular';
  if (whatsappPhone(raw)) return null;
  const digits = raw.replace(/\D/g, '').replace(/^(00)?57(?=3)/, '');
  if (/^3\d{8}$/.test(digits)) return 'Celular incompleto (9 dígitos)';
  if (/^3\d{10,}$/.test(digits)) return 'Celular con dígitos de más';
  return 'Número por revisar';
}

/**
 * Número escrito por el usuario + país elegido → texto a guardar en el miembro.
 * Se quitan los ceros iniciales (prefijo nacional, p. ej. 0412 en Venezuela). Si ya
 * trae el indicativo del país elegido, no se repite. Colombia se guarda sin indicativo,
 * como el resto de los números del box.
 */
export function phoneWithCountry(countryCode, input) {
  let digits = String(input || '').replace(/\D/g, '').replace(/^0+/, '');
  if (!digits) return '';
  if (countryCode === COLOMBIA) {
    if (/^573\d{9}$/.test(digits)) digits = digits.slice(2);
    return digits;
  }
  if (digits.startsWith(countryCode) && digits.length > countryCode.length + 7) {
    digits = digits.slice(countryCode.length);
  }
  return `+${countryCode} ${digits}`;
}

/** Separa un número guardado en país y número nacional, para editarlo. */
export function splitCountry(raw) {
  const text = String(raw || '').trim();
  const digits = text.replace(/\D/g, '').replace(/^00/, '');
  if (text.startsWith('+') || text.replace(/\s/g, '').startsWith('00')) {
    const match = COUNTRY_CODES.map(([code]) => code)
      .sort((a, b) => b.length - a.length)
      .find((code) => digits.startsWith(code));
    if (match) return { country: match, number: digits.slice(match.length) };
  }
  return { country: COLOMBIA, number: text };
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
