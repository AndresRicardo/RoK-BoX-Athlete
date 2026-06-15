import { useEffect, useMemo, useState } from 'react';
import useAuthStore from '../stores/authStore';
import useProfileStore from '../stores/profileStore';
import usePRStore from '../stores/prStore';
import useBenchmarkStore from '../stores/benchmarkStore';
import useAchievementStore from '../stores/achievementStore';
import { ACHIEVEMENTS, getAllAchievementsStatus } from '../data/achievements';
import './Achievements.css';

const FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'unlocked', label: 'Desbloqueados' },
  { value: 'locked', label: 'Bloqueados' },
];

function Achievements() {
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
  }, [user, fetchProfile, fetchPRs, fetchBenchmarks, fetchAchievements]);

  const status = useMemo(
    () => getAllAchievementsStatus({ prs, benchmarks, profile }),
    [prs, benchmarks, profile],
  );

  const unlockedIds = useMemo(
    () => new Set(unlocked.map((u) => u.achievement_id)),
    [unlocked],
  );

  const unlockedMap = useMemo(() => {
    const map = new Map();
    for (const u of unlocked) {
      map.set(u.achievement_id, u);
    }
    return map;
  }, [unlocked]);

  const merged = useMemo(
    () => status.map((a) => ({
      ...a,
      unlocked: a.unlocked || unlockedIds.has(a.id),
      unlocked_at: unlockedMap.get(a.id)?.unlocked_at,
    })),
    [status, unlockedIds, unlockedMap],
  );

  const totalUnlocked = merged.filter((a) => a.unlocked).length;
  const progress = ACHIEVEMENTS.length > 0
    ? Math.round((totalUnlocked / ACHIEVEMENTS.length) * 100)
    : 0;

  const filtered = useMemo(() => {
    if (filter === 'unlocked') return merged.filter((a) => a.unlocked);
    if (filter === 'locked') return merged.filter((a) => !a.unlocked);
    return merged;
  }, [merged, filter]);

  return (
    <div className="achievements-page">
      <div className="achievements-header">
        <h1>Logros</h1>
        <p className="achievements-stats">
          {totalUnlocked} de {ACHIEVEMENTS.length} desbloqueados
        </p>
        <div className="achievements-progress">
          <div
            className="achievements-progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="achievements-filters" role="tablist" aria-label="Filtrar logros">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={filter === f.value}
            className={`filter-tab ${filter === f.value ? 'filter-tab-active' : ''}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="achievements-empty">No hay logros en este filtro.</p>
      ) : (
        <div className="achievements-grid">
          {filtered.map((a) => (
            <div
              key={a.id}
              className={`achievement-card ${a.unlocked ? 'achievement-card-unlocked' : 'achievement-card-locked'} tier-${a.tier}`}
            >
              <div className="achievement-card-icon">{a.icon}</div>
              <div className="achievement-card-info">
                <h2>{a.name}</h2>
                <p>{a.description}</p>
                <div className="achievement-card-meta">
                  <span className={`achievement-card-tier tier-${a.tier}`}>
                    {a.tier}
                  </span>
                  {a.unlocked && a.unlocked_at && (
                    <span className="achievement-card-date">
                      {new Date(a.unlocked_at).toLocaleDateString('es-ES', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Achievements;
