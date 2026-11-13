import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, MessageCircle, PhoneOff, BellRing } from 'lucide-react';
import useManageStore from '../../stores/manageStore';
import {
  ManageHeader, Chips, ErrorBox, Empty, Loading, StatusBadge, useAction,
} from '../../components/manage/ui';
import WhatsAppReminderSheet, { lastReminderText } from '../../components/manage/WhatsAppReminderSheet';
import { whatsappPhone, dueText } from '../../utils/whatsapp';
import { formatDate } from '../../utils/dates';

// Vencidas que todavía vale la pena recordar (las más viejas suelen ser exmiembros).
const OVERDUE_DAYS = 30;
const DUE_OVERDUE_DAYS = 7;

const FILTERS = [
  ['due', 'Por recordar'],
  ['expiring', 'Por vencer'],
  ['overdue', `Vencidas (${OVERDUE_DAYS} d)`],
  ['no_phone', 'Sin celular válido'],
];

const fold = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const isExpiring = (m) => m.status === 'expiring_soon';
const isRecentOverdue = (m, days) => m.status === 'overdue' && m.days_left >= -days;

// "Por recordar": por vencer o vencida hace poco, con celular y sin recordatorio en esta vigencia.
const isDue = (m) => whatsappPhone(m.phone) && !m.reminded_this_period
  && (isExpiring(m) || isRecentOverdue(m, DUE_OVERDUE_DAYS));

// Primero las que vencen antes (hoy, mañana...), luego las vencidas más recientes.
const sortKey = (m) => (m.days_left >= 0 ? m.days_left : 100 - m.days_left);

export default function MembershipReminders() {
  const fetchMembershipReminders = useManageStore((state) => state.fetchMembershipReminders);
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState(() => (
    FILTERS.some(([key]) => key === searchParams.get('list')) ? searchParams.get('list') : 'due'
  ));
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  // Orden fijo mientras la hoja está abierta, para que "Siguiente" no salte.
  const [queue, setQueue] = useState([]);
  const { run, error } = useAction();

  const refresh = useCallback(async () => setRows(await fetchMembershipReminders()), [fetchMembershipReminders]);

  useEffect(() => {
    run(refresh);
  }, [refresh, run]);

  const visible = useMemo(() => {
    if (!rows) return [];
    const q = fold(search.trim());
    return rows
      .filter((m) => m.is_active && (isExpiring(m) || isRecentOverdue(m, OVERDUE_DAYS)))
      .filter((m) => {
        if (q && !fold(m.full_name).includes(q)) return false;
        if (filter === 'due') return isDue(m);
        if (filter === 'expiring') return isExpiring(m);
        if (filter === 'overdue') return m.status === 'overdue';
        if (filter === 'no_phone') return !whatsappPhone(m.phone);
        return true;
      })
      .sort((a, b) => sortKey(a) - sortKey(b));
  }, [rows, filter, search]);

  const open = (memberId) => {
    setQueue(visible.filter((m) => whatsappPhone(m.phone) || m.member_id === memberId));
    setSelectedId(memberId);
  };

  const idx = queue.findIndex((m) => m.member_id === selectedId);
  const next = idx >= 0 ? queue.slice(idx + 1).find((m) => whatsappPhone(m.phone)) : null;

  return (
    <div className="flex flex-col gap-3 pb-8">
      <ManageHeader title="Recordar mensualidad" subtitle="Miembros" back="/manage/members" />

      <p className="text-[11px] text-[#A0A0A5] -mt-1">
        Se abre WhatsApp en tu teléfono con un mensaje amable, la fecha de vencimiento y los medios de pago.
        Tú decides si lo envías. Quien usa la app además recibe un aviso push al pasar a "por vencer".
      </p>

      <div className="relative">
        <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre"
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#1C1C1E] border border-white/5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#FFC815]"
        />
      </div>

      <Chips options={FILTERS} value={filter} onChange={setFilter} />

      <ErrorBox error={error} />

      {!rows ? (
        <Loading>Cargando membresías...</Loading>
      ) : visible.length === 0 ? (
        <Empty title={filter === 'due' ? 'No hay a quién recordar' : 'Nadie en esta lista'}>
          {filter === 'due' && `A quienes están por vencer o vencieron en los últimos ${DUE_OVERDUE_DAYS} días ya se les recordó esta vigencia.`}
        </Empty>
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] text-[#A0A0A5] font-bold">
            {visible.length} {visible.length === 1 ? 'persona' : 'personas'}
          </span>
          {visible.map((m) => {
            const hasPhone = Boolean(whatsappPhone(m.phone));
            return (
              <button
                key={m.member_id}
                type="button"
                onClick={() => open(m.member_id)}
                className="w-full text-left p-3 rounded-2xl bg-[#1C1C1E] border border-white/5 flex items-center gap-3 tap-bounce"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-black text-white block truncate">{m.full_name}</span>
                  <span className="text-[11px] text-[#A0A0A5] block truncate">
                    {dueText(m.days_left).replace(/^./, (c) => c.toUpperCase())} · {formatDate(m.valid_until)}
                    {m.plan_name && m.plan_name !== 'Sin plan' ? ` · ${m.plan_name}` : ''}
                  </span>
                  <span className={`text-[10px] flex items-center gap-1 truncate ${m.reminded_this_period ? 'text-gray-500' : 'text-amber-400/80'}`}>
                    {m.reminded_this_period ? lastReminderText(m) : 'Sin recordatorio esta vigencia'}
                    {m.push_sent_at && <BellRing className="w-3 h-3 text-sky-400 shrink-0" aria-label="Recibió el aviso push" />}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <StatusBadge status={m.status} />
                  {hasPhone ? (
                    <span className="w-8 h-8 rounded-lg bg-[#25D366]/15 text-[#25D366] flex items-center justify-center">
                      <MessageCircle className="w-4 h-4" />
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-orange-400">
                      <PhoneOff className="w-3.5 h-3.5" /> {m.phone ? 'Revisar celular' : 'Sin celular'}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-gray-500 flex items-center gap-1">
        <BellRing className="w-3 h-3 text-sky-400" /> ya recibió el aviso push de la app
      </p>

      <WhatsAppReminderSheet
        open={!!selectedId}
        kind="membership"
        memberId={selectedId}
        onClose={() => {
          setSelectedId(null);
          run(refresh);
        }}
        onSent={() => run(refresh)}
        next={next}
        onNext={() => next && setSelectedId(next.member_id)}
      />
    </div>
  );
}
