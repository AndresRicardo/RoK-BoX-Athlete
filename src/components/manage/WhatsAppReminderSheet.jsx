import { useEffect, useState } from 'react';
import { MessageCircle, Check, ChevronRight, Pencil, Briefcase } from 'lucide-react';
import useManageStore from '../../stores/manageStore';
import { Sheet, Field, TextArea, Button, ErrorBox, Loading, Money, useAction, inputClass } from './ui';
import {
  buildDebtReminder, whatsappPhone, whatsappUrl, whatsappAppUrl, WHATSAPP_APPS,
  canChooseWhatsappApp, getPreferredWhatsappApp, setPreferredWhatsappApp,
} from '../../utils/whatsapp';
import { timeAgo } from '../../utils/time';

const OPEN_CLASS = 'py-3 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 tap-bounce';

/** Línea "Recordado hace 3 d por Ana" / "Nunca se le ha recordado". */
export function lastReminderText(debtor) {
  if (!debtor?.last_reminder_at) return 'Nunca se le ha recordado';
  const who = debtor.lastReminderByName ? ` por ${debtor.lastReminderByName.split(' ')[0]}` : '';
  return `Recordado ${timeAgo(debtor.last_reminder_at)}${who}`;
}

// Mensaje amable de cobro por WhatsApp para un miembro (D41). Arma el texto con la
// plantilla del box, deja editarlo y abre WhatsApp; al abrirlo se registra el recordatorio.
export default function WhatsAppReminderSheet({ open, memberId, onClose, onSent, next, onNext }) {
  const { fetchDebtors, fetchDebts, fetchReminderTemplate, logDebtReminder, saveMember } = useManageStore();
  const [data, setData] = useState(null); // { debtor, debts }
  const [text, setText] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
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
      const [debtors, debts, template] = await Promise.all([
        fetchDebtors({ memberId }),
        fetchDebts({ memberId, statuses: ['pending', 'partial'] }),
        fetchReminderTemplate(),
      ]);
      const debtor = debtors[0] || null;
      setData({ debtor, debts });
      setPhoneInput(debtor?.phone || '');
      if (debtor) {
        setText(buildDebtReminder({ template, fullName: debtor.full_name, total: debtor.balance, debts }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, memberId]);

  const debtor = data?.debtor;
  const phone = whatsappPhone(debtor?.phone);

  const savePhone = () => action.run(async () => {
    const value = phoneInput.trim();
    if (!whatsappPhone(value)) {
      throw new Error('Escribe un celular de 10 dígitos (ej. 3001234567) o un número internacional con +.');
    }
    await saveMember({ id: memberId, phone: value });
    setData((prev) => ({ ...prev, debtor: { ...prev.debtor, phone: value } }));
    setEditingPhone(false);
  });

  // El enlace abre WhatsApp por su cuenta; aquí solo se registra el envío.
  const markSent = () => action.run(async () => {
    await logDebtReminder(memberId);
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

  const footer = debtor && phone && !editingPhone && (
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
      ) : !debtor ? (
        <ErrorBox error="Este miembro ya no tiene saldo pendiente." />
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="text-sm font-black text-white block truncate">{debtor.full_name}</span>
              <span className="text-[11px] text-[#A0A0A5] block">{lastReminderText(debtor)}</span>
            </div>
            <Money value={debtor.balance} className="text-lg text-[#FFC815] shrink-0" />
          </div>

          {editingPhone || !phone ? (
            <Field
              label="Celular para WhatsApp"
              hint={debtor.phone && !phone ? `El número guardado (${debtor.phone}) no es un celular válido.` : 'Se guarda en los datos del miembro.'}
            >
              <div className="flex gap-2">
                <input
                  type="tel"
                  inputMode="tel"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="3001234567"
                  className={inputClass}
                />
                <Button className="shrink-0" disabled={action.busy} onClick={savePhone}>Guardar</Button>
              </div>
            </Field>
          ) : (
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-[#A0A0A5]">
                Para <span className="font-bold text-white">+{phone}</span>
              </span>
              <button
                type="button"
                onClick={() => setEditingPhone(true)}
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
