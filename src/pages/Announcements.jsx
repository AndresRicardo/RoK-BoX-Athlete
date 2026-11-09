import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Megaphone } from 'lucide-react';
import useAnnouncementStore from '../stores/announcementStore';
import { AnnouncementItem } from '../components/Announcements';

// Comunicados vigentes del box (D49). Los avisos de la campana y del push abren
// /announcements?id=… y ese comunicado queda resaltado.
export default function Announcements() {
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get('id');
  const { active, activeLoaded, fetchActive, markSeen } = useAnnouncementStore();
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchActive().catch((err) => setError(err.message));
  }, [fetchActive]);

  const ids = active.map((a) => a.id).join(',');
  useEffect(() => {
    if (ids) markSeen(ids.split(',')).catch(() => {});
  }, [ids, markSeen]);

  useEffect(() => {
    if (!focusId || !activeLoaded) return;
    document.getElementById(`announcement-${focusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusId, activeLoaded]);

  const missing = focusId && activeLoaded && !active.some((a) => a.id === focusId);

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="flex items-center gap-2">
        <Link
          to="/"
          aria-label="Volver"
          className="w-9 h-9 shrink-0 rounded-xl bg-[#1C1C1E] border border-white/5 flex items-center justify-center text-gray-300 tap-bounce"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <span className="text-[10px] font-bold text-[#A0A0A5] uppercase tracking-wider block">RöK BoX</span>
          <h2 className="text-xl font-black text-white tracking-tight">Comunicados</h2>
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {missing && (
        <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-300">
          Ese comunicado ya no está vigente.
        </div>
      )}

      {!activeLoaded ? (
        <div className="p-8 text-center text-xs text-[#A0A0A5]">Cargando...</div>
      ) : active.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#1C1C1E] border border-white/5 text-center">
          <Megaphone className="w-7 h-7 text-[#FFC815] mx-auto mb-2 opacity-50" />
          <p className="text-sm font-bold text-white">No hay comunicados</p>
          <p className="text-xs text-[#A0A0A5] mt-1">Aquí verás los avisos y eventos del box.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {active.map((a) => (
            <AnnouncementItem key={a.id} announcement={a} highlight={a.id === focusId} />
          ))}
        </div>
      )}
    </div>
  );
}
