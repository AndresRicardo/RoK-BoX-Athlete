import { useEffect, useMemo, useState } from 'react';
import { Trophy, Award, Lock, Sparkles, Filter } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import useProfileStore from '../stores/profileStore';
import usePRStore from '../stores/prStore';
import useBenchmarkStore from '../stores/benchmarkStore';
import useAchievementStore from '../stores/achievementStore';
import { ACHIEVEMENTS, getAllAchievementsStatus } from '../data/achievements';

const FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'unlocked', label: 'Desbloqueados' },
  { value: 'locked', label: 'Por Desbloquear' },
];

export default function Achievements() {
  const { user } = useAuthStore();
  const { profile, fetchProfile } = useProfileStore();
  const { prs, fetchPRs } = usePRStore();
  const { benchmarks, fetchBenchmarks } = useBenchmarkStore();
  const { unlocked, fetchAchievements } = useAchievementStore();
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (user?.id) {
      fetchProfile(user.id);
      fetchPRs(user.id);
      fetchBenchmarks(user.id);
      fetchAchievements(user.id);
    }
  }, [user?.id]);

  const status = useMemo(
    () => getAllAchievementsStatus({ prs, benchmarks, profile }),
    [prs, benchmarks, profile]
  );

  const unlockedIds = useMemo(
    () => new Set(unlocked.map((u) => u.achievement_id)),
    [unlocked]
  );

  const merged = useMemo(
    () =>
      status.map((a) => ({
        ...a,
        unlocked: a.unlocked || unlockedIds.has(a.id),
      })),
    [status, unlockedIds]
  );

  const totalUnlocked = merged.filter((a) => a.unlocked).length;
  const progressPercent = Math.round((totalUnlocked / merged.length) * 100) || 0;

  const filteredAchievements = useMemo(() => {
    if (filter === 'unlocked') return merged.filter((a) => a.unlocked);
    if (filter === 'locked') return merged.filter((a) => !a.unlocked);
    return merged;
  }, [merged, filter]);

  const getTierBadge = (tier) => {
    switch (tier?.toLowerCase()) {
      case 'gold':
        return 'bg-[#FFC815]/20 text-[#FFC815] border-[#FFC815]/30';
      case 'silver':
        return 'bg-slate-300/20 text-slate-200 border-slate-300/30';
      case 'bronze':
        return 'bg-amber-700/20 text-amber-300 border-amber-700/30';
      default:
        return 'bg-[#292929] text-gray-400';
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-8">
      {/* Header */}
      <div>
        <span className="text-xs font-bold text-[#A0A0A5] uppercase tracking-wider">
          Recompensas
        </span>
        <h2 className="text-2xl font-black text-white tracking-tight">Logros & Medallas</h2>
      </div>

      {/* Progress Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#1C1C1E] to-[#292929] border border-[#FFC815]/30 shadow-xl flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-[#FFC815] text-black shadow-lg">
              <Trophy className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-xs font-bold text-[#A0A0A5] uppercase tracking-wider">
                Progreso General
              </span>
              <h3 className="text-lg font-black text-white">
                {totalUnlocked} de {merged.length} Logros
              </h3>
            </div>
          </div>
          <span className="text-2xl font-black text-[#FFC815]">{progressPercent}%</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2.5 rounded-full bg-[#0A0A0C] overflow-hidden p-0.5 border border-white/5">
          <div
            className="h-full rounded-full bg-[#FFC815] transition-all duration-500 shadow-[0_0_10px_#FFC815]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-[#1C1C1E] border border-white/5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`py-2 rounded-xl text-xs font-bold transition-all tap-bounce ${
              filter === f.value
                ? 'bg-[#FFC815] text-black shadow-md'
                : 'text-[#A0A0A5] hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Achievements Grid */}
      <div className="grid grid-cols-1 gap-2.5">
        {filteredAchievements.map((item) => (
          <div
            key={item.id}
            className={`p-4 rounded-2xl border transition-all flex items-start gap-3.5 ${
              item.unlocked
                ? 'bg-[#1C1C1E] border-[#FFC815]/30 shadow-lg'
                : 'bg-[#1C1C1E]/50 border-white/5 opacity-60'
            }`}
          >
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${
                item.unlocked
                  ? 'bg-gradient-to-tr from-[#FFC815]/20 to-amber-200/20 text-[#FFC815] border border-[#FFC815]/40'
                  : 'bg-[#0A0A0C] text-gray-600 border border-white/5'
              }`}
            >
              {item.unlocked ? item.icon : <Lock className="w-5 h-5" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-white truncate">{item.name}</h4>
                {item.tier && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shrink-0 ${getTierBadge(
                      item.tier
                    )}`}
                  >
                    {item.tier}
                  </span>
                )}
              </div>
              <p className="text-xs text-[#A0A0A5] mt-1 leading-snug">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
