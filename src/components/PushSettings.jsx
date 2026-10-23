import { useEffect, useState } from 'react';
import { BellRing, BellOff, Share, PlusSquare, Check, AlertCircle } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import useProfileStore from '../stores/profileStore';
import {
  pushSupport, pushPermission, getCurrentSubscription, enablePush, disablePush,
  fetchDisabledTypes, saveDisabledTypes,
} from '../utils/push';

// Tipos de aviso que cada usuario puede apagar (D18). Apagar uno lo quita de la campana
// y del push; en los sociales (me gusta, comentarios, seguidores) solo se apaga el push.
const GROUPS = [
  {
    title: 'Membresía y pagos',
    types: [
      ['membership_expiring', 'Membresía por vencer'],
      ['membership_renewed', 'Membresía renovada'],
      ['classes_low', 'Quedan pocas clases en la tiquetera'],
      ['debt_charged', 'Nuevo cargo en mi cuenta'],
      ['debt_payment', 'Abono registrado'],
      ['debt_reminder', 'Recordatorio semanal de saldo'],
      ['link_reviewed', 'Respuesta a mi solicitud de vínculo'],
    ],
  },
  {
    title: 'Comunidad',
    types: [
      ['like', 'Me gusta en mi actividad'],
      ['comment', 'Comentarios en mi actividad'],
      ['follow', 'Nuevos seguidores'],
    ],
  },
  {
    title: 'Gestión',
    staffOnly: true,
    types: [
      ['link_request', 'Solicitudes de vínculo por aprobar'],
      ['renewal_pending', 'Renovaciones en HikCentral sin pago', true],
      ['access_command_failed', 'Cambios que no llegaron a HikCentral', true],
      ['bridge_offline', 'PC del box sin conexión', true],
      ['weekly_summary', 'Resumen semanal (lunes)', true],
    ],
  },
];

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 rounded-full shrink-0 transition-colors disabled:opacity-50 ${checked ? 'bg-[#FFC815]' : 'bg-[#38383A]'}`}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  );
}

export default function PushSettings() {
  const user = useAuthStore((state) => state.user);
  const { isStaff, isPartner } = useProfileStore();
  const support = pushSupport();
  const [permission, setPermission] = useState(pushPermission());
  const [subscribed, setSubscribed] = useState(false);
  const [disabledTypes, setDisabledTypes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [showTypes, setShowTypes] = useState(false);

  useEffect(() => {
    if (support === 'supported') {
      getCurrentSubscription().then((s) => setSubscribed(Boolean(s))).catch(() => {});
    }
    if (user?.id) fetchDisabledTypes(user.id).then(setDisabledTypes).catch(() => {});
  }, [support, user?.id]);

  const toggleDevice = async () => {
    setBusy(true);
    setMessage(null);
    try {
      if (subscribed) {
        await disablePush();
        setSubscribed(false);
        setMessage({ ok: true, text: 'Este teléfono ya no recibirá notificaciones.' });
      } else {
        await enablePush();
        setSubscribed(true);
        setMessage({ ok: true, text: 'Listo: este teléfono recibirá las notificaciones.' });
      }
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    } finally {
      setPermission(pushPermission());
      setBusy(false);
    }
  };

  const toggleType = async (type, enabled) => {
    const next = enabled ? disabledTypes.filter((t) => t !== type) : [...new Set([...disabledTypes, type])];
    const prev = disabledTypes;
    setDisabledTypes(next);
    try {
      await saveDisabledTypes(user.id, next);
    } catch (err) {
      setDisabledTypes(prev);
      setMessage({ ok: false, text: err.message });
    }
  };

  return (
    <div className="p-5 rounded-2xl bg-[#1C1C1E] border border-white/5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className={`p-2.5 rounded-xl shrink-0 ${subscribed ? 'bg-[#FFC815] text-black' : 'bg-[#292929] text-gray-400'}`}>
          {subscribed ? <BellRing className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-white">Notificaciones en este teléfono</h4>
          <p className="text-xs text-[#A0A0A5] mt-0.5">
            {support === 'supported' && subscribed && 'Activadas: te avisamos de tu membresía, pagos y comunidad.'}
            {support === 'supported' && !subscribed && permission !== 'denied' && 'Recibe avisos de vencimiento, cargos y abonos aunque no tengas la app abierta.'}
            {support === 'supported' && !subscribed && permission === 'denied' && 'Bloqueadas para esta app. Actívalas en los ajustes del navegador o del teléfono y vuelve aquí.'}
            {support === 'ios-install' && 'En iPhone primero hay que instalar la app en la pantalla de inicio.'}
            {support === 'unsupported' && 'Este navegador no permite notificaciones push. Prueba con Chrome, Edge o Safari actualizados.'}
          </p>
        </div>
      </div>

      {support === 'ios-install' && (
        <ol className="flex flex-col gap-2 text-xs text-gray-300 p-3 rounded-xl bg-[#0A0A0C] border border-white/5">
          <li className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#292929] text-[10px] font-black flex items-center justify-center shrink-0">1</span>
            Toca <Share className="w-4 h-4 text-sky-400 shrink-0" /> <strong>Compartir</strong> en Safari.
          </li>
          <li className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#292929] text-[10px] font-black flex items-center justify-center shrink-0">2</span>
            Elige <PlusSquare className="w-4 h-4 shrink-0" /> <strong>Agregar a inicio</strong>.
          </li>
          <li className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#292929] text-[10px] font-black flex items-center justify-center shrink-0">3</span>
            Abre RöK BoX desde el ícono y activa aquí las notificaciones.
          </li>
          <li className="text-[10px] text-gray-500 pl-7">Requiere iOS 16.4 o superior.</li>
        </ol>
      )}

      {support === 'supported' && (permission !== 'denied' || subscribed) && (
        <button
          type="button"
          onClick={toggleDevice}
          disabled={busy}
          className={`py-3 rounded-xl font-black text-xs uppercase tracking-wider tap-bounce disabled:opacity-50 ${
            subscribed ? 'bg-[#292929] text-white border border-white/10' : 'bg-[#FFC815] text-black'
          }`}
        >
          {busy ? 'Un momento...' : subscribed ? 'Desactivar en este teléfono' : 'Activar notificaciones'}
        </button>
      )}

      {message && (
        <div className={`p-3 rounded-xl border flex items-start gap-2 text-xs ${
          message.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}
        >
          {message.ok ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowTypes((v) => !v)}
        className="text-xs font-bold text-[#FFC815] text-left"
      >
        {showTypes ? 'Ocultar tipos de aviso' : 'Elegir qué avisos recibir'}
      </button>

      {showTypes && GROUPS.filter((g) => !g.staffOnly || isStaff).map((group) => (
        <div key={group.title} className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#A0A0A5]">{group.title}</span>
          {group.types.filter(([, , partnerOnly]) => !partnerOnly || isPartner).map(([type, label]) => (
            <div key={type} className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0">
              <span className="text-xs text-gray-200">{label}</span>
              <Toggle checked={!disabledTypes.includes(type)} onChange={(on) => toggleType(type, on)} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
