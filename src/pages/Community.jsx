import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, Trophy, Search, Activity, Crown, Medal, RefreshCw } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import useFeedStore from '../stores/feedStore';
import useLeaderboardStore from '../stores/leaderboardStore';
import useFollowStore from '../stores/followStore';
import useEngagementStore from '../stores/engagementStore';
import FeedEventCard from '../components/FeedEventCard';
import AthleteRow from '../components/AthleteRow';

export default function Community() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const { events, fetchFeed, subscribeFeed, unsubscribeFeed, loading: loadingFeed } = useFeedStore();
  const { prs: leaderboardPRs, benchmarks: leaderboardBenchmarks, fetchLeaderboards, loading: loadingLeaderboards } = useLeaderboardStore();
  const { searchAthletes, searchResults, searching, fetchSuggestions, suggestions } = useFollowStore();
  const { fetchEngagement } = useEngagementStore();

  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'feed');
  const [searchQuery, setSearchQuery] = useState('');
  const [leaderboardCategory, setLeaderboardCategory] = useState('prs'); // 'prs' | 'benchmarks'

  useEffect(() => {
    if (user?.id) {
      fetchFeed(user.id);
      subscribeFeed(user.id);
      fetchLeaderboards('global').catch(() => {});
      fetchSuggestions(user.id).catch(() => {});
    }

    return () => {
      unsubscribeFeed();
    };
  }, [user?.id]);

  useEffect(() => {
    if (user?.id && events?.length > 0) {
      const ids = events.map((e) => e.id);
      fetchEngagement(ids, user.id).catch(() => {});
    }
  }, [user?.id, events, fetchEngagement]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && (tab === 'feed' || tab === 'leaderboard' || tab === 'search')) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleSearchChange = (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (q.trim().length >= 2) {
      searchAthletes(q.trim());
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-[#A0A0A5] uppercase tracking-wider">
            Comunidad
          </span>
          <h2 className="text-2xl font-black text-white tracking-tight">RöK BoX Social</h2>
        </div>
      </div>

      {/* Pill Tabs */}
      <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-[#1C1C1E] border border-white/5">
        <button
          type="button"
          onClick={() => setActiveTab('feed')}
          className={`py-2 rounded-xl text-xs font-bold transition-all tap-bounce flex items-center justify-center gap-1.5 ${
            activeTab === 'feed'
              ? 'bg-[#FFC815] text-black shadow-md'
              : 'text-[#A0A0A5] hover:text-white'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Feed</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('leaderboard')}
          className={`py-2 rounded-xl text-xs font-bold transition-all tap-bounce flex items-center justify-center gap-1.5 ${
            activeTab === 'leaderboard'
              ? 'bg-[#FFC815] text-black shadow-md'
              : 'text-[#A0A0A5] hover:text-white'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          <span>Líderes</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('search')}
          className={`py-2 rounded-xl text-xs font-bold transition-all tap-bounce flex items-center justify-center gap-1.5 ${
            activeTab === 'search'
              ? 'bg-[#FFC815] text-black shadow-md'
              : 'text-[#A0A0A5] hover:text-white'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Atletas</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: FEED SOCIAL */}
      {/* ======================================================== */}
      {activeTab === 'feed' && (
        <div className="flex flex-col gap-3">
          {loadingFeed && events.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#A0A0A5]">Cargando actividad...</div>
          ) : events.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#1C1C1E] border border-white/5 text-center">
              <Users className="w-8 h-8 text-[#FFC815] mx-auto mb-2 opacity-50" />
              <p className="text-sm font-bold text-white">Tu feed está vacío</p>
              <p className="text-xs text-[#A0A0A5] mt-1">
                Sigue a otros atletas del box en la pestaña "Atletas" para ver sus récords y actividad.
              </p>
            </div>
          ) : (
            events.map((evt) => <FeedEventCard key={evt.id} event={evt} />)
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: TABLERO DE LÍDERES */}
      {/* ======================================================== */}
      {activeTab === 'leaderboard' && (
        <div className="flex flex-col gap-4">
          {/* Subselector: PRs vs Benchmarks */}
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setLeaderboardCategory('prs')}
              className={`px-4 py-1.5 rounded-xl text-xs font-black transition-colors ${
                leaderboardCategory === 'prs'
                  ? 'bg-white text-black'
                  : 'bg-[#1C1C1E] text-gray-400'
              }`}
            >
              Fuerza / PRs
            </button>
            <button
              type="button"
              onClick={() => setLeaderboardCategory('benchmarks')}
              className={`px-4 py-1.5 rounded-xl text-xs font-black transition-colors ${
                leaderboardCategory === 'benchmarks'
                  ? 'bg-white text-black'
                  : 'bg-[#1C1C1E] text-gray-400'
              }`}
            >
              WODs / Benchmarks
            </button>
          </div>

          {loadingLeaderboards ? (
            <div className="p-8 text-center text-xs text-[#A0A0A5]">
              Cargando tabla de líderes...
            </div>
          ) : leaderboardCategory === 'prs' ? (
            leaderboardPRs.length === 0 ? (
              <div className="p-8 rounded-2xl bg-[#1C1C1E] border border-white/5 text-center text-xs text-[#A0A0A5]">
                No hay marcas de PRs registradas para el ranking aún.
              </div>
            ) : (
              leaderboardPRs.map((item, idx) => (
                <div
                  key={`${item.movement || idx}-${idx}`}
                  className="p-4 rounded-2xl bg-[#1C1C1E] border border-white/5 flex flex-col gap-2.5"
                >
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h4 className="text-sm font-black text-[#FFC815]">
                      {item.movement || 'Movimiento'}
                    </h4>
                    <span className="text-[10px] uppercase font-bold text-gray-400">
                      Récord del Box
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-[#FFC815]/20 text-[#FFC815] font-black text-sm flex items-center justify-center">
                        {idx === 0 ? <Crown className="w-4 h-4" /> : `#${idx + 1}`}
                      </div>
                      <div>
                        <span className="text-sm font-bold text-white block">
                          {item.athlete_name || item.full_name || 'Atleta'}
                        </span>
                        <span className="text-xs text-[#A0A0A5]">
                          @{item.display_name || 'atleta'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-base font-black text-white block">
                        {item.value} {item.unit || 'kg'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )
          ) : leaderboardBenchmarks.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#1C1C1E] border border-white/5 text-center text-xs text-[#A0A0A5]">
              No hay resultados de benchmarks registrados para el ranking aún.
            </div>
          ) : (
            leaderboardBenchmarks.map((item, idx) => (
              <div
                key={`${item.name || idx}-${idx}`}
                className="p-4 rounded-2xl bg-[#1C1C1E] border border-white/5 flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black text-white">{item.name}</h4>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-[#292929] text-[#FFC815]">
                      {item.scaling || 'RX'}
                    </span>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-gray-400">
                    Mejor Tiempo
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 font-black text-sm flex items-center justify-center">
                      {idx === 0 ? <Medal className="w-4 h-4" /> : `#${idx + 1}`}
                    </div>
                    <div>
                      <span className="text-sm font-bold text-white block">
                        {item.athlete_name || item.full_name || 'Atleta'}
                      </span>
                      <span className="text-xs text-[#A0A0A5]">
                        @{item.display_name || 'atleta'}
                      </span>
                    </div>
                  </div>

                  <span className="text-base font-black text-white">{item.result}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: BUSCAR ATLETAS */}
      {/* ======================================================== */}
      {activeTab === 'search' && (
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Buscar por nombre o @handle..."
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#1C1C1E] border border-white/5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#FFC815]"
            />
          </div>

          {searchQuery.trim().length >= 2 ? (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-[#A0A0A5] uppercase tracking-wider">
                Resultados de Búsqueda
              </span>
              {searching ? (
                <div className="p-6 text-center text-xs text-[#A0A0A5]">Buscando...</div>
              ) : searchResults.length === 0 ? (
                <div className="p-6 rounded-2xl bg-[#1C1C1E] border border-white/5 text-center text-xs text-[#A0A0A5]">
                  No se encontraron atletas con "{searchQuery}".
                </div>
              ) : (
                searchResults.map((athlete) => (
                  <AthleteRow key={athlete.id} athlete={athlete} />
                ))
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-[#A0A0A5] uppercase tracking-wider">
                Atletas Sugeridos en RöK BoX
              </span>
              {suggestions.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#A0A0A5]">
                  Escribe en el buscador para encontrar atletas de tu comunidad.
                </div>
              ) : (
                suggestions.map((athlete) => (
                  <AthleteRow key={athlete.id} athlete={athlete} />
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
