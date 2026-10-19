import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Zap, Timer, TrendingUp, CheckCircle2, Plus, Search, Edit3, Trash2 } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import usePRStore from '../stores/prStore';
import useBenchmarkStore from '../stores/benchmarkStore';
import useMovementStore from '../stores/movementStore';
import PRModal from '../components/PRModal';
import BenchmarkModal from '../components/BenchmarkModal';
import HistoryChart from '../components/HistoryChart';
import { MOVEMENT_CATALOG, CATEGORY_LABELS } from '../data/movements';

export default function Training() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const { prs = [], fetchPRs, deletePR, loading: loadingPRs } = usePRStore();
  const { benchmarks = [], fetchBenchmarks, deleteBenchmark, loading: loadingBenchmarks } = useBenchmarkStore();
  const { unlocked = [], fetchUnlocked, unlockMovement, lockMovement } = useMovementStore();

  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'prs');
  const [search, setSearch] = useState('');

  // Modals state
  const [prModalOpen, setPrModalOpen] = useState(false);
  const [selectedPr, setSelectedPr] = useState(null);
  const [benchmarkModalOpen, setBenchmarkModalOpen] = useState(false);
  const [selectedBenchmark, setSelectedBenchmark] = useState(null);

  useEffect(() => {
    if (user?.id) {
      if (typeof fetchPRs === 'function') fetchPRs(user.id);
      if (typeof fetchBenchmarks === 'function') fetchBenchmarks(user.id);
      if (typeof fetchUnlocked === 'function') fetchUnlocked(user.id);
    }
  }, [user?.id, fetchPRs, fetchBenchmarks, fetchUnlocked]);

  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'new-pr') {
      setActiveTab('prs');
      setSelectedPr(null);
      setPrModalOpen(true);
    } else if (action === 'new-wod') {
      setActiveTab('benchmarks');
      setSelectedBenchmark(null);
      setBenchmarkModalOpen(true);
    }
  }, [searchParams]);

  // Filtrado de PRs
  const filteredPRs = (prs || []).filter((p) =>
    (p.movement || '').toLowerCase().includes(search.toLowerCase())
  );

  // Filtrado de Benchmarks
  const filteredBenchmarks = (benchmarks || []).filter((b) =>
    (b.name || '').toLowerCase().includes(search.toLowerCase())
  );

  // Filtrado de Skills
  const gymnasticMovements = MOVEMENT_CATALOG.filter(
    (m) => m.category === 'gymnastic' || m.category === 'olympic'
  );
  const filteredSkills = gymnasticMovements.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase())
  );

  const isSkillUnlocked = (movementName) => {
    return unlocked.some((u) => u.movement === movementName);
  };

  const handleToggleSkill = async (mov) => {
    if (isSkillUnlocked(mov.name)) {
      await lockMovement(user.id, mov.name);
    } else {
      await unlockMovement(user.id, mov.name, mov.category);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-8">
      {/* Top Header con Tab Switcher */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-[#A0A0A5] uppercase tracking-wider">
            Rendimiento
          </span>
          <h2 className="text-2xl font-black text-white tracking-tight">Entrenamiento</h2>
        </div>

        {/* Action Button */}
        {activeTab === 'prs' && (
          <button
            onClick={() => {
              setSelectedPr(null);
              setPrModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#FFC815] text-black font-extrabold text-xs shadow-md tap-bounce"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Nuevo PR</span>
          </button>
        )}

        {activeTab === 'benchmarks' && (
          <button
            onClick={() => {
              setSelectedBenchmark(null);
              setBenchmarkModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500 text-white font-extrabold text-xs shadow-md tap-bounce"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Nuevo WOD</span>
          </button>
        )}
      </div>

      {/* Pill Navigation (Tabs) */}
      <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-[#1C1C1E] border border-white/5">
        <button
          type="button"
          onClick={() => setActiveTab('prs')}
          className={`py-2 rounded-xl text-xs font-bold transition-all tap-bounce ${
            activeTab === 'prs'
              ? 'bg-[#FFC815] text-black shadow-md'
              : 'text-[#A0A0A5] hover:text-white'
          }`}
        >
          PRs
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('benchmarks')}
          className={`py-2 rounded-xl text-xs font-bold transition-all tap-bounce ${
            activeTab === 'benchmarks'
              ? 'bg-[#FFC815] text-black shadow-md'
              : 'text-[#A0A0A5] hover:text-white'
          }`}
        >
          WODs
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`py-2 rounded-xl text-xs font-bold transition-all tap-bounce ${
            activeTab === 'history'
              ? 'bg-[#FFC815] text-black shadow-md'
              : 'text-[#A0A0A5] hover:text-white'
          }`}
        >
          Histórico
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('skills')}
          className={`py-2 rounded-xl text-xs font-bold transition-all tap-bounce ${
            activeTab === 'skills'
              ? 'bg-[#FFC815] text-black shadow-md'
              : 'text-[#A0A0A5] hover:text-white'
          }`}
        >
          Skills
        </button>
      </div>

      {/* Search Input (Para tabs de listas) */}
      {activeTab !== 'history' && (
        <div className="relative">
          <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Buscar en ${activeTab}...`}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#1C1C1E] border border-white/5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#FFC815]"
          />
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 1: PRs */}
      {/* ======================================================== */}
      {activeTab === 'prs' && (
        <div className="flex flex-col gap-2.5">
          {loadingPRs && prs.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#A0A0A5]">Cargando récords...</div>
          ) : filteredPRs.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#1C1C1E] border border-white/5 text-center">
              <Zap className="w-8 h-8 text-[#FFC815] mx-auto mb-2 opacity-50" />
              <p className="text-sm font-bold text-white">No hay PRs registrados</p>
              <p className="text-xs text-[#A0A0A5] mt-1">
                Toca "+ Nuevo PR" para registrar tu primer récord de fuerza.
              </p>
            </div>
          ) : (
            filteredPRs.map((pr) => (
              <div
                key={pr.id}
                className="p-3.5 rounded-2xl bg-[#1C1C1E] border border-white/5 flex items-center justify-between gap-3 shadow-md tap-bounce"
              >
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#A0A0A5] block">
                    {new Date(pr.date).toLocaleDateString('es-CO', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  <h4 className="text-sm font-black text-white truncate">{pr.movement}</h4>
                  {pr.notes && (
                    <p className="text-[11px] text-[#A0A0A5] truncate mt-0.5">{pr.notes}</p>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className="text-base font-black text-[#FFC815]">
                      {pr.value} {pr.unit || 'kg'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 border-l border-white/10 pl-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPr(pr);
                        setPrModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-white"
                      title="Editar"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`¿Eliminar PR de ${pr.movement}?`)) {
                          deletePR(pr.id);
                        }
                      }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-400"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: BENCHMARKS (WODs) */}
      {/* ======================================================== */}
      {activeTab === 'benchmarks' && (
        <div className="flex flex-col gap-2.5">
          {loadingBenchmarks && benchmarks.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#A0A0A5]">Cargando benchmarks...</div>
          ) : filteredBenchmarks.length === 0 ? (
            <div className="p-8 rounded-2xl bg-[#1C1C1E] border border-white/5 text-center">
              <Timer className="w-8 h-8 text-blue-400 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-bold text-white">No hay benchmarks registrados</p>
              <p className="text-xs text-[#A0A0A5] mt-1">
                Registra tus marcas en Fran, Murph, Cindy y más WODs clásicos.
              </p>
            </div>
          ) : (
            filteredBenchmarks.map((bench) => (
              <div
                key={bench.id}
                className="p-3.5 rounded-2xl bg-[#1C1C1E] border border-white/5 flex items-center justify-between gap-3 shadow-md tap-bounce"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black text-white">{bench.name}</h4>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-[#292929] text-[#FFC815]">
                      {bench.discipline?.toUpperCase() || 'RX'}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#A0A0A5] mt-0.5 block">
                    {new Date(bench.date).toLocaleDateString('es-CO', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-base font-black text-white tracking-tight">
                    {bench.result}
                  </span>

                  <div className="flex items-center gap-1 border-l border-white/10 pl-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBenchmark(bench);
                        setBenchmarkModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-white"
                      title="Editar"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`¿Eliminar benchmark de ${bench.name}?`)) {
                          deleteBenchmark(bench.id);
                        }
                      }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-400"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: HISTÓRICO (GRÁFICAS) */}
      {/* ======================================================== */}
      {activeTab === 'history' && <HistoryChart prs={prs} />}

      {/* ======================================================== */}
      {/* TAB 4: SKILLS */}
      {/* ======================================================== */}
      {activeTab === 'skills' && (
        <div className="flex flex-col gap-2.5">
          <div className="p-3.5 rounded-2xl bg-[#1C1C1E] border border-white/5 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-300">
              Habilidades Desbloqueadas:
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-[#FFC815] text-black">
              {unlocked.length} / {gymnasticMovements.length}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {filteredSkills.map((mov) => {
              const unlockedSkill = isSkillUnlocked(mov.name);
              return (
                <div
                  key={mov.name}
                  onClick={() => handleToggleSkill(mov)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer tap-bounce flex items-center justify-between ${
                    unlockedSkill
                      ? 'bg-[#1C1C1E] border-emerald-500/30 shadow-md'
                      : 'bg-[#1C1C1E]/60 border-white/5 opacity-75'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-black ${
                        unlockedSkill
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-[#292929] text-gray-500'
                      }`}
                    >
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{mov.name}</h4>
                      <span className="text-[10px] uppercase font-bold text-[#A0A0A5]">
                        {CATEGORY_LABELS[mov.category] || mov.category}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-extrabold px-3 py-1 rounded-xl ${
                      unlockedSkill
                        ? 'bg-emerald-500 text-black'
                        : 'bg-[#292929] text-gray-400'
                    }`}
                  >
                    {unlockedSkill ? 'Dominado' : 'Por Lograr'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modales */}
      {prModalOpen && (
        <PRModal
          initialData={selectedPr}
          onClose={() => setPrModalOpen(false)}
          onSuccess={() => fetchPRs(user?.id)}
        />
      )}

      {benchmarkModalOpen && (
        <BenchmarkModal
          initialData={selectedBenchmark}
          onClose={() => setBenchmarkModalOpen(false)}
          onSuccess={() => fetchBenchmarks(user?.id)}
        />
      )}
    </div>
  );
}
