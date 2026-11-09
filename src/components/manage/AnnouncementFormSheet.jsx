import { useEffect, useMemo, useState } from 'react';
import { BellRing } from 'lucide-react';
import useAnnouncementStore, { ANNOUNCEMENT_KINDS } from '../../stores/announcementStore';
import { formatEventAt } from '../Announcements';
import { bogotaDate, bogotaDayEnd } from '../../utils/dates';
import {
  Sheet, Field, TextInput, TextArea, Button, ErrorBox, Segmented, useAction, inputClass,
} from './ui';

const TZ = 'America/Bogota';
const TITLE_MAX = 80;
const BODY_MAX = 500;

// 'YYYY-MM-DDTHH:mm' (hora de Bogotá) ↔ instante ISO.
function inputToIso(value) {
  return value ? new Date(`${value}:00-05:00`).toISOString() : null;
}
function isoToInput(iso) {
  if (!iso) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

// Igual que private.announcement_remind_at: la noche anterior a las 7:00 p. m. si el evento es
// antes de las 10:00 a. m.; si no, el mismo día a las 8:00 a. m.
function reminderAt(eventIso) {
  if (!eventIso) return null;
  const [date, time] = isoToInput(eventIso).split('T');
  if (time < '10:00') {
    const prev = new Date(`${date}T12:00:00Z`);
    prev.setUTCDate(prev.getUTCDate() - 1);
    return new Date(`${prev.toISOString().slice(0, 10)}T19:00:00-05:00`).toISOString();
  }
  return new Date(`${date}T08:00:00-05:00`).toISOString();
}

function Toggle({ checked, onChange, label, hint }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-3 text-left"
    >
      <span className="min-w-0">
        <span className="text-xs font-bold text-white block">{label}</span>
        {hint && <span className="text-[10px] text-gray-500 block">{hint}</span>}
      </span>
      <span className={`relative w-10 h-6 rounded-full shrink-0 transition-colors ${checked ? 'bg-[#FFC815]' : 'bg-[#38383A]'}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

const EMPTY = {
  kind: 'notice', title: '', body: '', eventAt: '', remind: true, audience: 'all',
  when: 'now', publishAt: '', visibleUntil: '', notify: true,
};

// Crear o editar un comunicado (save_announcement). Uno ya enviado solo corrige el texto:
// no se vuelve a enviar la notificación.
export default function AnnouncementFormSheet({ open, announcement, onClose }) {
  const save = useAnnouncementStore((state) => state.save);
  const [form, setForm] = useState(EMPTY);
  const { run, busy, error } = useAction();
  const sent = Boolean(announcement?.published_at);

  useEffect(() => {
    if (!open) return;
    setForm(announcement
      ? {
          kind: announcement.kind,
          title: announcement.title,
          body: announcement.body,
          eventAt: isoToInput(announcement.event_at),
          remind: announcement.remind || !announcement.event_at,
          audience: announcement.audience,
          when: announcement.published_at ? 'now' : 'later',
          publishAt: announcement.published_at ? '' : isoToInput(announcement.publish_at),
          visibleUntil: bogotaDate(new Date(new Date(announcement.visible_until).getTime() - 1000)),
          notify: announcement.notify,
        }
      : EMPTY);
  }, [open, announcement]);

  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));
  const setInput = (key) => (e) => set(key)(e.target.value);

  const eventIso = inputToIso(form.eventAt);
  const remindIso = useMemo(() => reminderAt(eventIso), [eventIso]);
  const remindPast = remindIso && new Date(remindIso) <= new Date();
  const kind = ANNOUNCEMENT_KINDS[form.kind];

  const submit = () => run(async () => {
    const title = form.title.trim();
    const body = form.body.trim();
    if (title.length < 3) throw new Error('El título debe tener al menos 3 caracteres.');
    if (!body) throw new Error('Escribe el mensaje.');
    if (!sent && form.when === 'later' && !form.publishAt) throw new Error('Elige cuándo enviarlo.');
    const publishAt = !sent && form.when === 'later' ? inputToIso(form.publishAt) : null;
    if (publishAt && new Date(publishAt) <= new Date()) throw new Error('La hora de envío ya pasó.');
    await save({
      id: announcement?.id,
      kind: form.kind,
      title,
      body,
      eventAt: eventIso,
      remind: form.remind && !remindPast,
      audience: form.audience,
      publishAt,
      visibleUntil: form.visibleUntil ? bogotaDayEnd(form.visibleUntil) : null,
      notify: form.notify,
    });
    onClose();
  });

  const submitLabel = busy ? 'Guardando...'
    : sent ? 'Guardar cambios'
      : form.when === 'later' ? 'Programar envío'
        : form.notify ? 'Publicar y notificar' : 'Publicar';

  return (
    <Sheet
      open={open}
      title={announcement ? 'Editar comunicado' : 'Nuevo comunicado'}
      onClose={onClose}
      footer={(
        <Button className="w-full py-3" disabled={busy} onClick={submit}>{submitLabel}</Button>
      )}
    >
      <Field label="Tipo">
        <Segmented
          options={[['notice', '📢 Aviso'], ['event', '🎉 Evento'], ['schedule', '🗓️ Horario']]}
          value={form.kind}
          onChange={set('kind')}
        />
      </Field>
      <Field label={`Título (${form.title.length}/${TITLE_MAX})`}>
        <TextInput
          value={form.title}
          maxLength={TITLE_MAX}
          placeholder={form.kind === 'schedule' ? 'Sábado sin clase de 6:00' : form.kind === 'event' ? 'Asado del fin de semana' : 'Aviso importante'}
          onChange={setInput('title')}
        />
      </Field>
      <Field label={`Mensaje (${form.body.length}/${BODY_MAX})`}>
        <TextArea rows={4} value={form.body} maxLength={BODY_MAX} onChange={setInput('body')} />
      </Field>

      <Field label="Fecha del evento (opcional)" hint="Se muestra en el comunicado y permite el recordatorio.">
        <div className="flex gap-2">
          <input type="datetime-local" className={inputClass} value={form.eventAt} onChange={setInput('eventAt')} />
          {form.eventAt && (
            <Button variant="secondary" onClick={() => set('eventAt')('')}>Quitar</Button>
          )}
        </div>
      </Field>
      {form.eventAt && (
        <Toggle
          checked={form.remind && !remindPast}
          onChange={set('remind')}
          label="Recordatorio automático"
          hint={remindPast
            ? 'La hora del recordatorio ya pasó: no se enviará.'
            : `Se envía el ${formatEventAt(remindIso)}`}
        />
      )}

      <Field label="Para quién">
        <Segmented
          options={[['all', 'Todos'], ['active_members', 'Membresía al día']]}
          value={form.audience}
          onChange={set('audience')}
        />
      </Field>

      {!sent && (
        <>
          <Field label="Cuándo enviarlo">
            <Segmented options={[['now', 'Ahora'], ['later', 'Programar']]} value={form.when} onChange={set('when')} />
          </Field>
          {form.when === 'later' && (
            <input type="datetime-local" className={inputClass} value={form.publishAt} onChange={setInput('publishAt')} />
          )}
          <Toggle
            checked={form.notify}
            onChange={set('notify')}
            label="Enviar notificación"
            hint="Push al teléfono y aviso en la campana. Sin ella, solo aparece en Inicio."
          />
        </>
      )}

      <Field
        label="Visible en Inicio hasta (opcional)"
        hint={form.eventAt ? 'Si lo dejas vacío, hasta el final del día del evento.' : 'Si lo dejas vacío, 7 días.'}
      >
        <input type="date" className={inputClass} value={form.visibleUntil} onChange={setInput('visibleUntil')} />
      </Field>

      {sent ? (
        <p className="text-[10px] text-gray-500">
          Ya se envió: los cambios corrigen el texto en la app y en la campana, pero no se vuelve a notificar.
        </p>
      ) : form.notify && (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#A0A0A5]">Así llega al teléfono</span>
          <div className="p-3 rounded-2xl bg-[#2C2C2E] border border-white/10 flex gap-3">
            <img src="/pwa-192x192.png" alt="" className="w-9 h-9 rounded-lg shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                <BellRing className="w-3 h-3" /> RöK BoX · ahora
              </div>
              <p className="text-xs font-bold text-white truncate">{kind.emoji} {form.title.trim() || 'Título'}</p>
              <p className="text-xs text-gray-300 line-clamp-2">{form.body.trim() || 'Mensaje'}</p>
            </div>
          </div>
        </div>
      )}

      <ErrorBox error={error} />
    </Sheet>
  );
}
