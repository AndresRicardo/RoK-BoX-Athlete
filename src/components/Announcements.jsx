import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Megaphone, CalendarClock, ChevronRight } from 'lucide-react';
import useAnnouncementStore, { ANNOUNCEMENT_KINDS } from '../stores/announcementStore';

const TZ = 'America/Bogota';
const NEW_MS = 24 * 60 * 60 * 1000;

/** "sábado 15 nov, 6:00 a. m." */
export function formatEventAt(value) {
  if (!value) return '';
  return new Date(value).toLocaleString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: TZ,
  });
}

const KIND_STYLE = {
  notice: 'bg-[#FFC815]/15',
  event: 'bg-emerald-500/15',
  schedule: 'bg-sky-500/15',
};

/** Un comunicado: icono del tipo, título, fecha del evento y mensaje. */
export function AnnouncementItem({ announcement: a, clamp = false, highlight = false, footer }) {
  const kind = ANNOUNCEMENT_KINDS[a.kind] || ANNOUNCEMENT_KINDS.notice;
  const isNew = a.published_at && Date.now() - new Date(a.published_at).getTime() < NEW_MS;
  return (
    <div
      id={`announcement-${a.id}`}
      className={`p-3.5 rounded-2xl border flex gap-3 ${
        highlight ? 'bg-[#FFC815]/10 border-[#FFC815]/50' : 'bg-[#1C1C1E] border-white/5'
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${KIND_STYLE[a.kind] || KIND_STYLE.notice}`}>
        {kind.emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <h4 className="flex-1 text-sm font-black text-white leading-snug">{a.title}</h4>
          {isNew && (
            <span className="px-1.5 py-0.5 rounded-md bg-[#FFC815] text-black text-[9px] font-black uppercase tracking-wide shrink-0">
              Nuevo
            </span>
          )}
        </div>
        {a.event_at && (
          <p className="mt-0.5 text-[11px] font-bold text-[#FFC815] flex items-center gap-1">
            <CalendarClock className="w-3.5 h-3.5 shrink-0" />
            <span className="first-letter:uppercase">{formatEventAt(a.event_at)}</span>
          </p>
        )}
        <p className={`mt-1 text-xs text-gray-300 leading-relaxed whitespace-pre-line ${clamp ? 'line-clamp-3' : ''}`}>
          {a.body}
        </p>
        {footer}
      </div>
    </div>
  );
}

/** Tarjeta de Inicio: los comunicados vigentes (hasta 3). No se muestra si no hay. */
export function AnnouncementsCard() {
  const { active, fetchActive, markSeen } = useAnnouncementStore();

  useEffect(() => {
    fetchActive().catch(() => {});
  }, [fetchActive]);

  const shown = active.slice(0, 3);
  const shownIds = shown.map((a) => a.id).join(',');
  useEffect(() => {
    if (shownIds) markSeen(shownIds.split(',')).catch(() => {});
  }, [shownIds, markSeen]);

  if (shown.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-[#FFC815]" />
          <h3 className="text-sm font-black uppercase tracking-wider text-white">Del box</h3>
        </div>
        {active.length > 0 && (
          <Link to="/announcements" className="text-xs font-bold text-[#FFC815] flex items-center gap-1 tap-bounce">
            <span>{active.length > 3 ? `Ver los ${active.length}` : 'Ver todo'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
      {shown.map((a) => (
        <Link key={a.id} to={`/announcements?id=${a.id}`} className="tap-bounce">
          <AnnouncementItem announcement={a} clamp />
        </Link>
      ))}
    </div>
  );
}
