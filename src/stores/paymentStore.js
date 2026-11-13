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

const usePaymentStore = create((set, get) => ({
  info: null, // { accounts: [{ ...cuenta, qrUrl }], instructions, whatsapp }
  loadedAt: 0,
  loading: false,
  error: null,

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

  reset: () => set({ info: null, loadedAt: 0, loading: false, error: null }),
}));

export default usePaymentStore;
