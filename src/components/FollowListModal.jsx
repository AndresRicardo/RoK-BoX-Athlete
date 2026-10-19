import { useEffect, useState } from 'react';
import { X, Users } from 'lucide-react';
import useFollowStore from '../stores/followStore';
import AthleteRow from './AthleteRow';

export default function FollowListModal({ athleteId, type = 'followers', onClose }) {
  const { fetchGraphList } = useFollowStore();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  const title = type === 'followers' ? 'Seguidores' : 'Siguiendo';

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchGraphList(athleteId, type)
      .then((data) => {
        if (active) {
          setList(data || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [athleteId, type, fetchGraphList]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#1C1C1E] rounded-t-3xl sm:rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[80vh] overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#FFC815]" />
            <h3 className="text-base font-bold text-white">{title}</h3>
            <span className="text-xs font-semibold text-[#A0A0A5]">({list.length})</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="p-8 text-center text-sm text-[#A0A0A5]">Cargando atletas...</div>
          ) : list.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#A0A0A5]">
              No hay atletas en esta lista.
            </div>
          ) : (
            list.map((athlete) => (
              <AthleteRow
                key={athlete.id}
                athlete={athlete}
                onSelect={() => onClose()}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
