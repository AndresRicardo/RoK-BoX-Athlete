import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import useLeaderboardStore from '../stores/leaderboardStore';
import { formatBenchmarkResult, formatPrValue } from '../utils/format';
import './Leaderboard.css';

const PR_TYPES = {
  strength: 'Fuerza',
  benchmark: 'Tiempo',
  reps: 'Repeticiones',
};

const BENCHMARK_TYPES = {
  for_time: 'For Time',
  amrap: 'AMRAP',
  emom: 'EMOM',
  max: 'Max',
};

const SCALINGS = {
  rx: 'RX',
  scaled: 'Scaled',
  masters: 'Masters',
};

const getPrGroupKey = (row) => `${row.movement}|${row.type}`;
const getBenchmarkGroupKey = (row) =>
  `${row.name}|${row.type}|${row.scaling}|${row.result_unit}`;

function initialsFor(row) {
  const initials = `${row.full_name?.split(' ')[0]?.[0] || ''}${row.full_name?.split(' ').slice(-1)[0]?.[0] || ''}`;
  return initials.toUpperCase() || row.display_name?.[0]?.toUpperCase() || '@';
}

function LeaderRow({ row, kind }) {
  const value = kind === 'prs' ? formatPrValue({
    type: row.type,
    value_numeric: row.value_numeric,
  }) : formatBenchmarkResult({
    result_unit: row.result_unit,
    result_value: row.result_value,
  });

  return (
    <li className={`leaderboard-row ${row.rank <= 3 ? 'leaderboard-row-podium' : ''}`}>
      <span className={`leaderboard-rank leaderboard-rank-${row.rank}`}>
        {row.rank}
      </span>
      <Link to={`/athletes/${row.athlete_id}`} className="leaderboard-athlete">
        <span className="leaderboard-avatar" aria-hidden="true">
          {row.avatar_url ? <img src={row.avatar_url} alt="" /> : initialsFor(row)}
        </span>
        <span className="leaderboard-athlete-info">
          <strong>{row.full_name || row.display_name || 'Atleta'}</strong>
          {row.display_name && <small>@{row.display_name}</small>}
        </span>
      </Link>
      <strong className="leaderboard-value">{value}</strong>
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
    <section className="leaderboard-group">
      <header className="leaderboard-group-header">
        <div>
          <h2>{title}</h2>
          <span>{subtitle}</span>
        </div>
        <span className="leaderboard-group-count">
          {total} {total === 1 ? 'atleta' : 'atletas'}
        </span>
      </header>
      <ol className="leaderboard-list">
        {group.items.map((row) => (
          <LeaderRow key={`${row.athlete_id}-${row.rank}`} row={row} kind={kind} />
        ))}
      </ol>
      {hasMore && (
        <button
          type="button"
          className="leaderboard-more"
          disabled={loadingMore}
          onClick={() => onLoadMore(group)}
        >
          {loadingMore ? 'Cargando...' : 'Ver más'}
        </button>
      )}
    </section>
  );
}

function Leaderboard() {
  const user = useAuthStore((state) => state.user);
  const {
    prs,
    benchmarks,
    scope,
    loading,
    loadingMore,
    error,
    fetchLeaderboards,
    loadMorePr,
    loadMoreBenchmarks,
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

  const handleScopeChange = (nextScope) => {
    setSelectedScope(nextScope);
    setCategoryFilter('all');
  };

  const handleTypeChange = (nextType) => {
    setTypeFilter(nextType);
    setCategoryFilter('all');
  };

  const handleScalingChange = (nextScaling) => {
    setScalingFilter(nextScaling);
    setCategoryFilter('all');
  };

  const groups = useMemo(() => {
    const map = new Map();
    const filtered = rows.filter((row) => {
      if (typeFilter !== 'all' && row.type !== typeFilter) return false;
      if (kind === 'benchmarks' && scalingFilter !== 'all' && row.scaling !== scalingFilter) {
        return false;
      }
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
        await loadMorePr({
          scope,
          movement: first.movement,
          type: first.type,
          limit: nextLimit,
        });
      } else {
        await loadMoreBenchmarks({
          scope,
          name: first.name,
          type: first.type,
          scaling: first.scaling,
          resultUnit: first.result_unit,
          limit: nextLimit,
        });
      }
    } catch {
      // El error queda disponible en el store.
    }
  };

  return (
    <div className="leaderboard-page">
      <header className="leaderboard-header">
        <div>
          <h1>Tablero de líderes</h1>
          <p>Compara los mejores registros de la comunidad.</p>
        </div>
      </header>

      <div className="leaderboard-tabs" role="tablist" aria-label="Tipo de ranking">
        <button
          type="button"
          role="tab"
          aria-selected={kind === 'prs'}
          className={kind === 'prs' ? 'leaderboard-tab-active' : ''}
          onClick={() => handleKindChange('prs')}
        >
          🏋️ PRs
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={kind === 'benchmarks'}
          className={kind === 'benchmarks' ? 'leaderboard-tab-active' : ''}
          onClick={() => handleKindChange('benchmarks')}
        >
          ⏱️ Benchmarks
        </button>
      </div>

      <div className="leaderboard-scope" role="tablist" aria-label="Alcance del ranking">
        <button
          type="button"
          role="tab"
          aria-selected={selectedScope === 'global'}
          className={selectedScope === 'global' ? 'leaderboard-scope-active' : ''}
          onClick={() => handleScopeChange('global')}
        >
          🌎 Global
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={selectedScope === 'following'}
          className={selectedScope === 'following' ? 'leaderboard-scope-active' : ''}
          onClick={() => handleScopeChange('following')}
        >
          👥 Siguiendo
        </button>
      </div>

      <div className="leaderboard-filters">
        <label>
          <span>Tipo</span>
          <select value={typeFilter} onChange={(event) => handleTypeChange(event.target.value)}>
            <option value="all">Todos</option>
            {Object.entries(kind === 'prs' ? PR_TYPES : BENCHMARK_TYPES).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        {kind === 'benchmarks' && (
          <label>
            <span>Scaling</span>
            <select value={scalingFilter} onChange={(event) => handleScalingChange(event.target.value)}>
              <option value="all">Todos</option>
              {Object.entries(SCALINGS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span>{kind === 'prs' ? 'Movimiento' : 'Benchmark'}</span>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">Todos</option>
            {categoryOptions.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      {error && <div className="leaderboard-error">{error}</div>}

      {loading ? (
        <p className="leaderboard-state">Cargando líderes...</p>
      ) : groups.length === 0 ? (
        <div className="leaderboard-empty">
          <span aria-hidden="true">🏆</span>
          <h2>Aún no hay registros</h2>
          <p>Cuando los atletas registren sus marcas aparecerán aquí.</p>
        </div>
      ) : (
        <div className="leaderboard-groups">
          {groups.map((group) => (
            <LeaderboardGroup
              key={group.key}
              group={group}
              kind={kind}
              loadingMore={loadingMore}
              onLoadMore={handleLoadMore}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default Leaderboard;
