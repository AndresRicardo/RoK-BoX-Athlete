import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, UserPlus, UserCheck, Trophy, Zap, Shield } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import useFollowStore from '../stores/followStore';
import { supabase } from '../supabase/client';
import FollowListModal from '../components/FollowListModal';

export default function AthleteProfile() {
  const { id } = useParams();
  const { user } = useAuthStore();
  const { isFollowing, follow, unfollow, fetchNetwork } = useFollowStore();

  const [athlete, setAthlete] = useState(null);
  const [prs, setPrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followModal, setFollowModal] = useState({ open: false, type: 'followers' });

  const isMe = id === user?.id;
  const following = isFollowing(id);

  useEffect(() => {
    let active = true;
    setLoading(true);

    async function loadData() {
      try {
        const [dirRes, prsRes] = await Promise.all([
          supabase
            .from('athlete_directory')
            .select('*')
            .eq('id', id)
            .maybeSingle(),
          supabase
            .from('prs')
            .select('*')
            .eq('user_id', id)
            .order('value_numeric', { ascending: false }),
        ]);

        if (active) {
          setAthlete(dirRes.data || null);
          const normalizedPRs = (prsRes.data || []).map((p) => ({
            ...p,
            value: p.value ?? p.value_numeric,
            unit: p.unit || 'kg',
            date: p.date || p.achieved_at,
          }));
          setPrs(normalizedPRs);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error loading athlete profile:', err);
        if (active) setLoading(false);
      }
    }

    if (id) {
      loadData();
      if (user?.id) fetchNetwork(user.id);
    }

    return () => {
      active = false;
    };
  }, [id, user?.id]);

  const handleFollowToggle = async () => {
    if (!user?.id || isMe) return;
    if (following) {
      await unfollow(user.id, id);
    } else {
      await follow(user.id, id);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-[#A0A0A5]">
        Cargando perfil del atleta...
      </div>
    );
  }

  if (!athlete) {
    return (
      <div className="p-8 text-center flex flex-col items-center">
        <p className="text-sm font-bold text-white">Atleta no encontrado</p>
        <Link to="/community" className="mt-3 text-xs font-bold text-[#FFC815]">
          Volver a la comunidad
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 pb-8">
      {/* Back button */}
      <Link
        to="/community"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-white tap-bounce"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Comunidad</span>
      </Link>

      {/* Profile Header */}
      <div className="p-5 rounded-3xl bg-[#1C1C1E] border border-white/10 shadow-xl flex flex-col gap-4">
        <div className="flex items-center gap-4">
          {athlete.avatar_url ? (
            <img
              src={athlete.avatar_url}
              alt={athlete.display_name}
              className="w-16 h-16 rounded-2xl object-cover border-2 border-[#FFC815]/50 shadow-lg"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-[#0A0A0C] border-2 border-[#FFC815]/50 flex items-center justify-center text-xl font-black text-[#FFC815] shadow-lg">
              {athlete.first_name?.[0]?.toUpperCase() || 'A'}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-white truncate">
                {athlete.full_name || athlete.display_name}
              </h3>
              {athlete.discipline && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-[#FFC815] text-black shrink-0">
                  {athlete.discipline}
                </span>
              )}
            </div>
            <span className="text-xs font-bold text-[#A0A0A5] block mt-0.5">
              @{athlete.display_name || 'atleta'}
            </span>
            {athlete.box_name && (
              <span className="text-[11px] text-gray-400 block mt-0.5">{athlete.box_name}</span>
            )}
          </div>
        </div>

        {/* Action Button: Follow / Edit */}
        {!isMe ? (
          <button
            type="button"
            onClick={handleFollowToggle}
            className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 tap-bounce shadow-md transition-colors ${
              following
                ? 'bg-[#292929] text-gray-300 border border-white/10'
                : 'bg-[#FFC815] text-black'
            }`}
          >
            {following ? (
              <>
                <UserCheck className="w-4 h-4" />
                <span>Siguiendo</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Seguir a este atleta</span>
              </>
            )}
          </button>
        ) : (
          <Link
            to="/profile"
            className="w-full py-2.5 rounded-xl bg-[#292929] text-white text-xs font-bold text-center tap-bounce"
          >
            Editar mi perfil
          </Link>
        )}
      </div>

      {/* Récords Personales (PRs) del Atleta */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#FFC815]" />
          <h4 className="text-xs font-bold text-[#A0A0A5] uppercase tracking-wider">
            Récords Personales (PRs)
          </h4>
        </div>

        {prs.length === 0 ? (
          <div className="p-6 rounded-2xl bg-[#1C1C1E] border border-white/5 text-center text-xs text-[#A0A0A5]">
            Este atleta no tiene PRs públicos registrados todavía.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {prs.map((pr) => (
              <div
                key={pr.id}
                className="p-3.5 rounded-2xl bg-[#1C1C1E] border border-white/5 flex flex-col justify-between"
              >
                <span className="text-xs font-bold text-white truncate">{pr.movement}</span>
                <span className="text-base font-black text-[#FFC815] mt-1">
                  {pr.value} lb
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Seguidores */}
      {followModal.open && (
        <FollowListModal
          athleteId={id}
          type={followModal.type}
          onClose={() => setFollowModal({ open: false, type: 'followers' })}
        />
      )}
    </div>
  );
}
