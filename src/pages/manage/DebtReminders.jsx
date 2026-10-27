import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, MessageCircle, PhoneOff } from 'lucide-react';
import useManageStore from '../../stores/manageStore';
import {
  ManageHeader, Chips, ErrorBox, Empty, Loading, Money, useAction,
} from '../../components/manage/ui';
import WhatsAppReminderSheet, { lastReminderText } from '../../components/manage/WhatsAppReminderSheet';
import { whatsappPhone } from '../../utils/whatsapp';
import { formatDate } from '../../utils/dates';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const FILTERS = [
  ['due', 'Por recordar'],
  ['all', 'Todos'],
  ['no_phone', 'Sin celular válido'],
];

const fold = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// "Por recordar": con celular y sin recordatorio en los últimos 7 días.
const isDue = (d) => whatsappPhone(d.phone)
  && (!d.last_reminder_at || Date.now() - new Date(d.last_reminder_at).getTime() > WEEK_MS);

export default function DebtReminders() {
  const fetchDebtors = useManageStore((state) => state.fetchDebtors);
  const [debtors, setDebtors] = useState(null);
  const [filter, setFilter] = useState('due');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  // Orden fijo mientras la hoja está abierta, para que "Siguiente" no salte.
  const [queue, setQueue] = useState([]);
  const { run, error } = useAction();

  const refresh = useCallback(async () => setDebtors(await fetchDebtors()), [fetchDebtors]);

  useEffect(() => {
    run(refresh);
  }, [refresh, run]);

  const visible = useMemo(() => {
    if (!debtors) return [];
    const q = fold(search.trim());
    return debtors.filter((d) => {
      if (q && !fold(d.full_name).includes(q)) return false;
      if (filter === 'due') return isDue(d);
      if (filter === 'no_phone') return !whatsappPhone(d.phone);
      return true;
    });
  }, [debtors, filter, search]);

  const total = visible.reduce((sum, d) => sum + Number(d.balance || 0), 0);

  const open = (memberId) => {
    setQueue(visible.filter((d) => whatsappPhone(d.phone) || d.member_id === memberId));
    setSelectedId(memberId);
  };

  const idx = queue.findIndex((d) => d.member_id === selectedId);
  const next = idx >= 0 ? queue.slice(idx + 1).find((d) => whatsappPhone(d.phone)) : null;

  return (
    <div className="flex flex-col gap-3 pb-8">
      <ManageHeader title="Recordar por WhatsApp" subtitle="Deudas" back="/manage/debts" />

      <p className="text-[11px] text-[#A0A0A5] -mt-1">
        Se abre WhatsApp en tu teléfono con un mensaje amable y el detalle de lo que debe. Tú decides si lo envías.
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

      {debtors && (
        <div className="px-4 py-3 rounded-2xl bg-[#1C1C1E] border border-white/5 flex items-center justify-between">
          <span className="text-xs text-[#A0A0A5] font-bold">
            {visible.length} {visible.length === 1 ? 'persona' : 'personas'}
          </span>
          <Money value={total} className="text-lg text-[#FFC815]" />
        </div>
      )}

      <ErrorBox error={error} />

      {!debtors ? (
        <Loading>Cargando saldos...</Loading>
      ) : visible.length === 0 ? (
        <Empty title={filter === 'due' ? 'No hay a quién recordar' : 'Nadie en esta lista'}>
          {filter === 'due' && 'A todos los que deben ya se les recordó en los últimos 7 días.'}
        </Empty>
      ) : (
        <div className="flex flex-col gap-1.5">
          {visible.map((d) => {
            const hasPhone = Boolean(whatsappPhone(d.phone));
            return (
              <button
                key={d.member_id}
                type="button"
                onClick={() => open(d.member_id)}
                className="w-full text-left p-3 rounded-2xl bg-[#1C1C1E] border border-white/5 flex items-center gap-3 tap-bounce"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-black text-white block truncate">{d.full_name}</span>
                  <span className="text-[11px] text-[#A0A0A5] block truncate">
                    {d.open_debts} {Number(d.open_debts) === 1 ? 'deuda' : 'deudas'} · desde {formatDate(d.oldest_debt_at)}
                  </span>
                  <span className={`text-[10px] block truncate ${d.last_reminder_at ? 'text-gray-500' : 'text-amber-400/80'}`}>
                    {lastReminderText(d)}
                  </span>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <Money value={d.balance} className="text-sm text-white" />
                  {hasPhone ? (
                    <span className="w-8 h-8 rounded-lg bg-[#25D366]/15 text-[#25D366] flex items-center justify-center">
                      <MessageCircle className="w-4 h-4" />
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-orange-400">
                      <PhoneOff className="w-3.5 h-3.5" /> {d.phone ? 'Revisar celular' : 'Sin celular'}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <WhatsAppReminderSheet
        open={!!selectedId}
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
