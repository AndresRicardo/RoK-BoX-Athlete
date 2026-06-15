import { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import useAuthStore from '../stores/authStore';
import usePRStore from '../stores/prStore';
import useBenchmarkStore from '../stores/benchmarkStore';
import './History.css';

const FILTERS = [
  { value: 'all', label: 'Todos' },
  { value: 'prs', label: 'PRs' },
  { value: 'benchmarks', label: 'Benchmarks' },
];

function formatPRValue(pr) {
  if (pr.type === 'strength') return `${pr.value_numeric} lb`;
  if (pr.type === 'reps') return `${pr.value_numeric} reps`;
  const total = Math.round(pr.value_numeric);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatBenchmarkValue(b) {
  if (b.result_unit === 'time_seconds') {
    const total = Math.round(b.result_value);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  if (b.result_unit === 'rounds_reps') {
    const total = Math.round(b.result_value);
    const r = Math.floor(total / 1000);
    const e = total % 1000;
    if (e === 0) return `${r} rounds`;
    return `${r} + ${e}`;
  }
  return `${Math.round(b.result_value)} reps`;
}

function formatChartValue(value, unit, type) {
  if (unit === 'time_seconds') {
    const total = Math.round(value);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  if (unit === 'rounds_reps') {
    const total = Math.round(value);
    const r = Math.floor(total / 1000);
    const e = total % 1000;
    if (e === 0) return `${r}r`;
    return `${r}+${e}`;
  }
  if (type === 'strength') return `${Math.round(value)} lb`;
  if (type === 'reps' || type === 'emom' || type === 'max' || type === 'amrap') {
    return `${Math.round(value)} reps`;
  }
  return `${Math.round(value)}`;
}

function formatDateShort(dateStr) {
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  });
}

function History() {
  const { user } = useAuthStore();
  const { prs, fetchPRs } = usePRStore();
  const { benchmarks, fetchBenchmarks } = useBenchmarkStore();

  const [filter, setFilter] = useState('all');
  const [manualSelectedKey, setManualSelectedKey] = useState(null);

  useEffect(() => {
    if (user?.id) {
      fetchPRs(user.id);
      fetchBenchmarks(user.id);
    }
  }, [user, fetchPRs, fetchBenchmarks]);

  const prGroups = useMemo(() => {
    const map = new Map();
    for (const pr of prs) {
      const key = `pr|${pr.movement}|${pr.type}`;
      if (!map.has(key)) {
        map.set(key, { key, source: 'prs', label: pr.movement, type: pr.type, items: [] });
      }
      map.get(key).items.push(pr);
    }
    return Array.from(map.values());
  }, [prs]);

  const benchmarkGroups = useMemo(() => {
    const map = new Map();
    for (const b of benchmarks) {
      const key = `b|${b.name}|${b.scaling}|${b.type}|${b.result_unit}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          source: 'benchmarks',
          label: b.name,
          sublabel: b.scaling,
          type: b.type,
          unit: b.result_unit,
          items: [],
        });
      }
      map.get(key).items.push(b);
    }
    return Array.from(map.values());
  }, [benchmarks]);

  const filteredGroups = useMemo(() => {
    if (filter === 'prs') return prGroups;
    if (filter === 'benchmarks') return benchmarkGroups;
    return [...prGroups, ...benchmarkGroups];
  }, [filter, prGroups, benchmarkGroups]);

  const eligibleGroups = useMemo(
    () => filteredGroups.filter((g) => g.items.length >= 2),
    [filteredGroups],
  );

  const activeKey = useMemo(() => {
    if (
      manualSelectedKey &&
      eligibleGroups.some((g) => g.key === manualSelectedKey)
    ) {
      return manualSelectedKey;
    }
    return eligibleGroups[0]?.key || null;
  }, [eligibleGroups, manualSelectedKey]);

  const handleSelectChange = (newKey) => {
    setManualSelectedKey(newKey);
  };

  const selectedGroup = useMemo(
    () => eligibleGroups.find((g) => g.key === activeKey) || null,
    [eligibleGroups, activeKey],
  );

  const chartData = useMemo(() => {
    if (!selectedGroup) return [];
    const sorted = [...selectedGroup.items].sort(
      (a, b) => new Date(a.achieved_at || a.performed_at) - new Date(b.achieved_at || b.performed_at),
    );
    return sorted.map((item) => {
      const date = item.achieved_at || item.performed_at;
      const value = item.value_numeric ?? item.result_value;
      return {
        date,
        value,
        formattedDate: formatDateShort(date),
        formattedValue: selectedGroup.source === 'prs'
          ? formatPRValue(item)
          : formatBenchmarkValue(item),
      };
    });
  }, [selectedGroup]);

  const stats = useMemo(() => {
    if (!selectedGroup || chartData.length === 0) return null;

    const lowerIsBetter = selectedGroup.type === 'for_time';
    const values = chartData.map((p) => p.value);
    const best = lowerIsBetter ? Math.min(...values) : Math.max(...values);
    const bestPoint = chartData.find((p) => p.value === best);
    const first = values[0];
    const last = values[values.length - 1];
    const improved = lowerIsBetter ? last < first : last > first;
    const trend = last === first ? 'flat' : improved ? 'up' : 'down';

    return {
      best: bestPoint.formattedValue,
      bestDate: bestPoint.formattedDate,
      count: chartData.length,
      trend,
    };
  }, [selectedGroup, chartData]);

  const isLowerBetter = selectedGroup?.type === 'for_time';

  return (
    <div className="history-page">
      <div className="history-header">
        <h1>Histórico</h1>
        <p className="history-subtitle">
          Visualiza tu evolución a lo largo del tiempo
        </p>
      </div>

      <div className="history-filters" role="tablist" aria-label="Filtrar">
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

      {eligibleGroups.length === 0 ? (
        <div className="history-empty">
          <h2>Sin datos suficientes</h2>
          <p>
            Necesitas al menos 2 registros del mismo movimiento o WOD para ver
            tu evolución.
          </p>
        </div>
      ) : (
        <>
          <div className="history-selector">
            <label htmlFor="movement-select">Movimiento / WOD</label>
            <select
              id="movement-select"
              value={activeKey || ''}
              onChange={(e) => handleSelectChange(e.target.value)}
            >
              {eligibleGroups.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.source === 'prs' ? g.label : `${g.label} (${g.sublabel})`}
                </option>
              ))}
            </select>
          </div>

          {selectedGroup && (
            <div className="history-card">
              <div className="history-card-header">
                <h2>
                  {selectedGroup.source === 'prs'
                    ? selectedGroup.label
                    : `${selectedGroup.label} (${selectedGroup.sublabel})`}
                </h2>
                <span className={`history-trend history-trend-${stats?.trend}`}>
                  {stats?.trend === 'up' && '↑ Mejorando'}
                  {stats?.trend === 'down' && '↓ Bajando'}
                  {stats?.trend === 'flat' && '→ Estable'}
                </span>
              </div>

              <div className="history-chart">
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart
                    data={chartData}
                    margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid stroke="#585858" strokeDasharray="3 3" opacity={0.3} />
                    <XAxis
                      dataKey="formattedDate"
                      stroke="#FFFFFF"
                      tick={{ fill: '#FFFFFF', fontSize: 12 }}
                      tickLine={{ stroke: '#585858' }}
                    />
                    <YAxis
                      reversed={isLowerBetter}
                      stroke="#FFFFFF"
                      tick={{ fill: '#FFFFFF', fontSize: 12 }}
                      tickLine={{ stroke: '#585858' }}
                      tickFormatter={(v) => formatChartValue(
                        v,
                        selectedGroup.unit,
                        selectedGroup.type,
                      )}
                      width={60}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#292929',
                        border: '2px solid #FFC815',
                        borderRadius: '8px',
                        color: '#FFFFFF',
                      }}
                      labelStyle={{ color: '#FFC815', fontWeight: 700 }}
                      formatter={(value) => [
                        formatChartValue(value, selectedGroup.unit, selectedGroup.type),
                        'Resultado',
                      ]}
                    />
                    <ReferenceLine
                      y={chartData[0]?.value}
                      stroke="#585858"
                      strokeDasharray="4 4"
                      label={{
                        value: 'Inicio',
                        fill: '#585858',
                        fontSize: 11,
                        position: 'insideTopRight',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#FFC815"
                      strokeWidth={3}
                      dot={{ fill: '#FFC815', r: 5 }}
                      activeDot={{ fill: '#FFC815', r: 7, stroke: '#FFFFFF', strokeWidth: 2 }}
                      isAnimationActive
                      animationDuration={400}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {stats && (
                <div className="history-stats">
                  <div className="history-stat">
                    <span className="history-stat-label">Mejor marca</span>
                    <span className="history-stat-value">{stats.best}</span>
                    <span className="history-stat-sub">{stats.bestDate}</span>
                  </div>
                  <div className="history-stat">
                    <span className="history-stat-label">Registros</span>
                    <span className="history-stat-value">{stats.count}</span>
                    <span className="history-stat-sub">totales</span>
                  </div>
                  <div className="history-stat">
                    <span className="history-stat-label">Último</span>
                    <span className="history-stat-value">
                      {chartData[chartData.length - 1].formattedValue}
                    </span>
                    <span className="history-stat-sub">
                      {chartData[chartData.length - 1].formattedDate}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default History;
