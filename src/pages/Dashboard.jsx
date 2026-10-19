import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Timer, Trophy, Flame, ChevronRight, Activity } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import useProfileStore from '../stores/profileStore';
import useMembershipStore from '../stores/membershipStore';
import useDebtStore from '../stores/debtStore';
import useFeedStore from '../stores/feedStore';
import usePRStore from '../stores/prStore';
import MembershipCard from '../components/MembershipCard';
import DebtCard from '../components/DebtCard';
import FeedEventCard from '../components/FeedEventCard';

export default function Dashboard() {
  const { user } = useAuthStore();
  const { profile, fetchProfile } = useProfileStore();
  const { fetchMembership, subscribeMembership } = useMembershipStore();
  const { fetchMyDebts, subscribeDebts } = useDebtStore();
  const { events, fetchFeed } = useFeedStore();
  const { prs, fetchPRs } = usePRStore();

  useEffect(() => {
    if (user?.id) {
      fetchProfile(user.id).then((p) => {
        if (p) {
          fetchMembership(user.id, p.document_id);
        }
      });
      fetchMyDebts(user.id);
      fetchFeed(user.id);
      fetchPRs(user.id);

      subscribeMembership(user.id);
      subscribeDebts(user.id);
    }
  }, [user?.id]);

  const recentPR = prs?.[0];
  const recentEvents = (events || []).slice(0, 3);

  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* Saludo */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-[#A0A0A5] uppercase tracking-wider">
            Box Dashboard
          </span>
          <h2 className="text-2xl font-black text-white tracking-tight mt-0.5">
            ¡Hola, {profile?.first_name || 'Atleta'}! 🔥
          </h2>
        </div>
        {profile?.discipline && (
          <span className="px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider bg-[#FFC815] text-black shadow-md">
            {profile.discipline}
          </span>
        )}
      </div>

      {/* 1) Estado de Membresía (HikCentral) */}
      <MembershipCard />

      {/* 2) Deudas de Suplementos / Tienda */}
      <DebtCard />

      {/* 3) Accesos Rápidos de Entrenamiento */}
      <div className="grid grid-cols-3 gap-2.5">
        <Link
          to="/training?action=new-pr"
          className="p-3 rounded-2xl bg-[#1C1C1E] border border-white/5 flex flex-col items-center justify-center text-center tap-bounce hover:border-[#FFC815]/30 transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-[#FFC815]/15 text-[#FFC815] flex items-center justify-center mb-2">
            <Zap className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-white">Nuevo PR</span>
          <span className="text-[10px] text-[#A0A0A5]">Fuerza</span>
        </Link>

        <Link
          to="/training?action=new-wod"
          className="p-3 rounded-2xl bg-[#1C1C1E] border border-white/5 flex flex-col items-center justify-center text-center tap-bounce hover:border-blue-500/30 transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center mb-2">
            <Timer className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-white">WOD</span>
          <span className="text-[10px] text-[#A0A0A5]">Benchmark</span>
        </Link>

        <Link
          to="/community?tab=leaderboard"
          className="p-3 rounded-2xl bg-[#1C1C1E] border border-white/5 flex flex-col items-center justify-center text-center tap-bounce hover:border-amber-500/30 transition-all"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-300 flex items-center justify-center mb-2">
            <Trophy className="w-5 h-5" />
          </div>
          <span className="text-xs font-bold text-white">Líderes</span>
          <span className="text-[10px] text-[#A0A0A5]">Top Box</span>
        </Link>
      </div>

      {/* 4) Tarjeta de Último Récord Personal */}
      {recentPR && (
        <div className="p-4 rounded-2xl bg-[#1C1C1E] border border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#FFC815]/15 text-[#FFC815]">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#A0A0A5]">
                Último Récord Registrado
              </span>
              <h4 className="text-sm font-black text-white">{recentPR.movement}</h4>
              <p className="text-xs font-bold text-[#FFC815]">
                {recentPR.value} {recentPR.unit || 'kg'}
              </p>
            </div>
          </div>
          <Link
            to="/training?tab=history"
            className="p-2 rounded-xl bg-[#292929] text-gray-300 tap-bounce"
            title="Ver evolución"
          >
            <ChevronRight className="w-4 h-4 text-[#FFC815]" />
          </Link>
        </div>
      )}

      {/* 5) Actividad Reciente del Box (Feed Preview) */}
      <div className="flex flex-col gap-3 mt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#FFC815]" />
            <h3 className="text-sm font-black uppercase tracking-wider text-white">
              Actividad en el Box
            </h3>
          </div>
          <Link
            to="/community"
            className="text-xs font-bold text-[#FFC815] flex items-center gap-1 tap-bounce"
          >
            <span>Ver todo</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentEvents.length === 0 ? (
          <div className="p-6 rounded-2xl bg-[#1C1C1E] border border-white/5 text-center text-xs text-[#A0A0A5]">
            Aún no hay actividad reciente. ¡Sé el primero en registrar un PR hoy!
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {recentEvents.map((evt) => (
              <FeedEventCard key={evt.id} event={evt} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
