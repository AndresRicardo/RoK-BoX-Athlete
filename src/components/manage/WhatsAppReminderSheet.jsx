import { useEffect, useState } from 'react';
import { MessageCircle, Check, ChevronRight, Pencil, Briefcase, BellRing, Smartphone } from 'lucide-react';
import useManageStore from '../../stores/manageStore';
import { Sheet, Field, TextArea, Button, ErrorBox, Loading, Money, StatusBadge, useAction, inputClass } from './ui';
import {
  buildDebtReminder, buildMembershipReminder, dueText, whatsappPhone, whatsappUrl, whatsappAppUrl, WHATSAPP_APPS,
  canChooseWhatsappApp, getPreferredWhatsappApp, setPreferredWhatsappApp,
  COUNTRY_CODES, phoneWithCountry, phoneProblem, splitCountry,
} from '../../utils/whatsapp';
import { timeAgo } from '../../utils/time';
import { formatDate, formatDateTime } from '../../utils/dates';

const OPEN_CLASS = 'py-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 tap-bounce';

/** Línea "Recordado hace 3 d por Ana" / "Nunca se le ha recordado". */
export function lastReminderText(debtor) {
  if (!debtor?.last_reminder_at) return 'Nunca se le ha recordado';
  const who = debtor.lastReminderByName ? ` por ${debtor.lastReminderByName.split(' ')[0]}` : '';
  return `Recordado ${timeAgo(debtor.last_reminder_at)}${who}`;
}

// Cómo se carga, se arma y se registra cada tipo de recordatorio.
const KINDS = {
  // Deuda (D41): saldo total y una línea por deuda.
  debt: {
    load: async (store, memberId) => {
      const [debtors, debts, template] = await Promise.all([
        store.fetchDebtors({ memberId }),
        store.fetchDebts({ memberId, statuses: ['pending', 'partial'] }),
        store.fetchReminderTemplate(),
      ]);
      const target = debtors[0] || null;
      const text = target
        ? buildDebtReminder({ template, fullName: target.full_name, total: target.balance, debts })
        : '';
      return { target, text };
    },
    log: (store, memberId) => store.logDebtReminder(memberId),
    missing: 'Este miembro ya no tiene saldo pendiente.',
  },
  // Mensualidad por vencer o vencida (D50), con los medios de pago del box.
  membership: {
    load: async (store, memberId) => {
      const [rows, template, accounts] = await Promise.all([
        store.fetchMembershipReminders({ memberId }),
        store.fetchSetting('membership_reminder_template'),
        store.fetchPaymentAccounts().catch(() => []),
      ]);
      const target = rows[0] || null;
      const text = target
        ? buildMembershipReminder({
          template,
          fullName: target.full_name,
          planName: target.plan_name,
          validUntil: target.valid_until,
          daysLeft: target.days_left,
          accounts,
        })
        : '';
      return { target, text };
    },
    log: (store, memberId) => store.logMembershipReminder(memberId),
    missing: 'La membresía de este miembro ya no está por vencer ni vencida.',
  },
};

/** Encabezado de la hoja según el tipo de recordatorio. */
function TargetSummary({ kind, target }) {
  if (kind === 'debt') {
    return (
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-sm font-black text-white block truncate">{target.full_name}</span>
          <span className="text-[11px] text-[#A0A0A5] block">{lastReminderText(target)}</span>
        </div>
        <Money value={target.balance} className="text-lg text-[#FFC815] shrink-0" />
      </div>
    );
  }
  const hasPlan = target.plan_name && target.plan_name !== 'Sin plan';
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-sm font-black text-white block truncate">{target.full_name}</span>
          <span className="text-[11px] text-[#A0A0A5] block">
            {hasPlan ? `${target.plan_name} · ` : ''}
            {dueText(target.days_left)} ({formatDate(target.valid_until)})
          </span>
          <span className="text-[11px] text-[#A0A0A5] block">
            {target.reminded_this_period ? lastReminderText(target) : 'Aún no se le ha recordado esta vigencia'}
          </span>
        </div>
        <StatusBadge status={target.status} />
      </div>
      <span className="text-[11px] flex items-center gap-1.5 text-gray-400">
        {!target.profile_id ? (
          <><Smartphone className="w-3.5 h-3.5 text-gray-600 shrink-0" /> No usa la app: no recibe avisos push</>
        ) : target.push_sent_at ? (
          <><BellRing className="w-3.5 h-3.5 text-sky-400 shrink-0" /> La app le avisó {formatDateTime(target.push_sent_at)}</>
        ) : (
          <><BellRing className="w-3.5 h-3.5 text-gray-600 shrink-0" /> Usa la app; el aviso push sale a las 8:00 a. m.</>
        )}
      </span>
      {Number(target.debt_balance) > 0 && (
        <span className="text-[11px] font-bold text-amber-400">
          Además tiene deudas por <Money value={target.debt_balance} className="text-[11px]" /> (se recuerdan desde Deudas)
        </span>
      )}
    </div>
  );
}

// Mensaje amable por WhatsApp para un miembro: deuda (D41) o mensualidad (D50). Arma el
// texto con la plantilla del box, deja editarlo y abre WhatsApp; al abrirlo se registra.
export default function WhatsAppReminderSheet({ open, memberId, kind = 'debt', onClose, onSent, next, onNext }) {
  const saveMember = useManageStore((state) => state.saveMember);
  const config = KINDS[kind];
  const [data, setData] = useState(null); // { target }
  const [text, setText] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [country, setCountry] = useState('57');
  const [editingPhone, setEditingPhone] = useState(false);
  const [sent, setSent] = useState(false);
  const canChoose = canChooseWhatsappApp();
  const [app, setApp] = useState(() => (canChoose ? getPreferredWhatsappApp() : null));
  const [choosing, setChoosing] = useState(false);
  const [remember, setRemember] = useState(false);
  const load = useAction();
  const action = useAction();

  useEffect(() => {
    if (!open || !memberId) return;
    setData(null);
    setSent(false);
    setEditingPhone(false);
    setChoosing(false);
    action.setError(null);
    load.run(async () => {
      const { target, text: built } = await config.load(useManageStore.getState(), memberId);
      setData({ target });
      const parts = splitCountry(target?.phone);
      setCountry(parts.country);
      setPhoneInput(parts.number);
      setText(built);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, memberId, kind]);

  const target = data?.target;
  const phone = whatsappPhone(target?.phone);

  const savePhone = () => action.run(async () => {
    const value = phoneWithCountry(country, phoneInput);
    if (!whatsappPhone(value)) {
      throw new Error(country === '57'
        ? 'Revisa el número: un celular colombiano tiene 10 dígitos y empieza por 3 (ej. 3001234567).'
        : 'Revisa el número: escríbelo sin el indicativo del país, como lo marcarías allá.');
    }
    await saveMember({ id: memberId, phone: value });
    setData((prev) => ({ ...prev, target: { ...prev.target, phone: value } }));
    setEditingPhone(false);
  });

  // El enlace abre WhatsApp por su cuenta; aquí solo se registra el envío.
  const markSent = () => action.run(async () => {
    await config.log(useManageStore.getState(), memberId);
    setSent(true);
    onSent?.();
  });

  // En Android se pregunta la app si no hay una elección recordada o si pidió cambiarla.
  const askApp = canChoose && (!app || choosing);

  const openProps = (appKey) => ({
    // intent:// se abre en la misma pestaña (Android lanza la app sin salir de aquí).
    href: appKey ? whatsappAppUrl(appKey, phone, text) : whatsappUrl(phone, text),
    ...(appKey ? {} : { target: '_blank', rel: 'noopener noreferrer' }),
    onClick: (e) => {
      if (!text.trim()) {
        e.preventDefault();
        action.setError('El mensaje está vacío.');
        return;
      }
      if (appKey && askApp) {
        if (remember) {
          setPreferredWhatsappApp(appKey);
          setApp(appKey);
        }
        setChoosing(false);
      }
      markSent();
    },
  });

  const footer = target && phone && !editingPhone && (
    sent ? (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-400">
          <Check className="w-4 h-4" /> Recordatorio registrado
        </div>
        {next ? (
          <Button className="w-full py-3" onClick={onNext}>
            Siguiente: {next.full_name} <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button variant="secondary" className="w-full py-3" onClick={onClose}>Listo</Button>
        )}
      </div>
    ) : askApp ? (
      <div className="flex flex-col gap-2.5">
        <span className="text-xs font-bold text-white text-center">¿Desde qué WhatsApp lo envías?</span>
        <div className="grid grid-cols-2 gap-2">
          <a {...openProps('whatsapp')} className={`${OPEN_CLASS} bg-[#25D366] text-black`}>
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </a>
          <a {...openProps('business')} className={`${OPEN_CLASS} bg-[#128C7E] text-white`}>
            <Briefcase className="w-4 h-4" /> Business
          </a>
        </div>
        <label className="flex items-center justify-center gap-2 text-[11px] font-bold text-gray-300">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="accent-[#25D366] w-4 h-4"
          />
          Recordar mi elección en este teléfono
        </label>
      </div>
    ) : (
      <div className="flex flex-col gap-2">
        <a
          {...openProps(canChoose ? app : null)}
          className={`${OPEN_CLASS} w-full ${app === 'business' ? 'bg-[#128C7E] text-white' : 'bg-[#25D366] text-black'}`}
        >
          {app === 'business' ? <Briefcase className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
          Abrir {canChoose && app ? WHATSAPP_APPS[app].label : 'WhatsApp'}
        </a>
        {canChoose && app && (
          <button
            type="button"
            onClick={() => {
              setRemember(true);
              setChoosing(true);
            }}
            className="text-[11px] font-bold text-[#A0A0A5]"
          >
            Cambiar de app
          </button>
        )}
      </div>
    )
  );

  return (
    <Sheet open={open} title="Recordar por WhatsApp" onClose={onClose} footer={footer}>
      {!data ? (
        load.error ? <ErrorBox error={load.error} /> : <Loading />
      ) : !target ? (
        <ErrorBox error={config.missing} />
      ) : (
        <>
          <TargetSummary kind={kind} target={target} />

          {editingPhone || !phone ? (
            <Field
              label="Celular para WhatsApp"
              hint={target.phone && !phone
                ? `El número guardado (${target.phone}) no sirve: ${phoneProblem(target.phone).toLowerCase()}. Si es de otro país, elige el país y escríbelo sin indicativo.`
                : 'Si es de otro país, elige el país. Se guarda en los datos del miembro con su indicativo.'}
            >
              <div className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] gap-2">
                <select
                  value={country}
                  onChange={(e) => {
                    setCountry(e.target.value);
                    action.setError(null);
                  }}
                  aria-label="País"
                  className={`${inputClass} px-2 text-xs`}
                >
                  {COUNTRY_CODES.map(([code, name]) => (
                    <option key={code} value={code}>+{code} {name}</option>
                  ))}
                </select>
                <input
                  type="tel"
                  inputMode="tel"
                  value={phoneInput}
                  onChange={(e) => {
                    setPhoneInput(e.target.value);
                    action.setError(null);
                  }}
                  placeholder={country === '57' ? '3001234567' : 'Sin indicativo'}
                  className={`${inputClass} min-w-0`}
                />
                <Button disabled={action.busy} onClick={savePhone}>Guardar</Button>
              </div>
            </Field>
          ) : (
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-[#A0A0A5]">
                Para <span className="font-bold text-white">+{phone}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  const parts = splitCountry(target.phone);
                  setCountry(parts.country);
                  setPhoneInput(parts.number);
                  setEditingPhone(true);
                }}
                className="text-[11px] font-black text-[#FFC815] flex items-center gap-1"
              >
                <Pencil className="w-3 h-3" /> Cambiar
              </button>
            </div>
          )}

          <Field label="Mensaje" hint="Puedes ajustarlo antes de enviarlo. El texto base se cambia en Ajustes.">
            <TextArea rows={11} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>

          {sent && (
            <p className="text-[11px] text-gray-400">
              Si WhatsApp no se abrió, revisa que esté instalado en este teléfono.
            </p>
          )}
        </>
      )}
      <ErrorBox error={action.error} />
    </Sheet>
  );
}
