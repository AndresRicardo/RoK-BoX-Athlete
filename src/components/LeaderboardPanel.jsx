import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import useLeaderboardStore from '../stores/leaderboardStore';
import { formatBenchmarkResult, formatPrValue } from '../utils/format';

// Port del tablero de líderes de producción (main: src/pages/Leaderboard.jsx).

const PR_TYPES = { strength: 'Fuerza', benchmark: 'Tiempo', reps: 'Repeticiones' };
const BENCHMARK_TYPES = { for_time: 'For Time', amrap: 'AMRAP', emom: 'EMOM', max: 'Max' };
const SCALINGS = { rx: 'RX', scaled: 'Scaled', masters: 'Masters' };

const getPrGroupKey = (row) => `${row.movement}|${row.type}`;
const getBenchmarkGroupKey = (row) => `${row.name}|${row.type}|${row.scaling}|${row.result_unit}`;

function initialsFor(row) {
  const parts = (row.full_name || '').split(' ').filter(Boolean);
  const initials = `${parts[0]?.[0] || ''}${parts.length > 1 ? parts[parts.length - 1][0] : ''}`;
  return initials.toUpperCase() || row.display_name?.[0]?.toUpperCase() || '@';
}

const RANK_STYLES = {
  1: 'bg-[#FFC815] text-black',
  2: 'bg-zinc-300 text-black',
  3: 'bg-amber-700 text-white',
};

function LeaderRow({ row, kind }) {
  const value = kind === 'prs'
    ? formatPrValue({ type: row.type, value_numeric: row.value_numeric })
    : formatBenchmarkResult({ result_unit: row.result_unit, result_value: row.result_value });

  return (
    <li className="flex items-center gap-3 py-2">
      <span className={`w-7 h-7 shrink-0 rounded-lg text-xs font-black flex items-center justify-center ${
        RANK_STYLES[row.rank] || 'bg-[#292929] text-gray-300'
      }`}>
        {row.rank}
      </span>
      <Link to={`/athletes/${row.athlete_id}`} className="flex items-center gap-2.5 flex-1 min-w-0">
        <span className="w-8 h-8 shrink-0 rounded-full bg-[#292929] text-[11px] font-black text-[#FFC815] flex items-center justify-center overflow-hidden">
          {row.avatar_url ? <img src={row.avatar_url} alt="" className="w-full h-full object-cover" /> : initialsFor(row)}
        </span>
        <span className="min-w-0">
          <strong className="text-sm font-bold text-white block truncate">
            {row.full_name || row.display_name || 'Atleta'}
          </strong>
          {row.display_name && <small className="text-[11px] text-[#A0A0A5]">@{row.display_name}</small>}
        </span>
      </Link>
      <strong className="text-sm font-black text-white shrink-0">{value}</strong>
    </li>
  );
}

function LeaderboardGroup({ group, kind, loadingMore, onLoadMore }) {
  const first = group.items[0];
  const total = Number(first?.total_count || group.items.length);
  const hasMore = group.items.length < total;
  const title = kind === 'prs' ? first.movement : first.name;
  const subtitle = kind === 'prs'
    ? PR_TYPES[first.type]
    : `${BENCHMARK_TYPES[first.type] || first.type} · ${SCALINGS[first.scaling] || first.scaling || 'RX'}`;

  return (
    <section className="p-4 rounded-2xl bg-[#1C1C1E] border border-white/5">
      <header className="flex items-start justify-between gap-2 pb-2 border-b border-white/5">
        <div>
          <h3 className="text-sm font-black text-[#FFC815]">{title}</h3>
          <span className="text-[11px] text-[#A0A0A5]">{subtitle}</span>
        </div>
        <span className="text-[10px] font-bold uppercase text-gray-400 shrink-0">
          {total} {total === 1 ? 'atleta' : 'atletas'}
        </span>
      </header>
      <ol className="divide-y divide-white/5">
        {group.items.map((row) => (
          <LeaderRow key={`${row.athlete_id}-${row.rank}`} row={row} kind={kind} />
        ))}
      </ol>
      {hasMore && (
        <button
          type="button"
          disabled={loadingMore}
          onClick={() => onLoadMore(group)}
          className="mt-2 w-full py-2 rounded-xl bg-[#292929] text-xs font-bold text-[#FFC815] tap-bounce disabled:opacity-50"
        >
          {loadingMore ? 'Cargando...' : 'Ver más'}
        </button>
      )}
    </section>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <div className="flex p-1 rounded-xl bg-[#1C1C1E] border border-white/5">
      {options.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`flex-1 py-1.5 rounded-lg text-xs font-black transition-colors ${
            value === key ? 'bg-white text-black' : 'text-gray-400'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function FilterSelect({ label, value, onChange, children }) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-[10px] font-bold uppercase tracking-wider text-[#A0A0A5]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-2 rounded-xl bg-[#1C1C1E] border border-white/10 text-xs font-bold text-white focus:outline-none focus:border-[#FFC815]"
      >
        {children}
      </select>
    </label>
  );
}

export default function LeaderboardPanel() {
  const user = useAuthStore((state) => state.user);
  const {
    prs, benchmarks, scope, loading, loadingMore, error,
    fetchLeaderboards, loadMorePr, loadMoreBenchmarks,
  } = useLeaderboardStore();
  const [kind, setKind] = useState('prs');
  const [selectedScope, setSelectedScope] = useState('global');
  const [typeFilter, setTypeFilter] = useState('all');
  const [scalingFilter, setScalingFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    if (user?.id) {
      fetchLeaderboards(selectedScope).catch(() => {});
    }
  }, [user?.id, selectedScope, fetchLeaderboards]);

  const rows = kind === 'prs' ? prs : benchmarks;

  const handleKindChange = (nextKind) => {
    setKind(nextKind);
    setTypeFilter('all');
    setScalingFilter('all');
    setCategoryFilter('all');
  };

  const groups = useMemo(() => {
    const map = new Map();
    const filtered = rows.filter((row) => {
      if (typeFilter !== 'all' && row.type !== typeFilter) return false;
      if (kind === 'benchmarks' && scalingFilter !== 'all' && row.scaling !== scalingFilter) return false;
      if (categoryFilter !== 'all') {
        const key = kind === 'prs' ? getPrGroupKey(row) : getBenchmarkGroupKey(row);
        if (key !== categoryFilter) return false;
      }
      return true;
    });

    for (const row of filtered) {
      const key = kind === 'prs' ? getPrGroupKey(row) : getBenchmarkGroupKey(row);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }

    return Array.from(map.entries())
      .map(([key, items]) => ({ key, items }))
      .sort((a, b) => {
        const aName = kind === 'prs' ? a.items[0].movement : a.items[0].name;
        const bName = kind === 'prs' ? b.items[0].movement : b.items[0].name;
        return aName.localeCompare(bName, 'es');
      });
  }, [rows, kind, typeFilter, scalingFilter, categoryFilter]);

  const categoryOptions = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      const key = kind === 'prs' ? getPrGroupKey(row) : getBenchmarkGroupKey(row);
      if (!map.has(key)) {
        map.set(key, kind === 'prs'
          ? `${row.movement} · ${PR_TYPES[row.type]}`
          : `${row.name} · ${SCALINGS[row.scaling] || row.scaling || 'RX'}`);
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], 'es'));
  }, [rows, kind]);

  const handleLoadMore = async (group) => {
    const first = group.items[0];
    const nextLimit = group.items.length + 10;
    try {
      if (kind === 'prs') {
        await loadMorePr({ scope, movement: first.movement, type: first.type, limit: nextLimit });
      } else {
        await loadMoreBenchmarks({
          scope, name: first.name, type: first.type, scaling: first.scaling,
          resultUnit: first.result_unit, limit: nextLimit,
        });
      }
    } catch {
      // El error queda disponible en el store.
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Segmented
        options={[['prs', '🏋️ PRs'], ['benchmarks', '⏱️ Benchmarks']]}
        value={kind}
        onChange={handleKindChange}
      />
      <Segmented
        options={[['global', '🌎 Global'], ['following', '👥 Siguiendo']]}
        value={selectedScope}
        onChange={(v) => { setSelectedScope(v); setCategoryFilter('all'); }}
      />

      <div className={`grid gap-2 ${kind === 'benchmarks' ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <FilterSelect label="Tipo" value={typeFilter} onChange={(v) => { setTypeFilter(v); setCategoryFilter('all'); }}>
          <option value="all">Todos</option>
          {Object.entries(kind === 'prs' ? PR_TYPES : BENCHMARK_TYPES).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </FilterSelect>
        {kind === 'benchmarks' && (
          <FilterSelect label="Scaling" value={scalingFilter} onChange={(v) => { setScalingFilter(v); setCategoryFilter('all'); }}>
            <option value="all">Todos</option>
            {Object.entries(SCALINGS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </FilterSelect>
        )}
        <FilterSelect label={kind === 'prs' ? 'Movimiento' : 'Benchmark'} value={categoryFilter} onChange={setCategoryFilter}>
          <option value="all">Todos</option>
          {categoryOptions.map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </FilterSelect>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{error}</div>
      )}

      {loading ? (
        <div className="p-8 text-center text-xs text-[#A0A0A5]">Cargando líderes...</div>
      ) : groups.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[#1C1C1E] border border-white/5 text-center">
          <Trophy className="w-8 h-8 text-[#FFC815] mx-auto mb-2 opacity-50" />
          <p className="text-sm font-bold text-white">Aún no hay registros</p>
          <p className="text-xs text-[#A0A0A5] mt-1">Cuando los atletas registren sus marcas aparecerán aquí.</p>
        </div>
      ) : (
        groups.map((group) => (
          <LeaderboardGroup
            key={group.key}
            group={group}
            kind={kind}
            loadingMore={loadingMore}
            onLoadMore={handleLoadMore}
          />
        ))
      )}
    </div>
  );
}
