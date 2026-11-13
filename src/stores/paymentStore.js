import { create } from 'zustand';
import { supabase } from '../supabase/client';

// Medios de pago del box (D51): cuentas, llaves y QR que ve el atleta al tocar "Pagar".
// La RLS solo los entrega a atletas vinculados y al staff. Los QR están en un bucket
// privado y se muestran con URL firmada.

const QR_URL_SECONDS = 60 * 60;

/** URL firmada de un QR guardado en el bucket payment-qr (null si no hay o falla). */
export async function paymentQrUrl(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from('payment-qr').createSignedUrl(path, QR_URL_SECONDS);
  if (error) {
    console.warn('No se pudo cargar el QR:', error.message);
    return null;
  }
  return data.signedUrl;
}

/** URL firmada de un comprobante del bucket payment-receipts (null si no hay o falla). */
export async function receiptUrl(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from('payment-receipts').createSignedUrl(path, QR_URL_SECONDS);
  if (error) {
    console.warn('No se pudo cargar el comprobante:', error.message);
    return null;
  }
  return data.signedUrl;
}

const RECEIPT_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
};
export const RECEIPT_ACCEPT = Object.keys(RECEIPT_TYPES).join(',');
// HEIC no se convierte: Chrome no lo lee, pero el bucket lo acepta y el staff lo abre aparte.
export const RECEIPT_IMAGE_TYPES = Object.keys(RECEIPT_TYPES).filter((t) => t.startsWith('image/'));
const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;

/** Por qué un archivo no sirve como comprobante (null si sirve). */
export function receiptProblem(file) {
  if (!file) return 'Adjunta el comprobante del pago (captura o PDF).';
  if (!RECEIPT_TYPES[file.type]) return 'El comprobante debe ser una imagen (PNG, JPG) o un PDF.';
  if (file.size > RECEIPT_MAX_BYTES) return 'El comprobante pesa más de 5 MB. Envía una captura de pantalla.';
  return null;
}

const usePaymentStore = create((set, get) => ({
  info: null, // { accounts: [{ ...cuenta, qrUrl }], instructions, whatsapp }
  loadedAt: 0,
  loading: false,
  error: null,
  reports: [], // pagos reportados por el atleta (D52), del más reciente al más antiguo
  channel: null,

  fetchMyReports: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      set({ reports: [] });
      return [];
    }
    const { data, error } = await supabase.from('payment_reports')
      .select('id, amount, covers_membership, covers_debt, payment_method, account_label, status, review_note, created_at, reviewed_at')
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) {
      console.warn('No se pudieron cargar los pagos reportados:', error.message);
      return get().reports;
    }
    set({ reports: data || [] });
    return data || [];
  },

  // Sube el comprobante a la carpeta del usuario y crea el reporte. Si el reporte falla,
  // se borra el archivo subido (la RLS lo permite mientras no esté en un reporte).
  reportPayment: async ({ amount, coversMembership, coversDebt, paymentMethod, accountId, file, note }) => {
    const problem = receiptProblem(file);
    if (problem) throw new Error(problem);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Tu sesión terminó. Vuelve a iniciar sesión.');
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${RECEIPT_TYPES[file.type]}`;
    const bucket = supabase.storage.from('payment-receipts');
    const up = await bucket.upload(path, file, { contentType: file.type });
    if (up.error) throw new Error(`No se pudo subir el comprobante: ${up.error.message}`);
    const { data, error } = await supabase.rpc('report_payment', {
      p_amount: amount,
      p_covers_membership: coversMembership,
      p_covers_debt: coversDebt,
      p_payment_method: paymentMethod,
      p_payment_account_id: accountId || null,
      p_receipt_path: path,
      p_note: note || null,
    });
    if (error) {
      await bucket.remove([path]);
      throw new Error(error.message);
    }
    await get().fetchMyReports();
    return data;
  },

  // Cuando el staff confirma o rechaza, el estado cambia sin recargar.
  subscribeReports: (userId) => {
    if (!userId) return;
    const prev = get().channel;
    if (prev) supabase.removeChannel(prev);
    const channel = supabase
      .channel(`payment_reports_${userId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'payment_reports', filter: `profile_id=eq.${userId}`,
      }, () => get().fetchMyReports())
      .subscribe();
    set({ channel });
  },

  cancelReport: async (reportId) => {
    const { error } = await supabase.rpc('cancel_payment_report', { p_report_id: reportId });
    if (error) throw new Error(error.message);
    await get().fetchMyReports();
  },

  // Se cachea unos minutos (las URL firmadas duran una hora).
  fetchPaymentInfo: async (force = false) => {
    const { info, loadedAt } = get();
    if (info && !force && Date.now() - loadedAt < 10 * 60 * 1000) return info;
    set({ loading: true, error: null });
    try {
      const [accountsRes, settingsRes] = await Promise.all([
        supabase.from('payment_accounts').select('*').eq('is_active', true)
          .order('sort_order').order('created_at'),
        supabase.from('app_settings').select('key, value').in('key', ['payment_instructions', 'payment_whatsapp']),
      ]);
      if (accountsRes.error) throw accountsRes.error;
      if (settingsRes.error) throw settingsRes.error;
      const settings = Object.fromEntries((settingsRes.data || []).map((r) => [r.key, r.value]));
      const accounts = await Promise.all(
        (accountsRes.data || []).map(async (a) => ({ ...a, qrUrl: await paymentQrUrl(a.qr_path) })),
      );
      const next = {
        accounts,
        instructions: settings.payment_instructions || null,
        whatsapp: settings.payment_whatsapp || null,
      };
      set({ info: next, loadedAt: Date.now(), loading: false });
      return next;
    } catch (err) {
      set({ error: err.message || 'No se pudieron cargar los medios de pago', loading: false });
      return null;
    }
  },

  // Solo los datos de pago (Ajustes los cambia); los reportes y la suscripción siguen.
  invalidateInfo: () => set({ info: null, loadedAt: 0 }),

  reset: () => {
    const { channel } = get();
    if (channel) supabase.removeChannel(channel);
    set({ info: null, loadedAt: 0, loading: false, error: null, reports: [], channel: null });
  },
}));

export default usePaymentStore;
